-- ARK Report "resume killer" bio fields. Idempotent.
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS candidate_name text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS current_employer text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS "current_role" text;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS professional_quals text[];
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS academic_quals text[];
