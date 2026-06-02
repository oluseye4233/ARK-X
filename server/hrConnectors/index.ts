// HR-connector framework public surface — Task #25.
export type {
  HrConnectorAdapter,
  HrConnectorInput,
  HrConnectorParseResult,
  NormalizedHrRecord,
  HrConnectorAdapterKey,
} from "./types";
export {
  registerHrConnector,
  getHrConnector,
  listHrConnectors,
} from "./registry";
export { parseCsv } from "./csvAdapter";
export {
  finalizeApiRecords,
  normalizeHireDate,
  detectFieldMapping,
  fetchJson,
  secretsPresent,
  assertConfigured,
} from "./normalize";
