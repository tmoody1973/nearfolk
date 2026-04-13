# Dev Diary #004 — The Director remembers

**Date:** April 13, 2026
**Author:** Tarik Moody
**Commits:** `a8e35ce` through `5344357`

---

## What happened

Yesterday the game had a working loop. Place, settle, story. It worked. It didn't feel like anything.

Today it remembers.

The Director has memory now. It knows who's lonely, who's been crossing paths, which story it told yesterday. It picks beats that build on what came before. And the settle animation shows the story instead of just telling it on a card. When the Director picks "The Check-In," you watch the Host walk across the commons to the lonely resident's porch, pause there for three seconds, and then both of them walk to the commons together. The story card confirms what you just saw with your own eyes.

Five rounds per session. The neighborhood persists. Stories chain. The journal fills up.

"Day 1: June noticed Maya hadn't been out all week. She brought coffee."
"Day 2: Someone lit the fire pit. Nobody remembers who. Everyone remembers the conversation."
"Day 3: The shared garden had two people in it today. Neither planned it."

That's the architecture of kindness, unfolding over time.

## The RimWorld lesson that changed everything

I spent the morning researching how RimWorld's storyteller actually works. Not the concept. The mechanics. Three things transferred directly.

**1. Wealth-based scaling.** In RimWorld, as your colony gets richer, the storyteller sends harder raids. In Nearfolk, as your Neighborliness Score grows and residents get more content, the Director picks more ambitious beats. Low-contentment neighborhoods get "The Check-In" and "The Quiet Day." High-contentment neighborhoods earn "The Potluck" and "The Unexpected Kindness." The neighborhood earns its stories.

**2. Colonist mood as a persistent number.** RimWorld colonists have a mood bar (0-100) that shifts constantly based on environment, relationships, and events. Each resident in Nearfolk now has a contentment value that goes up when they have encounters (+10), goes up when porches face each other (+5), and drops when they're isolated (-15). The Director reads the lowest-contentment resident to decide who needs a Check-In. You can SEE contentment: happy residents bounce, lonely ones hunch.

**3. Spiraling events through memory.** RimWorld's genius is that one event creates the conditions for the next. A raid injures a colonist, the injured colonist needs medicine, the doctor falls in love with the patient, the patient dies, the doctor has a mental break. Each link is logical but unpredictable. In Nearfolk, if June was the subject of a Check-In on Day 1 (she was lonely, Maya brought her coffee), then on Day 2 June becomes eligible to be the HELPER in someone else's Check-In. "June remembered how it felt." Fifteen lines of code. Enormous emotional payoff.

The article on Gamasutra (now Game Developer) had a phrase that stuck: "Human-made meaning proves more powerful than explicitly designed drama." The simple graphics trigger apophenia, the tendency to perceive meaning in ambiguity. Our flat-shaded pill-shaped residents with two colors and a name work BECAUSE they're simple. Players project personality onto them. The trait tooltip, the story caption, the color pair, that's enough for a person. Don't over-animate. Let the player's imagination do the work.

## Beat choreography

The settle animation used to send every resident to the nearest garden or firepit. They walked in parallel lines to generic positions. Nothing met. Nothing happened.

Now each beat has a choreography function. The Director picks "The Check-In" and returns `subjectId` (the lonely resident) and `helperId` (the Host). The choreography function builds custom waypoints:

```
CHECK_IN choreography:
  Helper: home → mailbox → home → subject's porch (PAUSE) → commons → home
  Subject: home → (waits) → (pause together) → commons → home
```

The pause is the moment. Three seconds where two residents stand next to each other on a porch. That's when the heart particle pops. That's the Check-In. The player watches it happen and THEN reads the caption: "June noticed Maya hadn't been out all week. She brought coffee."

The story card doesn't introduce the story. It confirms what you already felt.

Six beats have choreography now. Check-In, Potluck, Garden Club, Storyteller's Porch, Dusk Fire, Morning Wave. Each one is maybe 25 lines of waypoint arrays. Residents without choreography overrides get generic routines. The system is dead simple: a map from `residentId` to custom waypoints. If you're in the map, you do the choreography. If you're not, you walk your normal routine.

## Multi-round sessions

A session is now 5 days. After each settle, the story card appears. You click Continue. The grid keeps all your pieces. Budget refreshes with 2-3 random new pieces (paths, benches, trees, porches). You can adjust your layout for the next day. Move a cottage. Add a bench. Rotate a porch.

The puzzle shifts from "build the best neighborhood from scratch" to "given what happened yesterday, what should I change today?" Day 1 might reveal that Maya is lonely because her porch faces the edge. Day 2, you rotate her cottage toward the commons. Day 3, the Director notices she's having encounters now and picks "The Unexpected Kindness."

The journal is the artifact. After 5 days, it opens automatically. Five captions. Five days. One neighborhood's history. That's the thing you screenshot. That's the thing you show a friend. Not a score. A story.

## The contentment numbers

```
Start: 50
+10 per encounter during settle
+5 per eye-contact sightline
-15 if lonely (no encounters, no sightlines)
-5 per round with no encounters
```

Simple. A resident who has encounters every round sits around 70-80. A resident who's isolated drops to 20-30 within two rounds. The Director watches the lowest-contentment resident and leans on beats that help them. The player learns to watch for hunched residents and redesign their corner of the neighborhood.

Relationship strength works the same way. +1 per shared encounter, +3 if both involved in the same Director beat. Strength 3+ = "friends." Friends get a dusty rose line between their cottages (thinner than the golden sightlines, different color). The line gets brighter as the relationship grows.

## What I learned from SimCity Three.js clone

The SimCity clone had a clean pattern I stole: strict separation of render loop (every frame) from simulation tick (every second). In Nearfolk this translates to: the animation loop runs at 60fps and interpolates positions, but the Director and memory only update once per settle. The visual layer and the logic layer don't compete.

The other thing: SimCity uses `camera.zoom` for orthographic zoom instead of changing frustum size. Cleaner math, consistent raycasting. I switched to that today and added smooth lerping. Zoom and orbit feel buttery now. The camera eases into position instead of snapping.

## The Kenney UI

Swapped all CSS panels for Kenney UI Pack Adventure sprites. Brown panels with corner bolts for the palette and score. Brown buttons for the settle and story card. The whole thing reads as "game" now, not "web app." 10 PNG sprites, 7KB total. The sprites use CSS `border-image` for 9-slice scaling, so they resize cleanly at any dimension.

The code reviewer caught that the mute and help buttons were sitting on top of the score panel. Moved them to a toolbar row under the logo. UI layout bugs in games are the same as UI layout bugs in apps: obvious once you see them, invisible until someone plays on a different screen size.

## State of the codebase

```
src/scene.js       ~1500 lines (still too big, still works)
src/settle.js       ~250 lines (rewritten with choreography)
src/director.js     ~350 lines (reads memory, returns choreography IDs)
src/memory.js       ~200 lines (contentment, relationships, beat history)
src/journal.js       ~90 lines (story history overlay)
src/scoring.js      ~300 lines (pure, unchanged, still the best file)
src/state.js        ~170 lines (immutable, undo/redo)
src/residents.js    ~245 lines (15 traits)
src/audio.js        ~250 lines (Web Audio API)
src/share.js        ~140 lines (postcard PNG)
src/leaderboard.js   ~70 lines (score submission)
src/seed.js          ~90 lines (daily seed)
src/timer.js         ~60 lines (ranked countdown)
src/tutorial.js     ~170 lines (ghost tutorial)
src/pathfinding.js  ~110 lines (A* grid)
src/pieces/         ~200 lines (8 factories)
────────────────────────────────
Total:             ~4200 lines
Bundle:             151KB gzipped
```

scene.js is still the monster. Everything else is clean and focused. For a game jam this is fine. The architecture works. The Director reads memory. The settle shows the story. The journal records it. The player adjusts and settles again. Five days. Five stories. One neighborhood.

## The moment

Place two cottages facing each other. Drop a path between them. Hit Settle. Watch one resident walk to the other's porch, pause, then both walk to the commons. Read the caption: "June noticed Maya hadn't been out all week. She brought coffee."

Rotate Maya's cottage toward the garden for Day 2. The Director picks "Garden Club." Two residents end up side by side at the garden. "The shared garden had two people in it today. Neither planned it."

Day 3. The fire pit. Everyone converges. "Dusk. The fire pit. Four chairs. No agenda."

That's not a puzzle game with a cozy skin. That's a game about how good design creates the conditions for small kindnesses. That's the thesis. That's the ACRE capstone, turned into something you can feel with a mouse click.

---

*Next: polish pass. The settle animation timing needs work (some choreography waypoints feel rushed). The score reveal after settle needs more drama (fade, pause, then reveal). Audio during settle should shift with the phases (quiet morning pad, brighter midday, warm evening). And we need to test on mobile. 16 days left.*
