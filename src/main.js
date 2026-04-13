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
  try {
    createScene();
  } catch (e) {
    console.error('Nearfolk scene init failed:', e);
    document.body.style.background = '#f5efe6';
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed;bottom:20px;left:20px;background:rgba(200,80,80,0.9);color:white;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:13px;max-width:80vw;z-index:999';
    errDiv.textContent = 'Error: ' + e.message;
    document.body.appendChild(errDiv);
  }
}
