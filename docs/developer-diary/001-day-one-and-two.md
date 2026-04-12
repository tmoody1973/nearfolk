# Dev Diary #001 — The First Two Days

**Date:** April 12, 2026
**Author:** Tarik Moody
**Commits:** `47669dc` through `04b345b`

---

## What happened

Nearfolk went from a 15,000-word design doc and a name I didn't love to a playable spatial puzzle in one sitting. The game was called Pocket Neighborhood until this morning. That name is technically accurate (Ross Chapin coined the term, I'm building the real thing in Milwaukee) but it sounds like a Wikipedia article. "Nearfolk" came out of a brainstorming session. "Near" is architectural... proximity is what drives connection. "Folk" is communal. It sounds like a place that already exists, somewhere you'd want to live.

By end of day: 8 procedural piece types on a 10x10 grid, camera zoom and orbit, full undo/redo, and a live scoring engine that updates as you place pieces. 135KB gzipped. The thesis is in the player's hands.

## The moment it felt real

Placing two cottages facing each other across 3 empty cells and watching the score tick up by 3. Then dropping a tree between them and watching it drop back. That's the entire design argument in one interaction. Sightlines create connection. Obstacles break it. Ross Chapin has been saying this since 1996. Now you can feel it with a mouse click.

## Technical observations

**Three.js bundle size is manageable if you're disciplined.** Tree-shaken imports from `three` plus EffectComposer, tilt-shift, and vignette shaders: 135KB gzipped. The whole scoring engine, state management, 8 piece factories, and UI overlay added maybe 5KB to that. The game logic is essentially free. The renderer is the budget.

**Dropping Tone.js was the right call.** The original spec called for Tone.js for audio. Bundle audit showed Three.js at ~170KB + Tone.js at ~60KB = 230KB before writing any game code. That leaves 20KB for everything else on a 250KB budget. Web Audio API does everything we need (ambient pad, foley samples, glockenspiel notes) at 0KB bundle cost. The API is more verbose but the game's audio needs are simple.

**Immutable state with undo/redo for free.** Every state mutation returns a new object. The old state gets pushed onto an undo stack. Undo pops the stack and pushes current state to redo. This pattern is maybe 20 lines of code and it makes the game feel professional. Players can experiment freely. Place 5 cottages, undo 3, try a different arrangement. The build phase goes from "careful placement" to "rapid experimentation," which is where spatial puzzles get fun.

**The scoring engine is pure math, no Three.js dependency.** `computeScore(grid, pieces)` takes a 2D array and a list of piece objects, returns a number and a breakdown. No scene graph, no meshes, no rendering context. This means unit tests can run without WebGL. It also means the scoring logic can run on the server if we ever need server-side score validation.

```
Neighborliness = eyes×3 + nodes×2 + paths×1 - lonely×5 - walls×1
```

Five terms. Each one maps to a visible event the player can see and reason about. The formula is simple enough to hold in your head but deep enough that optimal play requires real spatial thinking.

**Orthographic raycasting just works in Three.js now.** The outside voice warned that `Raycaster.setFromCamera()` assumes perspective math. Either Three.js fixed this in recent versions or the warning was outdated, because the ortho raycaster hit the ground plane perfectly on the first try. No manual unprojection needed. Filed that under "verify warnings before acting on them."

## What I'm thinking about

**The eye-contact cone geometry is still loosely defined.** Right now, sightline detection casts a single ray from the porch center in the facing direction. The spec says "facing cones intersect" which implies an angular spread, not a single ray. A 90-degree cone would catch diagonal sightlines (cottage at 0,0 facing +Z can see cottage at 1,3). A single ray misses those. This needs tuning in Week 2 when I can feel whether the scoring is too tight or too generous.

**The palette-to-Settle morph is going to be the signature moment.** The design review decided that when the piece budget hits zero, the entire palette panel smoothly morphs into a Settle button with a gentle pulse. The items fade out one by one as you use them. Last piece placed, the palette becomes the invitation to watch what happens. I haven't built this yet but I can already feel the emotional beat. Building phase ends. Story phase begins. That transition IS the game.

**Cottage color cycling is a small thing that matters a lot.** Each cottage gets the next color in a 4-color cycle (cream, terracotta, sage, dusty rose). This means a neighborhood of 5 cottages has visual variety without any player effort. It also means each cottage is visually distinct, which matters when the Director starts telling stories about specific residents. "June noticed Maya hadn't been out all week" only works if the player can tell June's cottage from Maya's.

## The real risk

The spec is ambitious. 12 Director beats, 15 traits, story card output, daily seed, leaderboard, audio pass, onboarding tutorial... all for a May 1 deadline. The CEO review accepted Selective Expansion mode, which means the scope actually grew (undo/redo, ghost tutorial, seed share codes, mobile controls, accessibility). The plan says "ship Tier 1 before touching Tier 2" and I believe that's the right discipline, but Tier 1 is still a lot.

The scoring engine is done. The placement system works. Camera controls feel good. What's left is the hard part: making the settle animation tell stories, making the Director pick the right ones, and making the whole thing feel like a place where small kindnesses happen.

That's next week. This week is about proving the vibe. And the vibe is proven.

## Lines of code

```
src/scene.js      ~320 lines  (renderer, camera, UI, placement)
src/state.js      ~130 lines  (game state, undo/redo, immutable ops)
src/scoring.js    ~200 lines  (pure scoring engine)
src/pieces/       ~150 lines  (8 procedural piece factories)
─────────────────────────────
Total game code:  ~800 lines
Bundle:           135KB gzipped
Time:             1 day
```

---

*Next entry: Week 2, Day Director and the settle animation. The part where the game stops being a puzzle and starts being a story.*
