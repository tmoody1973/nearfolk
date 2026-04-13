// Nearfolk settle animation
//
// When the player presses Settle:
// 1. Director picks a beat (with memory)
// 2. Beat choreography overrides specific resident paths
// 3. 25-second dawn-to-dusk animation plays
// 4. Residents walk routines, encounters happen VISIBLY
// 5. Story card appears
//
// The settle SHOWS the story. If the Director picks "The Check-In,"
// the player literally sees the Host walk to the lonely resident's porch.

import { runDirector } from './director.js';
import { GRID_SIZE, PIECE_SIZES } from './state.js';

// Duration scales with cottage count: min 10s, max 25s
function getSettleDuration(cottageCount) {
  return Math.max(10, Math.min(25, cottageCount * 5));
}
const halfGrid = GRID_SIZE / 2;

const PHASES = [
  { name: 'morning', start: 0, end: 0.25 },
  { name: 'midday', start: 0.25, end: 0.5 },
  { name: 'afternoon', start: 0.5, end: 0.75 },
  { name: 'evening', start: 0.75, end: 1.0 },
];

function cottagePos(pieces, cottageId) {
  const c = pieces.find(p => p.id === cottageId);
  if (!c) return { x: 0, z: 0 };
  return {
    x: c.x - halfGrid + PIECE_SIZES.COTTAGE.w / 2,
    z: c.z - halfGrid + PIECE_SIZES.COTTAGE.h / 2,
  };
}

function findPiecePos(pieces, type) {
  const p = pieces.find(pp => pp.type === type);
  if (!p) return null;
  return {
    x: p.x - halfGrid + PIECE_SIZES[p.type].w / 2,
    z: p.z - halfGrid + PIECE_SIZES[p.type].h / 2,
  };
}

function nearestPiecePos(pieces, type, fromX, fromZ) {
  const candidates = pieces.filter(p => p.type === type);
  if (candidates.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const tx = c.x - halfGrid + PIECE_SIZES[c.type].w / 2;
    const tz = c.z - halfGrid + PIECE_SIZES[c.type].h / 2;
    const d = Math.abs(tx - fromX) + Math.abs(tz - fromZ);
    if (d < bestDist) { bestDist = d; best = { x: tx, z: tz }; }
  }
  return best;
}

// ─── Beat choreography functions ───
// Each returns a map of residentId -> custom waypoints
// Residents NOT in the map get generic routines

const CHOREOGRAPHY = {
  CHECK_IN(dirResult, residents, pieces) {
    const overrides = {};
    const subject = residents.find(r => r.id === dirResult.subjectId);
    const helper = residents.find(r => r.id === dirResult.helperId);
    if (!subject || !helper) return overrides;

    const subjectHome = cottagePos(pieces, subject.cottageId);
    const helperHome = cottagePos(pieces, helper.cottageId);

    // Helper walks to subject's porch in the afternoon, pauses, both walk to commons
    overrides[helper.id] = [
      { ...helperHome, t: 0 },
      { ...nearestPiecePos(pieces, 'MAILBOX', helperHome.x, helperHome.z) || helperHome, t: 0.2 },
      { ...helperHome, t: 0.4 },
      { x: subjectHome.x + 0.3, z: subjectHome.z + 0.3, t: 0.55 }, // Walk to subject's porch
      { x: subjectHome.x + 0.3, z: subjectHome.z + 0.3, t: 0.7 },  // Pause (the moment)
      { x: 0, z: 0, t: 0.85 },  // Walk to commons together
      { ...helperHome, t: 1.0 },
    ];
    overrides[subject.id] = [
      { ...subjectHome, t: 0 },
      { ...subjectHome, t: 0.55 },   // Stays home until helper arrives
      { ...subjectHome, t: 0.7 },    // Pause together
      { x: 0.3, z: 0, t: 0.85 },    // Walk to commons together
      { ...subjectHome, t: 1.0 },
    ];
    return overrides;
  },

  POTLUCK(dirResult, residents, pieces) {
    const overrides = {};
    // Everyone converges at commons in the evening
    for (const r of residents) {
      const home = cottagePos(pieces, r.cottageId);
      const garden = nearestPiecePos(pieces, 'GARDEN', home.x, home.z);
      const offset = (Math.random() - 0.5) * 1.5;
      overrides[r.id] = [
        { ...home, t: 0 },
        { ...(garden || home), t: 0.3 },
        { ...(garden || home), t: 0.5 },
        { x: offset, z: offset * 0.5, t: 0.65 }, // Converge at commons
        { x: offset, z: offset * 0.5, t: 0.9 },  // Stay (the potluck)
        { ...home, t: 1.0 },
      ];
    }
    return overrides;
  },

  GARDEN_CLUB(dirResult, residents, pieces) {
    const overrides = {};
    const subject = residents.find(r => r.id === dirResult.subjectId);
    const helper = residents.find(r => r.id === dirResult.helperId);
    if (!subject) return overrides;

    const garden = findPiecePos(pieces, 'GARDEN') || { x: 0, z: 0 };
    const subjectHome = cottagePos(pieces, subject.cottageId);

    overrides[subject.id] = [
      { ...subjectHome, t: 0 },
      { x: garden.x - 0.3, z: garden.z, t: 0.25 },  // Walk to garden
      { x: garden.x - 0.3, z: garden.z, t: 0.7 },    // Stay (gardening)
      { ...subjectHome, t: 1.0 },
    ];

    if (helper) {
      const helperHome = cottagePos(pieces, helper.cottageId);
      overrides[helper.id] = [
        { ...helperHome, t: 0 },
        { x: garden.x + 0.3, z: garden.z, t: 0.3 },  // Arrive slightly later
        { x: garden.x + 0.3, z: garden.z, t: 0.7 },   // Side by side
        { ...helperHome, t: 1.0 },
      ];
    }
    return overrides;
  },

  STORYTELLERS_PORCH(dirResult, residents, pieces) {
    const overrides = {};
    const teller = residents.find(r => r.id === dirResult.subjectId);
    if (!teller) return overrides;

    const tellerHome = cottagePos(pieces, teller.cottageId);
    // Teller stays on porch. 2 others walk to them at sunset
    overrides[teller.id] = [
      { ...tellerHome, t: 0 },
      { ...tellerHome, t: 1.0 }, // Never leaves
    ];

    const others = residents.filter(r => r.id !== teller.id).slice(0, 2);
    others.forEach((r, i) => {
      const home = cottagePos(pieces, r.cottageId);
      overrides[r.id] = [
        { ...home, t: 0 },
        { ...(nearestPiecePos(pieces, 'BENCH', home.x, home.z) || home), t: 0.3 },
        { x: tellerHome.x + (i === 0 ? 0.4 : -0.4), z: tellerHome.z + 0.5, t: 0.65 },
        { x: tellerHome.x + (i === 0 ? 0.4 : -0.4), z: tellerHome.z + 0.5, t: 0.9 },
        { ...home, t: 1.0 },
      ];
    });
    return overrides;
  },

  DUSK_FIRE(dirResult, residents, pieces) {
    const overrides = {};
    const firepit = findPiecePos(pieces, 'FIREPIT');
    if (!firepit) return overrides;

    // Everyone converges at fire pit in the evening
    residents.forEach((r, i) => {
      const home = cottagePos(pieces, r.cottageId);
      const angle = (i / residents.length) * Math.PI * 2;
      const radius = 0.6;
      overrides[r.id] = [
        { ...home, t: 0 },
        { ...(nearestPiecePos(pieces, 'PATH', home.x, home.z) || home), t: 0.4 },
        { x: firepit.x + Math.cos(angle) * radius, z: firepit.z + Math.sin(angle) * radius, t: 0.7 },
        { x: firepit.x + Math.cos(angle) * radius, z: firepit.z + Math.sin(angle) * radius, t: 0.95 },
        { ...home, t: 1.0 },
      ];
    });
    return overrides;
  },

  MORNING_WAVE(dirResult, residents, pieces) {
    const overrides = {};
    const bird = residents.find(r => r.traitKey === 'EARLY_BIRD');
    if (!bird) return overrides;

    const birdHome = cottagePos(pieces, bird.cottageId);
    const mailbox = findPiecePos(pieces, 'MAILBOX');
    if (!mailbox) return overrides;

    const other = residents.find(r => r.id !== bird.id);
    overrides[bird.id] = [
      { ...birdHome, t: 0 },
      { ...mailbox, t: 0.1 },   // At mailbox early
      { ...mailbox, t: 0.25 },  // Lingers
      { ...birdHome, t: 0.4 },
      { ...birdHome, t: 1.0 },
    ];

    if (other) {
      const otherHome = cottagePos(pieces, other.cottageId);
      overrides[other.id] = [
        { ...otherHome, t: 0 },
        { x: mailbox.x + 0.3, z: mailbox.z, t: 0.15 }, // Arrives at mailbox
        { x: mailbox.x + 0.3, z: mailbox.z, t: 0.25 },  // Brief encounter
        { ...otherHome, t: 0.4 },
        { ...otherHome, t: 1.0 },
      ];
    }
    return overrides;
  },
};

// Generic walk target for residents without choreography overrides
function pickGenericTarget(resident, pieces, phase) {
  const cottage = pieces.find(p => p.id === resident.cottageId);
  if (!cottage) return null;

  const cx = cottage.x - halfGrid + PIECE_SIZES.COTTAGE.w / 2;
  const cz = cottage.z - halfGrid + PIECE_SIZES.COTTAGE.h / 2;

  const targetTypes = {
    morning: ['MAILBOX', 'PATH'],
    midday: ['GARDEN', 'BENCH'],
    afternoon: ['BENCH', 'GARDEN', 'PATH'],
    evening: ['FIREPIT', 'PATH'],
  };

  const preferred = targetTypes[phase] || ['PATH'];
  return nearestPiecePos(pieces, preferred[0], cx, cz) ||
         nearestPiecePos(pieces, preferred[1], cx, cz) ||
         { x: 0, z: 0 };
}

// Build timeline with beat choreography overrides
function buildTimeline(residents, pieces, grid, dirResult) {
  const choreographyFn = CHOREOGRAPHY[dirResult.beat.id];
  const overrides = choreographyFn
    ? choreographyFn(dirResult, residents, pieces)
    : {};

  const timeline = [];

  for (const resident of residents) {
    // If this resident has choreography overrides, use them
    if (overrides[resident.id]) {
      timeline.push({ resident, waypoints: overrides[resident.id] });
      continue;
    }

    // Otherwise, generic routine
    const cottage = pieces.find(p => p.id === resident.cottageId);
    if (!cottage) continue;

    const homeX = cottage.x - halfGrid + PIECE_SIZES.COTTAGE.w / 2;
    const homeZ = cottage.z - halfGrid + PIECE_SIZES.COTTAGE.h / 2;

    const waypoints = [{ x: homeX, z: homeZ, t: 0 }];

    for (const phase of PHASES) {
      const target = pickGenericTarget(resident, pieces, phase.name);
      if (target) {
        waypoints.push({ ...target, t: phase.start + 0.05 });
        waypoints.push({ ...target, t: phase.end - 0.05 });
      }
    }

    waypoints.push({ x: homeX, z: homeZ, t: 1.0 });
    timeline.push({ resident, waypoints });
  }

  return timeline;
}

function interpolatePosition(waypoints, t) {
  if (waypoints.length === 0) return { x: 0, z: 0 };
  if (t <= waypoints[0].t) return { x: waypoints[0].x, z: waypoints[0].z };
  if (t >= waypoints[waypoints.length - 1].t) {
    const last = waypoints[waypoints.length - 1];
    return { x: last.x, z: last.z };
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    if (t >= waypoints[i].t && t < waypoints[i + 1].t) {
      const segT = (t - waypoints[i].t) / (waypoints[i + 1].t - waypoints[i].t);
      return {
        x: waypoints[i].x + (waypoints[i + 1].x - waypoints[i].x) * segT,
        z: waypoints[i].z + (waypoints[i + 1].z - waypoints[i].z) * segT,
      };
    }
  }

  const last = waypoints[waypoints.length - 1];
  return { x: last.x, z: last.z };
}

// ─── Determine interaction type based on nearby pieces ───
function getInteractionType(pieces, x, z) {
  for (const p of pieces) {
    const px = p.x - GRID_SIZE / 2 + PIECE_SIZES[p.type].w / 2;
    const pz = p.z - GRID_SIZE / 2 + PIECE_SIZES[p.type].h / 2;
    const dist = Math.abs(px - x) + Math.abs(pz - z);
    if (dist < 1.5) {
      if (p.type === 'GARDEN') return 'GARDEN_CHAT';
      if (p.type === 'FIREPIT') return 'FIRE_PIT_STORY';
      if (p.type === 'MAILBOX') return 'MORNING_WAVE';
      if (p.type === 'BENCH') return 'BENCH_CHAT';
    }
  }
  // Check if near a cottage (porch coffee)
  for (const p of pieces) {
    if (p.type !== 'COTTAGE') continue;
    const px = p.x - GRID_SIZE / 2 + PIECE_SIZES.COTTAGE.w / 2;
    const pz = p.z - GRID_SIZE / 2 + PIECE_SIZES.COTTAGE.h / 2;
    if (Math.abs(px - x) + Math.abs(pz - z) < 2) return 'PORCH_COFFEE';
  }
  return 'PASSING_HELLO';
}

// ─── Settle controller ───
export function createSettleController(pieces, residents, grid, onComplete, memory = null) {
  const directorResult = runDirector(pieces, residents, memory);
  const timeline = buildTimeline(residents, pieces, grid, directorResult);
  const cottageCount = pieces.filter(p => p.type === 'COTTAGE').length;
  const duration = getSettleDuration(cottageCount);

  let startTime = null;
  let isRunning = false;
  let progress = 0;
  const detectedInteractions = new Set(); // Track unique pairs to avoid duplicates

  function start(currentTime) {
    startTime = currentTime;
    isRunning = true;
    progress = 0;
    detectedInteractions.clear();
  }

  function update(currentTime) {
    if (!isRunning || startTime === null) {
      return { progress: 0, positions: [], isRunning: false, directorResult, interactions: [] };
    }

    const elapsed = (currentTime - startTime) / 1000;
    progress = Math.min(1, elapsed / duration);

    const positions = timeline.map(entry => ({
      residentId: entry.resident.id,
      residentName: entry.resident.name,
      position: interpolatePosition(entry.waypoints, progress),
    }));

    // Detect named interactions when two residents are close
    const newInteractions = [];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        const dist = Math.abs(a.position.x - b.position.x) + Math.abs(a.position.z - b.position.z);
        if (dist < 1.5) {
          const pairId = [a.residentId, b.residentId].sort().join(':');
          if (!detectedInteractions.has(pairId)) {
            detectedInteractions.add(pairId);
            const type = getInteractionType(pieces, (a.position.x + b.position.x) / 2, (a.position.z + b.position.z) / 2);
            newInteractions.push({
              residentA: a.residentId,
              residentB: b.residentId,
              nameA: a.residentName,
              nameB: b.residentName,
              type,
              position: {
                x: (a.position.x + b.position.x) / 2,
                z: (a.position.z + b.position.z) / 2,
              },
            });
          }
        }
      }
    }

    if (progress >= 1) {
      isRunning = false;
      if (onComplete) onComplete(directorResult);
    }

    return { progress, positions, isRunning, directorResult, interactions: newInteractions };
  }

  return { start, update, directorResult, get isRunning() { return isRunning; }, get duration() { return duration; } };
}
