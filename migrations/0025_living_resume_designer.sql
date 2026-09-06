-- ═══════════════════════════════════════════════════════════════════════════
-- LIVING RESUME DESIGNER — Database Schema (LRD)
-- SPARTAN-Certified MVP · Add-On for ARK HARNESS
-- Production ID: JNGL-PDD-ARKH-LRD-2026-001
-- ═══════════════════════════════════════════════════════════════════════════

-- ── LRD-101: Wizard Session State ──────────────────────────────────────────
-- Stores the in-progress resume builder state per user. No save-to-server until
-- download; the export operation itself triggers a finalization. Nullable fields
-- reflect optional wizard sections (projects, video intro, etc).
CREATE TABLE IF NOT EXISTS living_resume_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL,
  -- Theme picker: 'navy_gold' | 'palette_2' | 'palette_3'
  theme VARCHAR(32) NOT NULL DEFAULT 'navy_gold',
  -- Identity section
  full_name TEXT,
  current_role TEXT,
  professional_summary TEXT,
  -- Contact section
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  -- Headshot: base64 data URL (client-side downscaled ≤400px)
  headshot_data_url TEXT,
  -- Projects: JSONB array of up to 8 cards {name, role, status, summary, detail, link}
  projects JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Methodology tags: free-text + vocabulary library (ATOMIC, SPC, PDD, FORGE, JCSE, GRO, ZPOS+5, SAVANT, Camelot, etc)
  methodology_tags TEXT[] DEFAULT '{}',
  -- YouTube intro: validated YouTube URL (click-to-load facade)
  youtube_url TEXT,
  -- Completeness heuristic (0-100)
  completeness_pct INTEGER NOT NULL DEFAULT 0,
  -- SPC portfolio linked (LRD-201): array of listing IDs from SPHINX
  linked_spc_listing_ids TEXT[] DEFAULT '{}',
  -- AI-native app showcase (LRD-202): up to 4 apps {name, pitch, stack, link, testEmbed}
  ai_native_apps JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- ARK Resume import bridge (LRD-301): snapshot of prefilled bio from Domain 2
  ark_resume_imported BOOLEAN NOT NULL DEFAULT FALSE,
  ark_score_snapshot INTEGER,  -- cached 0-600 from Domain 2 at import time
  -- Entitlement gate check (LRD-303): was this exported under their current tier?
  tier_at_export VARCHAR(32),
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  exported_at TIMESTAMP,  -- set when user downloads the final artifact
  -- Honesty Gate audit trail (LRD-404): last validation result
  last_honesty_check JSONB,
  last_honesty_check_at TIMESTAMP,
  UNIQUE(user_id)
);

-- ── LRD-105: Export History ────────────────────────────────────────────────
-- Append-only log of every resume export. Drives analytics + audit trail.
-- The downloaded HTML/PDF artifact itself is never stored (it's client-side blob).
CREATE TABLE IF NOT EXISTS living_resume_exports (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  -- Export format: 'html' | 'pdf'
  format VARCHAR(16) NOT NULL DEFAULT 'html',
  -- Snapshot of completeness at export time
  completeness_pct INTEGER NOT NULL,
  -- Snapshot of entitlement (tier, feature unlocks)
  tier_at_export VARCHAR(32),
  spc_panel_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_app_showcase_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  forge_verified_badges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Honesty Gate result at export time
  honesty_gate_passed BOOLEAN NOT NULL DEFAULT TRUE,
  honesty_gate_warnings TEXT[],
  -- Command Deck telemetry (LRD-304): governance event ID reference
  telemetry_event_id VARCHAR(36),
  -- Export details
  exported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

-- ── LRD-402: SPARTAN Export Certificate ────────────────────────────────────
-- Optional companion artifact: JSON summary of completion + heuristic badge.
-- Explicitly labeled a heuristic, never an external audit.
CREATE TABLE IF NOT EXISTS living_resume_certificates (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  export_id VARCHAR(36) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL,
  -- Sections populated: identity, projects, spc, apps, contact
  sections_populated TEXT[] NOT NULL,
  completeness_heuristic INTEGER NOT NULL,  -- 0-100
  -- Badge: DRAFT | COMPLETE | EXTENSIVE
  badge VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  -- Certificate body (JSON): {sections: {...}, timestamp, badge, note}
  certificate_json JSONB NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── LRD-405: PDF Export with Links ─────────────────────────────────────────
-- Metadata for the companion PDF export (separate from the HTML artifact).
-- The PDF itself is not stored; this is just the generation + delivery log.
CREATE TABLE IF NOT EXISTS living_resume_pdf_exports (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL,
  export_id VARCHAR(36) NOT NULL,
  -- PDF generation details
  page_count INTEGER,
  file_size_bytes INTEGER,
  -- Whether all external links are active (true = PDF ready)
  links_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Fallback for PDF (app demo → primary site link)
  primary_site_url TEXT,
  -- Generation timestamps
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP  -- optional TTL for the cached PDF
);

-- ── LRD-106: Headshot Management ───────────────────────────────────────────
-- Transient storage during editing; base64 embedded at export time.
-- Mirrors the platform's existing headshot pattern (users.headshot_data_url).
CREATE TABLE IF NOT EXISTS living_resume_headshots (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  -- Original upload metadata
  original_filename TEXT NOT NULL,
  original_mime_type VARCHAR(64) NOT NULL,
  original_size_bytes INTEGER NOT NULL,
  -- Client-side downscaled version (≤400px, base64)
  base64_data_url TEXT NOT NULL,
  -- Crop metadata (optional circular/square preset)
  crop_type VARCHAR(32),  -- 'circular' | 'square' | null
  -- Alt text (required field per accessibility)
  alt_text TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  used_in_exports TEXT[]  -- array of export IDs that embedded this
);

-- ── LRD-301: ARK RESUME Integration Bridge ─────────────────────────────────
-- Class B adapter: reads Domain 2 (ARK RESUME → VMST) on prefill + import.
-- Never writes back to Domain 2 — the Designer is a consumer only.
CREATE TABLE IF NOT EXISTS living_resume_ark_imports (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL UNIQUE,  -- one import per user (idempotent)
  session_id VARCHAR(36) NOT NULL,
  -- Prefilled from ARK RESUME (Domain 2)
  imported_name TEXT,
  imported_bio TEXT,
  imported_current_role TEXT,
  imported_current_employer TEXT,
  -- ARK Score snapshot (0-600) at import time
  ark_score_snapshot INTEGER,
  jst_index_snapshot INTEGER,
  -- Whether the import succeeded and when
  import_status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- pending | success | failed
  import_error_message TEXT,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  -- SPC auto-sync (LRD-203): toggle for live refresh during editing
  spc_auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_spc_sync_at TIMESTAMP
);

-- ── LRD-303: Entitlement Gate State ────────────────────────────────────────
-- Snapshot of tier-based feature access at creation/export time.
-- References the existing Domain 1 (Tier Engine) without replicating it.
CREATE TABLE IF NOT EXISTS living_resume_entitlements (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  -- Cached tier at session creation (for consistent UX)
  tier_at_session_creation VARCHAR(32) NOT NULL,
  -- Feature flags based on tier (cumulative model)
  can_use_spc_panel BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_ai_app_showcase BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_youtube_intro BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_forge_verified_badges BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_pdf_export BOOLEAN NOT NULL DEFAULT FALSE,
  -- Checked at export time; gates the finalization
  checked_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── LRD-304: Command Deck Telemetry ────────────────────────────────────────
-- Governance-gated event logging (Domain 9). Mirrors the platform's existing
-- telemetry pattern. Resume content is NOT retained unless explicit consent.
CREATE TABLE IF NOT EXISTS living_resume_telemetry (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id VARCHAR(36) NOT NULL,
  session_id VARCHAR(36) NOT NULL,
  export_id VARCHAR(36),
  -- Event types: session_started | field_completed | tag_selected | card_linked | export_initiated | export_completed
  event_type VARCHAR(64) NOT NULL,
  -- Event payload (no content, just metadata)
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Governance flags
  consent_given BOOLEAN NOT NULL DEFAULT TRUE,
  -- Timestamp
  logged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── Indexes for Performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS living_resume_sessions_user_id_idx ON living_resume_sessions(user_id);
CREATE INDEX IF NOT EXISTS living_resume_sessions_exported_at_idx ON living_resume_sessions(exported_at);
CREATE INDEX IF NOT EXISTS living_resume_exports_user_id_idx ON living_resume_exports(user_id);
CREATE INDEX IF NOT EXISTS living_resume_exports_session_id_idx ON living_resume_exports(session_id);
CREATE INDEX IF NOT EXISTS living_resume_exports_exported_at_idx ON living_resume_exports(exported_at);
CREATE INDEX IF NOT EXISTS living_resume_telemetry_user_id_idx ON living_resume_telemetry(user_id);
CREATE INDEX IF NOT EXISTS living_resume_telemetry_session_id_idx ON living_resume_telemetry(session_id);
CREATE INDEX IF NOT EXISTS living_resume_telemetry_event_type_idx ON living_resume_telemetry(event_type);
CREATE INDEX IF NOT EXISTS living_resume_headshots_user_id_idx ON living_resume_headshots(user_id);
CREATE INDEX IF NOT EXISTS living_resume_ark_imports_user_id_idx ON living_resume_ark_imports(user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- END Living Resume Designer Schema
-- ─────────────────────────────────────────────────────────────────────────
