---
name: HR connector adapters (file vs API)
description: Two-flavour adapter contract and why roster sync is on-demand, not a global scheduler
---

The `HrConnectorAdapter` contract has two flavours selected by `acceptsFile`:
- File adapters (CSV) implement `parse(input)` (sync, never throws — bad rows become errors).
- Live API adapters (BambooHR/Gusto/Workday) implement async `fetchRecords()` (may throw on auth/network) plus `requiredSecrets` + `isConfigured()`.

Both produce the identical `HrConnectorParseResult`; API adapters route their raw response through `finalizeApiRecords()` so validation/dedupe/hire-date-normalization match the CSV path exactly.

**Scheduled sync exists (was deferred, now built).** A per-institution connector-config table (`hrConnectorConfigs`, keyed unique on `(institution, adapter)`) is the tenant target the scheduler needs — staff records are per-institution but credentials are global env secrets, so the scheduler keys off enabled config rows, not a single global institution. A background `setInterval` scheduler (`server/hrScheduler.ts`, started in `server/index.ts` after `listen`, gated on the `institutionWorkforce` flag) scans enabled configs each tick and syncs the ones whose per-config `intervalMinutes` cadence has elapsed.
**Shared pipeline:** both the on-demand route (`POST /api/workforce/sync`) and the scheduler call `runConnectorSync()` (`server/hrConnectors/sync.ts`), which returns a discriminated `{ok}|{ok:false,code}` result — the route maps `code` → HTTP status, the scheduler maps it → `lastSyncStatus` (success/skipped/error) recorded on the config row. Never let those two callers drift; edit the shared runner.
**Gotchas:** the scheduler `unref()`s its timer + skips unconfigured/non-API adapters; enabling a config for an unconfigured connector is blocked at the PUT route (would only fail-close every tick). Scheduled-sync batches record `importedBy = "system:hr-scheduler"`.

Credentials are never client-supplied: the sync route accepts only the adapter key from the body; everything else is read from `process.env`. Unconfigured adapters fail closed with an actionable "set these secrets" message (400), and upstream API failures surface as 502.
