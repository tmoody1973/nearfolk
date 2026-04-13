# Dev Diary #003 — The invisible crash

**Date:** April 12, 2026
**Author:** Tarik Moody
**Commits:** `14a1f1b` through `51901c0`

---

## What happened

Built the entire game loop in one session. Day Director with 12 story beats. Settle animation with residents walking to activity nodes. Story card that appears afterward with a caption like "June noticed Maya hadn't been out all week. She brought coffee." A* pathfinding. Resident spawning with names and traits. The whole thing.

Then spent an hour chasing a bug where the ghost preview wouldn't follow the mouse.

## The bug

The ghost preview, the transparent piece that follows your cursor showing where it'll land, stopped working. It would only appear after pressing R to rotate. Moving the mouse did nothing. No error in the build. No error visible in the browser. Just... nothing.

Tarik found the error in the console:

```
scene.js:341 Uncaught TypeError: Cannot read properties of null (reading 'style')
```

The tooltip element for showing resident names on hover was referenced before the UI HTML was added to the DOM. The mousemove handler ran this:

```javascript
const tooltipEl = document.getElementById('resident-tooltip');

window.addEventListener('mousemove', (e) => {
    // ... raycasting, hover detection ...
    tooltipEl.style.display = 'none';  // CRASH: tooltipEl is null
    updatePreview();  // never reached
});
```

The `getElementById` call happened at line 319. The UI HTML that creates `#resident-tooltip` was added at line 540+. Every mousemove crashed before reaching `updatePreview()`. The R key handler called `updatePreview()` directly without touching the tooltip, so it worked fine.

One line. Killed the entire interaction system. And the build passed clean.

## The fix

```javascript
let tooltipEl = null;

window.addEventListener('mousemove', (e) => {
    if (!tooltipEl) tooltipEl = document.getElementById('resident-tooltip');
    // ... rest of handler with null guards ...
    updatePreview();  // now actually runs
});
```

Lazy resolution. Three lines. The kind of bug that takes 5 seconds to fix and 45 minutes to find.

## What I learned

**Silent crashes are the worst kind of bug.** The mousemove handler threw an error on every mouse movement, but JavaScript doesn't stop the page for uncaught errors in event handlers. It just silently skips the rest of the handler. The scene kept rendering. The keyboard kept working. Everything looked fine except the one thing that depended on mousemove completing. Without Tarik opening the console and reading the error, I would have kept looking in the wrong places.

**Initialization order matters in a single-file scene.** scene.js is ~1100 lines now. Event listeners are registered early (line 319). UI DOM is created later (line 540). In React or any component framework, this can't happen because lifecycle hooks enforce order. In vanilla JS, you're on your own. The code worked for days because the tooltip was added in the same commit as the mousemove handler, and the mousemove handler was originally simpler (no tooltip). The crash was introduced when I added the tooltip reference to the existing handler without checking where the DOM element was created.

**Build tools don't catch runtime DOM errors.** Vite builds clean. No warnings. No errors. The bug only exists at runtime, when the browser executes the code in order and the DOM element doesn't exist yet. TypeScript would catch `null` access with strict null checks. We're using vanilla JS. This is the tradeoff.

## What got built (before the bug hunt)

The game loop works end to end now. Place cottages, watch residents appear with names and traits, drop paths and gardens, hit Settle, watch the 25-second animation as residents walk their routines, read the Director's chosen story, see the final score.

**Day Director** picks from 12 beats based on neighborhood state. The Check-In fires when someone is lonely and a Host or Storyteller is nearby. The Potluck fires when path density is high and there are 4+ cottages. The Quiet Day is the fallback: "Nothing happened today. It was perfect." Each beat generates a caption from templates with the residents' actual names filled in.

The captions are the part I keep rereading. "June noticed Maya hadn't been out all week. She brought coffee." "Someone lit the fire pit. Nobody remembers who. Everyone remembers the conversation." "Dusk. The fire pit. Four chairs. No agenda." These are the shirt-tail aunties and uncles. This is the architecture of kindness, rendered as text.

**Settle animation** runs 25 seconds with four phases: morning (mailbox), midday (garden), afternoon (bench), evening (fire pit). Residents walk to the nearest activity node for each phase. The lighting shifts from dawn to dusk. The grid is locked during playback. A progress bar shows how far through the day you are.

**Residents** spawn when you place a cottage. Each gets a random name from a pool of 60, a color pair, and one trait from the weighted pool. Hovering a cottage shows the resident's name, trait icon, and description. 15 traits across three tiers. The trait determines what the Day Director can do with that resident.

## The state of the code

scene.js is too big. 1100+ lines in one file. It has the renderer, the camera, the grid, the placement system, the UI, the settle integration, the visual connections, the tooltip, the keyboard nav, the mobile buttons. That's too many concerns in one place. The state module is clean. The Director is clean. The settle controller is clean. But scene.js is doing the work of 5 files.

For a game jam with 18 days left, this is fine. The code works. The bug is fixed. But if this game lives past May 1, scene.js needs to be broken into scene (renderer + camera + lighting), grid (placement + hover + preview), ui (palette + score + tooltip + story card), and input (mouse + keyboard + mobile).

Not today. Today the game loop works.

## Lines of code

```
src/scene.js      ~1100 lines (too big, works anyway)
src/state.js       ~140 lines (clean, immutable)
src/scoring.js     ~270 lines (pure, Chapin-aligned)
src/director.js    ~280 lines (12 beats, template captions)
src/settle.js      ~150 lines (timeline animation controller)
src/pathfinding.js ~100 lines (A* on 10x10 grid)
src/residents.js   ~170 lines (names, colors, 15 traits)
src/pieces/        ~160 lines (8 procedural factories)
─────────────────────────────────
Total:            ~2370 lines
Bundle:            143KB gzipped
Time:              1 day (Day 2 of Week 2... technically still Day 1)
```

---

*Next entry: polish pass. Encounter particles. Audio. The settle animation needs to feel alive, not just functional. Right now residents walk to nodes and the Director tells a story. But you don't SEE the encounters happen. You don't hear the fire pit crackle. The math is right. The feeling isn't there yet.*
