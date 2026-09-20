-- Stores the latest connector health check per institution/adapter.
-- Kept separate from sync configuration because testing is read-only.
CREATE TABLE IF NOT EXISTS hr_connector_tests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  institution text NOT NULL,
  adapter text NOT NULL,
  ok boolean NOT NULL,
  total_rows integer,
  valid_rows integer,
  error_rows integer,
  message text,
  tested_by varchar NOT NULL,
  tested_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_connector_tests_institution_adapter_uniq
  ON hr_connector_tests (institution, adapter);