---
name: HR connector adapters (file vs API)
description: Two-flavour adapter contract and why roster sync is on-demand, not a global scheduler
---

The `HrConnectorAdapter` contract has two flavours selected by `acceptsFile`:
- File adapters (CSV) implement `parse(input)` (sync, never throws — bad rows become errors).
- Live API adapters (BambooHR/Gusto/Workday) implement async `fetchRecords()` (may throw on auth/network) plus `requiredSecrets` + `isConfigured()`.

Both produce the identical `HrConnectorParseResult`; API adapters route their raw response through `finalizeApiRecords()` so validation/dedupe/hire-date-normalization match the CSV path exactly.

**Decision: roster sync is on-demand only (no scheduler).**
**Why:** staff records are per-institution, but HR credentials live in global env secrets. A background scheduler has no `institutionScope` to target — that scope is only available from an authenticated admin's session. On-demand sync (`POST /api/workforce/sync`, derives institution from session) keeps tenancy correct. A scheduler would need an explicit per-tenant connector-config table first.
**How to apply:** if asked to add scheduled/auto sync, first add a per-institution connector configuration record (which institution → which adapter), then drive the scheduler off that — do not assume a single global institution.

Credentials are never client-supplied: the sync route accepts only the adapter key from the body; everything else is read from `process.env`. Unconfigured adapters fail closed with an actionable "set these secrets" message (400), and upstream API failures surface as 502.
