---
name: TSX browser evaluation
description: Prevent tsx/esbuild helper injection from breaking code evaluated inside a real browser.
---

When browser tests run through `tsx`, pass plain JavaScript source to `page.evaluate` rather than a callback containing nested functions.

**Why:** The tsx/esbuild transform can inject a Node-side helper such as `__name` into serialized nested functions. Chromium then throws because that helper is absent from the page context.

**How to apply:** Keep evaluated source valid standalone JavaScript with no TypeScript annotations or template interpolation from the test process. Normal callbacks are fine when their transformed output has no injected helper references.