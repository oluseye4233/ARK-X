-- 0023 — LLM-resilient model preference
-- Adds users.preferred_ai_model (nullable). Null = platform default model
-- per AI feature. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_ai_model TEXT;
