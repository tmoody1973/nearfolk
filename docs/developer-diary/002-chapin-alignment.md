# Dev Diary #002 — Making the mechanics honest

**Date:** April 12, 2026
**Author:** Tarik Moody
**Commits:** `46e9fd4` through `175bf45`

---

## What happened

I wrote a social post about the game and then realized the game didn't do what the post said it did.

The post talked about Ross Chapin's pocket neighborhood principles. Layered privacy. Nesting cottages so the open side faces the closed side. Porches as thresholds where lingering happens. "Shirt-tail aunties and uncles just beyond the front gate." Good stuff. Real stuff. Stuff I spent six months learning during the ACRE capstone with Chandra.

Then I looked at the scoring engine and it was... fine. Eye-contact lines between facing porches, check. Tree blocks sightlines, check. Lonely penalty, check. But it was missing the ideas that actually make Chapin's work interesting. Nesting wasn't rewarded. Porches didn't do anything special. And you couldn't SEE the connections. The score was just a number changing in the corner.

So I spent the afternoon fixing that. Now the mechanics are honest.

## The alignment

Here's where each Chapin concept lives in the code:

| Chapin says | The game does |
|-------------|---------------|
| "Shared space is the heart" | Commons is pre-placed at center of the grid. You build around it. |
| Porches oriented toward the commons | Eye-contact detection between facing porches, +3 per connection |
| "Open side facing closed side" | Nesting bonus: cottages at 90-degree angles score +2 |
| Porch as a threshold for lingering | Porch piece near a shared node amplifies encounters, +2 |
| Layered privacy (fence, yard, porch, door) | Rotation is the whole mechanic. Which direction you face IS your privacy layer. |
| No connections = the design failed | Lonely resident penalty, -5. Visible sad cloud bobs above the roof. |
| Porch facing a back wall = bad nesting | Blank-wall penalty, -1 |

The one that isn't built yet: "shirt-tail aunties and uncles just beyond the front gate." That's the Day Director. The system that watches your neighborhood and writes a small story about what happened today. That's Week 2.

## The visual feedback moment

The biggest change wasn't in the scoring math. It was making the connections visible.

Before: you place two cottages facing each other. The number in the corner goes from 0 to 3. You feel... nothing. A number changed.

After: you place two cottages facing each other. A warm golden line appears between them, pulsing gently. The number goes up. You can SEE the relationship. You rotate one cottage away, the line disappears. You rotate it back, it reappears. Place a tree between them, the line breaks. Remove the tree, it reconnects.

And the opposite: place a cottage facing the edge of the grid, alone. A small gray cloud appears above it, bobbing slowly. Rotate it toward a neighbor, the cloud dissolves, a golden line forms, the score jumps. That transition, cloud to line, IS the emotional arc of the whole game compressed into one mouse click.

I didn't expect the visual feedback to matter this much. The scoring math was always correct. But correctness isn't the same as feeling. The golden lines make you feel like you're weaving something. The clouds make you feel responsible.

## The nesting insight

Chapin's nesting idea is the one I almost missed. It's not just about face-to-face (two porches staring at each other across a courtyard). It's about the L-shaped arrangement where cottage A's porch faces the commons and cottage B sits at 90 degrees, its closed side toward A. Cottage A gets community. Cottage B gets privacy. Both get what they need.

In the game, this is a dot product check. If two adjacent cottages have facing directions with a dot product of 0, they're at 90 degrees. That's a nesting bonus. It means the scoring now rewards arrangements that look like real pocket neighborhoods, not just rows of cottages staring at each other.

```javascript
const dot = dirA.dx * dirB.dx + dirA.dz * dirB.dz;
if (dot === 0) nesting++;  // 90-degree relationship
```

Three lines of code. Two points per pair. Changes the whole design strategy.

## What the ACRE capstone taught me that the spec didn't

The original game spec was written before I really sat with the Chapin material. It talked about sightlines and scoring and the RimWorld storyteller, and all of that is right. But the spec treated the architecture theory as flavor text. "Based on Ross Chapin's actual theory of pocket neighborhoods." Cool sentence. Doesn't tell you what to build.

What I learned from the capstone, from actually laying out 15 cottages on a 1-acre site with Chandra, is that the interesting decisions aren't about whether porches face each other. Of course they should. The interesting decisions are about which neighbor you DON'T face. Where you put the closed side. How much privacy you give up to get community. The nesting arrangement, the L-shape, is interesting because it's a compromise. Neither cottage gets everything. Both get enough.

That's the puzzle. Not maximizing connections. Balancing connections with privacy. The nesting bonus encodes that.

## Technical notes

**Pure scoring with visual data.** `computeScore()` now returns not just the total and breakdown but also `connections` (array of from/to coordinates for drawing sightlines) and `lonelyCottages` (array of positions for drawing clouds). The function is still pure. No Three.js. No side effects. The scene reads the visual data and draws it. Clean separation.

**Connection lines use `Line` geometry with `LineBasicMaterial`.** They pulse by oscillating opacity in the animation loop. The pulse is subtle (0.3 to 0.45 range). Looks like breathing. The clouds bob on a sine wave offset by their X position so they don't all move in sync.

**Bundle still at 136KB.** Adding Line geometry, Float32BufferAttribute, and MeshBasicMaterial to the Three.js imports cost about 1KB. The visual feedback is essentially free.

## The question I'm sitting with

The scoring formula has seven terms now. Is that too many? A player can't hold seven things in their head while placing a cottage. But maybe they don't need to. Maybe they just need to see the golden lines appear and the clouds disappear, and the numbers take care of themselves.

Dorfromantik has complex scoring under the hood but the player just sees tiles matching. Islanders has a dozen scoring rules but the player just sees green +numbers and red -numbers. Maybe the visual feedback IS the interface to the scoring, and the tooltip breakdown is for the people who want to understand the machine.

I think that's right. The golden lines teach you the thesis without explaining it. You learn that direction matters. You learn that proximity matters. You learn that blocking a sightline has consequences. All from watching lines appear and disappear. The seven-term formula is the explanation. The lines are the game.

---

*Next entry: Week 2. The Day Director picks its first story. "June noticed Maya hadn't been out all week. She brought coffee."*
