CREATE TABLE IF NOT EXISTS "ai_cache" (
	"cache_key" varchar PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ark_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_delta" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ark_score_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"ark_score" integer NOT NULL,
	"jst_index" integer NOT NULL,
	"ccmi" integer NOT NULL,
	"delta" integer DEFAULT 0 NOT NULL,
	"trigger" text NOT NULL,
	"trigger_meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"jst_total" integer DEFAULT 0 NOT NULL,
	"jst_jobs" integer DEFAULT 0 NOT NULL,
	"jst_skills" integer DEFAULT 0 NOT NULL,
	"jst_talent" integer DEFAULT 0 NOT NULL,
	"vulnerability_level" integer DEFAULT 2 NOT NULL,
	"readiness_profile" text DEFAULT 'Conductor' NOT NULL,
	"risk_modifiers" jsonb,
	"matched_card_ids" text[],
	"archetype_architect" integer DEFAULT 34 NOT NULL,
	"archetype_orchestrator" integer DEFAULT 33 NOT NULL,
	"archetype_conductor" integer DEFAULT 33 NOT NULL,
	"automation_milestones" jsonb,
	"context_craft_level" text DEFAULT 'NONE',
	"context_craft_multiplier" real DEFAULT 0.5,
	"jst_raw_total" integer,
	"jst_raw_jobs" integer,
	"jst_raw_skills" integer,
	"jst_raw_talent" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"from_plan" text,
	"to_plan" text,
	"amount_cents" integer,
	"external_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccge_cards" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pillar" text NOT NULL,
	"type" text NOT NULL,
	"base_kcse" integer NOT NULL,
	"token_cost" integer NOT NULL,
	"emoji" text NOT NULL,
	"description" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccge_scenarios" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"target_pillars" text[] NOT NULL,
	"token_budget" integer NOT NULL,
	"difficulty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccmi_pillar_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"p1" integer DEFAULT 0 NOT NULL,
	"p2" integer DEFAULT 0 NOT NULL,
	"p3" integer DEFAULT 0 NOT NULL,
	"p4" integer DEFAULT 0 NOT NULL,
	"p5" integer DEFAULT 0 NOT NULL,
	"p6" integer DEFAULT 0 NOT NULL,
	"p7" integer DEFAULT 0 NOT NULL,
	"composite" integer DEFAULT 0 NOT NULL,
	"tier" text DEFAULT 'T0' NOT NULL,
	"multiplier" real DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ccmi_pillar_scores_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkout_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"institution" text,
	"external_session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"risk" integer NOT NULL,
	"headcount" integer NOT NULL,
	"seniority" text NOT NULL,
	"location" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "endorsements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endorser_id" varchar NOT NULL,
	"recipient_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"scenario_id" varchar NOT NULL,
	"hand" jsonb NOT NULL,
	"played" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"kcse_score" real,
	"kcse_breakdown" jsonb,
	"cert_tier_earned" text,
	"ark_score_delta" integer DEFAULT 0,
	"cert_upgraded_from" text,
	"cert_upgraded_to" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jnomics_cards" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"type" text NOT NULL,
	"emoji" text NOT NULL,
	"description" text NOT NULL,
	"base_pts" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lhcs_signals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"cpr_score" integer DEFAULT 0 NOT NULL,
	"mps_score" integer DEFAULT 0 NOT NULL,
	"lcis_score" integer DEFAULT 0 NOT NULL,
	"cpr_light" text DEFAULT 'red' NOT NULL,
	"mps_light" text DEFAULT 'red' NOT NULL,
	"lcis_light" text DEFAULT 'red' NOT NULL,
	"status" text DEFAULT 'red' NOT NULL,
	"readiness_pct" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lhcs_signals_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pivot_opportunities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"role" text NOT NULL,
	"feasibility" integer NOT NULL,
	"gap_cost" text NOT NULL,
	"time" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spc_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"body" text NOT NULL,
	"pillar" text NOT NULL,
	"price_credits" integer NOT NULL,
	"kcse_score" real NOT NULL,
	"hive_score" real NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spc_purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" varchar NOT NULL,
	"listing_id" varchar NOT NULL,
	"creator_id" varchar NOT NULL,
	"price_credits" integer NOT NULL,
	"creator_share" integer NOT NULL,
	"platform_share" integer NOT NULL,
	"is_first_sale_for_creator" boolean DEFAULT false NOT NULL,
	"purchased_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transferability_vectors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"score" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "upskilling_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" varchar NOT NULL,
	"phase" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"hours" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_credits" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"department" text,
	"seniority" text,
	"location" text,
	"context_craft_cert_level" text DEFAULT 'NONE',
	"subscription_plan" text DEFAULT 'INDIVIDUAL_FREE',
	"subscription_status" text DEFAULT 'active',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_current_period_end" timestamp,
	"subscription_canceled_at" timestamp,
	"institution" text,
	"uploads_this_month" integer DEFAULT 0,
	"upload_reset_date" timestamp,
	"ark_score" integer DEFAULT 0 NOT NULL,
	"jst_index" integer DEFAULT 0 NOT NULL,
	"ccmi" integer DEFAULT 0 NOT NULL,
	"ccmi_tier" text DEFAULT 'T0' NOT NULL,
	"vmst_level" text DEFAULT 'L0' NOT NULL,
	"typology" text,
	"ark_id_string" text,
	"cpr_score" integer DEFAULT 0 NOT NULL,
	"mps_score" integer DEFAULT 0 NOT NULL,
	"lcis_score" integer DEFAULT 0 NOT NULL,
	"lhcs_status" text DEFAULT 'red' NOT NULL,
	"resume_replacement_pct" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "endorsements_endorser_recipient_uniq" ON "endorsements" USING btree ("endorser_id","recipient_id");--> statement-breakpoint
-- Phase J: additive ALTERs for users (no-op when columns already exist)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ark_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "jst_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ccmi" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ccmi_tier" text DEFAULT 'T0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vmst_level" text DEFAULT 'L0' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "typology" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ark_id_string" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpr_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mps_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lcis_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lhcs_status" text DEFAULT 'red' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resume_replacement_pct" integer DEFAULT 0 NOT NULL;
