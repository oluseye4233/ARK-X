---
name: Stripe operation recovery
description: Safety rules for resuming durable provider billing mutations.
---

Persisted Stripe operations may be reissued only while Stripe's current `planVersion` is not newer than the operation's target version. A newer provider version supersedes the pending operation and must be reconciled locally without replaying the stale command. Recovery completion must reconstruct accepted customer-facing proof, such as proration amounts, from the persisted operation payload rather than defaulting missing request-local results.

**Why:** Replaying an older plan switch or cancellation over a newer Stripe state can reverse a legitimate plan change and create unintended prorations. Request-bound event publication can also disappear when recovery finishes after the request fails, and provider reconciliation alone cannot recreate the accepted preview amount.

**How to apply:** Use a stable operation idempotency key for unapplied commands. When the provider version is newer, trust and reconcile the provider state. Persist accepted preview evidence with the operation, then write downstream billing/audit events transactionally with local completion and key them by operation ID.