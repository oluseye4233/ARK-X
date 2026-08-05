-- Atomic Gauntlet (adapted, JNGL-ACC-PDD-AGL-2026-001) — AI-judged quality
-- review of a user's AI-Native App Showcase entry. Idempotent.

CREATE TABLE IF NOT EXISTS gauntlet_runs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  app_name text NOT NULL,
  hive_vector jsonb NOT NULL,
  hive_score real NOT NULL,
  verdict text NOT NULL,
  reasons text[],
  credits_charged integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gauntlet_runs_user_id_idx
  ON gauntlet_runs (user_id);
