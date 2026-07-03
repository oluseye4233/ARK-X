import fs from "fs";
import path from "path";
import { pool } from "./db";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");
const ADVISORY_LOCK_KEY = 0x41524b4d; // "ARKM" — serializes concurrent migrators

/**
 * Applies every pending `migrations/*.sql` file to the connected database, in
 * filename order. Non-interactive (unlike `drizzle-kit push`, which hangs on
 * TTY prompts) and safe to run repeatedly: applied files are tracked in a
 * `schema_migrations` table, and the SQL files themselves are idempotent
 * (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so a lost tracking
 * table only costs a harmless re-run.
 *
 * Each file is executed as a single multi-statement query — files contain
 * `DO $$ ... $$` blocks, so naive semicolon-splitting would corrupt them.
 * A failure aborts startup with an error naming the exact migration file.
 */
export async function applyMigrations(): Promise<void> {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log("[migrate] no migrations directory found, skipping");
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] no migration files found, skipping");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations",
    );
    const applied = new Set(rows.map((r) => r.filename));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(`[migrate] up to date (${files.length} migrations applied)`);
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
          [file],
        );
        await client.query("COMMIT");
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Migration failed: migrations/${file} — ${detail}. ` +
            `The database schema is behind the code; fix or apply this migration before starting.`,
        );
      }
    }

    console.log(
      `[migrate] applied ${pending.length} pending migration(s); ${files.length} total`,
    );
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
