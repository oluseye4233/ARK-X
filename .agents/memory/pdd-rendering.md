---
name: PDD PDF rendering (md-to-pdf / puppeteer)
description: How to render exports/*.md PDDs to PDF in this Replit env
---

# Rendering PDDs to PDF

`scripts/renderPdd.ts <src.md> <out.pdf>` uses `md-to-pdf` (puppeteer-core). Puppeteer
CANNOT auto-resolve a browser here — it throws "Could not find Chrome" /
`resolveExecutablePath`, and `npx puppeteer browsers install chrome` times out.

**Fix:** export `PUPPETEER_EXECUTABLE_PATH` to a real nix chromium, then run:

    export PUPPETEER_EXECUTABLE_PATH="$(which chromium)"   # clean recent stable build
    npx tsx scripts/renderPdd.ts exports/X.md exports/X.pdf

**Pitfall:** do NOT use `ls /nix/store/*chromium*/bin/chromium | head -1` — the glob
sorts an ancient `ungoogled-chromium-98` first, which crashes Puppeteer. `$(which chromium)`
resolves a recent stable chromium (e.g. 125); otherwise pick a non-ungoogled high-version
path explicitly. The nix hash changes across rebuilds, so never hardcode the full path.

**Why this matters repeatedly:** the "Current" PDDs are LIVING docs — same filename, version
bumped inside (ATLAS PDD-CUR-2026-0NN, SPARTAN PDD-MVP-2026-0NN); git history preserves prior.
Every refresh regenerates the sibling .pdf, so you need a working headless Chrome each time.

**Styling:** CSS lives in `scripts/pddStyles.ts` (PDD_BASE_CSS). Cover/toc use raw HTML
`<div class="cover">` / `<div class="toc">` blocks at the top of the markdown.

**Batch regen:** `npm run pdd:render` regenerates every `exports/*Current*.md` sibling PDF;
`npm run pdd:check` flags (exit 1) any Current PDF missing or older than its .md. renderPdd.ts
now auto-resolves chromium via `resolveChromium()` (env → `which chromium`), so no manual
PUPPETEER_EXECUTABLE_PATH export is needed. Run pdd:render after every Current PDD edit.
