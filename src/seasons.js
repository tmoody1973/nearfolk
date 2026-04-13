// Nearfolk seasons system
//
// Maps the 5-day session to seasons. Each season changes:
// - Piece value modifiers (garden bloom, fire pit warmth, etc.)
// - Visual lighting (sky color, ambient intensity)
// - Tree appearance (green → orange → bare → green)

export const SEASONS = [
  {
    name: 'Spring',
    day: 1,
    modifiers: { GARDEN: 1 },
    skyColor: 0xc8d8b0,      // Bright green-tinted
    ambientIntensity: 0.45,
    keyIntensity: 1.0,
    treeColor: 0x7a9464,      // Normal green
    groundTint: 0xb0c8a0,
  },
  {
    name: 'Summer',
    day: 2,
    modifiers: { PORCH: 1 },
    skyColor: 0xf0d9bf,       // Warm golden
    ambientIntensity: 0.5,
    keyIntensity: 1.1,
    treeColor: 0x6a8454,      // Deep green
    groundTint: 0xa8b89a,
  },
  {
    name: 'Fall',
    day: 3,
    modifiers: { PATH: 1 },
    skyColor: 0xe0c8a0,       // Amber
    ambientIntensity: 0.4,
    keyIntensity: 0.9,
    treeColor: 0xc8864a,      // Orange/amber
    groundTint: 0xb0a888,
  },
  {
    name: 'Winter',
    day: 4,
    modifiers: { FIREPIT: 2, GARDEN: -1 },
    skyColor: 0xc0c8d0,       // Cool blue
    ambientIntensity: 0.3,
    keyIntensity: 0.7,
    treeColor: 0x8a8a7a,      // Muted/bare
    groundTint: 0xa0a8a0,
  },
  {
    name: 'Thaw',
    day: 5,
    modifiers: {},
    skyColor: 0xd8c8b0,       // Warm golden thaw
    ambientIntensity: 0.45,
    keyIntensity: 1.0,
    treeColor: 0x88a468,      // Light fresh green
    groundTint: 0xb0c0a0,
  },
];

export function getSeason(day) {
  const idx = Math.max(0, Math.min(SEASONS.length - 1, day - 1));
  return SEASONS[idx];
}

// Get score modifier for a piece type based on season
export function getSeasonModifier(season, pieceType) {
  return season.modifiers[pieceType] || 0;
}
