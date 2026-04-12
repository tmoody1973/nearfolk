import { WebGLRenderer } from 'three';
import { createScene } from './scene.js';

// WebGL check
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

if (!hasWebGL()) {
  const el = document.getElementById('no-webgl');
  el.style.display = 'flex';
} else {
  createScene();
}
