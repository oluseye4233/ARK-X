---
name: ACC Architect bridge
description: Authority and eligibility rules for linking ARK-X and ACC-FACTORY.
---

ACC-FACTORY is the canonical ARCHITECT subscription authority. ARK-X may attest that a signed-in user has durable verified HIVE Gold or Platinum evidence, but it must not grant the ACC subscription.

Verified HIVE Gold eligibility gives a 50% discount on the ACC-owned ARCHITECT subscription. Public badge images, share URLs, JCSE session Gold, email matching, browser plan claims, and shared sessions are not proof.

**Why:** The user explicitly chose ACC subscription ownership and verified HIVE Gold as the qualification. Keeping eligibility evidence separate from billing authority prevents either platform from forging the other's state.

**How to apply:** Use short-lived asymmetric ARK assertions, explicit one-to-one account linking, one-time assertion IDs, and ACC-owned Stripe lifecycle state. ACC customer billing must fail closed until verified per-customer authentication is mounted; staff-code identity is never a customer identity.