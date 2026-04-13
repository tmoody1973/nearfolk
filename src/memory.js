// Nearfolk Neighborhood Memory
//
// Persistent state that tracks the neighborhood's social history.
// The Director reads this to tell stories that chain across days.
// Inspired by RimWorld's colonist mood + relationship system,
// inverted for kindness.
//
// Pure data. No Three.js. Persists to localStorage.

const STORAGE_KEY = 'nearfolk_memory';

// Contentment rules:
//   Start at 50
//   +10 per encounter during settle
//   +5 per eye-contact sightline
//   -15 if lonely (no encounters, no sightlines)
//   -5 per round with no encounters
//   Capped 0-100

export function createMemory() {
  return {
    days: 0,
    contentment: {},      // residentId -> number (0-100)
    relationships: {},    // "idA:idB" -> number (encounter count)
    beatHistory: [],      // array of { day, beatId, subjectId, helperId, caption, score }
    journal: [],          // array of { date, day, beatName, caption, score, residentCount }
  };
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join(':');
}

// Initialize contentment for a new resident
export function initResident(memory, residentId) {
  return {
    ...memory,
    contentment: { ...memory.contentment, [residentId]: 50 },
  };
}

// Update memory after a settle round
// encounters: array of { residentA, residentB } pairs that met
// sightlines: array of { fromId, toId } eye-contact pairs
// lonelyIds: array of resident IDs with zero connections
// beat: { id, name, subjectId, helperId, caption }
// score: number
export function recordDay(memory, encounters, sightlines, lonelyIds, beat, score, residentCount) {
  const newContentment = { ...memory.contentment };
  const newRelationships = { ...memory.relationships };
  const day = memory.days + 1;

  // Track who had any encounters
  const hadEncounter = new Set();

  // Process encounters: boost contentment + relationship
  for (const enc of encounters) {
    hadEncounter.add(enc.residentA);
    hadEncounter.add(enc.residentB);

    // Contentment boost
    newContentment[enc.residentA] = Math.min(100,
      (newContentment[enc.residentA] || 50) + 10);
    newContentment[enc.residentB] = Math.min(100,
      (newContentment[enc.residentB] || 50) + 10);

    // Relationship strength
    const pk = pairKey(enc.residentA, enc.residentB);
    newRelationships[pk] = (newRelationships[pk] || 0) + 1;
  }

  // Process sightlines: small contentment boost
  for (const sl of sightlines) {
    hadEncounter.add(sl.fromId);
    hadEncounter.add(sl.toId);
    newContentment[sl.fromId] = Math.min(100,
      (newContentment[sl.fromId] || 50) + 5);
    newContentment[sl.toId] = Math.min(100,
      (newContentment[sl.toId] || 50) + 5);
  }

  // Beat participants get bonus
  if (beat.subjectId) {
    hadEncounter.add(beat.subjectId);
    newContentment[beat.subjectId] = Math.min(100,
      (newContentment[beat.subjectId] || 50) + 10);
  }
  if (beat.helperId) {
    hadEncounter.add(beat.helperId);
    newContentment[beat.helperId] = Math.min(100,
      (newContentment[beat.helperId] || 50) + 10);
    // Beat participants build relationship
    if (beat.subjectId) {
      const pk = pairKey(beat.subjectId, beat.helperId);
      newRelationships[pk] = (newRelationships[pk] || 0) + 3;
    }
  }

  // Lonely residents lose contentment
  for (const id of lonelyIds) {
    if (!hadEncounter.has(id)) {
      newContentment[id] = Math.max(0,
        (newContentment[id] || 50) - 15);
    }
  }

  // Anyone not in any encounter loses a small amount
  for (const id of Object.keys(newContentment)) {
    if (!hadEncounter.has(id)) {
      newContentment[id] = Math.max(0, newContentment[id] - 5);
    }
  }

  // Relationship decay (every 5 days, -1 for pairs with no recent encounter)
  if (day % 5 === 0) {
    for (const pk of Object.keys(newRelationships)) {
      // Only decay if not active this round
      const [a, b] = pk.split(':');
      const wasActive = encounters.some(e =>
        pairKey(e.residentA, e.residentB) === pk
      );
      if (!wasActive && newRelationships[pk] > 0) {
        newRelationships[pk] = Math.max(0, newRelationships[pk] - 1);
      }
    }
  }

  // Record beat
  const beatRecord = {
    day,
    beatId: beat.id,
    subjectId: beat.subjectId || null,
    helperId: beat.helperId || null,
    caption: beat.caption,
    score,
  };

  // Journal entry
  const journalEntry = {
    date: new Date().toISOString().split('T')[0],
    day,
    beatName: beat.name,
    caption: beat.caption,
    score,
    residentCount,
  };

  return {
    days: day,
    contentment: newContentment,
    relationships: newRelationships,
    beatHistory: [...memory.beatHistory, beatRecord].slice(-30), // keep last 30
    journal: [...memory.journal, journalEntry].slice(-60), // keep last 60
  };
}

// Query helpers for the Director
export function daysSinceBeat(memory, beatId) {
  for (let i = memory.beatHistory.length - 1; i >= 0; i--) {
    if (memory.beatHistory[i].beatId === beatId) {
      return memory.days - memory.beatHistory[i].day;
    }
  }
  return 99; // never fired
}

export function lastBeatSubject(memory, beatId) {
  for (let i = memory.beatHistory.length - 1; i >= 0; i--) {
    if (memory.beatHistory[i].beatId === beatId) {
      return memory.beatHistory[i].subjectId;
    }
  }
  return null;
}

export function getRelationshipStrength(memory, idA, idB) {
  return memory.relationships[pairKey(idA, idB)] || 0;
}

export function getFriendPairs(memory, minStrength = 3) {
  const pairs = [];
  for (const [pk, strength] of Object.entries(memory.relationships)) {
    if (strength >= minStrength) {
      const [a, b] = pk.split(':');
      pairs.push({ a, b, strength });
    }
  }
  return pairs;
}

export function getContentment(memory, residentId) {
  return memory.contentment[residentId] ?? 50;
}

export function getLowestContentment(memory, residentIds) {
  let lowest = null;
  let lowestVal = 101;
  for (const id of residentIds) {
    const val = memory.contentment[id] ?? 50;
    if (val < lowestVal) {
      lowestVal = val;
      lowest = id;
    }
  }
  return { id: lowest, contentment: lowestVal };
}

// Persistence
export function saveMemory(memory) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Private mode
  }
}

export function loadMemory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // Corrupted or private mode
  }
  return createMemory();
}
