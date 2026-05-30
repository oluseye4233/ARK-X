-- Free JST Assessment (guest / no-login marketing funnel)
-- Idempotent: re-runs cleanly on environments that already have the table.
-- Anonymous lead-funnel rows (NO PII, NO user FK) backing the "first 100 free"
-- landing-page scarcity counter plus lightweight conversion analytics.
CREATE TABLE IF NOT EXISTS guest_assessments (
  id                  varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  method              text NOT NULL,            -- "questionnaire" | "resume" | "linkedin"
  jst_total           integer NOT NULL DEFAULT 0,
  vulnerability_level integer NOT NULL DEFAULT 2,
  readiness_profile   text NOT NULL DEFAULT 'Conductor',
  created_at          timestamp NOT NULL DEFAULT now()
);
