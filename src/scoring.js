// Nearfolk scoring engine — pure function, no side effects
//
// Neighborliness Score =
//   eye-contact edges × 3
//   + shared-node encounters × 2
//   + path-crossing encounters × 1
//   − lonely residents × 5
//   − blank-wall views × 1
//
// All inputs are from state.js grid + pieces arrays.
// No Three.js dependency — operates on grid coordinates only.

import { GRID_SIZE, PIECE_SIZES } from './state.js';

// Direction vectors for each rotation (where the porch faces)
//   0   = +Z
//   90  = +X
//   180 = -Z
//   270 = -X
const FACING = {
  0:   { dx: 0,  dz: 1 },
  90:  { dx: 1,  dz: 0 },
  180: { dx: 0,  dz: -1 },
  270: { dx: -1, dz: 0 },
};

// Eye-contact cone: porch looks outward in a 90-degree arc,
// extending up to 5 cells. Checks 3 rays: center, 45-left, 45-right.
function porchCenter(piece) {
  const size = PIECE_SIZES[piece.type];
  const cx = piece.x + size.w / 2;
  const cz = piece.z + size.h / 2;
  return { cx, cz };
}

function porchFront(piece) {
  const center = porchCenter(piece);
  const dir = FACING[piece.rotation];
  return {
    x: center.cx + dir.dx * (PIECE_SIZES[piece.type].w / 2 + 0.5),
    z: center.cz + dir.dz * (PIECE_SIZES[piece.type].h / 2 + 0.5),
  };
}

// Check if a cell contains a tree (sightline blocker)
function isTree(grid, pieces, x, z) {
  if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return false;
  const id = grid[x][z];
  if (id === null) return false;
  const piece = pieces.find(p => p.id === id);
  return piece && piece.type === 'TREE';
}

// Check if cell is the back of a cottage (blank wall)
function isBlankWall(grid, pieces, x, z, viewerRotation) {
  if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return false;
  const id = grid[x][z];
  if (id === null) return false;
  const piece = pieces.find(p => p.id === id);
  if (!piece || piece.type !== 'COTTAGE') return false;
  // The back is opposite the porch facing
  const backRotation = (piece.rotation + 180) % 360;
  // If the viewer is looking at the back side
  return viewerRotation === backRotation;
}

// Cast a ray from a porch outward in the facing direction,
// return true if it reaches another cottage's porch facing back
function castSightline(grid, pieces, fromPiece, maxDist = 5) {
  const dir = FACING[fromPiece.rotation];
  const center = porchCenter(fromPiece);
  const contacts = [];

  // Start from just outside the cottage
  let sx = Math.round(center.cx + dir.dx);
  let sz = Math.round(center.cz + dir.dz);

  for (let dist = 1; dist <= maxDist; dist++) {
    const cx = Math.floor(center.cx + dir.dx * (dist + 0.5));
    const cz = Math.floor(center.cz + dir.dz * (dist + 0.5));

    if (cx < 0 || cx >= GRID_SIZE || cz < 0 || cz >= GRID_SIZE) break;

    // Tree blocks sightline
    if (isTree(grid, pieces, cx, cz)) break;

    // Check if we hit another cottage
    const cellId = grid[cx][cz];
    if (cellId !== null && cellId !== fromPiece.id) {
      const target = pieces.find(p => p.id === cellId);
      if (target && target.type === 'COTTAGE') {
        // Does the target's porch face back toward us?
        const targetDir = FACING[target.rotation];
        const facesBack = (targetDir.dx === -dir.dx && targetDir.dz === -dir.dz) ||
                          (targetDir.dx === 0 && targetDir.dz === 0); // shouldn't happen
        // More lenient: target porch faces within 90 degrees of us
        const dot = -(dir.dx * targetDir.dx + dir.dz * targetDir.dz);
        if (dot > 0) {
          contacts.push(target.id);
        }
        break; // stop at first cottage hit
      }
    }
  }

  return contacts;
}

// Shared-node encounters: count pairs of cottages that can both "see"
// a shared node (garden, firepit, mailbox, bench)
function countSharedNodeEncounters(pieces) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  const nodes = pieces.filter(p =>
    ['GARDEN', 'FIREPIT', 'BENCH', 'MAILBOX'].includes(p.type)
  );

  let encounters = 0;

  for (const node of nodes) {
    const nodeCenter = porchCenter(node);
    const nearby = [];

    for (const cottage of cottages) {
      const cc = porchCenter(cottage);
      const dist = Math.abs(cc.cx - nodeCenter.cx) + Math.abs(cc.cz - nodeCenter.cz);
      // Within 4 manhattan distance = "can reach the node"
      if (dist <= 4) {
        nearby.push(cottage);
      }
    }

    // Each pair of nearby cottages generates one encounter
    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        encounters++;
      }
    }
  }

  return encounters;
}

// Path-crossing: count pairs of cottages connected by a path
function countPathCrossings(grid, pieces) {
  const paths = new Set();
  for (const p of pieces) {
    if (p.type === 'PATH') {
      paths.add(`${p.x},${p.z}`);
    }
  }

  if (paths.size === 0) return 0;

  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  // Simple: each cottage adjacent to a path tile gets "connected"
  // Count pairs of connected cottages
  const connected = [];

  for (const cottage of cottages) {
    const size = PIECE_SIZES.COTTAGE;
    let hasPath = false;
    // Check cells adjacent to cottage footprint
    for (let dx = -1; dx <= size.w; dx++) {
      for (let dz = -1; dz <= size.h; dz++) {
        if (dx >= 0 && dx < size.w && dz >= 0 && dz < size.h) continue; // skip interior
        if (paths.has(`${cottage.x + dx},${cottage.z + dz}`)) {
          hasPath = true;
        }
      }
    }
    if (hasPath) connected.push(cottage);
  }

  // Pairs of path-connected cottages
  let crossings = 0;
  for (let i = 0; i < connected.length; i++) {
    for (let j = i + 1; j < connected.length; j++) {
      crossings++;
    }
  }
  return crossings;
}

// Lonely residents: cottages with no sightlines and no nearby nodes
function countLonelyResidents(grid, pieces) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  let lonely = 0;

  for (const cottage of cottages) {
    const contacts = castSightline(grid, pieces, cottage);
    if (contacts.length > 0) continue;

    // Check if any shared node is within 3 cells
    const cc = porchCenter(cottage);
    const hasNode = pieces.some(p => {
      if (!['GARDEN', 'FIREPIT', 'BENCH', 'MAILBOX'].includes(p.type)) return false;
      const nc = porchCenter(p);
      return Math.abs(cc.cx - nc.cx) + Math.abs(cc.cz - nc.cz) <= 3;
    });

    if (!hasNode) lonely++;
  }

  return lonely;
}

// Blank wall views: porch facing the back of another cottage
function countBlankWallViews(grid, pieces) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  let blanks = 0;

  for (const cottage of cottages) {
    const dir = FACING[cottage.rotation];
    const center = porchCenter(cottage);

    // Check 1-2 cells in front of porch
    for (let dist = 1; dist <= 2; dist++) {
      const cx = Math.floor(center.cx + dir.dx * (dist + 0.5));
      const cz = Math.floor(center.cz + dir.dz * (dist + 0.5));

      if (cx < 0 || cx >= GRID_SIZE || cz < 0 || cz >= GRID_SIZE) break;

      const cellId = grid[cx][cz];
      if (cellId !== null && cellId !== cottage.id) {
        const target = pieces.find(p => p.id === cellId);
        if (target && target.type === 'COTTAGE') {
          // Is the viewer seeing the back of this cottage?
          const targetDir = FACING[target.rotation];
          const dot = dir.dx * targetDir.dx + dir.dz * targetDir.dz;
          // dot > 0 means both face the same direction = viewing the back
          if (dot > 0) {
            blanks++;
          }
        }
        break;
      }
    }
  }

  return blanks;
}

// Main scoring function — PURE, takes state snapshot, returns score breakdown
export function computeScore(grid, pieces) {
  if (pieces.length === 0) return { total: 0, breakdown: {} };

  const cottages = pieces.filter(p => p.type === 'COTTAGE');

  // Eye-contact edges (deduplicated pairs)
  const contactPairs = new Set();
  for (const cottage of cottages) {
    const contacts = castSightline(grid, pieces, cottage);
    for (const targetId of contacts) {
      const pair = [cottage.id, targetId].sort().join('-');
      contactPairs.add(pair);
    }
  }
  const eyeContactEdges = contactPairs.size;

  const sharedNodeEncounters = countSharedNodeEncounters(pieces);
  const pathCrossings = countPathCrossings(grid, pieces);
  const lonelyResidents = countLonelyResidents(grid, pieces);
  const blankWallViews = countBlankWallViews(grid, pieces);

  const total =
    eyeContactEdges * 3 +
    sharedNodeEncounters * 2 +
    pathCrossings * 1 -
    lonelyResidents * 5 -
    blankWallViews * 1;

  return {
    total: Math.max(0, total),
    breakdown: {
      eyeContactEdges,
      sharedNodeEncounters,
      pathCrossings,
      lonelyResidents,
      blankWallViews,
    },
  };
}
