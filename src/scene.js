import {
  Scene, OrthographicCamera, WebGLRenderer,
  AmbientLight, DirectionalLight,
  PlaneGeometry, MeshLambertMaterial, Mesh,
  Color, PCFSoftShadowMap,
  Raycaster, Vector2, Vector3,
  BoxGeometry, Group, SphereGeometry, BackSide,
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
  undo, redo, totalBudget,
} from './state.js';
import { PIECE_FACTORIES } from './pieces/index.js';

export function createScene() {
  // ─── State ───
  let state = createInitialState();

  // Map piece IDs to Three.js groups for removal
  const meshMap = new Map();

  const scene = new Scene();
  scene.background = new Color(0xf5efe6);

  // ─── Camera ───
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 15;
  const camera = new OrthographicCamera(
    (frustumSize * aspect) / -2, (frustumSize * aspect) / 2,
    frustumSize / 2, frustumSize / -2, 0.1, 100
  );
  camera.position.set(12, 12, 12);
  camera.lookAt(0, 0, 0);

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
  const halfGrid = GRID_SIZE / 2;

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
    // R: rotate
    if (e.key === 'r' || e.key === 'R') {
      const idx = ROTATIONS.indexOf(state.rotation);
      state = { ...state, rotation: ROTATIONS[(idx + 1) % ROTATIONS.length] };
      updatePreview();
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
    </style>
    <div id="game-name">Nearfolk</div>
    <div id="score-display">
      <div id="score-label">Neighborliness</div>
      <div id="score-value">0</div>
    </div>
    <div id="piece-palette"></div>
    <div id="controls-hint">Click to place · R to rotate · Right-click to remove · Ctrl+Z to undo · 1-8 to select</div>
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

    // Score (placeholder 0 until scoring.js is built)
    scoreEl.textContent = '0';
  }

  updateUI();

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

    // Camera breathing
    camera.position.y = 12 + Math.sin(elapsed * 0.3) * 0.1;
    camera.lookAt(0, 0, 0);

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
    const a = window.innerWidth / window.innerHeight;
    camera.left = (frustumSize * a) / -2;
    camera.right = (frustumSize * a) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    hTilt.uniforms.h.value = 1.5 / window.innerHeight;
    vTilt.uniforms.v.value = 1.5 / window.innerWidth;
  });
}
