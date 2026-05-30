---
name: PDD PDF rendering (md-to-pdf / puppeteer)
description: How to render exports/*.md PDDs to PDF in this Replit env
---

# Rendering PDDs to PDF

`scripts/renderPdd.ts <src.md> <out.pdf>` uses `md-to-pdf` (puppeteer-core). Puppeteer
CANNOT auto-resolve a browser in this environment — it throws at `resolveExecutablePath`.

**Fix:** export `PUPPETEER_EXECUTABLE_PATH` to the nix-store chromium binary before running, e.g.

    # pick a REAL chromium browser (not chromium-bsu the game, not ungoogled):
    export PUPPETEER_EXECUTABLE_PATH="$(ls -d /nix/store/*-chromium-[0-9]*/bin/chromium | head -1)"
    npx tsx scripts/renderPdd.ts exports/X.md exports/X.pdf

**Why:** the nix chromium isn't on PATH where puppeteer-core looks, and the launch args in
renderPdd.ts (`--no-sandbox` etc.) don't set the executable path. The nix hash in the path
changes across rebuilds, so resolve it with a glob rather than hardcoding.

**Styling:** CSS lives in `scripts/pddStyles.ts` (PDD_BASE_CSS). Cover/toc use raw HTML
`<div class="cover">` / `<div class="toc">` blocks at the top of the markdown.
