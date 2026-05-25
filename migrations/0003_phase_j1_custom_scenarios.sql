-- Phase J.1: Custom industry-specific CCGE scenarios.
-- Adds creator ownership + industry label + isCustom flag to ccge_scenarios.
-- Fully idempotent — safe to re-run.

ALTER TABLE ccge_scenarios ADD COLUMN IF NOT EXISTS creator_user_id varchar;
ALTER TABLE ccge_scenarios ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE ccge_scenarios ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS ccge_scenarios_creator_idx
  ON ccge_scenarios (creator_user_id)
  WHERE creator_user_id IS NOT NULL;
