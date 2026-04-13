// Nearfolk Neighborhood Memory
//
// Full RimWorld-style mood + relationship + thought system,
// inverted for the architecture of kindness.
//
// Key systems:
// 1. Stacking thoughts with decay (not a single contentment number)
// 2. Named social interactions (garden chat, porch coffee, etc.)
// 3. View quality per cottage (what the porch can see)
// 4. Relationship strength between pairs
// 5. Beat history for Director arc detection
// 6. Inspiration triggers from high contentment
//
// Pure data. No Three.js. Persists to localStorage.

const STORAGE_KEY = 'nearfolk_memory';

export function createMemory() {
  return {
    days: 0,
    thoughts: {},         // residentId -> array of { reason, value, decayDays, day }
    relationships: {},    // "idA:idB" -> { strength, interactions: [] }
    beatHistory: [],
    journal: [],
    condition: null,      // current environmental condition
    encounters: [],       // last settle's named encounters
  };
}

function pairKey(idA, idB) {
  return [idA, idB].sort().join(':');
}

// ─── Thought system ───
// Each thought has: reason (string), value (+/-), decayDays (how long it lasts), day (when added)

export function addThought(memory, residentId, reason, value, decayDays) {
  const thoughts = memory.thoughts[residentId] || [];
  // Don't stack duplicate ongoing reasons
  const existing = thoughts.find(t => t.reason === reason && t.decayDays === -1);
  if (existing) {
    existing.value = value; // Update ongoing thought
    return { ...memory, thoughts: { ...memory.thoughts, [residentId]: [...thoughts] } };
  }
  return {
    ...memory,
    thoughts: {
      ...memory.thoughts,
      [residentId]: [...thoughts, { reason, value, decayDays, day: memory.days }],
    },
  };
}

export function decayThoughts(memory) {
  const newThoughts = {};
  for (const [id, thoughts] of Object.entries(memory.thoughts)) {
    newThoughts[id] = thoughts.filter(t => {
      if (t.decayDays === -1) return true; // Ongoing, doesn't decay
      return (memory.days - t.day) < t.decayDays;
    });
  }
  return { ...memory, thoughts: newThoughts };
}

export function getContentment(memory, residentId) {
  const thoughts = memory.thoughts[residentId] || [];
  const sum = thoughts.reduce((acc, t) => acc + t.value, 0);
  return Math.max(0, Math.min(100, 50 + sum)); // Base 50 + thoughts
}

export function getThoughts(memory, residentId) {
  return memory.thoughts[residentId] || [];
}

export function getLowestContentment(memory, residentIds) {
  let lowest = null;
  let lowestVal = 101;
  for (const id of residentIds) {
    const val = getContentment(memory, id);
    if (val < lowestVal) { lowestVal = val; lowest = id; }
  }
  return { id: lowest, contentment: lowestVal };
}

// ─── View quality ───
// Computed from what a cottage's porch can see (raycasted in scoring.js)

export const VIEW_SOURCES = {
  COMMONS: { value: 3, reason: 'Commons view' },
  GARDEN: { value: 2, reason: 'Garden view' },
  FIREPIT: { value: 1, reason: 'Fire pit view' },
  PORCH: { value: 2, reason: 'Neighbor visible' },
  TREE: { value: 1, reason: 'Tree view' },
  BLANK_WALL: { value: -2, reason: 'Facing a wall' },
  EDGE: { value: -1, reason: 'Facing the edge' },
  NOTHING: { value: -5, reason: 'Facing nothing' },
};

export function setViewThoughts(memory, residentId, viewSources) {
  // Remove old view thoughts
  let thoughts = (memory.thoughts[residentId] || []).filter(t => !t.reason.endsWith('view') && !t.reason.startsWith('Facing') && !t.reason.startsWith('Neighbor') && !t.reason.startsWith('Commons') && !t.reason.startsWith('Garden') && !t.reason.startsWith('Fire pit') && !t.reason.startsWith('Tree'));

  // Add new view thoughts (ongoing, decay = -1)
  for (const src of viewSources) {
    const info = VIEW_SOURCES[src];
    if (info) {
      thoughts.push({ reason: info.reason, value: info.value, decayDays: -1, day: memory.days });
    }
  }

  return { ...memory, thoughts: { ...memory.thoughts, [residentId]: thoughts } };
}

// ─── Named social interactions ───

export const INTERACTION_TYPES = {
  GARDEN_CHAT: { name: 'garden chat', value: 3, emoji: '🌱' },
  MORNING_WAVE: { name: 'morning wave', value: 2, emoji: '👋' },
  FIRE_PIT_STORY: { name: 'fire pit story', value: 5, emoji: '🔥' },
  PORCH_COFFEE: { name: 'porch coffee', value: 4, emoji: '☕' },
  PASSING_HELLO: { name: 'passing hello', value: 1, emoji: '🚶' },
  BENCH_CHAT: { name: 'bench chat', value: 2, emoji: '💬' },
};

export function recordInteraction(memory, residentA, residentB, type, day) {
  const pk = pairKey(residentA, residentB);
  const rel = memory.relationships[pk] || { strength: 0, interactions: [] };
  const interactionInfo = INTERACTION_TYPES[type] || { name: type, value: 1 };

  const newRel = {
    strength: rel.strength + interactionInfo.value,
    interactions: [...rel.interactions, { type, day, nameA: residentA, nameB: residentB }].slice(-20),
  };

  // Add thoughts to both residents
  let mem = { ...memory, relationships: { ...memory.relationships, [pk]: newRel } };
  mem = addThought(mem, residentA, interactionInfo.name, interactionInfo.value, 3);
  mem = addThought(mem, residentB, interactionInfo.name, interactionInfo.value, 3);

  // Track encounter
  const encounter = { residentA, residentB, type: interactionInfo.name, emoji: interactionInfo.emoji, day };
  mem = { ...mem, encounters: [...(mem.encounters || []), encounter] };

  return mem;
}

// ─── Relationships ───

export function getRelationshipStrength(memory, idA, idB) {
  const rel = memory.relationships[pairKey(idA, idB)];
  return rel ? rel.strength : 0;
}

export function getFriendPairs(memory, minStrength = 3) {
  const pairs = [];
  for (const [pk, rel] of Object.entries(memory.relationships)) {
    if (rel.strength >= minStrength) {
      const [a, b] = pk.split(':');
      pairs.push({ a, b, strength: rel.strength });
    }
  }
  return pairs;
}

// ─── Beat history ───

export function recordBeat(memory, beat, score, residentCount) {
  const beatRecord = {
    day: memory.days + 1,
    beatId: beat.id,
    subjectId: beat.subjectId || null,
    helperId: beat.helperId || null,
    caption: beat.caption,
    score,
  };

  const journalEntry = {
    date: new Date().toISOString().split('T')[0],
    day: memory.days + 1,
    beatName: beat.name,
    caption: beat.caption,
    score,
    residentCount,
    encounterCount: (memory.encounters || []).length,
    encounters: (memory.encounters || []).slice(0, 5).map(e =>
      `${e.emoji} ${e.type}`
    ),
  };

  return {
    ...memory,
    days: memory.days + 1,
    beatHistory: [...memory.beatHistory, beatRecord].slice(-30),
    journal: [...memory.journal, journalEntry].slice(-60),
    encounters: [], // Reset for next day
  };
}

export function daysSinceBeat(memory, beatId) {
  for (let i = memory.beatHistory.length - 1; i >= 0; i--) {
    if (memory.beatHistory[i].beatId === beatId) {
      return memory.days - memory.beatHistory[i].day;
    }
  }
  return 99;
}

export function lastBeatSubject(memory, beatId) {
  for (let i = memory.beatHistory.length - 1; i >= 0; i--) {
    if (memory.beatHistory[i].beatId === beatId) {
      return memory.beatHistory[i].subjectId;
    }
  }
  return null;
}

// ─── Inspirations ───
// When contentment >= 80, check for trait-specific inspiration

export function checkInspirations(memory, residents) {
  const inspirations = [];
  for (const r of residents) {
    const c = getContentment(memory, r.id);
    if (c >= 80) {
      const inspiration = {
        residentId: r.id,
        trait: r.traitKey,
        contentment: c,
      };
      if (r.traitKey === 'HOST') inspiration.beat = 'OPEN_HOUSE';
      else if (r.traitKey === 'GARDENER') inspiration.beat = 'HARVEST_FESTIVAL';
      else if (r.traitKey === 'STORYTELLER') inspiration.beat = 'BLOCK_STORY';
      else inspiration.beat = 'THE_WAVE';
      inspirations.push(inspiration);
    }
  }
  return inspirations;
}

// ─── Environmental conditions ───

export const CONDITIONS = {
  SUNNY: { name: 'Sunny day', modifiers: {} },
  RAINY: { name: 'Rainy morning', modifiers: { PORCH: 2, FIREPIT: 0 }, visual: 'rain' },
  HEATWAVE: { name: 'Heatwave', modifiers: { TREE: 2, BENCH: 2, FIREPIT: -1 }, visual: 'heat' },
  FROST: { name: 'First frost', modifiers: { FIREPIT: 3, GARDEN: -1 }, visual: 'frost' },
  BLOCK_PARTY: { name: 'Block party', modifiers: { COMMONS: 2 }, visual: 'party' },
  FESTIVAL: { name: 'Festival week', modifiers: {}, visual: 'festival', bonusPieces: 2 },
};

export function rollCondition(seedRandom) {
  const keys = Object.keys(CONDITIONS);
  const idx = Math.floor(seedRandom() * keys.length);
  return keys[idx];
}

// ─── Lonely penalty ───

export function applyLonelyPenalty(memory, lonelyIds) {
  let mem = memory;
  for (const id of lonelyIds) {
    mem = addThought(mem, id, 'Lonely day', -15, 2);
  }
  return mem;
}

export function applyIdlePenalty(memory, allIds, activeIds) {
  let mem = memory;
  const activeSet = new Set(activeIds);
  for (const id of allIds) {
    if (!activeSet.has(id)) {
      mem = addThought(mem, id, 'Quiet day', -3, 1);
    }
  }
  return mem;
}

// ─── Init ───

export function initResident(memory, residentId) {
  return {
    ...memory,
    thoughts: {
      ...memory.thoughts,
      [residentId]: [{ reason: 'Moved in', value: 5, decayDays: 3, day: memory.days }],
    },
  };
}

// ─── Persistence ───

export function saveMemory(memory) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch {}
}

export function loadMemory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      // Migrate old format
      if (parsed.contentment && !parsed.thoughts) {
        return createMemory(); // Reset if old format
      }
      return parsed;
    }
  } catch {}
  return createMemory();
}
