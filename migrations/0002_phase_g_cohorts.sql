CREATE TABLE IF NOT EXISTS "cohorts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "instructor_id" varchar NOT NULL,
  "institution" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "cohorts_instructor_idx" ON "cohorts"("instructor_id");

CREATE TABLE IF NOT EXISTS "cohort_memberships" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "cohort_id" varchar NOT NULL,
  "user_id" varchar NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "invited_email" text,
  "joined_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "cohort_memberships_unique" ON "cohort_memberships"("cohort_id","user_id");
CREATE INDEX IF NOT EXISTS "cohort_memberships_user_idx" ON "cohort_memberships"("user_id");

CREATE TABLE IF NOT EXISTS "cohort_assignments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "cohort_id" varchar NOT NULL,
  "scenario_id" varchar NOT NULL,
  "assigned_by" varchar NOT NULL,
  "due_at" timestamp,
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "cohort_assignments_cohort_idx" ON "cohort_assignments"("cohort_id");
