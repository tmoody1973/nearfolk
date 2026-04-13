// Nearfolk game state — single source of truth
// Pure data, no Three.js dependencies

export const GRID_SIZE = 10;

export const PIECE_TYPES = {
  COTTAGE: 'COTTAGE',     // 2x2, rotatable, houses resident
  PORCH: 'PORCH',         // 1x1, attaches to cottage front
  PATH: 'PATH',           // 1x1, connects cottages
  GARDEN: 'GARDEN',       // 2x2, afternoon encounter node
  FIREPIT: 'FIREPIT',     // 1x1, evening encounter node
  BENCH: 'BENCH',         // 1x1, path-side encounter node
  MAILBOX: 'MAILBOX',     // 1x1, morning encounter node
  TREE: 'TREE',           // 1x1, sightline blocker
};

// Piece sizes (in grid cells)
export const PIECE_SIZES = {
  COTTAGE: { w: 2, h: 2 },
  PORCH: { w: 1, h: 1 },
  PATH: { w: 1, h: 1 },
  GARDEN: { w: 2, h: 2 },
  FIREPIT: { w: 1, h: 1 },
  BENCH: { w: 1, h: 1 },
  MAILBOX: { w: 1, h: 1 },
  TREE: { w: 1, h: 1 },
};

// Rotations: 0 = porch faces +Z, 90 = +X, 180 = -Z, 270 = -X
export const ROTATIONS = [0, 90, 180, 270];

export function createInitialState() {
  return {
    // Grid: 10x10 array of cell references (null = empty)
    grid: Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => null)
    ),
    // Placed pieces
    pieces: [],
    // Undo/redo stacks
    undoStack: [],
    redoStack: [],
    // Currently selected piece type
    selectedType: PIECE_TYPES.COTTAGE,
    // Current rotation for placement
    rotation: 0,
    // Piece budget for current day
    budget: {
      COTTAGE: 5,
      PORCH: 4,
      PATH: 12,
      GARDEN: 2,
      FIREPIT: 1,
      BENCH: 3,
      MAILBOX: 1,
      TREE: 10,
    },
  };
}

// Check if a piece can be placed at (x, z) with given rotation
export function canPlace(state, type, x, z) {
  const size = PIECE_SIZES[type];
  if (state.budget[type] <= 0) return false;

  for (let dx = 0; dx < size.w; dx++) {
    for (let dz = 0; dz < size.h; dz++) {
      const cx = x + dx;
      const cz = z + dz;
      if (cx < 0 || cx >= GRID_SIZE || cz < 0 || cz >= GRID_SIZE) return false;
      if (state.grid[cx][cz] !== null) return false;
    }
  }
  return true;
}

// Place a piece — returns new state (immutable)
export function placePiece(state, type, x, z, rotation) {
  if (!canPlace(state, type, x, z)) return state;

  const size = PIECE_SIZES[type];
  const piece = { id: Date.now() + Math.random(), type, x, z, rotation };

  // Clone grid
  const newGrid = state.grid.map(row => [...row]);
  for (let dx = 0; dx < size.w; dx++) {
    for (let dz = 0; dz < size.h; dz++) {
      newGrid[x + dx][z + dz] = piece.id;
    }
  }

  return {
    ...state,
    grid: newGrid,
    pieces: [...state.pieces, piece],
    budget: { ...state.budget, [type]: state.budget[type] - 1 },
    undoStack: [...state.undoStack, { ...state, undoStack: [], redoStack: [] }],
    redoStack: [],
  };
}

// Remove a piece by id — returns new state (immutable)
export function removePiece(state, pieceId) {
  const piece = state.pieces.find(p => p.id === pieceId);
  if (!piece) return state;

  const size = PIECE_SIZES[piece.type];
  const newGrid = state.grid.map(row => [...row]);
  for (let dx = 0; dx < size.w; dx++) {
    for (let dz = 0; dz < size.h; dz++) {
      if (newGrid[piece.x + dx][piece.z + dz] === piece.id) {
        newGrid[piece.x + dx][piece.z + dz] = null;
      }
    }
  }

  return {
    ...state,
    grid: newGrid,
    pieces: state.pieces.filter(p => p.id !== pieceId),
    budget: { ...state.budget, [piece.type]: state.budget[piece.type] + 1 },
    undoStack: [...state.undoStack, { ...state, undoStack: [], redoStack: [] }],
    redoStack: [],
  };
}

// Undo last action — returns new state
export function undo(state) {
  if (state.undoStack.length === 0) return state;
  const prev = state.undoStack[state.undoStack.length - 1];
  return {
    ...prev,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, { ...state, undoStack: [], redoStack: [] }],
  };
}

// Redo — returns new state
export function redo(state) {
  if (state.redoStack.length === 0) return state;
  const next = state.redoStack[state.redoStack.length - 1];
  return {
    ...next,
    undoStack: [...state.undoStack, { ...state, undoStack: [], redoStack: [] }],
    redoStack: state.redoStack.slice(0, -1),
  };
}

// Rotate a placed piece in-place (cycles through 0/90/180/270)
export function rotatePieceInPlace(state, pieceId) {
  const piece = state.pieces.find(p => p.id === pieceId);
  if (!piece) return state;

  const idx = ROTATIONS.indexOf(piece.rotation);
  const newRotation = ROTATIONS[(idx + 1) % ROTATIONS.length];

  return {
    ...state,
    pieces: state.pieces.map(p =>
      p.id === pieceId ? { ...p, rotation: newRotation } : p
    ),
    undoStack: [...state.undoStack, { ...state, undoStack: [], redoStack: [] }],
    redoStack: [],
  };
}

// Get total remaining budget
export function totalBudget(state) {
  return Object.values(state.budget).reduce((sum, n) => sum + n, 0);
}
