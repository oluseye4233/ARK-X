// HR-connector registry — Task #25.
//
// Single lookup surface for adapters. New live connectors register here and the
// import pipeline, routes, and source-picker all consume them through this map,
// so adding a source never touches the import logic.

import type { HrConnectorAdapter, HrConnectorAdapterKey } from "./types";
import csvAdapter from "./csvAdapter";

const adapters = new Map<HrConnectorAdapterKey, HrConnectorAdapter>();

export function registerHrConnector(adapter: HrConnectorAdapter): void {
  adapters.set(adapter.key, adapter);
}

export function getHrConnector(
  key: string,
): HrConnectorAdapter | undefined {
  return adapters.get(key as HrConnectorAdapterKey);
}

export function listHrConnectors(): HrConnectorAdapter[] {
  return Array.from(adapters.values());
}

// Register the built-in adapters.
registerHrConnector(csvAdapter);
