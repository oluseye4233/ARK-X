-- Phase K — Corporate SPHINX Marketplace
-- Idempotent: re-runs cleanly on environments that already have the columns.

-- 1. Add scope + institution columns to spc_listings.
ALTER TABLE spc_listings
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'OPEN';
ALTER TABLE spc_listings
  ADD COLUMN IF NOT EXISTS institution text;

-- 2. New spc_feedback table — star ratings + per-use credit bonus audit.
CREATE TABLE IF NOT EXISTS spc_feedback (
  id           varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   varchar NOT NULL,
  buyer_id     varchar NOT NULL,
  creator_id   varchar NOT NULL,
  stars        integer NOT NULL,
  comment      text,
  bonus_awarded integer NOT NULL DEFAULT 0,
  created_at   timestamp NOT NULL DEFAULT now()
);

-- 3. One feedback row per (listing, buyer) — the unique index is the
--    race-safe gate; the route's pre-check is best-effort.
CREATE UNIQUE INDEX IF NOT EXISTS spc_feedback_listing_buyer_uidx
  ON spc_feedback (listing_id, buyer_id);

-- 4. Index for corporate-scoped lookups by institution.
CREATE INDEX IF NOT EXISTS spc_listings_scope_institution_idx
  ON spc_listings (scope, institution);
