// Nearfolk build timer — optional 60-second countdown for ranked mode
//
// Ranked mode: 60s timer, auto-settle on expiry
// Practice mode: no timer, untimed

const RANKED_DURATION = 60; // seconds

export function createTimer(onExpire) {
  let startTime = null;
  let isRunning = false;
  let remaining = RANKED_DURATION;
  let mode = 'practice'; // 'ranked' or 'practice'

  function start(timerMode = 'practice') {
    mode = timerMode;
    if (mode === 'practice') {
      isRunning = false;
      remaining = Infinity;
      return;
    }
    startTime = performance.now();
    isRunning = true;
    remaining = RANKED_DURATION;
  }

  function update() {
    if (!isRunning || mode === 'practice') return remaining;

    const elapsed = (performance.now() - startTime) / 1000;
    remaining = Math.max(0, RANKED_DURATION - elapsed);

    if (remaining <= 0) {
      isRunning = false;
      if (onExpire) onExpire();
    }

    return remaining;
  }

  function formatTime(seconds) {
    if (seconds === Infinity) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function stop() {
    isRunning = false;
  }

  return {
    start,
    update,
    stop,
    formatTime,
    get isRunning() { return isRunning; },
    get remaining() { return remaining; },
    get mode() { return mode; },
  };
}
