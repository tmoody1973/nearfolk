// Nearfolk Morning Walk
//
// Before each build phase, the camera pans across the neighborhood
// for 5-8 seconds. Shows residents on porches: happy ones stand tall,
// struggling ones hunched. Sightlines glow. No interaction.
//
// This is the "read the board" moment from good spatial puzzles.
// Teaches the player to LOOK before acting.

import { GRID_SIZE, PIECE_SIZES } from './state.js';

const WALK_DURATION = 6; // seconds
const halfGrid = GRID_SIZE / 2;

export function createMorningWalkController(pieces, residents, getContentment) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  if (cottages.length === 0) return null;

  // Build camera path: pan across all cottages
  const positions = cottages.map(c => ({
    x: c.x - halfGrid + PIECE_SIZES.COTTAGE.w / 2,
    z: c.z - halfGrid + PIECE_SIZES.COTTAGE.h / 2,
    residentId: residents.find(r => r.cottageId === c.id)?.id,
    contentment: residents.find(r => r.cottageId === c.id)
      ? getContentment(residents.find(r => r.cottageId === c.id).id)
      : 50,
  }));

  // Sort by x then z for a natural pan
  positions.sort((a, b) => a.x - b.x || a.z - b.z);

  let startTime = null;
  let isRunning = false;

  function start(currentTime) {
    startTime = currentTime;
    isRunning = true;
  }

  // Returns { progress, cameraTarget, isRunning, currentResident }
  function update(currentTime) {
    if (!isRunning || !startTime) {
      return { progress: 0, cameraTarget: null, isRunning: false, currentResident: null };
    }

    const elapsed = (currentTime - startTime) / 1000;
    const progress = Math.min(1, elapsed / WALK_DURATION);

    if (progress >= 1) {
      isRunning = false;
      return { progress: 1, cameraTarget: null, isRunning: false, currentResident: null };
    }

    // Interpolate camera focus across cottage positions
    const idx = progress * (positions.length - 1);
    const fromIdx = Math.floor(idx);
    const toIdx = Math.min(fromIdx + 1, positions.length - 1);
    const t = idx - fromIdx;

    const target = {
      x: positions[fromIdx].x + (positions[toIdx].x - positions[fromIdx].x) * t,
      z: positions[fromIdx].z + (positions[toIdx].z - positions[fromIdx].z) * t,
    };

    // Which resident is closest to camera focus
    const current = positions[Math.round(idx)];

    return {
      progress,
      cameraTarget: target,
      isRunning: true,
      currentResident: current,
    };
  }

  return {
    start,
    update,
    get isRunning() { return isRunning; },
    get duration() { return WALK_DURATION; },
    positions,
  };
}
