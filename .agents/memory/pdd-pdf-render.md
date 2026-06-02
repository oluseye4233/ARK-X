---
name: PDD PDF rendering
description: How to render exports/*.md PDDs to PDF when Puppeteer can't find Chrome
---

The PDD render script (`scripts/renderPdd.ts <src.md> <out.pdf>`, md-to-pdf + Puppeteer, styled by `scripts/pddStyles.ts::PDD_BASE_CSS`) fails with "Could not find Chrome" because no Chrome is installed in the Puppeteer cache and `npx puppeteer browsers install chrome` tends to time out in this sandbox.

**Fix:** point Puppeteer at the Nix-provided chromium instead of installing one:
`PUPPETEER_EXECUTABLE_PATH=$(ls /nix/store/*chromium*/bin/chromium | head -1) npx tsx scripts/renderPdd.ts exports/X.md exports/X.pdf`

**Why:** the repo's "Current" PDDs are LIVING docs — same filename, version bumped inside (v10→v11 = JNGL-ARK-PDD-CUR-2026-0NN), git history preserves prior. Each refresh regenerates the sibling .pdf, so you need a working headless Chrome every time.
