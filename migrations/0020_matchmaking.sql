-- ARK Matchmaking Engine — the Cognitive Talent Exchange.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS opportunities (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'JOB',
  title text NOT NULL,
  organization text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text,
  remote boolean NOT NULL DEFAULT true,
  archetype_preference text,
  jst_floor integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OPEN',
  created_by varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunity_requirements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id varchar NOT NULL,
  card_id varchar NOT NULL,
  min_tier text NOT NULL DEFAULT 'Bronze',
  weight integer NOT NULL DEFAULT 1,
  role_label text
);

CREATE INDEX IF NOT EXISTS opportunity_requirements_opp_idx
  ON opportunity_requirements (opportunity_id);

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id varchar NOT NULL,
  user_id varchar NOT NULL,
  match_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'INTERESTED',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS opportunity_applications_opp_user_uidx
  ON opportunity_applications (opportunity_id, user_id);
