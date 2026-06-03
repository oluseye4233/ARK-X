-- ARK RESUME artifact (Task #59). Idempotent.
-- Static resume extension on assessments: contact, external links, work history.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS link_linkedin text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS link_github text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS link_portfolio text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS work_history jsonb;

-- Uploadable headshot stored as a size-limited base64 data URL on the user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS headshot_data_url text;

-- Third-party confirmation layer for resume claims.
CREATE TABLE IF NOT EXISTS skill_confirmations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  type text NOT NULL,
  target_ref text NOT NULL,
  target_label text,
  status text NOT NULL DEFAULT 'PENDING',
  confirmer_user_id varchar,
  confirmer_org text NOT NULL,
  confirmer_name text,
  confirmer_logo_url text,
  note text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS skill_confirmations_user_type_target_uidx
  ON skill_confirmations (user_id, type, target_ref);
