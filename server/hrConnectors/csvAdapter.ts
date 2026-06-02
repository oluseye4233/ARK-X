// CSV HR-connector adapter — Task #25.
//
// Parses an uploaded CSV roster, auto-detects which column feeds which
// normalized HR field (via the shared synonym table, overridable by the admin),
// validates each row, and returns normalized records + a column mapping +
// per-row errors. Self-contained CSV parser (no new dependency) that handles
// quoted fields, embedded commas/newlines, and escaped double-quotes.

import {
  HR_FIELD_KEYS,
  HR_FIELD_SYNONYMS,
  type HrFieldKey,
} from "@shared/schema";
import type {
  HrConnectorAdapter,
  HrConnectorInput,
  HrConnectorParseResult,
  NormalizedHrRecord,
} from "./types";

/** RFC-4180-ish CSV parse: rows of string cells. Handles quoted fields with
 *  embedded commas, CRLF/LF, and "" escaped quotes. Tolerates a trailing
 *  newline. Returns [] for empty input. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  // Strip a leading UTF-8 BOM if present.
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      // Swallow CR; the following LF (if any) triggers the row break.
      if (text[i + 1] === "\n") {
        pushRow();
        i += 2;
      } else {
        pushRow();
        i++;
      }
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // Flush the final field/row unless the input ended on a clean row break with
  // nothing buffered.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }
  // Drop a trailing fully-empty row produced by a final newline.
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === "") rows.pop();
  }
  return rows;
}

/** Build a header → HrFieldKey mapping from the synonym table. First synonym
 *  match wins; a field is only auto-assigned once (first matching column). */
function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimed = new Set<HrFieldKey>();
  for (const header of headers) {
    const norm = header.trim().toLowerCase();
    if (!norm) continue;
    let matched: HrFieldKey | null = null;
    for (const key of HR_FIELD_KEYS) {
      if (claimed.has(key)) continue;
      const synonyms = HR_FIELD_SYNONYMS[key];
      if (synonyms.some((s) => s === norm)) {
        matched = key;
        break;
      }
    }
    // Fall back to a looser "contains" match if no exact synonym hit.
    if (!matched) {
      for (const key of HR_FIELD_KEYS) {
        if (claimed.has(key)) continue;
        const synonyms = HR_FIELD_SYNONYMS[key];
        if (synonyms.some((s) => norm.includes(s) || s.includes(norm))) {
          matched = key;
          break;
        }
      }
    }
    if (matched) {
      mapping[header] = matched;
      claimed.add(matched);
    }
  }
  return mapping;
}

/** Normalize a hire-date cell to YYYY-MM-DD, or return null if unparseable. */
function normalizeHireDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  // Already ISO-ish.
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // M/D/Y or D/M/Y — assume M/D/Y (US HR exports). Ambiguous but consistent.
  const slash = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (slash) {
    let [, a, b, y] = slash;
    if (y.length === 2) y = `20${y}`;
    const mm = a.padStart(2, "0");
    const dd = b.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

const csvAdapter: HrConnectorAdapter = {
  key: "csv",
  label: "CSV Upload",
  acceptsFile: true,

  parse(input: HrConnectorInput): HrConnectorParseResult {
    const rows = parseCsv(input.content ?? "");
    const errors: { row: number; message: string }[] = [];

    if (rows.length === 0) {
      return {
        adapter: "csv",
        columnMapping: {},
        unmappedColumns: [],
        records: [],
        errors: [{ row: 0, message: "The file is empty." }],
        totalRows: 0,
      };
    }

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    // Use the caller's override when provided, else auto-detect.
    const override = input.columnMapping;
    const columnMapping: Record<string, string> =
      override && Object.keys(override).length > 0
        ? sanitizeOverride(override, headers)
        : autoDetectMapping(headers);

    const mappedFields = new Set(Object.values(columnMapping));
    const unmappedColumns = headers.filter(
      (h) => h && !columnMapping[h],
    );

    if (!mappedFields.has("fullName")) {
      errors.push({
        row: 0,
        message:
          "No column maps to Full Name. Map a name column before importing.",
      });
    }

    // Pre-resolve header → column-index so we read by name regardless of order.
    const headerIndex = new Map<string, number>();
    headers.forEach((h, idx) => {
      if (h && !headerIndex.has(h)) headerIndex.set(h, idx);
    });

    const records: NormalizedHrRecord[] = [];
    const seenKeys = new Set<string>();

    dataRows.forEach((cells, idx) => {
      const sourceRow = idx + 1; // 1-indexed, header excluded
      // Skip fully-blank lines silently.
      if (cells.every((c) => c.trim() === "")) return;

      const rec: Partial<Record<HrFieldKey, string>> = {};
      for (const [header, fieldKey] of Object.entries(columnMapping)) {
        const colIdx = headerIndex.get(header);
        if (colIdx === undefined) continue;
        const raw = (cells[colIdx] ?? "").trim();
        if (!raw) continue;
        if (fieldKey === "hireDate") {
          const norm = normalizeHireDate(raw);
          if (norm) rec.hireDate = norm;
          else {
            errors.push({
              row: sourceRow,
              message: `Unrecognized hire date "${raw}" — left blank.`,
            });
          }
          continue;
        }
        rec[fieldKey as HrFieldKey] = raw;
      }

      const fullName = (rec.fullName ?? "").trim();
      if (!fullName) {
        errors.push({ row: sourceRow, message: "Missing required Full Name." });
        return;
      }

      // Basic email sanity — drop a clearly-invalid email but keep the row.
      if (rec.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) {
        errors.push({
          row: sourceRow,
          message: `Invalid email "${rec.email}" — left blank.`,
        });
        delete rec.email;
      }

      // De-dupe within a single file on email (or name when no email) so the
      // upsert key never collides inside one batch.
      const dedupeKey = (rec.email ?? `name:${fullName.toLowerCase()}`).toLowerCase();
      if (seenKeys.has(dedupeKey)) {
        errors.push({
          row: sourceRow,
          message: `Duplicate of an earlier row (${rec.email ?? fullName}) — skipped.`,
        });
        return;
      }
      seenKeys.add(dedupeKey);

      records.push({ ...rec, fullName } as NormalizedHrRecord);
    });

    return {
      adapter: "csv",
      columnMapping,
      unmappedColumns,
      records,
      errors,
      totalRows: dataRows.filter((r) => !r.every((c) => c.trim() === "")).length,
    };
  },
};

/** Keep only override entries whose header exists and whose value is a real
 *  HrFieldKey; ignore everything else so a malformed override can't poison the
 *  mapping. A field can only be claimed by one column (first wins). */
function sanitizeOverride(
  override: Record<string, string>,
  headers: string[],
): Record<string, string> {
  const valid: Record<string, string> = {};
  const claimed = new Set<string>();
  const headerSet = new Set(headers.filter(Boolean));
  const fieldSet = new Set<string>(HR_FIELD_KEYS);
  for (const header of headers) {
    const value = override[header];
    if (!value) continue;
    if (!headerSet.has(header)) continue;
    if (!fieldSet.has(value)) continue;
    if (claimed.has(value)) continue;
    valid[header] = value;
    claimed.add(value);
  }
  return valid;
}

export default csvAdapter;
