-- Phase M4 — platform credit pool ledger (post-review hardening).
-- Persists the 30% platform share per finalized synthesis so the buyer's
-- credit debit reconciles exactly to (sum(creator credited) + platform).
CREATE TABLE IF NOT EXISTS platform_credit_ledger (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text    NOT NULL,
  source_ref_id varchar NOT NULL,
  amount        integer NOT NULL,
  created_at    timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_credit_source_ref_uniq
  ON platform_credit_ledger(source, source_ref_id);
