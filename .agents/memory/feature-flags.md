---
name: Feature flag layering on always-on parent routes
description: Why a flag must be re-checked inside parent routes/components that swallow reserved child slugs, even when the child Route is conditionally registered.
---

A flagged-off CLASS C surface is not "off" just because its `<Route>` is gated and its handler returns 404. If an always-on parent route (server **or** client) matches the same path via a wildcard / `:param`, the request never reaches the flagged registration.

**Concrete pattern that bit us**: `App.tsx` registers `/marketplace/synergy` only when `FEATURES.sphinxAdvanced` is true, but it also always registers `/marketplace/:id`. With the flag off, `useRoute("/marketplace/synergy")` correctly returns false — but the always-on `/marketplace/:id` still matches, and the internal `paramsDetail.id === "synergy"` branch inside `MarketplacePage` happily rendered the CLASS C component anyway.

**Why:** Wouter `<Switch>` finds the first matching `<Route>`. When you conditionally register a more-specific route alongside an unconditional broader one, removing the specific route lets the broader one capture the same URL. The same trap exists server-side anywhere a `:param` or wildcard handler is registered before the specific flagged one.

**How to apply:**
- Whenever you gate a child route, audit all parent/wildcard routes that could match the same path and add a flag re-check inside the parent's branching.
- For reserved child slugs under a wildcard parent, render the 404 page (or return a 404 response) when the flag is off — don't fall through to the generic handler, which will try to fetch a nonexistent record.
- Keep a reserved-slug list in code (e.g. `const RESERVED = new Set([...])`) next to the wildcard so the relationship is obvious to the next reader.
