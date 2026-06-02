// HR-connector adapter framework — Task #25.
//
// Every HR source (CSV today; live Workday / BambooHR / SAP connectors later)
// implements the same `HrConnectorAdapter` interface so the import pipeline,
// the storage layer, and the workforce dashboard never need to know which
// source the data came from. An adapter's only job is to turn its raw input
// into the shared normalized HR record shape + a column mapping + row errors.

import type {
  HrConnectorAdapterKey,
  HrConnectorParseResult,
  NormalizedHrRecord,
} from "@shared/schema";

export type {
  HrConnectorAdapterKey,
  HrConnectorParseResult,
  NormalizedHrRecord,
};

/** Input handed to an adapter's `parse`. Raw bytes/text plus an optional
 *  caller-supplied column mapping (sourceHeader → HrFieldKey) that overrides
 *  the adapter's auto-detection — this is what the mapping-preview UI sends
 *  back when the admin corrects a column guess before running the import. */
export interface HrConnectorInput {
  /** Decoded source content (UTF-8 text for the CSV adapter). */
  content: string;
  /** Original filename, for the audit record. */
  filename?: string;
  /** Optional override of the detected mapping. Keys are source headers,
   *  values are HrFieldKey strings (or "" / omitted to ignore a column). */
  columnMapping?: Record<string, string>;
}

/** The pluggable contract. A registry holds one instance per `key`. */
export interface HrConnectorAdapter {
  /** Stable identifier persisted on the import batch (e.g. "csv"). */
  readonly key: HrConnectorAdapterKey;
  /** Human label for the source-picker UI. */
  readonly label: string;
  /** Whether this adapter consumes an uploaded file (vs. a live API pull). */
  readonly acceptsFile: boolean;
  /** Parse raw input into normalized records + mapping + per-row errors.
   *  Never throws on bad data — malformed rows become entries in `errors`. */
  parse(input: HrConnectorInput): HrConnectorParseResult;
}
