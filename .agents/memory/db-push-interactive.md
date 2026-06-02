---
name: db:push is interactive / blocked
description: How to make schema changes in this repl when drizzle-kit push hangs on a TTY prompt
---

`npm run db:push` (drizzle-kit) prompts interactively (e.g. column rename "create vs rename"
confirmations) and hangs/fails under the non-TTY agent shell.

**Why:** drizzle-kit push needs a TTY for ambiguous-diff prompts; the agent shell has none.

**How to apply:** For schema changes, do BOTH:
1. Apply the DDL directly so the dev DB is live now: `psql "$DATABASE_URL" -c '<DDL>'`.
2. ALSO write a numbered idempotent SQL file in `migrations/` (CREATE TABLE/INDEX IF NOT
   EXISTS, ADD COLUMN IF NOT EXISTS) so deployed/prod DBs get the change. Direct psql DDL
   alone does NOT migrate production — code review will (correctly) fail the task without
   the migration file.
