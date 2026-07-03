---
name: Dev DB migration drift
description: How migrations/*.sql are applied automatically at startup, and pitfalls when authoring new ones.
---

# Dev DB migration drift

Migrations are now auto-applied: server startup runs an idempotent runner that
executes pending `migrations/*.sql` in filename order and records them in a
`schema_migrations` tracking table (advisory-locked). `npm run db:migrate` runs
the same thing standalone. A failing migration aborts startup with an error
naming the exact file.

**Why:** `db:push` (drizzle-kit) is interactive in this environment and hangs
on TTY prompts, so merged task work that relied on it never ran against the
shared dev DB — code and schema silently drifted (e.g. a missing column broke
an entire test suite with no obvious cause).

**How to apply:** just write the SQL file — it gets applied on the next server
start, or run `npm run db:migrate`. Files execute as ONE multi-statement query
(they contain `DO $$` blocks; never semicolon-split them). Keep every migration
idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so a lost
tracking table only costs a harmless re-run.

**Naming:** monotonic, unique 4-digit prefix. `ls migrations/*.sql`, take max
prefix + 1 — never reuse an ordinal. The runner sorts by full filename, so
duplicate prefixes get lexicographic order, which may not match intent.

**Gotcha:** `current_role` is a Postgres reserved word — quote it
(`"current_role"`) in raw SQL. Drizzle auto-quotes in schema definitions.
