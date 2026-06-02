-- Task #35 — Scheduled HR-roster sync
-- Per-institution connector configuration: which institution has opted a given
-- live HR adapter (BambooHR/Gusto/Workday) into automatic background sync, the
-- cadence, and the outcome of the most recent attempt. The scheduler keys off
-- the (institution, adapter) rows so it has a concrete tenant to target even
-- though connector credentials are global env secrets.
-- Idempotent: re-runs cleanly on environments that already have the objects.

CREATE TABLE IF NOT EXISTS hr_connector_configs (
  id                varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  institution       text NOT NULL,
  adapter           text NOT NULL,                 -- HrConnectorAdapterKey (API adapters)
  enabled           boolean NOT NULL DEFAULT false,
  interval_minutes  integer NOT NULL DEFAULT 60,
  last_synced_at    timestamp,
  last_sync_status  text,                          -- success | error | skipped
  last_sync_message text,
  last_sync_summary jsonb,                         -- { inserted, updated, totalRows, errorRows }
  created_by        varchar NOT NULL,
  created_at        timestamp NOT NULL DEFAULT now(),
  updated_at        timestamp NOT NULL DEFAULT now()
);

-- One config per (institution, adapter): an institution opts each HR system in
-- at most once.
CREATE UNIQUE INDEX IF NOT EXISTS hr_connector_configs_institution_adapter_uniq
  ON hr_connector_configs (institution, adapter);

-- The scheduler scans for enabled rows across all institutions every tick.
CREATE INDEX IF NOT EXISTS hr_connector_configs_enabled_idx
  ON hr_connector_configs (enabled);
