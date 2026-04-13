import {
  Scene, OrthographicCamera, WebGLRenderer,
  AmbientLight, DirectionalLight,
  PlaneGeometry, MeshLambertMaterial, Mesh, MeshBasicMaterial,
  Color, PCFSoftShadowMap,
  Raycaster, Vector2, Vector3,
  BoxGeometry, Group, SphereGeometry, BackSide,
  BufferGeometry, LineBasicMaterial, Line, Float32BufferAttribute,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

import {
  GRID_SIZE, PIECE_SIZES, ROTATIONS,
  createInitialState, canPlace, placePiece, removePiece,
  rotatePieceInPlace, undo, redo, totalBudget,
} from './state.js';
import { PIECE_FACTORIES } from './pieces/index.js';
import { computeScore } from './scoring.js';
import { createResident, resetResidentPool } from './residents.js';
import { createSettleController } from './settle.js';
import {
  shouldShowTutorial, getTutorialPieces, isTutorialSolved,
  createTutorialUI, showTutorialSuccess, removeTutorialUI, markTutorialSeen,
} from './tutorial.js';
import {
  initAudio, playPlace, playRemove, playRotate, playScoreTick,
  startSettleUnderscore, stopSettleUnderscore, playEndBell,
  toggleMute, getIsMuted,
} from './audio.js';
import { captureShareCard, generatePostcard, sharePostcard } from './share.js';
import { todayUTC, generateSeed, generatePracticeSeed, hasSubmittedToday, markScoreSubmitted } from './seed.js';
import { createTimer } from './timer.js';
import { submitScore, fetchLeaderboard } from './leaderboard.js';

export function createScene() {
  // ─── Seed + State ───
  let currentSeed = generateSeed(todayUTC());
  let state = createInitialState();
  // Apply seed budget
  state = { ...state, budget: { ...currentSeed.budget } };

  // Map piece IDs to Three.js groups for removal
  const meshMap = new Map();

  // Residents: array of resident objects + map to meshes
  let residents = [];
  const residentMeshMap = new Map();

  // Settle state
  let settleController = null;
  let isSettling = false;

  // Timer
  const gameTimer = createTimer(() => {
    // Auto-settle on timer expiry
    if (!isSettling && state.pieces.some(p => p.type === 'COTTAGE')) {
      document.getElementById('settle-btn').click();
    }
  });

  // Tutorial state
  let inTutorial = shouldShowTutorial();

  const scene = new Scene();
  scene.background = new Color(0xf5efe6);

  // ─── Camera (zoom + orbit) ───
  const aspect = window.innerWidth / window.innerHeight;
  let zoom = 15;          // frustum size (smaller = zoomed in)
  const ZOOM_MIN = 6;
  const ZOOM_MAX = 22;
  let orbitAngle = Math.PI / 4;  // 45 degrees (default iso)
  const CAM_HEIGHT = 12;
  const CAM_DIST = 12;

  const camera = new OrthographicCamera(
    (zoom * aspect) / -2, (zoom * aspect) / 2,
    zoom / 2, zoom / -2, 0.1, 100
  );

  function updateCamera() {
    const a = window.innerWidth / window.innerHeight;
    camera.left = (zoom * a) / -2;
    camera.right = (zoom * a) / 2;
    camera.top = zoom / 2;
    camera.bottom = zoom / -2;
    camera.position.set(
      Math.cos(orbitAngle) * CAM_DIST,
      CAM_HEIGHT,
      Math.sin(orbitAngle) * CAM_DIST
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  updateCamera();

  // ─── Renderer ───
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // ─── Lights ───
  const ambient = new AmbientLight(0xffe8cc, 0.4);
  scene.add(ambient);

  const key = new DirectionalLight(0xfff4e0, 1.0);
  key.position.set(10, 15, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 50;
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  scene.add(key);

  const rim = new DirectionalLight(0x88aaff, 0.2);
  rim.position.set(-8, 5, -8);
  scene.add(rim);

  // ─── Ground ───
  const ground = new Mesh(
    new PlaneGeometry(GRID_SIZE, GRID_SIZE),
    new MeshLambertMaterial({ color: 0xa8b89a, flatShading: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const halfGrid = GRID_SIZE / 2;

  // ─── Grid lines (subtle) ───
  const gridLineMat = new LineBasicMaterial({ color: 0x8a9a7a, transparent: true, opacity: 0.2 });
  for (let i = 0; i <= GRID_SIZE; i++) {
    const offset = i - halfGrid;
    // Horizontal
    const hGeo = new BufferGeometry();
    hGeo.setAttribute('position', new Float32BufferAttribute([
      -halfGrid, 0.01, offset, halfGrid, 0.01, offset
    ], 3));
    scene.add(new Line(hGeo, gridLineMat));
    // Vertical
    const vGeo = new BufferGeometry();
    vGeo.setAttribute('position', new Float32BufferAttribute([
      offset, 0.01, -halfGrid, offset, 0.01, halfGrid
    ], 3));
    scene.add(new Line(vGeo, gridLineMat));
  }

  // ─── Commons (pre-placed shared space, position from seed) ───
  const COMMONS_X = currentSeed.commonsX;
  const COMMONS_Z = currentSeed.commonsZ;
  const COMMONS_W = currentSeed.commonsW;
  const COMMONS_H = currentSeed.commonsH;

  // Mark commons cells as occupied in state
  for (let dx = 0; dx < COMMONS_W; dx++) {
    for (let dz = 0; dz < COMMONS_H; dz++) {
      state.grid[COMMONS_X + dx][COMMONS_Z + dz] = 'COMMONS';
    }
  }

  // Commons visual: a slightly raised lighter green area with a subtle border
  const commonsGround = new Mesh(
    new BoxGeometry(COMMONS_W, 0.06, COMMONS_H),
    new MeshLambertMaterial({ color: 0xb8c8a8, flatShading: true })
  );
  commonsGround.position.set(
    COMMONS_X - halfGrid + COMMONS_W / 2,
    0.03,
    COMMONS_Z - halfGrid + COMMONS_H / 2
  );
  commonsGround.receiveShadow = true;
  scene.add(commonsGround);

  // Small decorative elements on commons
  // Center tree
  const commonsTree = new Group();
  const cTrunk = new Mesh(
    new BoxGeometry(0.12, 0.8, 0.12),
    new MeshLambertMaterial({ color: 0x6b4e3a, flatShading: true })
  );
  cTrunk.position.y = 0.4;
  cTrunk.castShadow = true;
  commonsTree.add(cTrunk);
  const cFoliage = new Mesh(
    new SphereGeometry(0.5, 6, 6),
    new MeshLambertMaterial({ color: 0x7a9464, flatShading: true })
  );
  cFoliage.position.y = 1.0;
  cFoliage.castShadow = true;
  commonsTree.add(cFoliage);
  commonsTree.position.set(
    COMMONS_X - halfGrid + COMMONS_W / 2,
    0.06,
    COMMONS_Z - halfGrid + COMMONS_H / 2
  );
  scene.add(commonsTree);

  // ─── Sky ───
  const sky = new Mesh(
    new SphereGeometry(40, 16, 16),
    new MeshLambertMaterial({ color: 0xf0d9bf, side: BackSide, flatShading: true })
  );
  scene.add(sky);

  // ─── Post-processing ───
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const hTilt = new ShaderPass(HorizontalTiltShiftShader);
  hTilt.uniforms.h.value = 1.5 / window.innerHeight;
  hTilt.uniforms.r.value = 0.4;
  composer.addPass(hTilt);

  const vTilt = new ShaderPass(VerticalTiltShiftShader);
  vTilt.uniforms.v.value = 1.5 / window.innerWidth;
  vTilt.uniforms.r.value = 0.4;
  composer.addPass(vTilt);

  const vig = new ShaderPass(VignetteShader);
  vig.uniforms.offset.value = 1.0;
  vig.uniforms.darkness.value = 0.8;
  composer.addPass(vig);

  // ─── Grid hover ───
  const raycaster = new Raycaster();
  const mouse = new Vector2();
  const hoverCell = { x: -1, z: -1 };

  const highlight = new Mesh(
    new BoxGeometry(1, 0.02, 1),
    new MeshLambertMaterial({ color: 0xfff4e0, transparent: true, opacity: 0.3 })
  );
  highlight.visible = false;
  scene.add(highlight);

  // Preview ghost (shows what will be placed)
  let previewMesh = null;

  function updatePreview() {
    if (previewMesh) {
      scene.remove(previewMesh);
      previewMesh = null;
    }

    if (hoverCell.x < 0) return;
    if (isSettling) return;

    const factory = PIECE_FACTORIES[state.selectedType];
    if (!factory) return;

    const valid = canPlace(state, state.selectedType, hoverCell.x, hoverCell.z);

    previewMesh = factory();
    previewMesh.rotation.y = (state.rotation * Math.PI) / 180;

    const size = PIECE_SIZES[state.selectedType];
    previewMesh.position.set(
      hoverCell.x - halfGrid + size.w / 2,
      0,
      hoverCell.z - halfGrid + size.h / 2
    );

    // Ghost transparency: green-tinted if valid, red-tinted if not
    previewMesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = valid ? 0.4 : 0.15;
        if (!valid) {
          child.material.color.setHex(0xcc6666);
        }
      }
    });
    scene.add(previewMesh);
  }

  function cellFromMouse(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Try ground first
    const groundHits = raycaster.intersectObject(ground);
    if (groundHits.length > 0) {
      const p = groundHits[0].point;
      const cx = Math.floor(p.x + halfGrid);
      const cz = Math.floor(p.z + halfGrid);
      if (cx >= 0 && cx < GRID_SIZE && cz >= 0 && cz < GRID_SIZE) {
        return { x: cx, z: cz };
      }
    }

    // Fallback: intersect placed pieces (for hovering over tall objects)
    const pieceObjects = [];
    for (const [, mesh] of meshMap) pieceObjects.push(mesh);
    const pieceHits = raycaster.intersectObjects(pieceObjects, true);
    if (pieceHits.length > 0) {
      const p = pieceHits[0].point;
      const cx = Math.floor(p.x + halfGrid);
      const cz = Math.floor(p.z + halfGrid);
      if (cx >= 0 && cx < GRID_SIZE && cz >= 0 && cz < GRID_SIZE) {
        return { x: cx, z: cz };
      }
    }

    return null;
  }

  // ─── Scroll to zoom ───
  window.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom += e.deltaY * 0.01;
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
    updateCamera();
  }, { passive: false });

  // ─── Middle-click to rotate placed piece ───
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return; // middle click
    e.preventDefault();
    if (hoverCell.x < 0) return;
    const pieceId = state.grid[hoverCell.x][hoverCell.z];
    if (pieceId === null) return;

    state = rotatePieceInPlace(state, pieceId);
    const piece = state.pieces.find(p => p.id === pieceId);
    const mesh = meshMap.get(pieceId);
    if (mesh && piece) {
      mesh.rotation.y = (piece.rotation * Math.PI) / 180;
    }
    updateUI();
  });

  // ─── Mouse events ───
  // tooltipEl is resolved lazily because the UI DOM is created later
  let tooltipEl = null;

  window.addEventListener('mousemove', (e) => {
    if (!tooltipEl) tooltipEl = document.getElementById('resident-tooltip');

    const cell = cellFromMouse(e);
    if (cell) {
      hoverCell.x = cell.x;
      hoverCell.z = cell.z;
      highlight.position.set(cell.x - halfGrid + 0.5, 0.02, cell.z - halfGrid + 0.5);
      highlight.visible = true;

      // Show resident tooltip if hovering a cottage
      const pieceId = state.grid[cell.x][cell.z];
      const resident = pieceId ? residents.find(r => r.cottageId === pieceId) : null;
      if (resident && tooltipEl) {
        tooltipEl.innerHTML = `
          <div class="tooltip-name">${resident.trait.icon} ${resident.name}</div>
          <div class="tooltip-trait">${resident.trait.name}: ${resident.trait.description}</div>
        `;
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = (e.clientX + 16) + 'px';
        tooltipEl.style.top = (e.clientY - 10) + 'px';
      } else if (tooltipEl) {
        tooltipEl.style.display = 'none';
      }
    } else {
      hoverCell.x = -1;
      hoverCell.z = -1;
      highlight.visible = false;
      if (tooltipEl) tooltipEl.style.display = 'none';
    }
    updatePreview();
  });

  // ─── Resident mesh factory ───
  function createResidentMesh(resident) {
    const group = new Group();
    const body = new Mesh(
      new BoxGeometry(0.2, 0.4, 0.2),
      new MeshLambertMaterial({ color: resident.bodyColor, flatShading: true })
    );
    body.position.y = 0.3;
    body.castShadow = true;
    group.add(body);

    const head = new Mesh(
      new BoxGeometry(0.15, 0.15, 0.15),
      new MeshLambertMaterial({ color: resident.accentColor, flatShading: true })
    );
    head.position.y = 0.58;
    head.castShadow = true;
    group.add(head);

    group.userData.residentId = resident.id;
    group.userData.residentName = resident.name;
    group.userData.traitName = resident.trait.name;
    group.userData.traitIcon = resident.trait.icon;
    return group;
  }

  function spawnResident(cottageId, cottageX, cottageZ, rotation = 0) {
    const resident = createResident(cottageId, residents);
    residents = [...residents, resident];

    const mesh = createResidentMesh(resident);
    const size = PIECE_SIZES.COTTAGE;
    const cx = cottageX - halfGrid + size.w / 2;
    const cz = cottageZ - halfGrid + size.h / 2;

    // Place resident OUTSIDE the cottage on the porch side
    const dir = { 0: { dx: 0, dz: 1.3 }, 90: { dx: 1.3, dz: 0 }, 180: { dx: 0, dz: -1.3 }, 270: { dx: -1.3, dz: 0 } };
    const offset = dir[rotation] || dir[0];
    mesh.position.set(cx + offset.dx, 0, cz + offset.dz);

    scene.add(mesh);
    residentMeshMap.set(resident.id, mesh);
    return resident;
  }

  function despawnResident(cottageId) {
    const resident = residents.find(r => r.cottageId === cottageId);
    if (!resident) return;
    const mesh = residentMeshMap.get(resident.id);
    if (mesh) {
      scene.remove(mesh);
      residentMeshMap.delete(resident.id);
    }
    residents = residents.filter(r => r.id !== resident.id);
  }

  // Left-click: place piece
  window.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    initAudio(); // First interaction starts audio
    if (isSettling) return; // Grid locked during settle
    if (hoverCell.x < 0) return;
    if (!canPlace(state, state.selectedType, hoverCell.x, hoverCell.z)) return;

    playPlace();
    const type = state.selectedType;
    const rotation = state.rotation;
    const x = hoverCell.x;
    const z = hoverCell.z;

    state = placePiece(state, type, x, z, rotation);
    const placed = state.pieces[state.pieces.length - 1];

    // Create piece mesh
    const mesh = PIECE_FACTORIES[type]();
    mesh.rotation.y = (rotation * Math.PI) / 180;
    const size = PIECE_SIZES[type];
    mesh.position.set(x - halfGrid + size.w / 2, 0, z - halfGrid + size.h / 2);
    scene.add(mesh);
    meshMap.set(placed.id, mesh);

    // Spawn resident if cottage
    if (type === 'COTTAGE') {
      spawnResident(placed.id, x, z, rotation);
    }

    updatePreview();
    updateUI();
  });

  // Right-click: remove piece under cursor
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (isSettling) return;
    if (hoverCell.x < 0) return;

    const pieceId = state.grid[hoverCell.x][hoverCell.z];
    if (pieceId === null) return;

    // Despawn resident if cottage
    const piece = state.pieces.find(p => p.id === pieceId);
    if (piece && piece.type === 'COTTAGE') {
      despawnResident(pieceId);
    }

    const mesh = meshMap.get(pieceId);
    if (mesh) {
      scene.remove(mesh);
      meshMap.delete(pieceId);
    }
    state = removePiece(state, pieceId);
    playRemove();
    updatePreview();
    updateUI();
  });

  // ─── Keyboard ───
  window.addEventListener('keydown', (e) => {
    // R: rotate selected piece type (for next placement)
    if (e.key === 'r' || e.key === 'R') {
      playRotate();
      const idx = ROTATIONS.indexOf(state.rotation);
      state = { ...state, rotation: ROTATIONS[(idx + 1) % ROTATIONS.length] };
      updatePreview();
    }

    // Q/E: orbit camera
    if (e.key === 'q' || e.key === 'Q') {
      orbitAngle -= Math.PI / 4;
      updateCamera();
    }
    if (e.key === 'e' || e.key === 'E') {
      orbitAngle += Math.PI / 4;
      updateCamera();
    }

    // T: rotate placed piece under cursor
    if (e.key === 't' || e.key === 'T') {
      if (hoverCell.x >= 0) {
        const pieceId = state.grid[hoverCell.x][hoverCell.z];
        if (pieceId !== null && pieceId !== 'COMMONS') {
          playRotate();
          state = rotatePieceInPlace(state, pieceId);
          const piece = state.pieces.find(p => p.id === pieceId);
          const mesh = meshMap.get(pieceId);
          if (mesh && piece) {
            mesh.rotation.y = (piece.rotation * Math.PI) / 180;
            // Update resident position to match new porch direction
            const resident = residents.find(r => r.cottageId === pieceId);
            if (resident) {
              const rMesh = residentMeshMap.get(resident.id);
              if (rMesh) {
                const size = PIECE_SIZES.COTTAGE;
                const cx = piece.x - halfGrid + size.w / 2;
                const cz = piece.z - halfGrid + size.h / 2;
                const dir = { 0: { dx: 0, dz: 1.3 }, 90: { dx: 1.3, dz: 0 }, 180: { dx: 0, dz: -1.3 }, 270: { dx: -1.3, dz: 0 } };
                const offset = dir[piece.rotation] || dir[0];
                rMesh.position.set(cx + offset.dx, 0, cz + offset.dz);
              }
            }
          }
          updateUI();

          // Check tutorial completion
          if (inTutorial && isTutorialSolved(state.pieces)) {
            showTutorialSuccess(() => {
              // Clear tutorial pieces and start real game
              inTutorial = false;
              syncStateToScene(createInitialState());
              // Re-mark commons
              for (let dx = 0; dx < 3; dx++) {
                for (let dz = 0; dz < 3; dz++) {
                  state.grid[3 + dx][3 + dz] = 'COMMONS';
                }
              }
              updateUI();
            });
          }
        }
      }
    }

    // Ctrl+Z: undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      syncStateToScene(undo(state));
    }

    // Ctrl+Shift+Z or Ctrl+Y: redo
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Z' || e.key === 'y')) {
      e.preventDefault();
      syncStateToScene(redo(state));
    }

    // Number keys 1-8: select piece type
    const types = ['COTTAGE', 'PORCH', 'PATH', 'GARDEN', 'FIREPIT', 'BENCH', 'MAILBOX', 'TREE'];
    const num = parseInt(e.key);
    if (num >= 1 && num <= 8) {
      state = { ...state, selectedType: types[num - 1] };
      updatePreview();
      updateUI();
    }
  });

  // Rebuild all meshes from state (for undo/redo)
  function syncStateToScene(newState) {
    // Remove all existing piece meshes
    for (const [id, mesh] of meshMap) {
      scene.remove(mesh);
    }
    meshMap.clear();

    // Remove all resident meshes
    for (const [id, mesh] of residentMeshMap) {
      scene.remove(mesh);
    }
    residentMeshMap.clear();
    residents = [];
    resetResidentPool();

    state = newState;

    // Recreate all piece meshes + residents
    for (const piece of state.pieces) {
      const mesh = PIECE_FACTORIES[piece.type]();
      mesh.rotation.y = (piece.rotation * Math.PI) / 180;
      const size = PIECE_SIZES[piece.type];
      mesh.position.set(
        piece.x - halfGrid + size.w / 2, 0,
        piece.z - halfGrid + size.h / 2
      );
      scene.add(mesh);
      meshMap.set(piece.id, mesh);

      if (piece.type === 'COTTAGE') {
        spawnResident(piece.id, piece.x, piece.z, piece.rotation);
      }
    }
    updatePreview();
    updateUI();
  }

  // ─── UI overlay ───
  const uiContainer = document.createElement('div');
  uiContainer.id = 'game-ui';
  uiContainer.innerHTML = `
    <style>
      #game-ui {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        font-family: 'Nunito', sans-serif;
        color: #6b4e3a;
        z-index: 10;
      }
      #game-name {
        position: absolute;
        top: 12px; left: 12px;
      }
      #game-logo {
        height: 56px;
        mix-blend-mode: screen;
        opacity: 0.85;
      }
      #score-display {
        position: absolute;
        top: 16px; right: 20px;
        text-align: right;
      }
      #score-label { font-size: 0.75rem; opacity: 0.6; }
      #score-value {
        font-family: 'Lora', serif;
        font-size: 2.5rem;
        font-weight: 700;
        line-height: 1;
      }
      #piece-palette {
        position: absolute;
        top: 50%;
        left: 16px;
        transform: translateY(-50%);
        background: rgba(240, 228, 208, 0.85);
        border-radius: 12px;
        padding: 8px;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .palette-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        transition: background 0.15s;
        user-select: none;
      }
      .palette-item:hover { background: rgba(139, 107, 74, 0.1); }
      .palette-item.selected { background: rgba(139, 107, 74, 0.2); }
      .palette-item.exhausted { opacity: 0.3; pointer-events: none; }
      #piece-palette.morphed {
        transition: all 0.6s ease;
        padding: 0;
      }
      .palette-morph-settle {
        padding: 20px 16px;
        text-align: center;
        font-family: 'Lora', serif;
        font-size: 1.2rem;
        font-weight: 700;
        color: #f5efe6;
        background: rgba(201, 122, 92, 0.9);
        border-radius: 12px;
        cursor: pointer;
        animation: settlePulse 2s ease-in-out infinite;
        user-select: none;
      }
      .palette-morph-settle:hover { background: rgba(201, 122, 92, 1); }
      .palette-count {
        margin-left: auto;
        font-size: 0.75rem;
        opacity: 0.6;
      }
      .palette-icon {
        width: 20px; height: 20px;
        border-radius: 4px;
      }
      #controls-hint {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.7rem;
        opacity: 0.4;
      }
      #mobile-controls {
        position: absolute;
        bottom: 48px;
        right: 16px;
        display: flex;
        gap: 8px;
        pointer-events: auto;
      }
      .mobile-btn {
        width: 44px;
        height: 44px;
        border-radius: 8px;
        border: none;
        background: rgba(240, 228, 208, 0.85);
        color: #6b4e3a;
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        font-family: 'Nunito', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .mobile-btn:active { background: rgba(139, 107, 74, 0.3); }
      #timer-display {
        font-family: 'Nunito', sans-serif;
        font-size: 1rem;
        font-weight: 700;
        opacity: 0.7;
        margin-top: 4px;
      }
      #timer-display.warning { color: #c97a5c; }
      #mode-toggle {
        position: absolute;
        top: 50px; right: 20px;
        pointer-events: auto;
      }
      #settle-btn {
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(201, 122, 92, 0.9);
        color: #f5efe6;
        border: none;
        border-radius: 12px;
        padding: 12px 32px;
        font-family: 'Lora', serif;
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        pointer-events: auto;
        transition: background 0.2s, transform 0.15s;
        display: none;
      }
      #settle-btn:hover { background: rgba(201, 122, 92, 1); transform: translateX(-50%) scale(1.05); }
      #settle-btn.visible { display: block; }
      #settle-btn.pulse {
        animation: settlePulse 2s ease-in-out infinite;
      }
      @keyframes settlePulse {
        0%, 100% { transform: translateX(-50%) scale(1); }
        50% { transform: translateX(-50%) scale(1.08); }
      }
      #settle-btn:disabled { opacity: 0.5; cursor: default; pointer-events: none; }
      #story-card {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(240, 228, 208, 0.95);
        border-radius: 16px;
        padding: 32px 40px;
        max-width: 420px;
        text-align: center;
        pointer-events: auto;
        box-shadow: 0 8px 32px rgba(107, 78, 58, 0.25);
      }
      #story-card.hidden { display: none; }
      #story-beat-name {
        font-family: 'Nunito', sans-serif;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.5;
        margin-bottom: 8px;
      }
      #story-caption {
        font-family: 'Lora', serif;
        font-size: 1.1rem;
        font-style: italic;
        line-height: 1.6;
        margin-bottom: 16px;
      }
      #story-score {
        font-family: 'Lora', serif;
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 16px;
      }
      #story-close, #story-share {
        background: rgba(139, 107, 74, 0.15);
        border: none;
        border-radius: 8px;
        padding: 8px 24px;
        font-family: 'Nunito', sans-serif;
        font-size: 0.85rem;
        font-weight: 600;
        color: #6b4e3a;
        cursor: pointer;
      }
      #story-close:hover, #story-share:hover { background: rgba(139, 107, 74, 0.25); }
      #story-share { background: rgba(201, 122, 92, 0.2); }
      #settle-progress {
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 200px;
        height: 4px;
        background: rgba(139, 107, 74, 0.15);
        border-radius: 2px;
        overflow: hidden;
      }
      #settle-progress.hidden { display: none; }
      #settle-bar {
        height: 100%;
        background: rgba(201, 122, 92, 0.8);
        border-radius: 2px;
        width: 0%;
        transition: width 0.1s linear;
      }
      #resident-tooltip {
        position: absolute;
        pointer-events: none;
        background: rgba(240, 228, 208, 0.92);
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
        display: none;
        box-shadow: 0 2px 8px rgba(107, 78, 58, 0.15);
      }
      .tooltip-name { font-family: 'Lora', serif; font-size: 0.9rem; }
      .tooltip-trait { opacity: 0.7; font-size: 0.7rem; margin-top: 2px; }
      @media (min-width: 769px) {
        #mobile-controls { display: none; }
      }
    </style>
    <div id="game-name"><img src="/logo.png" alt="Nearfolk" id="game-logo"></div>
    <div id="score-display">
      <div id="score-label">Neighborliness</div>
      <div id="score-value">0</div>
      <div id="timer-display"></div>
    </div>
    <div id="mode-toggle">
      <button id="mode-btn" class="mobile-btn" style="width:auto;padding:4px 12px;font-size:0.7rem;border-radius:6px;pointer-events:auto;">Practice</button>
    </div>
    <div id="piece-palette"></div>
    <div id="mobile-controls">
      <button class="mobile-btn" id="btn-rotate" title="Rotate">R</button>
      <button class="mobile-btn" id="btn-orbit-l" title="Orbit left">Q</button>
      <button class="mobile-btn" id="btn-orbit-r" title="Orbit right">E</button>
      <button class="mobile-btn" id="btn-undo" title="Undo">↩</button>
    </div>
    <div id="resident-tooltip"></div>
    <button id="settle-btn">Settle</button>
    <div id="story-card" class="hidden">
      <div id="story-beat-name"></div>
      <div id="story-caption"></div>
      <div id="story-score"></div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button id="story-share">Share postcard</button>
        <button id="story-close">Continue</button>
      </div>
    </div>
    <div id="settle-progress" class="hidden">
      <div id="settle-bar"></div>
    </div>
    <div id="controls-hint">Click place · R rotate · T rotate placed · Right-click remove · Q/E orbit · Scroll zoom · Ctrl+Z undo</div>
  `;
  document.body.appendChild(uiContainer);

  const paletteEl = document.getElementById('piece-palette');
  const scoreEl = document.getElementById('score-value');

  const PIECE_LABELS = {
    COTTAGE: { label: 'Cottage', color: '#f0e4d0' },
    PORCH: { label: 'Porch', color: '#c4a882' },
    PATH: { label: 'Path', color: '#c8b89c' },
    GARDEN: { label: 'Garden', color: '#7a9464' },
    FIREPIT: { label: 'Fire Pit', color: '#f4a65c' },
    BENCH: { label: 'Bench', color: '#c4a882' },
    MAILBOX: { label: 'Mailbox', color: '#c97a5c' },
    TREE: { label: 'Tree', color: '#7a9464' },
  };

  // ─── Visual connections (sightlines + lonely clouds) ───
  const connectionLines = [];
  const lonelyMarkers = [];

  function updateVisualConnections(connections, lonelyCottages) {
    // Clear old lines
    for (const line of connectionLines) scene.remove(line);
    connectionLines.length = 0;
    for (const marker of lonelyMarkers) scene.remove(marker);
    lonelyMarkers.length = 0;

    // Draw warm golden lines between connected porches
    for (const conn of connections) {
      const geo = new BufferGeometry();
      const positions = new Float32Array([
        conn.from.cx - halfGrid, 1.2, conn.from.cz - halfGrid,
        conn.to.cx - halfGrid, 1.2, conn.to.cz - halfGrid,
      ]);
      geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const mat = new LineBasicMaterial({
        color: 0xf4a65c,
        transparent: true,
        opacity: 0.5,
        linewidth: 1,
      });
      const line = new Line(geo, mat);
      scene.add(line);
      connectionLines.push(line);
    }

    // Draw small sad cloud spheres over lonely cottages
    for (const pos of lonelyCottages) {
      const cloud = new Mesh(
        new SphereGeometry(0.15, 6, 6),
        new MeshBasicMaterial({
          color: 0x9999aa,
          transparent: true,
          opacity: 0.6,
        })
      );
      cloud.position.set(pos.cx - halfGrid, 2.5, pos.cz - halfGrid);
      scene.add(cloud);
      lonelyMarkers.push(cloud);
    }
  }

  function updateUI() {
    const budgetEmpty = totalBudget(state) === 0;
    const hasCottages = state.pieces.some(p => p.type === 'COTTAGE');
    const settleBtn = document.getElementById('settle-btn');

    if (budgetEmpty && hasCottages && !isSettling) {
      // ─── MORPH: palette becomes Settle button ───
      paletteEl.innerHTML = '';
      paletteEl.classList.add('morphed');
      const morphBtn = document.createElement('div');
      morphBtn.className = 'palette-morph-settle';
      morphBtn.textContent = 'Settle';
      morphBtn.addEventListener('click', () => {
        settleBtn.click();
      });
      paletteEl.appendChild(morphBtn);
      settleBtn.classList.remove('visible');
    } else {
      // ─── Normal palette ───
      paletteEl.classList.remove('morphed');
      paletteEl.innerHTML = '';
      const types = Object.keys(PIECE_LABELS);
      types.forEach((type, i) => {
        const info = PIECE_LABELS[type];
        const count = state.budget[type];
        const item = document.createElement('div');
        item.className = 'palette-item';
        if (type === state.selectedType) item.classList.add('selected');
        if (count <= 0) item.classList.add('exhausted');
        item.innerHTML = `
          <div class="palette-icon" style="background:${info.color}"></div>
          <span>${info.label}</span>
          <span class="palette-count">${count}</span>
        `;
        item.addEventListener('click', () => {
          if (count <= 0) return;
          state = { ...state, selectedType: type };
          updatePreview();
          updateUI();
        });
        paletteEl.appendChild(item);
      });

      // Show settle button when cottages exist but budget isn't empty
      if (hasCottages && !isSettling) {
        settleBtn.classList.add('visible');
        settleBtn.classList.remove('pulse');
      } else {
        settleBtn.classList.remove('visible');
      }
    }

    // Live score + visual connections
    const scoreResult = computeScore(state.grid, state.pieces);
    const { total, breakdown, connections, lonelyCottages } = scoreResult;
    const prevScore = parseInt(scoreEl.textContent) || 0;
    if (total !== prevScore && total > prevScore) {
      playScoreTick(total);
    }
    scoreEl.textContent = total;
    scoreEl.title = [
      `Eyes: ${breakdown.eyeContactEdges || 0}×3`,
      `Nesting: ${breakdown.nestingBonuses || 0}×2`,
      `Porches: ${breakdown.porchEncounters || 0}×2`,
      `Nodes: ${breakdown.sharedNodeEncounters || 0}×2`,
      `Paths: ${breakdown.pathCrossings || 0}×1`,
      `Lonely: -${breakdown.lonelyResidents || 0}×5`,
      `Walls: -${breakdown.blankWallViews || 0}×1`,
    ].join('  ');

    // Draw sightline connections
    updateVisualConnections(connections, lonelyCottages);
  }

  updateUI();

  // ─── Tutorial ───
  if (inTutorial) {
    createTutorialUI();
    const tutorialPieces = getTutorialPieces();

    // Place tutorial cottages
    for (const tp of tutorialPieces) {
      // Mark grid
      const size = PIECE_SIZES[tp.type];
      for (let dx = 0; dx < size.w; dx++) {
        for (let dz = 0; dz < size.h; dz++) {
          state.grid[tp.x + dx][tp.z + dz] = tp.id;
        }
      }
      state.pieces = [...state.pieces, tp];

      // Create mesh
      const mesh = PIECE_FACTORIES[tp.type]();
      mesh.rotation.y = (tp.rotation * Math.PI) / 180;
      mesh.position.set(
        tp.x - halfGrid + size.w / 2, 0,
        tp.z - halfGrid + size.h / 2
      );
      scene.add(mesh);
      meshMap.set(tp.id, mesh);

      // Spawn resident
      spawnResident(tp.id, tp.x, tp.z, tp.rotation);
    }
    updateUI();
  }

  // ? button to replay tutorial
  const helpBtn = document.createElement('button');
  helpBtn.textContent = '?';
  helpBtn.className = 'mobile-btn';
  helpBtn.style.cssText = 'position:absolute;top:16px;right:80px;pointer-events:auto;width:32px;height:32px;font-size:0.9rem;border-radius:50%;';
  document.getElementById('game-ui').appendChild(helpBtn);
  // ─── Mode toggle (ranked/practice) ───
  const modeBtnEl = document.getElementById('mode-btn');
  const timerDisplayEl = document.getElementById('timer-display');
  let gameMode = 'practice';

  modeBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    gameMode = gameMode === 'practice' ? 'ranked' : 'practice';
    modeBtnEl.textContent = gameMode === 'practice' ? 'Practice' : 'Ranked (60s)';
    gameTimer.start(gameMode);
    if (gameMode === 'practice') {
      timerDisplayEl.textContent = '';
    }
  });

  // Mute button
  const muteBtn = document.createElement('button');
  muteBtn.textContent = '♪';
  muteBtn.className = 'mobile-btn';
  muteBtn.style.cssText = 'position:absolute;top:16px;right:120px;pointer-events:auto;width:32px;height:32px;font-size:0.9rem;border-radius:50%;';
  document.getElementById('game-ui').appendChild(muteBtn);
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const muted = toggleMute();
    muteBtn.textContent = muted ? '✕' : '♪';
    muteBtn.style.opacity = muted ? '0.4' : '1';
  });

  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Reset and show tutorial
    inTutorial = true;
    syncStateToScene(createInitialState());
    // Re-mark commons
    for (let dx = 0; dx < 3; dx++) {
      for (let dz = 0; dz < 3; dz++) {
        state.grid[3 + dx][3 + dz] = 'COMMONS';
      }
    }
    createTutorialUI();
    const tutorialPieces = getTutorialPieces();
    for (const tp of tutorialPieces) {
      const size = PIECE_SIZES[tp.type];
      for (let dx = 0; dx < size.w; dx++) {
        for (let dz = 0; dz < size.h; dz++) {
          state.grid[tp.x + dx][tp.z + dz] = tp.id;
        }
      }
      state.pieces = [...state.pieces, tp];
      const mesh = PIECE_FACTORIES[tp.type]();
      mesh.rotation.y = (tp.rotation * Math.PI) / 180;
      mesh.position.set(tp.x - halfGrid + size.w / 2, 0, tp.z - halfGrid + size.h / 2);
      scene.add(mesh);
      meshMap.set(tp.id, mesh);
      spawnResident(tp.id, tp.x, tp.z, tp.rotation);
    }
    updateUI();
  });

  // ─── Settle button ───
  const settleBtnEl = document.getElementById('settle-btn');
  const storyCardEl = document.getElementById('story-card');
  const settleProgressEl = document.getElementById('settle-progress');
  const settleBarEl = document.getElementById('settle-bar');

  settleBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isSettling) return;
    if (!state.pieces.some(p => p.type === 'COTTAGE')) return;

    isSettling = true;
    settleBtnEl.disabled = true;
    settleBtnEl.classList.remove('visible');
    settleProgressEl.classList.remove('hidden');

    // Create settle controller
    settleController = createSettleController(
      state.pieces, residents, state.grid,
      (directorResult) => {
        // Settle complete, show story card
        stopSettleUnderscore();
        playEndBell();
        isSettling = false;
        settleProgressEl.classList.add('hidden');
        settleBtnEl.disabled = false;

        const { total } = computeScore(state.grid, state.pieces);

        document.getElementById('story-beat-name').textContent = directorResult.beat.name;
        document.getElementById('story-caption').textContent = directorResult.caption;
        document.getElementById('story-score').textContent = total;
        storyCardEl.classList.remove('hidden');

        // Store for share card
        lastStoryData = {
          beatName: directorResult.beat.name,
          caption: directorResult.caption,
          score: total,
          date: todayUTC(),
        };

        // Submit to leaderboard if ranked mode
        if (gameMode === 'ranked' && !hasSubmittedToday()) {
          const storyRankEl = document.createElement('div');
          storyRankEl.id = 'story-rank';
          storyRankEl.style.cssText = 'font-size:0.8rem;opacity:0.6;margin-bottom:8px;';
          storyRankEl.textContent = 'Submitting score...';
          document.getElementById('story-score').after(storyRankEl);

          submitScore(todayUTC(), total, directorResult.beat.id).then(result => {
            if (result.success) {
              markScoreSubmitted(todayUTC(), total);
              storyRankEl.textContent = `Rank #${result.rank} of ${result.total} today`;
            } else {
              storyRankEl.textContent = result.error === 'Already submitted today'
                ? 'Already scored today'
                : 'Score saved locally';
            }
          });
        }

        updateUI();
      }
    );

    startSettleUnderscore();
    settleController.start(performance.now());
  });

  let lastStoryData = null;

  document.getElementById('story-share').addEventListener('click', async () => {
    if (!lastStoryData) return;
    const btn = document.getElementById('story-share');
    btn.textContent = 'Capturing...';
    try {
      const sceneCapture = captureShareCard(scene, camera);
      const postcard = await generatePostcard(
        sceneCapture,
        lastStoryData.beatName,
        lastStoryData.caption,
        lastStoryData.score,
        lastStoryData.date
      );
      await sharePostcard(postcard, `${lastStoryData.caption} — Nearfolk, ${lastStoryData.date}`);
    } catch (e) {
      console.error('Share failed:', e);
    }
    btn.textContent = 'Share postcard';
  });

  document.getElementById('story-close').addEventListener('click', () => {
    storyCardEl.classList.add('hidden');
  });

  // ─── Mobile buttons ───
  document.getElementById('btn-rotate').addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = ROTATIONS.indexOf(state.rotation);
    state = { ...state, rotation: ROTATIONS[(idx + 1) % ROTATIONS.length] };
    updatePreview();
  });
  document.getElementById('btn-orbit-l').addEventListener('click', (e) => {
    e.stopPropagation();
    orbitAngle -= Math.PI / 4;
    updateCamera();
  });
  document.getElementById('btn-orbit-r').addEventListener('click', (e) => {
    e.stopPropagation();
    orbitAngle += Math.PI / 4;
    updateCamera();
  });
  document.getElementById('btn-undo').addEventListener('click', (e) => {
    e.stopPropagation();
    syncStateToScene(undo(state));
  });

  // ─── Keyboard nav (arrow keys + space) ───
  let keyboardCursor = { x: Math.floor(GRID_SIZE / 2), z: Math.floor(GRID_SIZE / 2) };
  let keyboardActive = false;

  function activateKeyboard() {
    keyboardActive = true;
    hoverCell.x = keyboardCursor.x;
    hoverCell.z = keyboardCursor.z;
    highlight.position.set(
      keyboardCursor.x - halfGrid + 0.5, 0.02,
      keyboardCursor.z - halfGrid + 0.5
    );
    highlight.visible = true;
    updatePreview();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (!keyboardActive) { activateKeyboard(); return; }

      if (e.key === 'ArrowUp') keyboardCursor.z = Math.max(0, keyboardCursor.z - 1);
      if (e.key === 'ArrowDown') keyboardCursor.z = Math.min(GRID_SIZE - 1, keyboardCursor.z + 1);
      if (e.key === 'ArrowLeft') keyboardCursor.x = Math.max(0, keyboardCursor.x - 1);
      if (e.key === 'ArrowRight') keyboardCursor.x = Math.min(GRID_SIZE - 1, keyboardCursor.x + 1);

      hoverCell.x = keyboardCursor.x;
      hoverCell.z = keyboardCursor.z;
      highlight.position.set(
        keyboardCursor.x - halfGrid + 0.5, 0.02,
        keyboardCursor.z - halfGrid + 0.5
      );
      highlight.visible = true;
      updatePreview();
    }

    // Space: place piece (keyboard nav)
    if (e.key === ' ' && keyboardActive) {
      e.preventDefault();
      if (hoverCell.x < 0) return;
      if (!canPlace(state, state.selectedType, hoverCell.x, hoverCell.z)) return;

      const type = state.selectedType;
      const rotation = state.rotation;
      const x = hoverCell.x;
      const z = hoverCell.z;

      state = placePiece(state, type, x, z, rotation);
      const placed = state.pieces[state.pieces.length - 1];

      const mesh = PIECE_FACTORIES[type]();
      mesh.rotation.y = (rotation * Math.PI) / 180;
      const size = PIECE_SIZES[type];
      mesh.position.set(x - halfGrid + size.w / 2, 0, z - halfGrid + size.h / 2);
      scene.add(mesh);
      meshMap.set(placed.id, mesh);

      updatePreview();
      updateUI();
    }
  });

  // Deactivate keyboard nav when mouse moves
  window.addEventListener('mousemove', () => { keyboardActive = false; }, { once: false });

  // ─── Animation loop ───
  const startTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = (performance.now() - startTime) / 1000;

    // Camera breathing (gentle Y oscillation on top of orbit position)
    const breathY = Math.sin(elapsed * 0.3) * 0.1;
    camera.position.set(
      Math.cos(orbitAngle) * CAM_DIST,
      CAM_HEIGHT + breathY,
      Math.sin(orbitAngle) * CAM_DIST
    );
    camera.lookAt(0, 0, 0);

    // Lonely cloud bob
    for (const cloud of lonelyMarkers) {
      cloud.position.y = 2.5 + Math.sin(elapsed * 1.5 + cloud.position.x) * 0.1;
    }

    // Connection line pulse (subtle opacity breathing)
    for (const line of connectionLines) {
      line.material.opacity = 0.3 + Math.sin(elapsed * 2) * 0.15;
    }

    // Timer update
    if (gameTimer.isRunning && !isSettling) {
      const remaining = gameTimer.update();
      timerDisplayEl.textContent = gameTimer.formatTime(remaining);
      timerDisplayEl.className = remaining < 10 ? 'warning' : '';
    }

    // Settle animation tick
    if (settleController && settleController.isRunning) {
      const result = settleController.update(performance.now());
      settleBarEl.style.width = (result.progress * 100) + '%';

      // Move residents to their timeline positions
      for (const { residentId, position } of result.positions) {
        const mesh = residentMeshMap.get(residentId);
        if (mesh) {
          mesh.position.x = position.x;
          mesh.position.z = position.z;
          mesh.position.y = Math.sin(elapsed * 8 + mesh.position.x) * 0.05;
        }
      }

      // Encounter particles: spawn hearts when two residents are close
      const positions = result.positions;
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i].position;
          const b = positions[j].position;
          const dist = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
          if (dist < 1.5) {
            // Spawn a heart particle at midpoint (throttle: only every ~2 seconds)
            if (Math.random() < 0.02) {
              const heart = new Mesh(
                new SphereGeometry(0.08, 4, 4),
                new MeshBasicMaterial({ color: 0xf4a65c, transparent: true, opacity: 0.8 })
              );
              heart.position.set(
                (a.x + b.x) / 2,
                1.0 + Math.random() * 0.5,
                (a.z + b.z) / 2
              );
              scene.add(heart);
              // Float up and fade
              const startY = heart.position.y;
              const startTime = elapsed;
              const animateHeart = () => {
                const age = (performance.now() / 1000 - startTime);
                if (age > 2) {
                  scene.remove(heart);
                  return;
                }
                heart.position.y = startY + age * 0.3;
                heart.material.opacity = 0.8 * (1 - age / 2);
                requestAnimationFrame(animateHeart);
              };
              animateHeart();
            }
          }
        }
      }

      // Lighting shift: dawn (warm) to dusk (golden orange)
      const sunProgress = result.progress;
      const sunAngle = 10 + sunProgress * 5;
      key.position.y = sunAngle;
      key.intensity = 0.7 + sunProgress * 0.5;
      ambient.intensity = 0.3 + sunProgress * 0.2;
    } else {
      // Resident idle bob (all spawned residents breathe gently)
      for (const [id, mesh] of residentMeshMap) {
        mesh.position.y = Math.sin(elapsed * 2 + mesh.position.x * 3) * 0.03;
      }
    }

    composer.render();
  }

  animate();

  // ─── Resize ───
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    hTilt.uniforms.h.value = 1.5 / window.innerHeight;
    vTilt.uniforms.v.value = 1.5 / window.innerWidth;
    updateCamera();
  });
}
