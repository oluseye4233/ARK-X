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

Post-publish verification must compare the migration files bundled into the
running deployment against its own `schema_migrations` rows using a read-only
query. Keep the result instance-local and include the startup migration summary.

**Why:** Autoscaled instances may overlap during rollout, so a checker must not
depend on shared process memory, mutate production, or compare production
against a workspace checkout that may differ from the live build.

**How to apply:** Call the published app's migration health check after a
publish and fail on its first missing filename. Treat an unreadable tracking
table as unhealthy rather than creating or repairing it from the checker.

**Naming:** monotonic, unique 4-digit prefix. `ls migrations/*.sql`, take max
prefix + 1 — never reuse an ordinal. The runner sorts by full filename, so
duplicate prefixes get lexicographic order, which may not match intent.

When reconciling branches that already published different migrations under the
same ordinal, preserve both histories rather than renaming one in place. Add the
incoming DDL under the next unused ordinal and rehearse upgrades against each
observed `schema_migrations` ledger plus a clean database.

**Why:** A filename-tracked database may already consider one branch's filename
applied. Rewriting published history can leave the ledger and actual schema
describing different realities.

**How to apply:** Inventory migration files and database ledger rows before the
merge, make incoming DDL idempotent under a new filename, and test every known
history. An application rollback cannot undo additive DDL safely; use feature
flags to disable the new surface while repairing migration state.

**Gotcha:** `current_role` is a Postgres reserved word — quote it
(`"current_role"`) in raw SQL. Drizzle auto-quotes in schema definitions.
