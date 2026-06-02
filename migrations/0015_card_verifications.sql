-- Primitive Card Verification (Task #55): subscribers verify the CODEC
-- primitives on their assessment by authoring their own Context-Craft prompts.
-- Idempotent: safe to re-run. Schema sync is via drizzle-kit push; this file
-- documents the change and provides the DDL for migration-driven environments.
CREATE TABLE IF NOT EXISTS card_verifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  card_id varchar NOT NULL,
  score integer NOT NULL DEFAULT 0,
  tier text,
  status text NOT NULL DEFAULT 'attempted',
  submissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ark_awarded integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS card_verifications_user_card_uidx
  ON card_verifications (user_id, card_id);
