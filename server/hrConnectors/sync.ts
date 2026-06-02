// Shared HR-connector sync runner — Task #35.
//
// Both the on-demand route (POST /api/workforce/sync) and the background
// scheduler (server/hrScheduler.ts) pull a roster from a live HR API adapter,
// upsert it into staff_records, and record an import-batch audit row. This
// module is the single implementation of that pipeline so the two callers can
// never drift. It returns a discriminated result instead of throwing/sending
// HTTP, leaving status-code mapping (route) and logging (scheduler) to callers.

import { getHrConnector } from "./registry";
import { storage } from "../storage";
import type { HrConnectorParseResult } from "@shared/schema";

/** Why a sync did not produce a roster upsert. Mapped to HTTP codes by the
 *  route and to log lines by the scheduler. */
export type SyncFailureCode =
  | "unknown_adapter" // adapter key not registered          → 400
  | "not_api" // adapter has no fetchRecords (file-only)     → 400
  | "not_configured" // required server-side secrets missing → 400
  | "fetch_failed" // adapter threw on auth/network          → 502
  | "no_records"; // adapter returned zero valid rows        → 422

export type SyncResult =
  | {
      ok: true;
      batchId: string;
      adapter: string;
      summary: { inserted: number; updated: number; linked: number; totalRows: number; errorRows: number };
      columnMapping: Record<string, string>;
      errors: HrConnectorParseResult["errors"];
    }
  | { ok: false; code: SyncFailureCode; message: string };

/**
 * Pull + normalize a roster from a live HR adapter and upsert it for one
 * institution, recording an audit batch. `importedBy` is the actor recorded on
 * the batch (an admin's userId for on-demand syncs, or the system marker for
 * scheduled runs).
 */
export async function runConnectorSync(opts: {
  institution: string;
  adapterKey: string;
  importedBy: string;
}): Promise<SyncResult> {
  const { institution, adapterKey, importedBy } = opts;

  const adapter = getHrConnector(adapterKey);
  if (!adapter) {
    return { ok: false, code: "unknown_adapter", message: `Unknown HR connector "${adapterKey}".` };
  }
  if (!adapter.fetchRecords) {
    return {
      ok: false,
      code: "not_api",
      message: `The "${adapter.label}" connector does not support API sync. Use the file import instead.`,
    };
  }
  if (adapter.isConfigured && !adapter.isConfigured()) {
    const missing = (adapter.requiredSecrets ?? []).join(", ");
    return {
      ok: false,
      code: "not_configured",
      message: `The "${adapter.label}" connector is not configured. Ask an admin to set its credentials${missing ? ` (${missing})` : ""}.`,
    };
  }

  let result: HrConnectorParseResult;
  try {
    result = await adapter.fetchRecords();
  } catch (err: any) {
    return {
      ok: false,
      code: "fetch_failed",
      message: err?.message ?? `${adapter.label} sync failed.`,
    };
  }

  if (result.records.length === 0) {
    return {
      ok: false,
      code: "no_records",
      message: `${adapter.label} returned no valid staff records.`,
    };
  }

  const batch = await storage.createImportBatch({
    institution,
    adapter: result.adapter,
    filename: `${adapter.label} API sync`,
    importedBy,
    totalRows: result.totalRows,
    importedRows: 0,
    updatedRows: 0,
    errorRows: result.errors.length,
    errors: result.errors,
    columnMapping: result.columnMapping,
  });

  const upserted = await storage.upsertStaffRecords(institution, batch.id, result.records);
  await storage.updateImportBatchCounts(batch.id, {
    importedRows: upserted.inserted,
    updatedRows: upserted.updated,
  });

  return {
    ok: true,
    batchId: batch.id,
    adapter: result.adapter,
    summary: {
      ...upserted,
      totalRows: result.totalRows,
      errorRows: result.errors.length,
    },
    columnMapping: result.columnMapping,
    errors: result.errors,
  };
}
