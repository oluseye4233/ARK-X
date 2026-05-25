-- ═══════════════════════════════════════════════════════════════════
-- Phase M1 — SPHINX × Matrix Foundation
-- Idempotent: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════

-- ── Additive columns on existing tables ────────────────────────────
ALTER TABLE "jnomics_cards" ADD COLUMN IF NOT EXISTS "disc" text;--> statement-breakpoint
ALTER TABLE "jnomics_cards" ADD COLUMN IF NOT EXISTS "rarity" text;--> statement-breakpoint
ALTER TABLE "jnomics_cards" ADD COLUMN IF NOT EXISTS "version" text;--> statement-breakpoint
ALTER TABLE "jnomics_cards" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "spc_listings" ADD COLUMN IF NOT EXISTS "synergy_tag_ids" text[];--> statement-breakpoint

-- ── New tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "card_synergies" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "card_a_id" varchar NOT NULL,
        "card_b_id" varchar NOT NULL,
        "synergy_score" integer DEFAULT 0 NOT NULL,
        "rationale" text,
        "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_synergies_pair_uniq" ON "card_synergies" USING btree ("card_a_id","card_b_id");--> statement-breakpoint
-- Enforce canonical ordering at the DB level so an unordered pair has exactly one row.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'card_synergies_ordered_chk'
  ) THEN
    ALTER TABLE "card_synergies" ADD CONSTRAINT "card_synergies_ordered_chk" CHECK ("card_a_id" < "card_b_id");
  END IF;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "complementary_pairs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "listing_id" varchar NOT NULL,
        "partner_listing_id" varchar NOT NULL,
        "score" integer DEFAULT 0 NOT NULL,
        "rank" integer DEFAULT 0 NOT NULL,
        "computed_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "complementary_pairs_listing_partner_uniq" ON "complementary_pairs" USING btree ("listing_id","partner_listing_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "synthesis_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "buyer_id" varchar NOT NULL,
        "source_listing_ids" text[] NOT NULL,
        "combined_body" text,
        "total_price_credits" integer DEFAULT 0 NOT NULL,
        "platform_share" integer DEFAULT 0 NOT NULL,
        "creator_share_total" integer DEFAULT 0 NOT NULL,
        "zpos_tokens_in" integer DEFAULT 0 NOT NULL,
        "zpos_tokens_out" integer DEFAULT 0 NOT NULL,
        "zpos_compression_pct" real DEFAULT 0 NOT NULL,
        "status" text DEFAULT 'draft' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "finalized_at" timestamp
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "synthesis_creators_split" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "creator_id" varchar NOT NULL,
        "source_listing_id" varchar NOT NULL,
        "weight" real NOT NULL,
        "credits_awarded" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "test_results" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "source" text NOT NULL,
        "filename" text,
        "hive_score" real DEFAULT 0 NOT NULL,
        "kcse_score" real DEFAULT 0 NOT NULL,
        "passes" boolean DEFAULT false NOT NULL,
        "log" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text,
        "link" text,
        "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "read_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roundtable_state" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "listing_id" varchar NOT NULL,
        "creator_id" varchar NOT NULL,
        "seat_number" integer NOT NULL,
        "score" real NOT NULL,
        "hive_score" real NOT NULL,
        "sales_count" integer NOT NULL,
        "snapshot_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roundtable_state_seat_uniq" ON "roundtable_state" USING btree ("seat_number");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "bonsai_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "current_stage" integer DEFAULT 1 NOT NULL,
        "completed_stages" integer[] DEFAULT '{}'::int[] NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "bonsai_progress_user_id_unique" UNIQUE("user_id")
);
