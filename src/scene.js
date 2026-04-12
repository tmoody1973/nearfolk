import {
  Scene,
  OrthographicCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  PlaneGeometry,
  MeshLambertMaterial,
  Mesh,
  Color,
  PCFSoftShadowMap,
  Raycaster,
  Vector2,
  Vector3,
  BoxGeometry,
  ConeGeometry,
  Group,
  SphereGeometry,
  BackSide,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

// Palette from spec §14
const COLORS = {
  groundSage: 0xa8b89a,
  cottageTerracotta: 0xc97a5c,
  cottageCream: 0xf0e4d0,
  roofBrown: 0x8b6b4a,
  porchWood: 0xc4a882,
  background: 0xf5efe6,
};

export function createScene() {
  const scene = new Scene();
  scene.background = new Color(COLORS.background);

  // --- Camera (orthographic isometric) ---
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 15;
  const camera = new OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    100
  );
  camera.position.set(12, 12, 12);
  camera.lookAt(0, 0, 0);

  // --- Renderer ---
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // --- Lights ---
  // Ambient: warm fill
  const ambient = new AmbientLight(0xffe8cc, 0.4);
  scene.add(ambient);

  // Key light: golden hour sun
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

  // Rim: cool counter-light
  const rim = new DirectionalLight(0x88aaff, 0.2);
  rim.position.set(-8, 5, -8);
  scene.add(rim);

  // --- Ground plane (10x10 grid) ---
  const gridSize = 10;
  const groundGeo = new PlaneGeometry(gridSize, gridSize);
  const groundMat = new MeshLambertMaterial({
    color: COLORS.groundSage,
    flatShading: true,
  });
  const ground = new Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Sky sphere (warm gradient) ---
  const skyGeo = new SphereGeometry(40, 16, 16);
  const skyMat = new MeshLambertMaterial({
    color: 0xf0d9bf,
    side: BackSide,
    flatShading: true,
  });
  const sky = new Mesh(skyGeo, skyMat);
  scene.add(sky);

  // --- Post-processing ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Tilt-shift (horizontal)
  const hTiltShift = new ShaderPass(HorizontalTiltShiftShader);
  hTiltShift.uniforms.h.value = 1.5 / window.innerHeight;
  hTiltShift.uniforms.r.value = 0.4;
  composer.addPass(hTiltShift);

  // Tilt-shift (vertical)
  const vTiltShift = new ShaderPass(VerticalTiltShiftShader);
  vTiltShift.uniforms.v.value = 1.5 / window.innerWidth;
  vTiltShift.uniforms.r.value = 0.4;
  composer.addPass(vTiltShift);

  // Vignette
  const vignette = new ShaderPass(VignetteShader);
  vignette.uniforms.offset.value = 1.0;
  vignette.uniforms.darkness.value = 0.8;
  composer.addPass(vignette);

  // --- Raycaster (ortho-corrected) ---
  const raycaster = new Raycaster();
  const mouse = new Vector2();
  const hoverCell = { x: -1, z: -1 };

  // Hover highlight quad
  const highlightGeo = new BoxGeometry(1, 0.02, 1);
  const highlightMat = new MeshLambertMaterial({
    color: 0xfff4e0,
    transparent: true,
    opacity: 0.3,
  });
  const highlight = new Mesh(highlightGeo, highlightMat);
  highlight.visible = false;
  scene.add(highlight);

  function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Ortho-corrected raycasting
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ground);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const halfGrid = gridSize / 2;
      const cellX = Math.floor(point.x + halfGrid);
      const cellZ = Math.floor(point.z + halfGrid);

      if (cellX >= 0 && cellX < gridSize && cellZ >= 0 && cellZ < gridSize) {
        hoverCell.x = cellX;
        hoverCell.z = cellZ;
        highlight.position.set(
          cellX - halfGrid + 0.5,
          0.02,
          cellZ - halfGrid + 0.5
        );
        highlight.visible = true;
      } else {
        highlight.visible = false;
      }
    } else {
      highlight.visible = false;
    }
  }

  window.addEventListener('mousemove', onMouseMove);

  // --- Procedural cottage (2x2 base + pyramid roof) ---
  function createCottage() {
    const group = new Group();

    // Base (2x2x1.5)
    const baseGeo = new BoxGeometry(1.8, 1.2, 1.8);
    const baseMat = new MeshLambertMaterial({
      color: COLORS.cottageCream,
      flatShading: true,
    });
    const base = new Mesh(baseGeo, baseMat);
    base.position.y = 0.6;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Roof (pyramid)
    const roofGeo = new ConeGeometry(1.4, 0.8, 4);
    const roofMat = new MeshLambertMaterial({
      color: COLORS.roofBrown,
      flatShading: true,
    });
    const roof = new Mesh(roofGeo, roofMat);
    roof.position.y = 1.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Porch (front face indicator)
    const porchGeo = new BoxGeometry(1.8, 0.1, 0.4);
    const porchMat = new MeshLambertMaterial({
      color: COLORS.porchWood,
      flatShading: true,
    });
    const porch = new Mesh(porchGeo, porchMat);
    porch.position.set(0, 0.05, 1.1);
    group.add(porch);

    return group;
  }

  // Place one demo cottage
  const cottage = createCottage();
  cottage.position.set(0, 0, 0);
  scene.add(cottage);

  // --- Resident (capsule + sphere head) ---
  // Simple cylinder body + sphere head for now
  const residentGroup = new Group();

  const bodyGeo = new BoxGeometry(0.2, 0.4, 0.2);
  const bodyMat = new MeshLambertMaterial({
    color: COLORS.cottageTerracotta,
    flatShading: true,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = 0.3;
  body.castShadow = true;
  residentGroup.add(body);

  const headGeo = new BoxGeometry(0.15, 0.15, 0.15);
  const headMat = new MeshLambertMaterial({
    color: COLORS.cottageCream,
    flatShading: true,
  });
  const head = new Mesh(headGeo, headMat);
  head.position.y = 0.58;
  head.castShadow = true;
  residentGroup.add(head);

  residentGroup.position.set(0, 0, 2);
  scene.add(residentGroup);

  // Resident walk path (hardcoded for demo)
  const walkPath = [
    new Vector3(0, 0, 2),
    new Vector3(2, 0, 2),
    new Vector3(2, 0, -1),
    new Vector3(0, 0, -1),
  ];
  let walkIndex = 0;
  let walkProgress = 0;
  const walkSpeed = 0.5;

  // --- Animation loop ---
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
    walkProgress += walkSpeed * 0.016;

    if (walkProgress >= 1) {
      walkProgress = 0;
      walkIndex = (walkIndex + 1) % walkPath.length;
    }

    residentGroup.position.lerpVectors(from, to, walkProgress);
    // Bob walk
    residentGroup.position.y = Math.sin(elapsed * 8) * 0.05;

    composer.render();
  }

  animate();

  // --- Resize handler ---
  window.addEventListener('resize', () => {
    const newAspect = window.innerWidth / window.innerHeight;
    camera.left = (frustumSize * newAspect) / -2;
    camera.right = (frustumSize * newAspect) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    hTiltShift.uniforms.h.value = 1.5 / window.innerHeight;
    vTiltShift.uniforms.v.value = 1.5 / window.innerWidth;
  });
}
