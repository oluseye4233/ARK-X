CREATE TABLE IF NOT EXISTS guin_max_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE,
  discovery_opt_in boolean NOT NULL DEFAULT false,
  adult_attested boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT false,
  selected_tier text,
  region varchar(80),
  language varchar(40),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guin_max_match_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id varchar NOT NULL,
  candidate_id varchar NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  cxs integer NOT NULL,
  radar jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT guin_max_requests_status_check CHECK (status IN ('PENDING','ACCEPTED','DECLINED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS guin_max_requests_candidate_idx ON guin_max_match_requests (candidate_id, created_at);
CREATE INDEX IF NOT EXISTS guin_max_requests_requester_idx ON guin_max_match_requests (requester_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS guin_max_requests_pending_pair_uidx
  ON guin_max_match_requests (requester_id, candidate_id) WHERE status = 'PENDING';