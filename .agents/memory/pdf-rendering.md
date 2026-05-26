---
name: PDF rendering on Replit
description: How to render Markdown to PDF reliably in this sandbox using md-to-pdf + puppeteer.
---

**Rule:** `md-to-pdf` (and any puppeteer-based renderer) needs a Chrome binary in `~/.cache/puppeteer/`. The Replit container does not include one by default — install it once with `npx puppeteer browsers install chrome`. After install, the binary lives at `/home/runner/.cache/puppeteer/chrome/linux-<ver>/chrome-linux64/chrome` and md-to-pdf picks it up automatically.

**Why:** First-time renders fail with `Could not find Chrome (ver. X)`. The install is large and can appear to time out — but it usually completes in the background; re-run the render and check before assuming failure.

**How to apply:**
- Always launch puppeteer with `args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]`. The Replit container has no user namespaces and `/dev/shm` is tiny.
- Drive page layout from CSS `@page { size: A4; margin: ...; @top-left{...} @bottom-center{ content: counter(page) " / " counter(pages) } }` and pass `preferCSSPageSize: true` in `pdf_options`. Don't set `pdf_options.margin` and CSS margins simultaneously — one will silently win.
- Use `page-break-before: always` on `h1` (with `:first-of-type { page-break-before: avoid }`) for chapter-per-page documents.
- A4 with the default Inter-ish stack renders ≈ 350 words per page; size markdown accordingly.
