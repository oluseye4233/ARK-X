-- Shareable ARK Report links (public token-gated web report). Idempotent.
CREATE TABLE IF NOT EXISTS report_shares (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar NOT NULL UNIQUE,
  user_id varchar NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS report_shares_token_uniq ON report_shares (token);
