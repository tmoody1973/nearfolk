import { BoxGeometry, ConeGeometry, MeshLambertMaterial, Mesh, Group } from 'three';

const COLORS = {
  cream: 0xf0e4d0,
  terracotta: 0xc97a5c,
  sage: 0x9fb089,
  dustyRose: 0xd4a294,
  roof: 0x8b6b4a,
  porch: 0xc4a882,
};

// Cycle cottage wall colors for variety
const WALL_COLORS = [COLORS.cream, COLORS.terracotta, COLORS.sage, COLORS.dustyRose];
let colorIndex = 0;

export function createCottage() {
  const group = new Group();
  const wallColor = WALL_COLORS[colorIndex++ % WALL_COLORS.length];

  // Base (fits in 2x2 grid cells)
  const base = new Mesh(
    new BoxGeometry(1.8, 1.2, 1.8),
    new MeshLambertMaterial({ color: wallColor, flatShading: true })
  );
  base.position.y = 0.6;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Roof
  const roof = new Mesh(
    new ConeGeometry(1.4, 0.8, 4),
    new MeshLambertMaterial({ color: COLORS.roof, flatShading: true })
  );
  roof.position.y = 1.6;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Porch (front face indicator, faces +Z by default)
  const porch = new Mesh(
    new BoxGeometry(1.8, 0.1, 0.4),
    new MeshLambertMaterial({ color: COLORS.porch, flatShading: true })
  );
  porch.position.set(0, 0.05, 1.1);
  group.add(porch);

  group.userData.pieceType = 'COTTAGE';
  return group;
}
