import { BoxGeometry, ConeGeometry, CylinderGeometry, MeshLambertMaterial, Mesh, Group } from 'three';
import { createCottage } from './cottage.js';

const C = {
  pathStone: 0xc8b89c,
  treeFoliage: 0x7a9464,
  treeTrunk: 0x6b4e3a,
  firePitStone: 0x8a7a6a,
  firePitFlame: 0xf4a65c,
  benchWood: 0xc4a882,
  mailboxPost: 0x6b4e3a,
  mailboxBox: 0xc97a5c,
  gardenSoil: 0x8a7a5a,
  gardenPlant: 0x7a9464,
  porchWood: 0xc4a882,
};

function mat(color) {
  return new MeshLambertMaterial({ color, flatShading: true });
}

export function createPorch() {
  const group = new Group();
  const deck = new Mesh(new BoxGeometry(0.9, 0.08, 0.9), mat(C.porchWood));
  deck.position.y = 0.04;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Small railing posts
  for (const xOff of [-0.35, 0.35]) {
    const post = new Mesh(new BoxGeometry(0.06, 0.3, 0.06), mat(C.porchWood));
    post.position.set(xOff, 0.23, 0.4);
    post.castShadow = true;
    group.add(post);
  }
  group.userData.pieceType = 'PORCH';
  return group;
}

export function createPath() {
  const group = new Group();
  // Flat stone slab
  const slab = new Mesh(new BoxGeometry(0.85, 0.05, 0.85), mat(C.pathStone));
  slab.position.y = 0.025;
  slab.receiveShadow = true;
  group.add(slab);
  group.userData.pieceType = 'PATH';
  return group;
}

export function createGarden() {
  const group = new Group();
  // Soil bed (2x2)
  const soil = new Mesh(new BoxGeometry(1.8, 0.1, 1.8), mat(C.gardenSoil));
  soil.position.y = 0.05;
  soil.receiveShadow = true;
  group.add(soil);

  // Small plant rows
  for (let row = -0.5; row <= 0.5; row += 0.5) {
    for (let col = -0.5; col <= 0.5; col += 0.5) {
      const plant = new Mesh(new BoxGeometry(0.15, 0.2, 0.15), mat(C.gardenPlant));
      plant.position.set(col, 0.2, row);
      plant.castShadow = true;
      group.add(plant);
    }
  }
  group.userData.pieceType = 'GARDEN';
  return group;
}

export function createFirepit() {
  const group = new Group();
  // Stone ring
  const ring = new Mesh(new CylinderGeometry(0.35, 0.4, 0.2, 8), mat(C.firePitStone));
  ring.position.y = 0.1;
  ring.castShadow = true;
  group.add(ring);

  // Flame
  const flame = new Mesh(new ConeGeometry(0.15, 0.3, 4), mat(C.firePitFlame));
  flame.position.y = 0.35;
  group.add(flame);
  group.userData.pieceType = 'FIREPIT';
  return group;
}

export function createBench() {
  const group = new Group();
  // Seat
  const seat = new Mesh(new BoxGeometry(0.7, 0.05, 0.25), mat(C.benchWood));
  seat.position.y = 0.25;
  seat.castShadow = true;
  group.add(seat);
  // Legs
  for (const xOff of [-0.28, 0.28]) {
    const leg = new Mesh(new BoxGeometry(0.06, 0.25, 0.2), mat(C.benchWood));
    leg.position.set(xOff, 0.125, 0);
    group.add(leg);
  }
  group.userData.pieceType = 'BENCH';
  return group;
}

export function createMailbox() {
  const group = new Group();
  // Post
  const post = new Mesh(new BoxGeometry(0.08, 0.5, 0.08), mat(C.mailboxPost));
  post.position.y = 0.25;
  post.castShadow = true;
  group.add(post);
  // Box
  const box = new Mesh(new BoxGeometry(0.2, 0.15, 0.15), mat(C.mailboxBox));
  box.position.y = 0.55;
  box.castShadow = true;
  group.add(box);
  group.userData.pieceType = 'MAILBOX';
  return group;
}

export function createTree() {
  const group = new Group();
  // Trunk
  const trunk = new Mesh(new CylinderGeometry(0.08, 0.1, 0.6, 6), mat(C.treeTrunk));
  trunk.position.y = 0.3;
  trunk.castShadow = true;
  group.add(trunk);
  // Foliage (cone)
  const foliage = new Mesh(new ConeGeometry(0.4, 0.8, 6), mat(C.treeFoliage));
  foliage.position.y = 0.9;
  foliage.castShadow = true;
  group.add(foliage);
  group.userData.pieceType = 'TREE';
  return group;
}

// Factory map
export const PIECE_FACTORIES = {
  COTTAGE: createCottage,
  PORCH: createPorch,
  PATH: createPath,
  GARDEN: createGarden,
  FIREPIT: createFirepit,
  BENCH: createBench,
  MAILBOX: createMailbox,
  TREE: createTree,
};
