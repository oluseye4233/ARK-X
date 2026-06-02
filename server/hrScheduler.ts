// Background HR-roster scheduler — Task #35.
//
// On-demand sync (POST /api/workforce/sync) requires an admin to click "Sync
// now". This scheduler keeps rosters current automatically: every tick it
// scans the per-institution connector configs (shared/schema.ts ::
// hrConnectorConfigs) for enabled rows whose cadence has elapsed, runs the same
// sync pipeline the on-demand route uses (server/hrConnectors/sync.ts), and
// records the outcome back onto the config row for the admin UI's last-sync
// status line.
//
// Why config-driven: staff records are per-institution while connector
// credentials live in global env secrets, so the scheduler has no tenant to
// target on its own. The (institution, adapter) config rows are that target —
// an institution explicitly opts each HR system into automatic sync.

import { storage } from "./storage";
import { runConnectorSync } from "./hrConnectors/sync";
import { getHrConnector } from "./hrConnectors/registry";
import { isFeatureEnabled } from "./featureFlags";

/** Actor recorded on import batches produced by an automatic sync. */
export const SCHEDULED_SYNC_ACTOR = "system:hr-scheduler";

/** How often the scheduler wakes to look for due configs. Each config's own
 *  `intervalMinutes` controls how often it actually syncs; this tick just has
 *  to be frequent enough to honour the smallest configured cadence. */
const TICK_MS = (() => {
  const raw = Number(process.env.HR_SYNC_TICK_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : 60_000;
})();

let timer: NodeJS.Timeout | null = null;
/** Guards against overlapping ticks (a slow upstream API outliving one tick). */
let ticking = false;
/** Per-config in-flight guard so a manual sync + a tick can't double-run. */
const inFlight = new Set<string>();

export function isDue(config: { lastSyncedAt: Date | null; intervalMinutes: number }, now: number): boolean {
  if (!config.lastSyncedAt) return true; // never synced → due immediately
  const elapsedMin = (now - new Date(config.lastSyncedAt).getTime()) / 60_000;
  return elapsedMin >= config.intervalMinutes;
}

/** Run one config's sync now, recording the outcome onto the config row.
 *  Exported so a future "sync this config now" admin action can reuse it.
 *  Never throws — failures are captured as the config's last-sync status. */
export async function syncConfigNow(config: {
  id: string;
  institution: string;
  adapter: string;
}): Promise<void> {
  if (inFlight.has(config.id)) return;
  inFlight.add(config.id);
  try {
    const result = await runConnectorSync({
      institution: config.institution,
      adapterKey: config.adapter,
      importedBy: SCHEDULED_SYNC_ACTOR,
    });

    if (result.ok) {
      await storage.recordConnectorSyncResult(config.id, {
        status: "success",
        message: `Synced ${result.summary.inserted + result.summary.updated} record(s) (${result.summary.inserted} new, ${result.summary.updated} updated).`,
        summary: {
          inserted: result.summary.inserted,
          updated: result.summary.updated,
          totalRows: result.summary.totalRows,
          errorRows: result.summary.errorRows,
        },
      });
    } else {
      // "no_records" is a benign outcome (empty roster), not an adapter fault.
      const status = result.code === "no_records" ? "skipped" : "error";
      await storage.recordConnectorSyncResult(config.id, {
        status,
        message: result.message,
        summary: null,
      });
      if (status === "error") {
        console.error(
          `[hrScheduler] ${config.adapter} sync failed for "${config.institution}": ${result.message}`,
        );
      }
    }
  } catch (err: any) {
    // Defensive: storage failure while recording, etc.
    console.error(
      `[hrScheduler] unexpected error syncing ${config.adapter} for "${config.institution}":`,
      err,
    );
    await storage
      .recordConnectorSyncResult(config.id, {
        status: "error",
        message: err?.message ?? "Unexpected scheduler error.",
        summary: null,
      })
      .catch(() => {});
  } finally {
    inFlight.delete(config.id);
  }
}

/** One scheduler pass: scan enabled configs and sync the ones that are due and
 *  API-capable. Exported for tests; not part of the public start/stop surface. */
export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const configs = await storage.getEnabledConnectorConfigs();
    const now = Date.now();
    for (const config of configs) {
      // Skip configs whose adapter is unconfigured (missing secrets) or no
      // longer an API connector — runConnectorSync would just fail-close, but
      // skipping avoids spamming error statuses for an unconfigured connector.
      const adapter = getHrConnector(config.adapter);
      if (!adapter?.fetchRecords) continue;
      if (adapter.isConfigured && !adapter.isConfigured()) continue;
      if (!isDue(config, now)) continue;
      await syncConfigNow(config);
    }
  } catch (err) {
    console.error("[hrScheduler] tick failed:", err);
  } finally {
    ticking = false;
  }
}

/** Start the background scheduler. No-op if the workforce feature is off or the
 *  scheduler is already running. Returns true if started. */
export function startHrScheduler(): boolean {
  if (timer) return false;
  if (process.env.HR_SYNC_DISABLED === "true") return false;
  if (!isFeatureEnabled("institutionWorkforce")) return false;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // Don't keep the event loop alive solely for the scheduler.
  if (typeof timer.unref === "function") timer.unref();
  // Kick an initial pass shortly after boot (after routes/DB are ready).
  setTimeout(() => void tick(), 5_000).unref?.();
  console.log(`[hrScheduler] started (tick ${TICK_MS}ms)`);
  return true;
}

/** Stop the scheduler (used in tests / graceful shutdown). */
export function stopHrScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
