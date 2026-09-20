---
name: Express SPA fallback paths
description: How to preserve the requested route when an Express catch-all renders route-specific HTML.
---

In a mounted Express catch-all, do not assume `req.path` still contains the browser's requested SPA route. Use the pathname parsed from `req.originalUrl` when selecting route-specific server-rendered metadata.

**Why:** Express can rewrite the mounted request path to `/` inside fallback middleware, making every route silently receive homepage metadata even though client navigation looks correct.

**How to apply:** Any SPA fallback that varies its HTML by route should parse `req.originalUrl`, strip the query string through URL parsing, and cover that behavior with a focused test.