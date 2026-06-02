---
name: Dev DB migration drift
description: Why merged task-agent schema changes can be absent from the dev DB, and how to fix "relation does not exist" at runtime.
---

# Dev DB migration drift

When a task agent adds a table/column (schema in `shared/schema.ts` + a SQL file
in `migrations/`), the merge does NOT automatically apply that SQL to the dev
Postgres. Runtime then fails with Drizzle `relation "<table>" does not exist` or
a missing-column error, even though the schema and migration file look correct.

**Why:** `db:push` (drizzle-kit) is interactive in this environment, so merged
task work that relied on it never ran against the shared dev DB. Each merged
migration file lands in `migrations/` but is not executed.

**How to apply:** the migration files are written to be idempotent
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
`CREATE UNIQUE INDEX IF NOT EXISTS`). Run the relevant one directly:
`psql "$DATABASE_URL" -f migrations/<file>.sql`, then verify with `\d <table>`
and an `information_schema.columns` check. Safe to re-run.

**Naming:** migration files use a monotonic, unique 4-digit prefix. Before
creating one, `ls migrations/*.sql` and take max prefix + 1 — never reuse an
existing ordinal (e.g. a second `0001_*`), even with idempotent SQL, because
duplicate prefixes create ambiguous ordering in tooling.

**Gotcha:** `current_role` is a Postgres reserved word — quote it
(`"current_role"`) in raw SQL. Drizzle auto-quotes, so the schema definition
needs no special handling.
