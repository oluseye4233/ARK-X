CREATE TABLE IF NOT EXISTS matchmaking_introductions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id varchar NOT NULL,
  employer_id varchar NOT NULL,
  candidate_id varchar NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  cxs integer NOT NULL,
  score_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT matchmaking_introductions_status_check
    CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS matchmaking_introductions_employer_idx
  ON matchmaking_introductions (employer_id, created_at);
CREATE INDEX IF NOT EXISTS matchmaking_introductions_candidate_idx
  ON matchmaking_introductions (candidate_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS matchmaking_introductions_pending_pair_uidx
  ON matchmaking_introductions (opportunity_id, candidate_id) WHERE status = 'PENDING';