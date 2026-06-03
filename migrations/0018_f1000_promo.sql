-- F1000 (First 1000) soft-launch promo.
-- Idempotent: safe to run repeatedly (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS).

-- Per-user membership flag drives promo pricing + raised AI allowances.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "f1000_member" boolean NOT NULL DEFAULT false;

-- The 1..1000 invite codes. seq + code + user_id are each unique so a code is a
-- single-use token strictly bound to one account.
CREATE TABLE IF NOT EXISTS "f1000_invites" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "seq" integer NOT NULL UNIQUE,
  "code" text NOT NULL UNIQUE,
  "user_id" varchar NOT NULL UNIQUE,
  "promo_applied" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);
