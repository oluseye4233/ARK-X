---
name: Stripe search consistency
description: Read-after-write safety when Stripe-backed validation creates catalog fixtures.
---

Stripe Search is eventually consistent. Any validation that creates a Product and then exercises application code that finds it through Search must wait until that exact Product appears in Search results.

**Why:** A freshly reset sandbox can accept Product and Price creation while an immediate Search still returns no matching Product, making a concurrency check fail because of catalog propagation rather than the behavior under test.

**How to apply:** Keep live-mode refusal ahead of all writes, reuse created objects within fixture preparation, and poll Search with a bounded timeout before handing control to code paths that independently search the catalog.