-- Public report links expire after 30 days. Idempotent for existing databases.
ALTER TABLE report_shares
  ADD COLUMN IF NOT EXISTS expires_at timestamp;

UPDATE report_shares
SET expires_at = created_at + interval '30 days'
WHERE expires_at IS NULL;

ALTER TABLE report_shares
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days'),
  ALTER COLUMN expires_at SET NOT NULL;