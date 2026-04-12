# Pocket Neighborhood — Project Context

> **This document is the single source of truth for the Pocket Neighborhood game.**
> Read it fully before writing any code. When in doubt, conform to this document rather than improvising. If this document is ambiguous, ask before guessing.

---

## 1. Project Overview

**Pocket Neighborhood** is a cozy 90-second web game for Cursor Vibe Jam 2026. The player designs a small cottage cluster around a shared commons, then presses "Settle" and watches the neighborhood come to life for 25 seconds as residents walk their daily routines, form connections, and experience a small story directed by an AI-style event director inspired by RimWorld's storyteller system — inverted from a tragedy generator into a kindness generator.

The core emotional pitch: *a puzzle about the architecture of kindness.*

**Designer:** Tarik Moody — architect, public radio director, currently co-developing Avenues West Cottages (15 real pocket neighborhood homes in Milwaukee, breaking ground 2027). The game is the design research for that real project, rendered as a toy.

**Target outcome:** Ship a polished, distinctive, instantly-loading web game by May 1, 2026 at 13:37 UTC. Aim for Silver/Bronze at minimum, with an outside shot at Gold on the strength of the Avenues West story angle and design thesis.

---

## 2. Jam Constraints (hard rules — do not violate)

- **Deadline:** May 1, 2026 at 13:37 UTC. Ship by 9:00 UTC that morning — never at the buzzer.
- **Code authorship:** At least 90% of code must be written by AI assistants (Claude Code). Human is director/editor, not coder.
- **Format:** Free-to-play in a web browser. No logins, no signups, no account systems.
- **Performance:** Instant-load. First meaningful paint under 1 second on cold cache. No heavy loading screens.
- **Entry limit:** One game per person.
- **Hosting:** Own domain or subdomain preferred (e.g. `pocket.tarik.dev`).
- **Multiplayer:** Preferred but not required. Our daily-seed + shared-leaderboard structure is the "multiplayer" substitute.

---

## 3. Design Thesis

Good small communities work because of **layered privacy and sightlines**, not density. This is Ross Chapin's actual architectural theory, which underlies the real pocket neighborhood movement and the real Avenues West Cottages project.

The scoring system is a direct mechanical expression of this theory:
- You don't optimize density, money, or efficiency.
- You optimize the **number of small social connections** that emerge from your spatial choices.
- Every porch has a facing direction. Every shared node generates encounters. Every tree is a tactical sightline blocker or preserver.
- The puzzle is: *given this cast of residents and this lot, design a space where good things want to happen.*

**The RimWorld inversion:** Our Day Director uses RimWorld's storyteller architecture (state-aware beat selection, dramatic appropriateness scoring) — but where RimWorld generates disasters, we generate kindnesses. Same engine, opposite emotional vector.

---

## 4. Tech Stack (locked decisions — do not change without discussion)

- **Engine:** Three.js (latest stable). No React, no game framework. Vanilla JS with a small typed state object.
- **Build tool:** Vite.
- **Rendering:** Orthographic camera at isometric angle. `MeshLambertMaterial` with `flatShading: true`. Vertex colors, no textures.
- **Post-processing:** Three.js `EffectComposer` with tilt-shift pass, vignette, subtle bloom.
- **Audio:** Tone.js for ambient synth bed + score ticker. CC0 foley samples (freesound.org) for placement SFX, birds, wind chimes. Target ~1MB total audio.
- **AI "storyteller":** 100% deterministic JavaScript. NO LLM API CALLS in the critical path. The Director is scored-heuristic code; captions use templated strings with state-filled slots. (Optional: a single opt-in "Describe my neighborhood" button in Week 3 as stretch, calling Anthropic's Claude Haiku via a Cloudflare Worker proxy — but this is NOT in Tier 1.)
- **Backend:** One Cloudflare Worker for the global daily leaderboard. Two endpoints: `POST /score`, `GET /top100`. Cloudflare KV for storage. No user accounts.
- **Persistence:** `localStorage` only. One save key: `pocketNeighborhood_save`. Everything (current neighborhood, history, stats, unlocks) lives in one JSON blob, capped at ~500KB.
- **Deploy:** Cloudflare Pages on a subdomain.
- **Bundle target:** Under 250KB gzipped for code, under 1MB for audio, under 150KB for assets (if any). First meaningful paint under 1 second.

**Explicitly NOT using:**
- Spotify / Deezer / any music streaming API (wrong game — this is for the Crate Diggers concept)
- LLMs in the core loop (latency, cost, reliability, tone risk)
- Godot or any engine other than Three.js (WebAssembly bundle sizes violate instant-load)
- Textured 3D models as the primary visual style (flat shading + lighting is the look)

---

## 5. Game Pieces

Eight piece types, and eight only. Every piece has a distinct mechanical role. Do NOT add a ninth piece without explicit approval — scope discipline is a ship requirement.

| Piece | Size | Role | Key mechanics |
|---|---|---|---|
| **Cottage** | 2×2, rotatable | Houses one resident | Has a **front face** = porch side. This is the most important attribute. Rotation is the whole placement game. |
| **Porch extension** | 1×1, attaches to cottage front | Extends eye-contact cone by 1 tile | Optional. Amplifies cottage reach. |
| **Path** | 1×1 | Connects cottages to commons and each other | Required. No path = resident can't leave = automatic loneliness penalty. |
| **Shared garden** | 2×2 | Afternoon encounter node | Counts for every cottage whose porch can see it. |
| **Fire pit** | 1×1 | Evening encounter node | High-value; everyone converges at dusk. |
| **Bench** | 1×1 | Path-side encounter node | Low-value but flexible. Converts path traffic into encounters. |
| **Mailbox cluster** | 1×1 | Morning encounter node | Reliable low-value generator. |
| **Tree** | 1×1 | Sightline blocker OR preserver | Tactical piece. Can wreck eye-contact graphs or save them (by blocking porches from seeing blank cottage walls). |

**The lot:** 10×10 grid with a pre-placed **commons** (usually 3×3 or 4×4) near the middle. Players build AROUND the commons, not on a blank slate. The commons position and shape varies by daily seed.

---

## 6. Scoring System

```
Neighborliness Score =
    Σ(eye-contact edges)       × 3
  + Σ(shared-node encounters)  × 2
  + Σ(path-crossing encounters) × 1
  − Σ(lonely residents)        × 5
  − Σ(blank-wall views)        × 1
  + Director beat bonuses      (variable)
```

**Eye-contact edge:** Porch A's facing cone intersects porch B's facing cone across open commons or path, with no tree blocking. The big points. Incentivizes thoughtful rotation and spacing.

**Shared-node encounter:** Two residents' daily routines bring them to the same activity node (garden, fire pit, mailbox) in the same time-of-day window.

**Path-crossing encounter:** Two residents' pathfinding routes overlap. The "bump into a neighbor" moment.

**Lonely resident:** Cottage whose porch faces nothing (wall, tree, lot edge) AND whose resident has zero encounters during the day. Visible on screen as a sad figure with a cloud particle. Penalty: −5 per lonely resident (−8 if the resident has the "New in Town" trait).

**Blank-wall view:** Porch faces the back of another cottage. Small penalty (−1) to encourage thoughtful orientation.

**Director beat bonuses:** Variable, added on top by the Day Director (see §8).

Scoring is computed LIVE as pieces are placed (~200 lines of graph code). Players see the score ticker in real time, which creates the dopamine drip.

---

## 7. Residents & Traits

Every cottage spawns one resident. Each resident has exactly **one trait** assigned on move-in. Traits are visible on hover.

### Common traits (70% of pool)

| Trait | Routine effect | Encounter effect | Unlocks |
|---|---|---|---|
| **Gardener** | Visits shared garden 2× | Garden encounters 1.5× | Garden Club beat |
| **Early Bird** | Full morning routine, skips fire pit | Mailbox & morning-porch 2× | Morning Wave beat |
| **Night Owl** | Skips morning, extended fire pit | Fire pit encounters 2× | Dusk Fire beat |
| **Wanderer** | Walks entire path network | Every bench passed becomes encounter node | The Long Walk beat |
| **Homebody** | Rarely leaves porch | Their porch = 1.5× node for passers-by | — |
| **Host** | Standard routine | Their porch = 2× node in afternoon hours | The Check-In (as helper) |
| **Green Thumb** | Standard routine | Trees within 3 tiles of porch = small bonus | — |

### Uncommon traits (25% of pool)

| Trait | Effect |
|---|---|
| **Introvert** | −3 if porch has sightlines to >2 porches. +5 if exactly 1. |
| **Storyteller** | +1 flat to every encounter they're in. Draws others to porch at sunset. Unlocks Storyteller's Porch beat. |
| **New in Town** | Needs 2+ encounters or becomes lonely faster (−8 instead of −5). Weights Check-In and New Neighbor beats. Transitions to normal trait after 3 days. |
| **Potluck Captain** | Garden + commons encounters 1.5× in their presence. Unlocks Potluck beat as catalyst. |

### Rare traits (5% of pool)

| Trait | Effect |
|---|---|
| **The Mayor** | +0.5 to every encounter neighborhood-wide. Wasted in layouts with <4 other cottages (show a "wasted" indicator). |
| **The Old-Timer** | Any friendship formed while they're present becomes permanent across daily seeds. |
| **The Kid** | Lives with another resident, no cottage of their own. 4th routine beat (afternoon play at commons). Only spawns in layouts with 4+ cottages and connected commons. |
| **The Ghost** | Very rare. Appears once. No cottage, no routine. Walks corner-to-corner, pauses at a random porch, leaves. Worth nothing mechanically. Unique story card: *"Someone passed through. Nobody quite remembers who."* |

### Trait interaction rules

Implement 5–8 of these max. Each should be discoverable through play.

- **Introvert + Host adjacent** → Introvert penalty doubles.
- **Gardener + Green Thumb** with shared garden between → both get +3 harmony bonus.
- **Storyteller + Homebody adjacent** → Homebody's porch becomes 2× instead of 1.5×.
- **Night Owl + Early Bird** on same path with no overlapping time → no natural encounters. Requires bench on connecting path for them to ever meet.
- **Wanderer + Introvert on Wanderer's path** → small penalty for Introvert each pass. Place trees to block.

### Assignment logic

When a resident moves in, their trait is rolled from the pool **weighted by current neighborhood composition**. If 2 Gardeners already exist, a third is unlikely. If no Host exists, Host becomes more likely. Soft balance — the game pushes toward variety without hard-locking.

On Moving Day events, arriving resident always has a trait the neighborhood is currently lacking.

---

## 8. The Day Director (beat-picking algorithm)

The Director runs **exactly once per settle**, right after the player hits Settle and before any resident begins walking. It picks ONE primary beat and optionally ONE secondary beat, then injects behavior overrides into resident routines to make those beats happen visibly during the 25-second settle animation.

### Architecture

```javascript
function runDirector(state) {
  const candidates = allBeats.filter(b => b.canFire(state));
  const scored = candidates.map(b => ({
    beat: b,
    score: evaluateFit(b, state)
  }));
  const ranked = scored.sort((a, b) => b.score - a.score);

  const primary = ranked[0] || NULL_BEAT;
  const secondary = findCompatibleSecondary(primary, ranked, state);

  return { primary, secondary };
}
```

### canFire — hard gate

Each beat has hard requirements. If any fail, beat is ineligible. Example — The Check-In:

```javascript
canFire(state) {
  return (
    state.cottages.length >= 3 &&
    state.residents.some(r => r.encounterCount === 0) &&
    state.residents.some(r =>
      ['Host', 'Storyteller', 'Gardener'].includes(r.trait)
    ) &&
    state.yesterday?.primaryBeat?.id !== 'CHECK_IN'
  );
}
```

The last clause is the memory gate — prevents same beat from firing two days running.

### evaluateFit — soft score (0–100)

Four factors, weighted per beat:

- **Novelty (0–25):** Days since this beat last fired, capped. `Math.min(25, daysSinceLastFire * 5)`.
- **State resonance (0–40):** How strongly current state matches beat's ideal. For Check-In, the loneliness score of the most-isolated resident. For Potluck, total path density around commons.
- **Cast fit (0–25):** How well available residents' traits match beat's preferred cast. Host > Storyteller > Gardener for Check-In helper.
- **Storyteller bias (0–10):** Current persona's preference multiplier (see §11).

Example — Check-In fit:

```javascript
function evaluateFit_CHECK_IN(state) {
  const lonely = state.residents
    .filter(r => r.encounterCount === 0)
    .sort((a, b) => a.trait === 'New in Town' ? -1 : 1)[0];

  const helper = state.residents
    .filter(r => ['Host', 'Storyteller', 'Gardener'].includes(r.trait))
    .sort((a, b) => distance(a, lonely) - distance(b, lonely))[0];

  const daysSinceLastFire = state.history.daysSince('CHECK_IN') ?? 99;

  const novelty   = Math.min(25, daysSinceLastFire * 5);
  const resonance = lonely ? (lonely.trait === 'New in Town' ? 40 : 30) : 0;
  const castFit   = helper ? (helper.trait === 'Host' ? 25 : 18) : 0;
  const bias      = state.storyteller.weights.CHECK_IN ?? 5;

  return novelty + resonance + castFit + bias;
}
```

Total Director code: ~400–500 lines across 12 beats. Each beat's fit function is 10–15 lines.

### NULL_BEAT fallback

If no beat can fire, the Director returns NULL_BEAT = "The Quiet Day." This is NOT a failure — it's a deliberate design choice. Quiet days should happen 10–15% of the time. The player learns that peace is a valid outcome.

### Secondary beats

Only on neighborhoods with 5+ cottages. Drawn from a short list of ambient beats (cat passes through, delivery arrives, laundry hung) that never conflict with the primary. ~100 lines. Creates sense of life beyond the main story.

### Arc detection (memory-driven)

If a resident was the subject of a Check-In beat in the past 10 days, they become eligible as the **helper** in today's Check-In. ("Maya remembered how it felt.") Fifteen lines of code:

```javascript
const wasRecentlyHelped = state.residents.filter(r =>
  state.history.residentHistory(r.id)
    .filter(rec => daysBetween(rec.date, today) <= 10)
    .some(rec => rec.primaryBeat?.subjectResidentId === r.id &&
                 rec.primaryBeat?.id === 'CHECK_IN')
);
// Residents in wasRecentlyHelped get +15 cast fit bonus
// when Director is casting for a Check-In helper.
```

This is the full arc mechanic. Huge emotional payoff for minimal code.

---

## 9. Beat Library (ship with exactly 12)

1. **The Check-In** — Sociable resident visits a lonely neighbor.
2. **The Accidental Meeting** — Two isolated residents with compatible traits finally meet.
3. **The Potluck** — Dusk convergence at commons when path density is high.
4. **Morning Wave** — Early-risers meeting at mailbox; small bonus, very warm.
5. **Garden Club** — Two Gardeners (or Gardener + Green Thumb) co-tend the shared garden.
6. **The Storyteller's Porch** — Storyteller resident draws two others to porch at sunset.
7. **The Long Walk** — Wanderer's route creates chain of 3+ incidental encounters.
8. **New Neighbor** — Fires on first settle after Moving Day event.
9. **The Introvert's Corner** — Introvert with perfectly-placed single-facing porch gets contentment bonus.
10. **Dusk Fire** — Cold-weather variant; everyone converges at fire pit.
11. **The Quiet Day** (NULL_BEAT) — No drama. Peace was the point.
12. **The Unexpected Kindness** — Rare, high-value. Requires 3+ peaceful days AND a New-in-Town resident present.

### Story card captions

Beat captions use **templated strings with state-filled slots**, NOT LLM generation. Each beat has 8–12 template variants. Example:

```javascript
const CHECK_IN_TEMPLATES = [
  "{subject} noticed {helper} hadn't been out all week. {pronoun} brought {warm_thing}.",
  "{helper} saw {subject}'s porch light stay dim. {pronoun_lower} walked over with {warm_thing}.",
  "It had been a quiet week for {subject}. {helper} knew when to knock.",
  // ... 8-12 total
];

const WARM_THINGS = ["coffee", "a pie", "the newspaper", "a folding chair", "flowers from the garden"];
```

12 beats × ~10 templates × 4–5 slot variations = thousands of possible stories. All deterministic, all tonally controlled, 0ms generation.

---

## 10. Environmental Conditions

One rolled per daily seed. Changes piece values for that day.

- **Rainy morning** — porches 2×, fire pit unavailable, tree sightline blocks disabled
- **Heatwave** — trees become encounter nodes (shade), benches 2×, fire pit penalty
- **First frost** — fire pit 3×, shared garden penalty
- **Block party** — commons 2×, every cottage must have path to commons or large penalty
- **Moving day** — one resident leaves, a new one arrives mid-settle with random trait
- **Power's out** — no ambient lighting, only fire pit and porches-with-lamps illuminate
- **Festival week** — two bonus pieces added to daily budget (string lights, food cart)

---

## 11. Storyteller Personas

Three options, player picks before daily seed runs. Each is ~80 lines of beat-weighting.

- **Ross** (after Ross Chapin) — gentle, patient, prefers warm beats. Default. Rarely picks dramatic events.
- **Jane** (after Jane Jacobs) — chaotic urbanist. Loves density, surprise encounters, block parties. Throws curveball conditions. "Cities need disruption."
- **Chris** (after Christopher Alexander) — patterns purist. Only picks beats with exact geometric fit. Hardest to satisfy, highest ceiling.

Each persona is a weight object:
```javascript
const ROSS_WEIGHTS = {
  CHECK_IN: 8, POTLUCK: 6, MORNING_WAVE: 7, GARDEN_CLUB: 7,
  STORYTELLERS_PORCH: 8, LONG_WALK: 5, INTROVERTS_CORNER: 9,
  DUSK_FIRE: 7, QUIET_DAY: 10, UNEXPECTED_KINDNESS: 8,
  ACCIDENTAL_MEETING: 7, NEW_NEIGHBOR: 6
};
```

---

## 12. Data Model

Everything persists in `localStorage` under key `pocketNeighborhood_save`.

### Top-level shape

```typescript
{
  version: 1,
  playerId: string,       // random UUID, generated on first launch
  createdAt: ISODate,
  currentNeighborhood: Neighborhood,
  history: SettleRecord[],  // capped at 60
  stats: PlayerStats,
  settings: PlayerSettings,
  unlocks: UnlockState
}
```

### Neighborhood

```typescript
Neighborhood {
  id: string,               // stable across days
  name: string,             // player-nameable, defaults to "Your Lot"
  createdAt: ISODate,
  pieces: Piece[],
  residents: Resident[],
  socialGraph: Friendship[],
  daysLived: number,
  storyteller: "ROSS" | "JANE" | "CHRIS"
}

Piece {
  type: "COTTAGE" | "PORCH" | "PATH" | "GARDEN" |
        "FIREPIT" | "BENCH" | "MAILBOX" | "TREE",
  position: [number, number],
  rotation: 0 | 90 | 180 | 270,
  residentId?: string       // only for cottages
}

Resident {
  id: string,
  name: string,             // from a pool of ~200 names
  colors: [string, string], // primary + secondary hex
  trait: Trait,
  movedInOn: number,        // daysLived value when arrived
  lastSettle: {
    encounterCount: number,
    beatParticipation: BeatId | null,
    loneliness: number,
    contentment: number
  } | null,
  lifetime: {
    totalEncounters: number,
    totalBeats: number,
    beatsAsSubject: BeatId[],
    beatsAsHelper: BeatId[]
  }
}

Friendship {
  residentA: string,    // id
  residentB: string,    // id
  strength: number,     // 1-10
  formedOn: number,     // daysLived
  lastEncounter: number,
  isPermanent: boolean  // true if formed while Old-Timer present
}
```

### SettleRecord (the diary)

```typescript
SettleRecord {
  date: "YYYY-MM-DD",
  daysLived: number,
  seedHash: string,
  condition: EnvironmentalCondition,
  storyteller: StorytellerId,
  primaryBeat: {
    id: BeatId,
    subjectResidentId: string,
    helperResidentId?: string,
    location: [number, number],
    caption: string       // generated from template
  } | null,               // null = Quiet Day
  secondaryBeat: {...} | null,
  encountersTotal: number,
  loneliestResidentId: string | null,
  score: number,
  rank: number,           // from leaderboard at submit time
  snapshot: string        // base64 thumbnail, ~8KB
}
```

### History methods

```typescript
history.daysSince(beatId: BeatId): number
history.timesFired(beatId: BeatId): number
history.residentHistory(residentId: string): SettleRecord[]
```

### Friendship formation

- Form when two residents appear in encounters on 3 separate days within a 10-day window
- Strength starts at 1, increments on shared encounter, cap 10
- Decrements by 1 every 5 days without shared encounter
- Dissolves at strength 0 unless `isPermanent: true`
- Friends trigger "unprompted visits" ambient behavior in settle

---

## 13. Daily Seed System

One new seed drops worldwide at midnight UTC. One scored attempt per day per browser (tracked in localStorage). Unlimited practice attempts. All players worldwide get the same seed, enabling global leaderboard as "multiplayer."

### Seed shape

```typescript
DailySeed {
  date: "2026-04-24",
  lotShape: "rectangular" | "L" | "T",
  commonsPosition: [number, number],
  commonsSize: [number, number],
  budget: {
    cottage: number, garden: number, firepit: number,
    path: number, bench: number, mailbox: number,
    porch: number, tree: number
  },
  theme: string,              // "Spring morning", "Harlem Nights", etc.
  condition: EnvironmentalConditionId
}
```

### Seed derivation

Seed is deterministic from date: `hash("pocket-neighborhood-" + date)`. Client and server agree without coordination.

### Leaderboard

Single Cloudflare Worker with KV. Two endpoints:
- `POST /score` — body: `{ playerId, date, score, beatId }`. Validates, writes to KV under `${date}:${score}:${playerId}`.
- `GET /top100?date=YYYY-MM-DD` — returns top 100 for that date.

~50 lines of Worker code total. Free tier covers everything.

---

## 14. Art Direction

### Core aesthetic: low-poly flat-shaded diorama with golden-hour lighting

**Visual references (in priority order):**
1. **Townscaper** (Oskar Stålberg) — primary reference. Flat shading, warm palette, clean silhouettes.
2. **Islanders** (Grimbart Tales) — closest match for what's realistically achievable in 4 weeks.
3. **Monument Valley** (ustwo) — steal the lighting and palette only, not the geometry.

Study screenshots of these. Tape them above the monitor. Compare at the end of Week 1 and Week 3.

### Palette (locked)

Warm earth tones only. No saturated primaries anywhere.

- **Ground sage:** `#a8b89a`
- **Cottage terracotta:** `#c97a5c`
- **Cottage cream:** `#f0e4d0`
- **Cottage sage:** `#9fb089`
- **Cottage dusty rose:** `#d4a294`
- **Path stone:** `#c8b89c`
- **Tree foliage:** `#7a9464`
- **Tree trunk:** `#6b4e3a`
- **Fire pit stone:** `#8a7a6a`
- **Fire pit flame:** `#f4a65c`
- **Background warm off-white:** `#f5efe6`
- **Sky gradient top:** `#d4c5b5`
- **Sky gradient bottom:** `#f0d9bf`

### Lighting setup (the single biggest lever)

```javascript
// Ambient — warm fill
const ambient = new THREE.AmbientLight(0xffe8cc, 0.4);

// Key light — golden hour sun
const key = new THREE.DirectionalLight(0xfff4e0, 1.0);
key.position.set(10, 15, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 50;

// Rim — cool counter-light
const rim = new THREE.DirectionalLight(0x88aaff, 0.2);
rim.position.set(-8, 5, -8);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

### Camera

Orthographic. 30° from horizontal, 45° rotation around vertical. Subtle continuous sine-wave breathing drift so the scene feels alive when static.

```javascript
const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 15;
const camera = new THREE.OrthographicCamera(
  frustumSize * aspect / -2, frustumSize * aspect / 2,
  frustumSize / 2, frustumSize / -2,
  0.1, 100
);
camera.position.set(12, 12, 12);
camera.lookAt(0, 0, 0);
```

### Post-processing (non-negotiable)

- **Tilt-shift blur** on top and bottom 20% of screen. Miniature effect.
- **Vignette** subtle, warm.
- **Bloom** very subtle, only on fire pit and porch lamps.

### Geometry approach

**Primary path: procedural primitives.** Every piece is built from Three.js primitives with flat shading and vertex colors. Cottage = 2×2×1.5 box + 4-sided pyramid roof. Tree = cylinder trunk + cone foliage. Bench = two thin boxes. Total geometry code: ~300 lines for all 8 pieces. Distinctive, consistent, tiny bundle, fast to iterate.

**Fallback path (Week 2 only if procedural looks sad):** Extract CC0 models from the Kenney Starter-Kit-City-Builder repo (https://github.com/KenneyNL/Starter-Kit-City-Builder). Convert to `.glb` if needed. Load via `GLTFLoader`. Bundle into single `assets.glb` file. Target: under 150KB for all models combined. Do NOT mix Kenney models with procedural primitives in the same scene — style drift will wreck the look.

### Art budget (every element has to earn its place)

- Flat colors only, no textures
- Under 500 triangles per piece
- No skeletal animation on residents — simple bob-walk via sine wave on vertical position
- Shadows do most of the visual storytelling
- Residents: capsule body, sphere head, two colors each. Don't over-animate.

---

## 15. Audio Design

Cozy games are 40% sound. Budget real time for this in Week 3.

### Layers

- **Ambient bed:** Wind through leaves + distant unintelligible kids + wind chime every ~20 sec + one distant dog bark per minute. Loops imperceptibly.
- **Placement SFX:** Wooden clunk (cottage/porch), leaf rustle (tree), stone clink (path), metallic clink (mailbox), crackle (fire pit), dirt pat (garden).
- **Score ticker:** Single glockenspiel note per point, pitch rising subtly with score total. Tone.js.
- **Settle underscore:** Ambient pad, gentle piano enters at ~8 sec, resolves at ~22 sec. Tone.js.
- **End card:** Single bell ring. Silence. Score appears.

Under 1MB total audio. Use freesound.org CC0 samples + Tone.js synthesis.

---

## 16. Tier Scoping (ship vs stretch)

**Tier 1 — MUST SHIP (core game):**
- 8 piece types, placement, rotation
- 10×10 grid with pre-placed commons
- Basic scoring (all 4 positive + 2 negative components, no Director bonuses)
- 15 traits in full pool
- Day Director with 10–12 beats
- Story card output with templated captions
- 1 environmental condition (start with just "Sunny day" variants, add more in Tier 2)
- Daily seed system with localStorage persistence
- Cloudflare Worker leaderboard
- Full art pass: lighting, post-processing, palette
- Full audio pass
- 60-second silent onboarding (no text tutorial)

**Tier 2 — ship if Week 2 goes smoothly:**
- Memory across days (arc detection, resident.lastSettle, friendships)
- Three storyteller personas (Ross/Jane/Chris)
- Full environmental conditions (7 types)
- Trait interaction rules (5–8)
- Expanded story card with highlighted moment

**Tier 3 — ONLY if ahead of schedule (don't count on this):**
- Persistent social graph across daily seeds
- Unlockable piece variants at score thresholds
- Multi-day beat chains
- Optional "Describe my neighborhood" LLM button (Claude Haiku via Cloudflare Worker)
- Easter eggs (Anti-Gala day variant, Avenues West groundbreaking variant)

**Ship Tier 1 before touching Tier 2. Ship Tier 2 before touching Tier 3. Do not interleave.**

---

## 17. Week-by-Week Build Plan

### Week 1 (Apr 10–16): Prove the Vibe

Three.js scene with orthographic iso camera. 10×10 grid with soft sage ground. Raycaster for hover highlight. ONE cottage placeable with R-to-rotate. ONE resident walking a hardcoded path. Three-light golden-hour setup. Post-processing: tilt-shift + vignette. Subtle camera breathing.

**Success metric:** A static screenshot of an empty lot with one cottage and one walking resident should look like something you'd want to play. If it doesn't, the concept is broken and pivot.

### Week 2 (Apr 17–23): Build the Full Game

All 8 pieces. Full drag-and-place UX. Pathfinding (A*, ~100 lines). Eye-contact detection. Shared-node encounters. Loneliness penalty. Live scoring ticker.

**Build the Day Director BEFORE the static scoring graph.** Director consumes state first; static scoring is a fallback when no beat fires. Doing this in the wrong order creates two competing systems fighting for control.

First pass on settle animation: day/night cycle, residents walking routines, basic particle effects for encounters. By end of Week 2, you can play one full round start to finish.

**Success metric:** You build a neighborhood, hit Settle, watch 25 seconds of your neighborhood living, and smile.

### Week 3 (Apr 24–30): Meta, Polish, Ship-Ready

Daily seed system. Cloudflare Worker leaderboard. Share-as-image score card. 60-second silent onboarding that teaches eye-contact placement without text. Audio pass. Lighting polish. Post-processing tuning. Trailer capture — record a perfect 10-second loop of the settle animation on a hand-built gorgeous neighborhood.

**Success metric:** A stranger can open the URL, learn it in 30 seconds, and post a score card unprompted.

### Week 4 (May 1 morning): Ship

Final bug bash. Submit by 9:00 UTC. Not 13:30. Ship early, watch the chaos from a coffee shop.

---

## 18. Day 1 Task List (first 48 hours of Week 1)

Hand each of these to Claude Code as a single-prompt task. Each should be completable in one focused session.

1. **Scaffold a Vite project** with Three.js. Create an `index.html`, `main.js`, `src/scene.js`, `src/state.js`, `src/pieces/` folder. Use ES modules. No TypeScript unless you insist — vanilla JS keeps velocity high.

2. **Orthographic isometric camera** looking at a 10×10 grid centered at origin. 30° from horizontal, 45° rotation around vertical. Frustum size 15. Viewing the grid from approximately [12, 12, 12].

3. **Ground plane** — single large plane, color `#a8b89a`, with a very subtle radial gradient darker toward the edges. Could be a shader or just a texture generated programmatically on a canvas.

4. **Three-light setup** exactly per §14. Ambient warm fill (0xffe8cc, 0.4), directional key light (0xfff4e0, 1.0, position [10, 15, 8], 2048 shadow map, PCF soft), rim light (0x88aaff, 0.2, position [-8, 5, -8]). Shadow map enabled, `PCFSoftShadowMap`.

5. **Raycaster hover highlight** — soft warm overlay on the grid cell under the mouse. Use a single translucent quad that snaps to the nearest grid cell on mousemove.

6. **Procedural cottage geometry** — a 2×2×1.5 box with a 4-sided pyramid roof on top. Front face marked by a slightly different colored porch (small 2×1 offset). Use `MeshLambertMaterial` with `flatShading: true` and per-face vertex colors. Placeable on click at the hovered grid cell, rotate with R key.

7. **Procedural resident** — a capsule (cylinder + two hemispheres) body + small sphere head, two colors. Walks from the cottage's porch to a hardcoded point on the grid using lerp along a path. Simple bob-walk: vertical position oscillates with `Math.sin(elapsed * 8) * 0.05`.

8. **Camera breathing** — subtle sine wave on camera position: `camera.position.y = 12 + Math.sin(elapsed * 0.3) * 0.1`. Almost imperceptible but makes the scene feel alive.

9. **Post-processing pipeline** — `EffectComposer` with:
   - `RenderPass`
   - Custom tilt-shift shader: gaussian blur in Y direction, preserved middle band. Top 20% and bottom 20% blurred.
   - Vignette: subtle darken toward corners, warm tint.
   - Skip bloom on Day 1, add in Week 2.

10. **Background color** — warm off-white `#f5efe6`. Plus a very simple gradient sky: large inverted sphere with vertex colors from `#d4c5b5` at top to `#f0d9bf` at bottom.

**At the end of 48 hours:** a scene with one cottage, one walking resident, golden hour light, tilt-shift blur, and a breathing camera. If that scene doesn't make you feel something, pivot. If it does — and it will — the rest of the game works.

---

## 19. Key Principles & Anti-Patterns

### Principles (always)

- **Scope discipline is a ship requirement.** Eight pieces, 12 beats, 15 traits, 3 storytellers, 1 lot. These numbers are locked.
- **Build the Director before the static scorer.** Otherwise they'll fight.
- **The settle animation is the marketing asset.** It has to be GIF-first beautiful. Design for screenshot-ability.
- **Every point scored must correspond to a visible event.** Hearts between porches, encounters at garden, sad clouds over lonely cottages. The number is a summary of things you just watched happen.
- **Ship Tier 1 first, always.** Don't touch Tier 2 until Tier 1 is polished.
- **Ship early.** 9:00 UTC on May 1, not 13:30.

### Anti-patterns (never)

- **Don't add a ninth piece.** You will want to. Don't.
- **Don't call an LLM in the critical path.** The Director is deterministic code. Captions are templates.
- **Don't use perspective camera.** Orthographic only.
- **Don't use textures.** Flat shading + vertex colors only.
- **Don't use hard shadows.** PCF soft always.
- **Don't mix Kenney models with procedural primitives in the same scene.** Pick one style and commit.
- **Don't improvise the data model.** Use the schema in §12 exactly.
- **Don't interleave tiers.** Finish Tier 1 before starting Tier 2.
- **Don't ship at 13:36 UTC.** Ship by 9:00 UTC May 1.

---

## 20. The Story Frame (for submission copy)

> I'm an architect and public radio director in Milwaukee. I'm currently co-developing Avenues West Cottages — 15 real pocket neighborhood homes breaking ground in 2027. This game is the design research for that project, rendered as a toy. The scoring is based on Ross Chapin's actual theory of layered privacy and sightline-driven community. Every eye-contact line in the game corresponds to a real design decision I'm making at the drafting table.
>
> A pocket neighborhood in your browser. Ninety seconds. One shared seed a day. No logins, no loading.
>
> Think RimWorld's storyteller, inverted. Instead of dramatic disasters in a space colony, it generates quiet moments of neighborliness in a cottage cluster. Same engine, opposite emotional vector.

This copy does three jobs: tells a story only Tarik can tell, earns the "design has a thesis" credit, gives press a one-paragraph pull-quote. It's also true.

---

## End of context document

When in doubt, re-read this document before improvising. If a decision isn't covered here, ask before guessing. Scope discipline and style consistency are the two things that will separate this game from every other jam entry — both of them live in this doc.
 