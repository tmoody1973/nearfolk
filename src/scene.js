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

export function createScene() {
  // ─── State ───
  let state = createInitialState();

  // Map piece IDs to Three.js groups for removal
  const meshMap = new Map();

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
  scene.add(new AmbientLight(0xffe8cc, 0.4));

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

  // ─── Commons (pre-placed shared space, 3x3 at center) ───
  const COMMONS_X = 3;
  const COMMONS_Z = 3;
  const COMMONS_W = 3;
  const COMMONS_H = 3;

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
    if (!canPlace(state, state.selectedType, hoverCell.x, hoverCell.z)) return;

    const factory = PIECE_FACTORIES[state.selectedType];
    if (!factory) return;

    previewMesh = factory();
    previewMesh.rotation.y = (state.rotation * Math.PI) / 180;

    const size = PIECE_SIZES[state.selectedType];
    previewMesh.position.set(
      hoverCell.x - halfGrid + size.w / 2,
      0,
      hoverCell.z - halfGrid + size.h / 2
    );

    // Ghost transparency
    previewMesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.4;
      }
    });
    scene.add(previewMesh);
  }

  function cellFromMouse(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(ground);
    if (hits.length === 0) return null;
    const p = hits[0].point;
    const cx = Math.floor(p.x + halfGrid);
    const cz = Math.floor(p.z + halfGrid);
    if (cx < 0 || cx >= GRID_SIZE || cz < 0 || cz >= GRID_SIZE) return null;
    return { x: cx, z: cz };
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
  window.addEventListener('mousemove', (e) => {
    const cell = cellFromMouse(e);
    if (cell) {
      hoverCell.x = cell.x;
      hoverCell.z = cell.z;
      highlight.position.set(cell.x - halfGrid + 0.5, 0.02, cell.z - halfGrid + 0.5);
      highlight.visible = true;
    } else {
      hoverCell.x = -1;
      hoverCell.z = -1;
      highlight.visible = false;
    }
    updatePreview();
  });

  // Left-click: place piece
  window.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    if (hoverCell.x < 0) return;
    if (!canPlace(state, state.selectedType, hoverCell.x, hoverCell.z)) return;

    const type = state.selectedType;
    const rotation = state.rotation;
    const x = hoverCell.x;
    const z = hoverCell.z;

    state = placePiece(state, type, x, z, rotation);
    const placed = state.pieces[state.pieces.length - 1];

    // Create mesh
    const mesh = PIECE_FACTORIES[type]();
    mesh.rotation.y = (rotation * Math.PI) / 180;
    const size = PIECE_SIZES[type];
    mesh.position.set(x - halfGrid + size.w / 2, 0, z - halfGrid + size.h / 2);
    scene.add(mesh);
    meshMap.set(placed.id, mesh);

    updatePreview();
    updateUI();
  });

  // Right-click: remove piece under cursor
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (hoverCell.x < 0) return;

    const pieceId = state.grid[hoverCell.x][hoverCell.z];
    if (pieceId === null) return;

    const mesh = meshMap.get(pieceId);
    if (mesh) {
      scene.remove(mesh);
      meshMap.delete(pieceId);
    }
    state = removePiece(state, pieceId);
    updatePreview();
    updateUI();
  });

  // ─── Keyboard ───
  window.addEventListener('keydown', (e) => {
    // R: rotate selected piece type (for next placement)
    if (e.key === 'r' || e.key === 'R') {
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
        if (pieceId !== null) {
          state = rotatePieceInPlace(state, pieceId);
          const piece = state.pieces.find(p => p.id === pieceId);
          const mesh = meshMap.get(pieceId);
          if (mesh && piece) {
            mesh.rotation.y = (piece.rotation * Math.PI) / 180;
          }
          updateUI();
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

    state = newState;

    // Recreate all meshes
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
        top: 16px; left: 20px;
        font-family: 'Lora', serif;
        font-size: 1.3rem;
        font-weight: 600;
        opacity: 0.7;
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
      @media (min-width: 769px) {
        #mobile-controls { display: none; }
      }
    </style>
    <div id="game-name">Nearfolk</div>
    <div id="score-display">
      <div id="score-label">Neighborliness</div>
      <div id="score-value">0</div>
    </div>
    <div id="piece-palette"></div>
    <div id="mobile-controls">
      <button class="mobile-btn" id="btn-rotate" title="Rotate">R</button>
      <button class="mobile-btn" id="btn-orbit-l" title="Orbit left">Q</button>
      <button class="mobile-btn" id="btn-orbit-r" title="Orbit right">E</button>
      <button class="mobile-btn" id="btn-undo" title="Undo">↩</button>
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

    // Live score + visual connections
    const scoreResult = computeScore(state.grid, state.pieces);
    const { total, breakdown, connections, lonelyCottages } = scoreResult;
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

  // ─── Resident (demo walker) ───
  const residentGroup = new Group();
  const body = new Mesh(
    new BoxGeometry(0.2, 0.4, 0.2),
    new MeshLambertMaterial({ color: 0xc97a5c, flatShading: true })
  );
  body.position.y = 0.3;
  body.castShadow = true;
  residentGroup.add(body);

  const head = new Mesh(
    new BoxGeometry(0.15, 0.15, 0.15),
    new MeshLambertMaterial({ color: 0xf0e4d0, flatShading: true })
  );
  head.position.y = 0.58;
  head.castShadow = true;
  residentGroup.add(head);

  residentGroup.position.set(0, 0, 2);
  scene.add(residentGroup);

  const walkPath = [
    new Vector3(0, 0, 2), new Vector3(2, 0, 2),
    new Vector3(2, 0, -1), new Vector3(0, 0, -1),
  ];
  let walkIndex = 0;
  let walkProgress = 0;

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

    // Resident walk
    const from = walkPath[walkIndex];
    const to = walkPath[(walkIndex + 1) % walkPath.length];
    walkProgress += 0.5 * 0.016;
    if (walkProgress >= 1) {
      walkProgress = 0;
      walkIndex = (walkIndex + 1) % walkPath.length;
    }
    residentGroup.position.lerpVectors(from, to, walkProgress);
    residentGroup.position.y = Math.sin(elapsed * 8) * 0.05;

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
