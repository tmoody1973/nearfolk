// Nearfolk resident system
// Each cottage spawns one resident with a name, colors, and one trait.
// Traits affect scoring, routines, and Director beat eligibility.

// ─── Name pool (~60 warm, diverse names) ───
const NAMES = [
  'June', 'Maya', 'Dev', 'Tomás', 'Aisha', 'Lena', 'Marcus', 'Raya',
  'Eli', 'Sana', 'Kai', 'Priya', 'Owen', 'Noor', 'Mateo', 'Iris',
  'Zara', 'Felix', 'Amara', 'Jin', 'Rosa', 'Idris', 'Vera', 'Nico',
  'Luz', 'Theo', 'Mina', 'Dante', 'Alma', 'Ravi', 'Esme', 'Kofi',
  'Hana', 'Miles', 'Suki', 'Leo', 'Freya', 'Amos', 'Pia', 'Joel',
  'Uma', 'Rune', 'Nadia', 'Sol', 'Opal', 'Cyrus', 'Lila', 'Hugo',
  'Wren', 'Dara', 'Sage', 'Tala', 'Oren', 'Cleo', 'Basil', 'Ada',
  'Reed', 'Flora', 'Jude', 'Neve',
];

// ─── Color pairs (body, accent) ───
const COLOR_PAIRS = [
  [0xc97a5c, 0xf0e4d0],  // terracotta + cream
  [0x9fb089, 0xf0e4d0],  // sage + cream
  [0xd4a294, 0x6b4e3a],  // dusty rose + brown
  [0x8b6b4a, 0xf0e4d0],  // brown + cream
  [0xc97a5c, 0x9fb089],  // terracotta + sage
  [0x7a9464, 0xf0e4d0],  // green + cream
  [0xd4a294, 0x9fb089],  // dusty rose + sage
  [0x6b4e3a, 0xd4a294],  // brown + dusty rose
  [0xc4a882, 0x6b4e3a],  // wood + brown
  [0x8a7a6a, 0xf0e4d0],  // stone + cream
];

// ─── Trait definitions ───
// Each trait has: name, rarity tier, routine effect description,
// scoring modifier function, and Director beat affinities.

export const TRAITS = {
  // Common (70% of pool)
  GARDENER: {
    name: 'Gardener',
    tier: 'common',
    description: 'Visits the garden twice. Garden encounters 1.5x.',
    icon: '🌱',
    routineModifier: 'garden_double',
    encounterMultiplier: { GARDEN: 1.5 },
  },
  EARLY_BIRD: {
    name: 'Early Bird',
    tier: 'common',
    description: 'Full morning routine. Mailbox encounters 2x.',
    icon: '🌅',
    routineModifier: 'morning_focus',
    encounterMultiplier: { MAILBOX: 2.0 },
  },
  NIGHT_OWL: {
    name: 'Night Owl',
    tier: 'common',
    description: 'Skips morning. Fire pit encounters 2x.',
    icon: '🌙',
    routineModifier: 'evening_focus',
    encounterMultiplier: { FIREPIT: 2.0 },
  },
  WANDERER: {
    name: 'Wanderer',
    tier: 'common',
    description: 'Walks the entire path. Every bench becomes an encounter.',
    icon: '👣',
    routineModifier: 'full_path',
    encounterMultiplier: { BENCH: 2.0 },
  },
  HOMEBODY: {
    name: 'Homebody',
    tier: 'common',
    description: 'Rarely leaves porch. Porch is 1.5x encounter node.',
    icon: '🏠',
    routineModifier: 'stay_home',
    porchBonus: 1.5,
  },
  HOST: {
    name: 'Host',
    tier: 'common',
    description: 'Porch is 2x encounter node in afternoon.',
    icon: '☕',
    routineModifier: 'afternoon_porch',
    porchBonus: 2.0,
  },
  GREEN_THUMB: {
    name: 'Green Thumb',
    tier: 'common',
    description: 'Trees within 3 tiles of porch give small bonus.',
    icon: '🌿',
    routineModifier: 'standard',
    treeBonus: true,
  },

  // Uncommon (25% of pool)
  INTROVERT: {
    name: 'Introvert',
    tier: 'uncommon',
    description: '-3 if porch sees >2 porches. +5 if exactly 1.',
    icon: '📖',
    routineModifier: 'selective',
    scoringOverride: 'introvert',
  },
  STORYTELLER: {
    name: 'Storyteller',
    tier: 'uncommon',
    description: '+1 to every encounter. Draws others at sunset.',
    icon: '📚',
    routineModifier: 'sunset_draw',
    encounterFlat: 1,
  },
  NEW_IN_TOWN: {
    name: 'New in Town',
    tier: 'uncommon',
    description: 'Needs 2+ encounters or loneliness hits harder (-8).',
    icon: '🧳',
    routineModifier: 'standard',
    lonelyPenalty: 8,
  },
  POTLUCK_CAPTAIN: {
    name: 'Potluck Captain',
    tier: 'uncommon',
    description: 'Garden + commons encounters 1.5x when present.',
    icon: '🍲',
    routineModifier: 'standard',
    encounterMultiplier: { GARDEN: 1.5 },
  },

  // Rare (5% of pool)
  THE_MAYOR: {
    name: 'The Mayor',
    tier: 'rare',
    description: '+0.5 to every encounter neighborhood-wide.',
    icon: '🎩',
    routineModifier: 'standard',
    globalBonus: 0.5,
  },
  THE_OLD_TIMER: {
    name: 'The Old-Timer',
    tier: 'rare',
    description: 'Friendships formed while present become permanent.',
    icon: '🪑',
    routineModifier: 'standard',
    permanentFriendships: true,
  },
  THE_KID: {
    name: 'The Kid',
    tier: 'rare',
    description: 'Lives with another resident. Plays at commons.',
    icon: '⚽',
    routineModifier: 'commons_play',
    requiresCottages: 4,
  },
  THE_GHOST: {
    name: 'The Ghost',
    tier: 'rare',
    description: 'Appears once. Walks corner to corner. Worth nothing.',
    icon: '👻',
    routineModifier: 'ghost_walk',
    isGhost: true,
  },
};

// Weighted trait pool for random assignment
const TRAIT_POOL = [];
for (const [key, trait] of Object.entries(TRAITS)) {
  const weight = trait.tier === 'common' ? 10 : trait.tier === 'uncommon' ? 4 : 1;
  for (let i = 0; i < weight; i++) {
    TRAIT_POOL.push(key);
  }
}

// Track used names to avoid duplicates in the same neighborhood
let usedNames = new Set();
let usedColorIndices = new Set();

export function resetResidentPool() {
  usedNames = new Set();
  usedColorIndices = new Set();
}

// Pick a trait weighted by current neighborhood composition
// (soft balance: traits already present become less likely)
export function pickTrait(existingResidents) {
  const traitCounts = {};
  for (const r of existingResidents) {
    traitCounts[r.traitKey] = (traitCounts[r.traitKey] || 0) + 1;
  }

  // Filter pool, reducing weight of already-present traits
  const weighted = [];
  for (const key of TRAIT_POOL) {
    const count = traitCounts[key] || 0;
    // Each existing copy halves the chance
    const adjustedWeight = Math.max(1, Math.pow(0.5, count));
    if (Math.random() < adjustedWeight) {
      weighted.push(key);
    }
  }

  if (weighted.length === 0) {
    // Fallback: pick any
    return TRAIT_POOL[Math.floor(Math.random() * TRAIT_POOL.length)];
  }

  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Create a new resident for a cottage
export function createResident(cottageId, existingResidents) {
  // Pick unused name
  let name;
  const available = NAMES.filter(n => !usedNames.has(n));
  if (available.length > 0) {
    name = available[Math.floor(Math.random() * available.length)];
  } else {
    name = NAMES[Math.floor(Math.random() * NAMES.length)];
  }
  usedNames.add(name);

  // Pick colors (cycle to avoid adjacent duplicates)
  let colorIdx = Math.floor(Math.random() * COLOR_PAIRS.length);
  let tries = 0;
  while (usedColorIndices.has(colorIdx) && tries < COLOR_PAIRS.length) {
    colorIdx = (colorIdx + 1) % COLOR_PAIRS.length;
    tries++;
  }
  usedColorIndices.add(colorIdx);
  const [bodyColor, accentColor] = COLOR_PAIRS[colorIdx];

  // Pick trait
  const traitKey = pickTrait(existingResidents);
  const trait = TRAITS[traitKey];

  return {
    id: `resident-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    bodyColor,
    accentColor,
    traitKey,
    trait,
    cottageId,
    encounterCount: 0,
  };
}
