import { applyMigrations } from "../server/migrate";
import { pool } from "../server/db";

applyMigrations()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
