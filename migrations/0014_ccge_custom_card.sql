-- CCGE Card Design stage: persist the player's authored custom card + craft score
-- Idempotent: safe to re-run.
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS custom_card_name text;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS custom_card_body text;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS craft_score real;
