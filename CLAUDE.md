# Nearfolk

Cozy 90-second web game for Cursor Vibe Jam 2026. Player designs cottage clusters around a shared commons, presses Settle, watches residents form social connections.

**Deadline:** May 1, 2026 at 13:37 UTC. Ship by 9:00 UTC.

## Key docs
- Spec: docs/POCKET_NEIGHBORHOOD.md
- Research: docs/research-neighborhood.txt
- Design doc: ~/.gstack/projects/pocket-neighborhood/tarikmoody-no-branch-design-20260412-114736.md
- CEO plan: ~/.gstack/projects/pocket-neighborhood/ceo-plans/2026-04-12-nearfolk-jam.md
- Full review plan: ~/.claude/plans/moonlit-juggling-simon.md
- Approved mockup: ~/.gstack/projects/pocket-neighborhood/designs/game-ui-20260412/variant-A.png

## Tech stack
- Three.js (tree-shaken imports, NOT full library)
- Vanilla JS (no React, no framework)
- Vite
- Web Audio API (NOT Tone.js)
- Cloudflare Pages + Worker + KV

## Anti-patterns (never do these)
- Don't add a ninth piece type
- Don't call an LLM in the critical path
- Don't use perspective camera (orthographic only)
- Don't use textures (flat shading + vertex colors only)
- Don't mix Kenney models with procedural primitives
- Don't import the full Three.js library (tree-shake everything)
- Don't interleave tiers (finish Tier 1 before Tier 2)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
