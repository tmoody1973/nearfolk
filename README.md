# Nearfolk

A cozy 90-second web game about the architecture of kindness.

Design a small cottage cluster around a shared commons. Face porches toward each other. Connect paths. Place a tree where you need to block a sightline. Leave space for people to bump into each other. Then press Settle and watch the neighborhood come to life.

**[Play now](https://nearfolk.pages.dev)** | Built for [Cursor Vibe Jam 2026](https://vibej.am/2026/)

## The idea

The game came from my ACRE capstone project. My partner Chandra Ellis and I spent six months designing Avenues West Cottages, a 15-home pocket neighborhood proposal for a site on W. State Street in Milwaukee. Ross Chapin's pocket neighborhood theory says that good small communities happen because of layered privacy and sightlines, not density. His line that stuck with me: "Shared space is the heart of a pocket neighborhood. It's what holds it together and what gives it vitality."

I kept thinking about that after the capstone. How the direction a porch faces changes whether two neighbors ever meet. How a tree in the wrong spot blocks a connection. I wanted other people to feel that, so I turned it into a puzzle.

That's what "architecture of kindness" means. The design of a space can make people more likely to notice each other, check in on each other, cross paths on the way home. In the game, that's the score.

## How it works

Place 8 types of pieces on a 10x10 isometric grid around a shared commons. Each cottage spawns a resident with a name and a trait. Face porches toward each other to form connections (golden sightlines appear). Leave a resident isolated and a sad cloud appears above their roof.

When you're ready, press **Settle** and watch 25 seconds of your neighborhood living: residents walk their routines, encounter each other at gardens and fire pits, and a Day Director picks a small story to tell. "June noticed Maya hadn't been out all week. She brought coffee."

Same seed worldwide every day. One scored attempt in ranked mode (60 seconds). Unlimited practice.

## Controls

| Action | Input |
|--------|-------|
| Place piece | Left click / Space (keyboard) |
| Rotate (before placing) | R |
| Rotate placed piece | T or Middle-click |
| Remove piece | Right-click |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z |
| Select piece type | 1-8 keys or click palette |
| Move cursor (keyboard) | Arrow keys |
| Orbit camera | Q / E |
| Zoom | Scroll wheel |

Mobile: tap to place, on-screen buttons for rotate/orbit/undo.

## Scoring

```
Neighborliness = eye-contact edges      x3
               + nesting bonus           x2
               + porch encounters        x2
               + shared-node encounters  x2
               + path-crossing           x1
               - lonely residents        x5
               - blank-wall views        x1
```

Hover the score number for the full breakdown. Each term maps to a Chapin principle:

- **Eye-contact**: porches facing each other across open space
- **Nesting**: cottages at 90-degree angles (open side facing closed side)
- **Porch encounters**: porch piece near a shared node amplifies lingering
- **Shared nodes**: garden, fire pit, bench, mailbox create reasons to be outside
- **Path crossings**: connected cottages bump into each other
- **Lonely**: no connections at all means the design failed
- **Blank wall**: porch staring at a back wall is bad nesting

## Pieces

| # | Piece | Size | Role |
|---|-------|------|------|
| 1 | Cottage | 2x2 | Houses one resident. Porch direction is everything. |
| 2 | Porch | 1x1 | Extends sightlines. Amplifies nearby encounters. |
| 3 | Path | 1x1 | Connects cottages. No path = isolated resident. |
| 4 | Garden | 2x2 | Afternoon encounter node. |
| 5 | Fire Pit | 1x1 | Evening gathering. Everyone converges at dusk. |
| 6 | Bench | 1x1 | Path-side encounters. Low-value but flexible. |
| 7 | Mailbox | 1x1 | Morning encounters. Reliable. |
| 8 | Tree | 1x1 | Blocks sightlines. Tactical. |

## The Day Director

Inspired by RimWorld's storyteller AI, but flipped. RimWorld's Cassandra picks disasters. Nearfolk's Director picks kindnesses. It watches your neighborhood state, who's lonely, who has the strongest connections, which residents haven't met, and picks one of 12 story beats to tell.

Each resident has one of 15 traits (Gardener, Host, Introvert, Storyteller, Night Owl...) that affect their routine and what stories the Director can tell about them.

## Tech

| Layer | Technology |
|-------|------------|
| Rendering | Three.js (orthographic iso, flat-shaded, golden-hour lighting, tilt-shift) |
| Logic | Vanilla JS, no framework |
| Build | Vite |
| Audio | Web Audio API (synthesized, 0KB bundle cost) |
| Hosting | Cloudflare Pages |
| Leaderboard | Cloudflare Worker + KV (HMAC-signed scores) |

Bundle: **148KB gzipped** (target was 250KB).

## Development

```bash
git clone https://github.com/tmoody1973/nearfolk.git
cd nearfolk
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/
```

### Project structure

```
nearfolk/
├── src/
│   ├── main.js          # Entry point, WebGL check
│   ├── scene.js         # Renderer, camera, UI, placement
│   ├── state.js         # Game state, immutable ops, undo/redo
│   ├── scoring.js       # Pure scoring engine (7 terms)
│   ├── director.js      # Day Director (12 beats)
│   ├── settle.js        # 25-second animation controller
│   ├── residents.js     # Names, colors, 15 traits
│   ├── pathfinding.js   # A* on 10x10 grid
│   ├── tutorial.js      # Ghost tutorial (first visit)
│   ├── seed.js          # Daily seed system
│   ├── audio.js         # Web Audio API sounds
│   ├── timer.js         # Ranked mode countdown
│   ├── share.js         # Postcard PNG capture
│   ├── leaderboard.js   # Score submission client
│   └── pieces/          # 8 procedural geometry factories
├── worker/
│   ├── index.js         # Cloudflare Worker (leaderboard API)
│   └── wrangler.toml    # Worker config
├── public/
│   └── logo.png         # Nearfolk logo
├── docs/
│   ├── POCKET_NEIGHBORHOOD.md    # Full game spec
│   ├── research-neighborhood.txt # Design research
│   ├── social-post.md            # Social media draft
│   └── developer-diary/          # Build diary entries
└── index.html
```

### Deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name nearfolk
```

Leaderboard Worker:
```bash
cd worker
npx wrangler deploy
```

## Links

- **Play**: [nearfolk.pages.dev](https://nearfolk.pages.dev)
- **Repo**: [github.com/tmoody1973/nearfolk](https://github.com/tmoody1973/nearfolk)
- **Jam**: [vibej.am/2026](https://vibej.am/2026/)
- **ACRE Program**: [LISC Milwaukee](https://www.lisc.org/milwaukee/our-work/acre/)
- **Pocket Neighborhoods**: [Ross Chapin Architects](https://rosschapin.com/projects/pocket-neighborhoods/)

## Credits

Designed and directed by Tarik Moody. ACRE capstone with Chandra Ellis. 90%+ of code written by AI (Claude Code) for the Cursor Vibe Jam 2026.

## License

MIT
