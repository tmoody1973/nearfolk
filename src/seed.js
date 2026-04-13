// Nearfolk daily seed system
//
// One seed drops worldwide at midnight UTC.
// Seed is deterministic from date: hash("nearfolk-" + date).
// Determines: commons position, piece budget, lot shape.
// Same seed = same puzzle for all players.

// Simple hash function (djb2)
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Seeded random number generator (mulberry32)
function seededRandom(seed) {
  let state = seed;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Get today's date string in UTC
export function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Generate seed config for a given date
export function generateSeed(dateStr) {
  const hash = hashString('nearfolk-' + dateStr);
  const rand = seededRandom(hash);

  // Commons position (varies slightly from center)
  const commonsX = 2 + Math.floor(rand() * 4);  // 2-5
  const commonsZ = 2 + Math.floor(rand() * 4);  // 2-5
  const commonsW = rand() > 0.7 ? 4 : 3;        // mostly 3x3, sometimes 4x4
  const commonsH = commonsW === 4 ? (rand() > 0.5 ? 4 : 3) : 3;

  // Piece budget (varies by day)
  const baseBudget = {
    COTTAGE: 4 + Math.floor(rand() * 3),   // 4-6
    PORCH: 3 + Math.floor(rand() * 3),     // 3-5
    PATH: 8 + Math.floor(rand() * 8),      // 8-15
    GARDEN: 1 + Math.floor(rand() * 2),    // 1-2
    FIREPIT: Math.floor(rand() * 2) + 1,   // 1-2
    BENCH: 2 + Math.floor(rand() * 3),     // 2-4
    MAILBOX: 1,                             // always 1
    TREE: 4 + Math.floor(rand() * 8),      // 4-11
  };

  return {
    date: dateStr,
    hash,
    commonsX,
    commonsZ,
    commonsW,
    commonsH,
    budget: baseBudget,
  };
}

// Practice mode: generates a random seed not tied to today's date
export function generatePracticeSeed() {
  const practiceDate = `practice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return generateSeed(practiceDate);
}

// Check if player has already submitted a scored attempt today
const SCORE_KEY_PREFIX = 'nearfolk_scored_';

export function hasSubmittedToday() {
  try {
    return !!localStorage.getItem(SCORE_KEY_PREFIX + todayUTC());
  } catch {
    return false;
  }
}

export function markScoreSubmitted(date, score) {
  try {
    localStorage.setItem(SCORE_KEY_PREFIX + date, String(score));
  } catch {
    // Private mode
  }
}
