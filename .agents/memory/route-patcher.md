---
name: HTTP-verb-aware smoke tests for route patchers
description: Why curl smoke-testing flagged routes with the wrong verb masks coverage gaps.
---

When verifying that a route gate (auth, feature flag, etc.) is applied to every CLASS C endpoint, the smoke test **must use the actual verb the route is registered for**. Express returns its own 404 when no handler matches the verb+path combination, which looks identical to the gate's intentional 404 and silently passes the test on routes that were never patched.

**Why:** A single `curl -X POST` loop over every flagged path will return 404 for unpatched GET-only routes (because there's no POST handler at all), making the patcher look complete when it isn't. We hit this exact false-pass on `/api/sphinx/roundtable`, `/api/departments`, `/api/admin/drm/violators`, `/api/guin/by-username/:u`, `/api/notifications` — all of which had been correctly patched, but a wrong-verb test would have hidden any miss.

**How to apply:**
- Build the smoke-test list as `(method, path)` tuples, not just paths.
- After running a route patcher (sed/Node-based), verify every patched declaration by parsing the file for `app.METHOD(...)` calls and re-deriving the verb list — don't trust a verb-agnostic loop.
- For middleware that should fire before auth (like a feature-flag 404), test with no credentials AND assert the same 404 with valid credentials — confirms the gate runs before `requireAuth`, not after.
