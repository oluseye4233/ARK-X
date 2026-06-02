-- Task #25 — Institution ARK Assessment + HR Connectors
-- ENTERPRISE / institution admins import their staff roster + HR fields through a
-- pluggable HR-connector framework (CSV adapter first), link staff to ARK accounts,
-- and view a workforce intelligence dashboard joining ARK scores with HR data.
-- Idempotent: re-runs cleanly on environments that already have the objects.

-- Per-institution staff roster with normalized HR fields. `ark_user_id` links a
-- staff member to their ARK account (matched by email on import or via the
-- invite/link endpoint). Re-importing replaces a row matched on (institution, email).
CREATE TABLE IF NOT EXISTS staff_records (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  institution        text NOT NULL,
  import_batch_id    varchar,
  external_id        text,
  full_name          text NOT NULL,
  email              text,
  job_title          text,
  department         text,
  team               text,
  hire_date          text,            -- normalized YYYY-MM-DD
  performance_rating text,
  compensation_band  text,
  manager            text,
  location           text,
  ark_user_id        varchar,
  invited_at         timestamp,        -- set when an unmatched staff member is invited
  created_at         timestamp NOT NULL DEFAULT now(),
  updated_at         timestamp NOT NULL DEFAULT now()
);

-- Idempotent add for environments created before the invite flow landed.
ALTER TABLE staff_records ADD COLUMN IF NOT EXISTS invited_at timestamp;

-- Upsert / dedupe key: one staff row per (institution, email). NULL emails are
-- distinct in Postgres so email-less rows always insert.
CREATE UNIQUE INDEX IF NOT EXISTS staff_records_institution_email_uniq
  ON staff_records (institution, email);

CREATE INDEX IF NOT EXISTS staff_records_institution_idx
  ON staff_records (institution);

CREATE INDEX IF NOT EXISTS staff_records_ark_user_idx
  ON staff_records (ark_user_id);

-- Import-batch audit trail: one row per import run, with row counts, the
-- detected column mapping, and per-row errors for the results screen.
CREATE TABLE IF NOT EXISTS hr_import_batches (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  institution    text NOT NULL,
  adapter        text NOT NULL,
  filename       text,
  imported_by    varchar NOT NULL,
  total_rows     integer NOT NULL DEFAULT 0,
  imported_rows  integer NOT NULL DEFAULT 0,
  updated_rows   integer NOT NULL DEFAULT 0,
  error_rows     integer NOT NULL DEFAULT 0,
  errors         jsonb,
  column_mapping jsonb,
  created_at     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_import_batches_institution_idx
  ON hr_import_batches (institution, created_at);
