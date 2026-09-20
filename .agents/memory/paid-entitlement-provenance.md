---
name: Paid entitlement provenance
description: Authorization rule for self-serve payments, administrative contracts, and legacy billing records.
---

Paid feature access requires an explicit source (`provider` or `contract`) paired with verified status. Never infer verification from the shape or presence of a provider identifier. Administrative Enterprise grants are contract provenance, distinct from self-serve provider payments.

**Why:** Historical synthetic identifiers and manually populated values are not authoritative payment confirmation. Trusting identifier naming conventions creates a paid-feature authorization escalation path.

**How to apply:** Every entitlement writer must set source and verification status atomically. Legacy and unknown records fail closed without deleting billing history. Backfills must preserve later classifications when rerun.