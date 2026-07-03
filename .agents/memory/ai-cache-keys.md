---
name: AI cache keys must track the resolved model
description: Rule for keying AI response caches when generation can fall back across providers/models.
---

Any cache in front of a chain-based AI call must include the resolved primary model (`chain[0]`) in its key — never a hardcoded model constant.

**Why:** With multi-provider fallback, the model that actually generates can differ per call/outage. A hardcoded-model key serves one model's cached output as if it came from another, silently masking provider differences (found as a regression during the LLM-resilience refactor).

**How to apply:** When adding or reviewing any `cacheKey([...])` near `generateWithChain`, resolve the chain first (after budget/quota gates), then key on `chain[0]`. Note: this means cache lookups happen after quota checks — quota gates are read-only checks, so cache hits still don't consume budget.
