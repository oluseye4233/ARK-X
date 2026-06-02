// Shared normalization helpers for live HR-connector adapters — Task #28.
//
// API adapters (BambooHR / Gusto / Workday) each map their raw response objects
// onto the normalized HR field set, then hand the result here. This helper runs
// the SAME row validation the CSV adapter applies (required Full Name, email
// sanity, hire-date normalization, in-batch de-dupe) so every source produces
// an identical `HrConnectorParseResult` regardless of where it came from.

import { HR_FIELD_KEYS, HR_FIELD_SYNONYMS, type HrFieldKey } from "@shared/schema";
import type {
  HrConnectorAdapterKey,
  HrConnectorParseResult,
  NormalizedHrRecord,
} from "./types";

/** Normalize a hire-date value to YYYY-MM-DD, or null if unparseable.
 *  Mirrors the CSV adapter so tenure bands stay consistent across sources. */
export function normalizeHireDate(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const slash = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (slash) {
    let [, a, b, y] = slash;
    if (y.length === 2) y = `20${y}`;
    const mm = a.padStart(2, "0");
    const dd = b.padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

/** A single raw record an API adapter has already mapped onto the normalized
 *  field keys (values may be empty/undefined — they get dropped). */
export type RawMappedRecord = Partial<Record<HrFieldKey, string | null | undefined>>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Validate + de-dupe a list of already-field-mapped records into the shared
 *  `HrConnectorParseResult`. `columnMapping` describes the source-field →
 *  HrFieldKey mapping the adapter used, purely for the audit/preview surface.
 *  Row numbers in errors are 1-indexed positions in the source list. */
export function finalizeApiRecords(
  adapter: HrConnectorAdapterKey,
  raw: RawMappedRecord[],
  columnMapping: Record<string, string> = {},
): HrConnectorParseResult {
  const errors: { row: number; message: string }[] = [];
  const records: NormalizedHrRecord[] = [];
  const seenKeys = new Set<string>();
  let totalRows = 0;

  raw.forEach((source, idx) => {
    const sourceRow = idx + 1;
    // Trim + drop empty values; keep only real HrFieldKeys.
    const rec: Partial<Record<HrFieldKey, string>> = {};
    for (const key of HR_FIELD_KEYS) {
      const val = source[key];
      if (val === undefined || val === null) continue;
      const trimmed = String(val).trim();
      if (!trimmed) continue;
      rec[key] = trimmed;
    }

    // A fully-empty record (no fields at all) is skipped silently.
    if (Object.keys(rec).length === 0) return;
    totalRows++;

    if (rec.hireDate) {
      const norm = normalizeHireDate(rec.hireDate);
      if (norm) rec.hireDate = norm;
      else {
        errors.push({ row: sourceRow, message: `Unrecognized hire date "${rec.hireDate}" — left blank.` });
        delete rec.hireDate;
      }
    }

    const fullName = (rec.fullName ?? "").trim();
    if (!fullName) {
      errors.push({ row: sourceRow, message: "Missing required Full Name." });
      return;
    }

    if (rec.email && !EMAIL_RE.test(rec.email)) {
      errors.push({ row: sourceRow, message: `Invalid email "${rec.email}" — left blank.` });
      delete rec.email;
    }

    const dedupeKey = (rec.email ?? `name:${fullName.toLowerCase()}`).toLowerCase();
    if (seenKeys.has(dedupeKey)) {
      errors.push({ row: sourceRow, message: `Duplicate of an earlier record (${rec.email ?? fullName}) — skipped.` });
      return;
    }
    seenKeys.add(dedupeKey);

    records.push({ ...rec, fullName } as NormalizedHrRecord);
  });

  return {
    adapter,
    columnMapping,
    unmappedColumns: [],
    records,
    errors,
    totalRows,
  };
}

/** Auto-detect a source-key → HrFieldKey mapping from the shared synonym table.
 *  Used by the Workday adapter, whose report column names are admin-defined.
 *  Exact synonym match wins; falls back to a looser contains match. A field is
 *  only claimed once (first matching source key). */
export function detectFieldMapping(sourceKeys: string[]): Record<string, HrFieldKey> {
  const mapping: Record<string, HrFieldKey> = {};
  const claimed = new Set<HrFieldKey>();
  const tryMatch = (loose: boolean) => {
    for (const sourceKey of sourceKeys) {
      if (mapping[sourceKey]) continue;
      const norm = sourceKey.trim().toLowerCase();
      if (!norm) continue;
      for (const key of HR_FIELD_KEYS) {
        if (claimed.has(key)) continue;
        const synonyms = HR_FIELD_SYNONYMS[key];
        const hit = loose
          ? synonyms.some((s) => norm.includes(s) || s.includes(norm))
          : synonyms.some((s) => s === norm);
        if (hit) {
          mapping[sourceKey] = key;
          claimed.add(key);
          break;
        }
      }
    }
  };
  tryMatch(false);
  tryMatch(true);
  return mapping;
}

/** GET a JSON resource with bounded time + clear error messages. Used by every
 *  live adapter so timeouts / non-2xx / bad-JSON failures read consistently. */
export async function fetchJson(
  url: string,
  init: RequestInit & { label: string; timeoutMs?: number },
): Promise<any> {
  const { label, timeoutMs = 20_000, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw new Error(`${label} request failed: ${err?.message ?? "network error"}.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const detail = body ? ` — ${body.slice(0, 300)}` : "";
    if (res.status === 401 || res.status === 403) {
      throw new Error(`${label} authentication failed (HTTP ${res.status}). Check the configured credentials.${detail}`);
    }
    throw new Error(`${label} returned HTTP ${res.status}.${detail}`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error(`${label} returned a non-JSON response.`);
  }
}

/** True when every named secret is a non-empty env value. */
export function secretsPresent(keys: readonly string[]): boolean {
  return keys.every((k) => {
    const v = process.env[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

/** Throw an actionable "not configured" error listing the missing secrets. */
export function assertConfigured(label: string, keys: readonly string[]): void {
  const missing = keys.filter((k) => {
    const v = process.env[k];
    return !(typeof v === "string" && v.trim().length > 0);
  });
  if (missing.length > 0) {
    throw new Error(
      `${label} is not configured. Set the following secret${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    );
  }
}
