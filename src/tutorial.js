// Nearfolk ghost tutorial
//
// First-visit onboarding. Two cottages pre-placed facing away from
// each other. Player rotates one. Hearts appear. Score jumps.
// They learn "direction matters" without reading a word.
//
// After completion, clears the tutorial pieces and starts the real game.
// Accessible anytime via ? button.

import { GRID_SIZE, PIECE_SIZES } from './state.js';

const TUTORIAL_KEY = 'nearfolk_tutorial_seen';
const halfGrid = GRID_SIZE / 2;

export function shouldShowTutorial() {
  try {
    return !localStorage.getItem(TUTORIAL_KEY);
  } catch {
    return true; // Private mode, show it anyway
  }
}

export function markTutorialSeen() {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // Private mode, no-op
  }
}

// Create the tutorial state: two cottages facing AWAY from the commons
// Player needs to rotate one to face the other to see the connection form
export function getTutorialPieces() {
  return [
    {
      id: 'tutorial-a',
      type: 'COTTAGE',
      x: 1, z: 4,
      rotation: 270,  // Facing left (away from cottage B)
    },
    {
      id: 'tutorial-b',
      type: 'COTTAGE',
      x: 6, z: 4,
      rotation: 90,   // Facing right (away from cottage A)
    },
  ];
}

// Check if the tutorial is "solved" (at least one cottage faces the other)
export function isTutorialSolved(pieces) {
  const a = pieces.find(p => p.id === 'tutorial-a');
  const b = pieces.find(p => p.id === 'tutorial-b');
  if (!a || !b) return false;

  // A faces right (toward B) = rotation 90
  // B faces left (toward A) = rotation 270
  // Either one facing the other counts
  const aFacesB = a.rotation === 90;
  const bFacesA = b.rotation === 270;

  return aFacesB || bFacesA;
}

// Tutorial UI overlay
export function createTutorialUI() {
  const overlay = document.createElement('div');
  overlay.id = 'tutorial-overlay';
  overlay.innerHTML = `
    <style>
      #tutorial-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none;
        z-index: 20;
      }
      #tutorial-hint {
        position: absolute;
        bottom: 140px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(240, 228, 208, 0.92);
        border-radius: 12px;
        padding: 14px 24px;
        font-family: 'Lora', serif;
        font-size: 1rem;
        color: #6b4e3a;
        text-align: center;
        box-shadow: 0 4px 16px rgba(107, 78, 58, 0.15);
        transition: opacity 0.5s;
        line-height: 1.5;
      }
      #tutorial-hint.fade-out {
        opacity: 0;
      }
      #tutorial-success {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(240, 228, 208, 0.95);
        border-radius: 16px;
        padding: 28px 36px;
        font-family: 'Lora', serif;
        font-size: 1.1rem;
        color: #6b4e3a;
        text-align: center;
        box-shadow: 0 8px 32px rgba(107, 78, 58, 0.2);
        display: none;
        pointer-events: auto;
        line-height: 1.6;
      }
      #tutorial-success button {
        margin-top: 14px;
        background: rgba(201, 122, 92, 0.9);
        color: #f5efe6;
        border: none;
        border-radius: 8px;
        padding: 10px 28px;
        font-family: 'Lora', serif;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
      }
      #tutorial-success button:hover {
        background: rgba(201, 122, 92, 1);
      }
    </style>
    <div id="tutorial-hint">
      Hover a cottage and press <strong>T</strong> to rotate it.<br>
      Face the porches toward each other.
    </div>
    <div id="tutorial-success">
      <div style="font-size: 1.8rem; margin-bottom: 8px;">A connection.</div>
      <div style="font-size: 0.9rem; opacity: 0.7;">
        That's the whole game. Face porches toward each other.<br>
        The closer they look, the stronger the neighborhood.
      </div>
      <button id="tutorial-start-btn">Start building</button>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

export function showTutorialSuccess(onStart) {
  const hint = document.getElementById('tutorial-hint');
  const success = document.getElementById('tutorial-success');

  if (hint) hint.classList.add('fade-out');

  setTimeout(() => {
    if (success) success.style.display = 'block';
    if (hint) hint.style.display = 'none';
  }, 500);

  const btn = document.getElementById('tutorial-start-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      markTutorialSeen();
      const overlay = document.getElementById('tutorial-overlay');
      if (overlay) overlay.remove();
      if (onStart) onStart();
    });
  }
}

export function removeTutorialUI() {
  const overlay = document.getElementById('tutorial-overlay');
  if (overlay) overlay.remove();
}
