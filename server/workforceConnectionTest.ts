// Read-only "Test connection" core for LIVE HR API connectors.
//
// Extracted from the POST /api/workforce/test-connection route so the
// invariant that matters — authenticate + count records, but NEVER write to
// staff_records or create an import batch — can be locked in by unit tests
// (see server/__tests__/workforceTestConnection.test.ts). This module has no
// dependency on `./storage` by design: a connection test must stay purely
// read-only, and that guarantee is structural, not just conventional.

import { getHrConnector } from "./hrConnectors";

export type ConnectionTestResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Resolve the requested adapter, validate it supports + is configured for live
 * API sync, then pull + normalize its roster to confirm credentials and
 * reachability. Returns an HTTP status + JSON body; never throws for the known
 * failure modes (the route wraps it in a generic 500 for anything unexpected).
 *
 *   - 400  unknown / file-only / unconfigured adapter
 *   - 502  adapter.fetchRecords() failed (auth / network — upstream error)
 *   - 200  ok, with totalRows / validRows / errorRows counts
 */
export async function runHrConnectionTest(
  adapterKey: string,
): Promise<ConnectionTestResult> {
  const adapter = getHrConnector(adapterKey);
  if (!adapter) {
    return {
      status: 400,
      body: { message: `Unknown HR connector "${adapterKey}".` },
    };
  }
  if (!adapter.fetchRecords) {
    return {
      status: 400,
      body: {
        message: `The "${adapter.label}" connector does not support API sync. Use the file import instead.`,
      },
    };
  }
  if (adapter.isConfigured && !adapter.isConfigured()) {
    const missing = (adapter.requiredSecrets ?? []).join(", ");
    return {
      status: 400,
      body: {
        message: `The "${adapter.label}" connector is not configured. Ask an admin to set its credentials${missing ? ` (${missing})` : ""}.`,
      },
    };
  }

  // Pull + normalize from the live API to confirm credentials + reachability.
  // fetchRecords throws on auth/network failure; surface as 502 (upstream).
  let result;
  try {
    result = await adapter.fetchRecords();
  } catch (err: any) {
    console.error(
      `[/api/workforce/test-connection] ${adapterKey} fetch failed:`,
      err,
    );
    return {
      status: 502,
      body: {
        ok: false,
        message: err?.message ?? `${adapter.label} connection test failed.`,
      },
    };
  }

  // Read-only: deliberately no createImportBatch / upsertStaffRecords here.
  return {
    status: 200,
    body: {
      ok: true,
      adapter: result.adapter,
      label: adapter.label,
      totalRows: result.totalRows,
      validRows: result.records.length,
      errorRows: result.errors.length,
    },
  };
}
