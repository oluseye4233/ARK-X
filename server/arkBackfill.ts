/**
 * PDD §3.4 — Migration backfill. Walks every existing user, runs the recalc
 * pipeline once with bypassCaps=true, and seeds users.arkScore + the 3 new
 * tables (ccmi_pillar_scores, lhcs_signals, ark_score_history).
 *
 * bypassCaps is intentional and admin-only: this is the one-time migration
 * path that must seed each user's identity from their full pre-Phase-J
 * history without being throttled by the +15/day or +20/30d caps. The
 * /api/admin/ark/backfill route gates this by ADMIN_USER_ID; non-admin
 * self-backfill goes through the standard capped recalc path.
 *
 * Idempotent: re-running just refreshes the snapshot.
 */
import { db } from "./db";
import { users } from "@shared/schema";
import { recalcArkForUser } from "./arkRecalc";

export async function backfillAllUsers(): Promise<{
  totalUsers: number;
  succeeded: number;
  failed: number;
  errors: Array<{ userId: string; error: string }>;
}> {
  const allUsers = await db.select({ id: users.id }).from(users);
  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ userId: string; error: string }> = [];
  for (const u of allUsers) {
    try {
      await recalcArkForUser({
        userId: u.id,
        trigger: "backfill",
        triggerMeta: { migration: "PDD_J_initial" },
        bypassCaps: true,
      });
      succeeded += 1;
    } catch (err: unknown) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ userId: u.id, error: msg });
    }
  }
  return { totalUsers: allUsers.length, succeeded, failed, errors };
}
