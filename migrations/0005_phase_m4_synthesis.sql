-- ═══════════════════════════════════════════════════════════════════
-- Phase M4 — SPHINX × Matrix Synthesis Engine & ZPOS Compression
-- Idempotent: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "synthesis_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "buyer_id" varchar NOT NULL,
        "source_listing_ids" text[] NOT NULL,
        "locked_prices" jsonb NOT NULL,
        "split_preview" jsonb NOT NULL,
        "total_credit_price" integer NOT NULL,
        "zpos_method" text NOT NULL,
        "pre_tokens" integer NOT NULL,
        "post_tokens" integer NOT NULL,
        "reduction_pct" real NOT NULL,
        "semantic_preservation" real NOT NULL,
        "combined_output" text NOT NULL,
        "status" text DEFAULT 'preview' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "finalized_at" timestamp
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "synthesis_sessions_buyer_idx" ON "synthesis_sessions" USING btree ("buyer_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "synthesis_creators_split" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "creator_id" varchar NOT NULL,
        "source_listing_id" varchar NOT NULL,
        "source_price_credits" integer NOT NULL,
        "weight_bp" integer NOT NULL,
        "credited_amount" integer NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "synthesis_split_session_listing_uniq" ON "synthesis_creators_split" USING btree ("session_id","source_listing_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_split_creator_idx" ON "synthesis_creators_split" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "synthesis_split_listing_idx" ON "synthesis_creators_split" USING btree ("source_listing_id");--> statement-breakpoint
