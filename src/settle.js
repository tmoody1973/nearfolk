// Nearfolk settle animation
//
// When the player presses Settle:
// 1. Director picks a beat
// 2. Grid is locked (no placement during animation)
// 3. 25-second dawn-to-dusk animation plays
// 4. Residents walk routines, encounters happen
// 5. Score freezes during build, reveals final after settle
// 6. Story card appears with caption
//
// Event sequence: Director fires -> animation ticks -> scoring reads

import { runDirector } from './director.js';
import { GRID_SIZE, PIECE_SIZES } from './state.js';

const SETTLE_DURATION = 25; // seconds
const halfGrid = GRID_SIZE / 2;

// Four time-of-day phases for resident routines
const PHASES = [
  { name: 'morning', start: 0, end: 0.25 },    // 0-6.25s
  { name: 'midday', start: 0.25, end: 0.5 },    // 6.25-12.5s
  { name: 'afternoon', start: 0.5, end: 0.75 },  // 12.5-18.75s
  { name: 'evening', start: 0.75, end: 1.0 },    // 18.75-25s
];

// Generate a simple walk target for a resident based on nearby pieces
function pickWalkTarget(resident, pieces, phase, grid) {
  const cottage = pieces.find(p => p.id === resident.cottageId);
  if (!cottage) return null;

  const cx = cottage.x - halfGrid + PIECE_SIZES.COTTAGE.w / 2;
  const cz = cottage.z - halfGrid + PIECE_SIZES.COTTAGE.h / 2;

  // Find nearby activity nodes by phase
  const targetTypes = {
    morning: ['MAILBOX', 'PATH'],
    midday: ['GARDEN', 'BENCH'],
    afternoon: ['BENCH', 'GARDEN', 'PATH'],
    evening: ['FIREPIT', 'PATH'],
  };

  const preferred = targetTypes[phase] || ['PATH'];
  const candidates = pieces.filter(p => preferred.includes(p.type));

  if (candidates.length === 0) {
    // Walk to commons center
    return { x: 0, z: 0 };
  }

  // Pick closest candidate
  let best = candidates[0];
  let bestDist = Infinity;
  for (const c of candidates) {
    const tx = c.x - halfGrid + PIECE_SIZES[c.type].w / 2;
    const tz = c.z - halfGrid + PIECE_SIZES[c.type].h / 2;
    const d = Math.abs(tx - cx) + Math.abs(tz - cz);
    if (d < bestDist) { bestDist = d; best = c; }
  }

  return {
    x: best.x - halfGrid + PIECE_SIZES[best.type].w / 2,
    z: best.z - halfGrid + PIECE_SIZES[best.type].h / 2,
  };
}

// Build the full animation timeline for all residents
function buildTimeline(residents, pieces, grid) {
  const timeline = [];

  for (const resident of residents) {
    const cottage = pieces.find(p => p.id === resident.cottageId);
    if (!cottage) continue;

    const homeX = cottage.x - halfGrid + PIECE_SIZES.COTTAGE.w / 2;
    const homeZ = cottage.z - halfGrid + PIECE_SIZES.COTTAGE.h / 2;

    // Each phase: walk to target, pause, walk home
    const waypoints = [{ x: homeX, z: homeZ, t: 0 }];

    for (const phase of PHASES) {
      const target = pickWalkTarget(resident, pieces, phase.name, grid);
      if (target) {
        // Walk to target at phase start
        waypoints.push({ x: target.x, z: target.z, t: phase.start + 0.05 });
        // Stay there
        waypoints.push({ x: target.x, z: target.z, t: phase.end - 0.05 });
      }
    }

    // Return home at end
    waypoints.push({ x: homeX, z: homeZ, t: 1.0 });

    timeline.push({ resident, waypoints });
  }

  return timeline;
}

// Interpolate position from waypoints at normalized time t (0-1)
function interpolatePosition(waypoints, t) {
  if (waypoints.length === 0) return { x: 0, z: 0 };
  if (t <= waypoints[0].t) return { x: waypoints[0].x, z: waypoints[0].z };
  if (t >= waypoints[waypoints.length - 1].t) {
    const last = waypoints[waypoints.length - 1];
    return { x: last.x, z: last.z };
  }

  // Find surrounding waypoints
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

// ─── Settle controller ───
// Returns an object that manages the animation state.
export function createSettleController(pieces, residents, grid, onComplete, memory = null) {
  const directorResult = runDirector(pieces, residents, memory);
  const timeline = buildTimeline(residents, pieces, grid);

  let startTime = null;
  let isRunning = false;
  let progress = 0; // 0 to 1

  function start(currentTime) {
    startTime = currentTime;
    isRunning = true;
    progress = 0;
  }

  // Called every frame. Returns { progress, positions, isRunning, directorResult }
  function update(currentTime) {
    if (!isRunning || startTime === null) {
      return { progress: 0, positions: [], isRunning: false, directorResult };
    }

    const elapsed = (currentTime - startTime) / 1000;
    progress = Math.min(1, elapsed / SETTLE_DURATION);

    // Get all resident positions at this time
    const positions = timeline.map(entry => ({
      residentId: entry.resident.id,
      position: interpolatePosition(entry.waypoints, progress),
    }));

    if (progress >= 1) {
      isRunning = false;
      if (onComplete) onComplete(directorResult);
    }

    return { progress, positions, isRunning, directorResult };
  }

  return { start, update, directorResult, get isRunning() { return isRunning; } };
}
