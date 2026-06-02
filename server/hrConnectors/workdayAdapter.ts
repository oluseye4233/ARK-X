// Workday live HR-connector adapter — Task #28.
//
// Pulls a Workday "Report as a Service" (RaaS) custom report exposed as a JSON
// web service and maps its admin-defined columns onto the normalized HR field
// set. Credentials come from server-side secrets only: the report URL plus an
// Integration System User (ISU) username + password.
//
//   GET {WORKDAY_REPORT_URL}            (format=json appended if absent)
//   Auth: HTTP Basic, ISU username:password
//
// Workday report columns are tenant-defined, so the column → field mapping is
// auto-detected from the report's keys via the shared synonym table — exactly
// like the CSV adapter detects from headers.

import type { HrConnectorAdapter, HrConnectorParseResult } from "./types";
import {
  assertConfigured,
  detectFieldMapping,
  fetchJson,
  finalizeApiRecords,
  secretsPresent,
  type RawMappedRecord,
} from "./normalize";

const REQUIRED = ["WORKDAY_REPORT_URL", "WORKDAY_USERNAME", "WORKDAY_PASSWORD"] as const;

/** Ensure the RaaS URL asks for JSON output. */
function withJsonFormat(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (!u.searchParams.has("format")) u.searchParams.set("format", "json");
    return u.toString();
  } catch {
    return rawUrl;
  }
}

const workdayAdapter: HrConnectorAdapter = {
  key: "workday",
  label: "Workday",
  acceptsFile: false,
  requiredSecrets: REQUIRED,

  isConfigured() {
    return secretsPresent(REQUIRED);
  },

  async fetchRecords(): Promise<HrConnectorParseResult> {
    assertConfigured("Workday", REQUIRED);
    const url = withJsonFormat(process.env.WORKDAY_REPORT_URL!.trim());
    const username = process.env.WORKDAY_USERNAME!.trim();
    const password = process.env.WORKDAY_PASSWORD!.trim();
    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const data = await fetchJson(url, {
      label: "Workday",
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });

    // RaaS JSON wraps rows under "Report_Entry".
    const entries: Record<string, unknown>[] = Array.isArray(data?.Report_Entry)
      ? data.Report_Entry
      : Array.isArray(data)
        ? data
        : [];

    if (entries.length === 0) {
      return { adapter: "workday", columnMapping: {}, unmappedColumns: [], records: [], errors: [], totalRows: 0 };
    }

    // Detect the report-column → HrFieldKey mapping from the union of keys.
    const keySet = new Set<string>();
    for (const e of entries) for (const k of Object.keys(e)) keySet.add(k);
    const mapping = detectFieldMapping(Array.from(keySet));
    const unmappedColumns = Array.from(keySet).filter((k) => !mapping[k]);

    const raw: RawMappedRecord[] = entries.map((entry) => {
      const rec: RawMappedRecord = {};
      for (const [sourceKey, fieldKey] of Object.entries(mapping)) {
        const val = entry[sourceKey];
        if (val == null) continue;
        // Workday occasionally nests a referenced value as { descriptor } or [].
        const str =
          typeof val === "object"
            ? Array.isArray(val)
              ? val.map((v) => (typeof v === "object" && v ? (v as any).descriptor ?? "" : String(v))).filter(Boolean).join(", ")
              : (val as any).descriptor ?? ""
            : String(val);
        if (str) rec[fieldKey] = str;
      }
      return rec;
    });

    const result = finalizeApiRecords("workday", raw, mapping as Record<string, string>);
    return { ...result, unmappedColumns };
  },
};

export default workdayAdapter;
