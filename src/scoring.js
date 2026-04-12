// Nearfolk scoring engine — pure function, no side effects
//
// SCORING (aligned with Ross Chapin's pocket neighborhood principles):
//
//   eye-contact edges        × 3  (porches facing each other = connection)
//   + nesting bonus          × 2  (open side facing closed side = good privacy design)
//   + porch encounters       × 2  (porch piece amplifies nearby encounters)
//   + shared-node encounters × 2  (garden, firepit, bench, mailbox = reasons to be outside)
//   + path-crossing          × 1  (paths between cottages = bumping into neighbors)
//   − lonely residents       × 5  (no connections = the design failed)
//   − blank-wall views       × 1  (porch staring at a back wall = bad nesting)
//
// All inputs are from state.js grid + pieces arrays.
// No Three.js dependency — operates on grid coordinates only.
// Returns connection data for visual rendering (sightlines, lonely cottages).

import { GRID_SIZE, PIECE_SIZES } from './state.js';

// Direction vectors for each rotation (where the porch faces)
const FACING = {
  0:   { dx: 0,  dz: 1 },
  90:  { dx: 1,  dz: 0 },
  180: { dx: 0,  dz: -1 },
  270: { dx: -1, dz: 0 },
};

function porchCenter(piece) {
  const size = PIECE_SIZES[piece.type];
  return { cx: piece.x + size.w / 2, cz: piece.z + size.h / 2 };
}

function isTree(grid, pieces, x, z) {
  if (x < 0 || x >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return false;
  const id = grid[x][z];
  if (id === null) return false;
  const piece = pieces.find(p => p.id === id);
  return piece && piece.type === 'TREE';
}

// Cast a ray from a cottage's porch outward. Returns IDs of cottages
// whose porches face back (mutual eye contact).
function castSightline(grid, pieces, fromPiece, maxDist = 5) {
  const dir = FACING[fromPiece.rotation];
  const center = porchCenter(fromPiece);
  const contacts = [];

  for (let dist = 1; dist <= maxDist; dist++) {
    const cx = Math.floor(center.cx + dir.dx * (dist + 0.5));
    const cz = Math.floor(center.cz + dir.dz * (dist + 0.5));

    if (cx < 0 || cx >= GRID_SIZE || cz < 0 || cz >= GRID_SIZE) break;
    if (isTree(grid, pieces, cx, cz)) break;

    const cellId = grid[cx][cz];
    if (cellId !== null && cellId !== fromPiece.id) {
      const target = pieces.find(p => p.id === cellId);
      if (target && target.type === 'COTTAGE') {
        const targetDir = FACING[target.rotation];
        // dot < 0 means porches face toward each other (mutual eye contact)
        const dot = dir.dx * targetDir.dx + dir.dz * targetDir.dz;
        if (dot < 0) {
          contacts.push(target.id);
        }
        break;
      }
    }
  }

  return contacts;
}

// Nesting bonus (Chapin's "open side facing closed side"):
// When a cottage's SIDE faces another cottage's porch, that's good nesting.
// The porch (open side) gets community. The side neighbor (closed side) gets privacy.
// This rewards placing cottages at 90-degree angles to each other, not just face-to-face.
function countNestingBonuses(pieces) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  let nesting = 0;

  for (let i = 0; i < cottages.length; i++) {
    for (let j = i + 1; j < cottages.length; j++) {
      const a = cottages[i];
      const b = cottages[j];
      const ac = porchCenter(a);
      const bc = porchCenter(b);

      // Must be adjacent (within 3 manhattan distance)
      const dist = Math.abs(ac.cx - bc.cx) + Math.abs(ac.cz - bc.cz);
      if (dist > 3) continue;

      const dirA = FACING[a.rotation];
      const dirB = FACING[b.rotation];

      // 90-degree relationship: dot product is 0
      const dot = dirA.dx * dirB.dx + dirA.dz * dirB.dz;
      if (dot === 0) {
        nesting++;
      }
    }
  }

  return nesting;
}

// Porch encounters: porch piece amplifies nearby shared-node encounters.
// Chapin: the porch is a threshold where lingering happens.
// If a porch piece is adjacent to a path or within 2 cells of a shared node,
// encounters at that node get a bonus.
function countPorchEncounters(pieces) {
  const porches = pieces.filter(p => p.type === 'PORCH');
  const nodes = pieces.filter(p =>
    ['GARDEN', 'FIREPIT', 'BENCH', 'MAILBOX'].includes(p.type)
  );

  let bonus = 0;
  for (const porch of porches) {
    const pc = porchCenter(porch);
    for (const node of nodes) {
      const nc = porchCenter(node);
      const dist = Math.abs(pc.cx - nc.cx) + Math.abs(pc.cz - nc.cz);
      if (dist <= 2) {
        bonus++;
      }
    }
  }
  return bonus;
}

// Shared-node encounters: pairs of cottages that can both reach a shared node
function countSharedNodeEncounters(pieces) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  const nodes = pieces.filter(p =>
    ['GARDEN', 'FIREPIT', 'BENCH', 'MAILBOX'].includes(p.type)
  );

  let encounters = 0;
  for (const node of nodes) {
    const nc = porchCenter(node);
    const nearby = [];
    for (const cottage of cottages) {
      const cc = porchCenter(cottage);
      if (Math.abs(cc.cx - nc.cx) + Math.abs(cc.cz - nc.cz) <= 4) {
        nearby.push(cottage);
      }
    }
    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        encounters++;
      }
    }
  }
  return encounters;
}

// Path-crossing: pairs of cottages connected by adjacent paths
function countPathCrossings(grid, pieces) {
  const paths = new Set();
  for (const p of pieces) {
    if (p.type === 'PATH') paths.add(`${p.x},${p.z}`);
  }
  if (paths.size === 0) return 0;

  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  const connected = [];

  for (const cottage of cottages) {
    const size = PIECE_SIZES.COTTAGE;
    let hasPath = false;
    for (let dx = -1; dx <= size.w; dx++) {
      for (let dz = -1; dz <= size.h; dz++) {
        if (dx >= 0 && dx < size.w && dz >= 0 && dz < size.h) continue;
        if (paths.has(`${cottage.x + dx},${cottage.z + dz}`)) hasPath = true;
      }
    }
    if (hasPath) connected.push(cottage);
  }

  let crossings = 0;
  for (let i = 0; i < connected.length; i++) {
    for (let j = i + 1; j < connected.length; j++) {
      crossings++;
    }
  }
  return crossings;
}

// Lonely residents: cottages with no sightlines AND no nearby nodes
function findLonelyResidents(grid, pieces) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');
  const lonely = [];

  for (const cottage of cottages) {
    const contacts = castSightline(grid, pieces, cottage);
    if (contacts.length > 0) continue;

    const cc = porchCenter(cottage);
    const hasNode = pieces.some(p => {
      if (!['GARDEN', 'FIREPIT', 'BENCH', 'MAILBOX'].includes(p.type)) return false;
      const nc = porchCenter(p);
      return Math.abs(cc.cx - nc.cx) + Math.abs(cc.cz - nc.cz) <= 3;
    });

    if (!hasNode) lonely.push(cottage);
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

    for (let dist = 1; dist <= 2; dist++) {
      const cx = Math.floor(center.cx + dir.dx * (dist + 0.5));
      const cz = Math.floor(center.cz + dir.dz * (dist + 0.5));

      if (cx < 0 || cx >= GRID_SIZE || cz < 0 || cz >= GRID_SIZE) break;

      const cellId = grid[cx][cz];
      if (cellId !== null && cellId !== cottage.id) {
        const target = pieces.find(p => p.id === cellId);
        if (target && target.type === 'COTTAGE') {
          const targetDir = FACING[target.rotation];
          const dot = dir.dx * targetDir.dx + dir.dz * targetDir.dz;
          if (dot > 0) blanks++;
        }
        break;
      }
    }
  }
  return blanks;
}

// ─── Main scoring function ───
// PURE: takes state snapshot, returns score + visual connection data
export function computeScore(grid, pieces) {
  if (pieces.length === 0) {
    return { total: 0, breakdown: {}, connections: [], lonelyCottages: [] };
  }

  const cottages = pieces.filter(p => p.type === 'COTTAGE');

  // Eye-contact edges (deduplicated pairs) + connection data for visuals
  const contactPairs = new Set();
  const connections = []; // { from: {x,z}, to: {x,z} } for drawing sightlines

  for (const cottage of cottages) {
    const contacts = castSightline(grid, pieces, cottage);
    for (const targetId of contacts) {
      const pair = [cottage.id, targetId].sort().join('-');
      if (!contactPairs.has(pair)) {
        contactPairs.add(pair);
        const target = pieces.find(p => p.id === targetId);
        if (target) {
          connections.push({
            from: porchCenter(cottage),
            to: porchCenter(target),
          });
        }
      }
    }
  }

  const eyeContactEdges = contactPairs.size;
  const nestingBonuses = countNestingBonuses(pieces);
  const porchEncounters = countPorchEncounters(pieces);
  const sharedNodeEncounters = countSharedNodeEncounters(pieces);
  const pathCrossings = countPathCrossings(grid, pieces);
  const lonelyCottages = findLonelyResidents(grid, pieces);
  const blankWallViews = countBlankWallViews(grid, pieces);

  const total =
    eyeContactEdges * 3 +
    nestingBonuses * 2 +
    porchEncounters * 2 +
    sharedNodeEncounters * 2 +
    pathCrossings * 1 -
    lonelyCottages.length * 5 -
    blankWallViews * 1;

  return {
    total: Math.max(0, total),
    breakdown: {
      eyeContactEdges,
      nestingBonuses,
      porchEncounters,
      sharedNodeEncounters,
      pathCrossings,
      lonelyResidents: lonelyCottages.length,
      blankWallViews,
    },
    // Visual data for scene rendering
    connections,
    lonelyCottages: lonelyCottages.map(c => porchCenter(c)),
  };
}
