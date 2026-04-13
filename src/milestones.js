// Nearfolk milestone unlocks
//
// At score thresholds, new pieces become available.
// Each unlock is a design tool, not a trophy.
// Persists in localStorage.

const STORAGE_KEY = 'nearfolk_unlocks';

export const MILESTONES = [
  {
    score: 30,
    piece: 'LAMP_POST',
    name: 'Lamp Post',
    description: 'Extends sightlines into evening.',
    icon: '🏮',
  },
  {
    score: 60,
    piece: 'GAZEBO',
    name: 'Gazebo',
    description: '1.5x encounter node. A place to gather.',
    icon: '⛩️',
  },
  {
    score: 100,
    piece: 'COMMUNITY_GARDEN',
    name: 'Community Garden',
    description: 'Larger garden. Holds events.',
    icon: '🌻',
  },
  {
    score: 150,
    piece: 'COVERED_PORCH',
    name: 'Covered Porch',
    description: '2x porch value in rain and winter.',
    icon: '🏡',
  },
];

export function getUnlocked() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function checkNewUnlocks(currentScore) {
  const unlocked = getUnlocked();
  const newUnlocks = [];

  for (const milestone of MILESTONES) {
    if (currentScore >= milestone.score && !unlocked.includes(milestone.piece)) {
      unlocked.push(milestone.piece);
      newUnlocks.push(milestone);
    }
  }

  if (newUnlocks.length > 0) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked)); } catch {}
  }

  return newUnlocks;
}

export function isUnlocked(piece) {
  return getUnlocked().includes(piece);
}

export function getAllUnlocked() {
  return getUnlocked();
}
