# Nearfolk

A cozy 90-second web game about the architecture of kindness.

Design a small cottage cluster around a shared commons. Face porches toward each other. Connect paths. Place a tree where you need to block a sightline. Leave space for people to bump into each other. Then press Settle and watch the neighborhood come to life.

**Built for [Cursor Vibe Jam 2026](https://vibej.am/2026/)**

## Play

Coming soon at [nearfolk.tarik.dev](https://nearfolk.tarik.dev)

## The idea

Good small communities work because of sightlines, not density. This game is built on Ross Chapin's theory of pocket neighborhoods: layered privacy, shared commons, and the spatial conditions that cause neighbors to actually meet each other.

Every eye-contact line between two porches is a potential friendship. Every shared garden is an afternoon encounter. Every tree can save a sightline or wreck one.

The scoring mechanic IS the architectural theory. You're not optimizing money or efficiency. You're optimizing the number of small social connections that emerge from your spatial choices.

## Controls

| Action | Input |
|--------|-------|
| Place piece | Left click |
| Rotate (before placing) | R |
| Rotate placed piece | T or Middle-click |
| Remove piece | Right-click |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z |
| Select piece type | 1-8 keys or click palette |
| Orbit camera | Q / E |
| Zoom | Scroll wheel |

## Scoring

```
Neighborliness = eye-contact edges x3
               + shared-node encounters x2
               + path-crossing encounters x1
               - lonely residents x5
               - blank-wall views x1
```

Hover the score to see the full breakdown.

## Pieces

| # | Piece | Size | What it does |
|---|-------|------|-------------|
| 1 | Cottage | 2x2 | Houses one resident. Porch side faces one direction. |
| 2 | Porch | 1x1 | Extends eye-contact range by 1 tile. |
| 3 | Path | 1x1 | Connects cottages. No path = lonely resident. |
| 4 | Garden | 2x2 | Afternoon encounter node. |
| 5 | Fire Pit | 1x1 | Evening gathering. High-value encounters. |
| 6 | Bench | 1x1 | Path-side encounters. Low-value but flexible. |
| 7 | Mailbox | 1x1 | Morning encounters. Reliable. |
| 8 | Tree | 1x1 | Blocks sightlines. Tactical. |

## Tech

- Three.js (orthographic isometric, flat-shaded, golden-hour lighting)
- Vanilla JS (no framework)
- Vite
- Web Audio API
- Cloudflare Pages + Worker

Bundle target: under 250KB gzipped. Currently at 135KB.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/
```

## The backstory

Nearfolk grew out of an ACRE capstone project where I designed a pocket neighborhood for a site in Milwaukee. ACRE is a commercial real estate development program run by LISC Milwaukee. That project got me thinking about Ross Chapin's work on how small communities actually function, and I kept wondering what that theory would feel like as a puzzle. This game is the answer.

Designed and directed by Tarik Moody. 90%+ of code written by AI (Claude Code) for the Cursor Vibe Jam.

## License

MIT
