-- Task #24 — Cumulative ARK Profile
-- Make the three intake methods (Resume / Self-Assessment / LinkedIn) cumulative:
-- one evolving ARK profile per user, each source refining the same report.
-- Idempotent: re-runs cleanly on environments that already have the objects.

-- Per-user, per-source raw intake. Re-submitting a source REPLACES its content
-- (upsert on the unique (user_id, source) index) so a user builds ONE profile.
CREATE TABLE IF NOT EXISTS assessment_sources (
  id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    varchar NOT NULL,
  source     text NOT NULL,            -- "resume" | "self" | "linkedin" | "quiz"
  content    text NOT NULL DEFAULT '',
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assessment_sources_user_source_uniq
  ON assessment_sources (user_id, source);

-- Attribution + completeness carried on each merged assessment row so the
-- dashboard and ARK Report can show which sources contributed.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS sources_used text[];
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS completeness integer NOT NULL DEFAULT 0;
