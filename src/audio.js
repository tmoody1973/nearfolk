// Nearfolk audio system — Web Audio API (0KB bundle cost)
//
// Sounds:
// - Ambient pad (warm drone, always playing)
// - Placement SFX (wooden clunk on piece place)
// - Score tick (glockenspiel note, pitch rises with score)
// - Settle underscore (piano enters at 8s, resolves at 22s)
// - End bell (single bell ring on story card)
//
// All synthesized. No sample files needed.
// AudioContext requires user gesture to start (browser policy).

let ctx = null;
let masterGain = null;
let ambientOsc = null;
let ambientGain = null;
let isInitialized = false;
let isMuted = false;

// Initialize on first user interaction
export function initAudio() {
  if (isInitialized) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(ctx.destination);
    isInitialized = true;
    startAmbient();
  } catch (e) {
    // Audio not available
  }
}

// Resume if suspended (browser autoplay policy)
function ensureRunning() {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

// ─── Ambient pad (warm drone) ───
function startAmbient() {
  if (!ctx || ambientOsc) return;

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(masterGain);

  // Two detuned oscillators for warmth
  ambientOsc = ctx.createOscillator();
  ambientOsc.type = 'sine';
  ambientOsc.frequency.value = 130.81; // C3

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 196.00; // G3
  osc2.detune.value = 5; // Slight detune for warmth

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;

  ambientOsc.connect(filter);
  osc2.connect(filter);
  filter.connect(ambientGain);

  ambientOsc.start();
  osc2.start();

  // Fade in over 2 seconds
  ambientGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);

  // Bird chirps every 8-15 seconds
  function scheduleBird() {
    if (!ctx || isMuted) return;
    const delay = 8 + Math.random() * 7;
    setTimeout(() => {
      if (!ctx || isMuted) { scheduleBird(); return; }
      const bird = ctx.createOscillator();
      const bGain = ctx.createGain();
      bird.type = 'sine';
      bird.frequency.value = 2000 + Math.random() * 1000;
      bird.frequency.linearRampToValueAtTime(1500 + Math.random() * 800, ctx.currentTime + 0.15);
      bGain.gain.value = 0.03;
      bGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      bird.connect(bGain);
      bGain.connect(masterGain);
      bird.start();
      bird.stop(ctx.currentTime + 0.2);
      scheduleBird();
    }, delay * 1000);
  }
  scheduleBird();

  // Wind chime every 20-30 seconds
  function scheduleChime() {
    if (!ctx) return;
    const delay = 20 + Math.random() * 10;
    setTimeout(() => {
      if (!ctx || isMuted) { scheduleChime(); return; }
      const chime = ctx.createOscillator();
      const cGain = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.value = 1200 + Math.random() * 400;
      cGain.gain.value = 0.02;
      cGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      chime.connect(cGain);
      cGain.connect(masterGain);
      chime.start();
      chime.stop(ctx.currentTime + 1.0);
      scheduleChime();
    }, delay * 1000);
  }
  scheduleChime();
}

// ─── Placement SFX (varies by piece type) ───
export function playPlace(pieceType = 'COTTAGE') {
  if (!ctx || isMuted) return;
  ensureRunning();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Different sound per piece type
  const sounds = {
    COTTAGE: { type: 'triangle', freq: 180, dur: 0.2, vol: 0.15 },
    TREE: { type: 'sawtooth', freq: 400, dur: 0.1, vol: 0.06 }, // leaf rustle
    PATH: { type: 'square', freq: 300, dur: 0.08, vol: 0.08 }, // stone clink
    GARDEN: { type: 'sine', freq: 250, dur: 0.15, vol: 0.1 }, // soft dirt
    FIREPIT: { type: 'triangle', freq: 150, dur: 0.2, vol: 0.12 }, // deeper
    BENCH: { type: 'triangle', freq: 220, dur: 0.12, vol: 0.1 },
    MAILBOX: { type: 'square', freq: 350, dur: 0.08, vol: 0.08 }, // metallic
    PORCH: { type: 'triangle', freq: 200, dur: 0.15, vol: 0.12 },
  };

  const s = sounds[pieceType] || sounds.COTTAGE;
  osc.type = s.type;
  osc.frequency.value = s.freq + Math.random() * 40;
  gain.gain.value = s.vol;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.dur);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + s.dur);
}

// ─── Remove SFX (softer reverse clunk) ───
export function playRemove() {
  if (!ctx || isMuted) return;
  ensureRunning();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.value = 160;

  gain.gain.value = 0.08;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

// ─── Score tick (glockenspiel, pitch rises with score) ───
export function playScoreTick(score) {
  if (!ctx || isMuted) return;
  ensureRunning();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  // Pitch rises with score: C5 to C6
  const baseFreq = 523.25; // C5
  const maxFreq = 1046.50; // C6
  const freq = baseFreq + (maxFreq - baseFreq) * Math.min(1, score / 100);
  osc.frequency.value = freq;

  gain.gain.value = 0.1;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// ─── Rotate SFX ───
export function playRotate() {
  if (!ctx || isMuted) return;
  ensureRunning();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 440;
  osc.frequency.linearRampToValueAtTime(520, ctx.currentTime + 0.08);

  gain.gain.value = 0.06;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}

// ─── Settle underscore (warm pad swell) ───
let settleNodes = null;

export function startSettleUnderscore() {
  if (!ctx || isMuted) return;
  ensureRunning();

  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(masterGain);

  // Warm chord: C3, E3, G3, C4
  const freqs = [130.81, 164.81, 196.00, 261.63];
  const oscs = freqs.map(f => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start();
    return osc;
  });

  // Fade in over 3 seconds
  gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3);

  // Piano-like note at 8 seconds
  setTimeout(() => {
    if (!ctx) return;
    const pianoOsc = ctx.createOscillator();
    const pianoGain = ctx.createGain();
    pianoOsc.type = 'triangle';
    pianoOsc.frequency.value = 523.25; // C5
    pianoGain.gain.value = 0.08;
    pianoGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
    pianoOsc.connect(pianoGain);
    pianoGain.connect(masterGain);
    pianoOsc.start();
    pianoOsc.stop(ctx.currentTime + 2);
  }, 8000);

  settleNodes = { oscs, gain };
}

export function stopSettleUnderscore() {
  if (!settleNodes) return;
  const { oscs, gain } = settleNodes;

  // Fade out over 2 seconds
  if (ctx) {
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
    setTimeout(() => {
      oscs.forEach(o => { try { o.stop(); } catch {} });
    }, 2100);
  }
  settleNodes = null;
}

// ─── End bell (single ring) ───
export function playEndBell() {
  if (!ctx || isMuted) return;
  ensureRunning();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 880; // A5

  gain.gain.value = 0.12;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 1.5);
}

// ─── Mute toggle ───
export function toggleMute() {
  isMuted = !isMuted;
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.3;
  }
  return isMuted;
}

export function getIsMuted() {
  return isMuted;
}
