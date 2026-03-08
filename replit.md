# ARK Platform — Advanced Resume & Karriere Synthesized Intelligence

## Overview
Full-stack AI-powered career intelligence platform featuring JST Index scoring, AI Vulnerability assessment, 12-Vector Transferability Radar, Dynamic Upskilling Navigator, Junglenomics FORGE card integration, and Enterprise Workforce Intelligence dashboard.

## Architecture
- **Frontend**: React + Vite, TailwindCSS, Recharts, Framer Motion, wouter routing
- **Backend**: Express.js on port 5000, serves API + Vite dev server
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: localStorage-based session via `useAuth` hook (demo: analyst@enterprise.com / arkplatform)

## Design System
- Cyberpunk enterprise aesthetic
- Fonts: Orbitron (display/meters), Rajdhani (UI body), Space Grotesk (mono/terminal)
- Dark mode default
- HSL palette: primary=`188 86% 53%` (cyan), secondary=`152 69% 31%` (emerald), destructive=`346 87% 43%` (crimson), background=`222 47% 11%`
- Custom CSS utilities: `.glass`, `.glass-card`, `.neon-text`, `.neon-border`

## Key Files
- `shared/schema.ts` — Drizzle schema: users, assessments, upskilling_plans, pivot_opportunities, transferability_vectors, jnomics_cards, departments
- `server/routes.ts` — Express API routes (auth, assessments, resume upload, jnomics-cards, departments, seed)
- `server/resumeAnalyzer.ts` — Resume parsing & scoring engine (keyword-based JST scoring, vulnerability classification, transferability vectors, upskilling plans, pivot opportunities)
- `server/storage.ts` — DatabaseStorage class implementing IStorage interface
- `server/db.ts` — Drizzle + pg Pool setup
- `client/src/lib/api.ts` — Frontend API client (includes uploadResume for multipart form upload)
- `client/src/lib/useAuth.ts` — Auth hook (localStorage)
- `client/src/components/upload/ResumeUploader.tsx` — File upload UI with drag-drop, progress, error states
- `client/src/App.tsx` — Route definitions
- `client/src/index.css` — Global styles, custom utilities

## Routes (Frontend)
- `/` — Landing page
- `/login` — Enterprise login
- `/upload` — Resume upload
- `/assessment` — Context Craft assessment questionnaire
- `/dashboard` — Intelligence Hub (JST gauge + radar, vulnerability meter + task heatmap + timeline, archetype handicap, FORGE cards)
- `/pathways` — Career Mobility (12-vector radar, pivot opportunities, upskilling timeline, skill gap matrix)
- `/enterprise` — Workforce Intelligence (department heatmap, vulnerability pie, JST trend)
- `/report` — Executive Summary (print-optimized brief)
- `/context-craft` — Context Craft Certifications (integration link, cert level management, JST multiplier preview)

## API Endpoints
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Register
- `GET /api/users/:id` — Get user
- `POST /api/resume/upload` — Upload resume (multipart: file + userId), parses PDF/TXT, runs analysis engine, saves full assessment
- `POST /api/assessments` — Create assessment with plans, pivots, vectors (manual)
- `GET /api/assessments/user/:userId/latest` — Latest assessment with full data
- `GET /api/jnomics-cards` — All FORGE cards
- `POST /api/jnomics-cards/by-ids` — Cards by ID array
- `GET /api/departments` — All departments
- `PUT /api/users/:id/context-craft-cert` — Update user's Context Craft certification level (Zod-validated against CONTEXT_CRAFT_LEVELS enum)
- `GET /api/context-craft/levels` — Get all certification level definitions (multipliers, labels, colors)
- `POST /api/seed` — Seed demo data

## Resume Analysis Engine (`server/resumeAnalyzer.ts`)
- Keyword-based scoring across 6 categories: technical, leadership, analytical, communication, innovation, ai_adjacent
- Each category has weighted keyword lists; scores determine JST sub-dimensions (Jobs, Skills, Talent)
- Automation risk detection via regex patterns matched against resume text (14 task patterns)
- Vulnerability level (0-4) computed from average automation risk adjusted by AI/leadership scores
- **Archetype Handicap System**: Tri-dimensional percentage scoring (Architect/Orchestrator/Conductor)
  - Three scoring signals weighted and combined: job title matches from JST AI MAP (40%), skill category archetype weights (35%), matched FORGE card classifications (25%)
  - `JST_ARCHETYPE_MAP`: 228+ job titles mapped to archetypes from the JST AI MAP document (240+ occupations across 13 sectors)
  - `SKILL_ARCHETYPE_WEIGHTS`: Each of 6 skill categories distributes weight across archetypes (e.g., innovation → 60% Architect, 25% Orchestrator, 15% Conductor)
  - `CARD_ARCHETYPE_MAP`: FORGE cards classified by archetype (card-001/002/003/010 → Architect, card-004/005/009 → Orchestrator, card-006/007/008 → Conductor)
  - Normalization ensures percentages always sum to exactly 100%
  - Primary archetype determines `readinessProfile` (Architect/Orchestrator/Conductor)
- **Context Craft Handicap System**: Multiplicative scoring modifier based on certification level
  - No certification (NONE) = 0.5x multiplier (50% JST penalty)
  - CC-100 Foundational = 1.0x (baseline, penalty removed)
  - CC-200 Practitioner = 1.1x, CC-300 Specialist = 1.2x, CC-400 Expert = 1.35x, CC-500 Master Architect = 1.5x
  - Multiplier applied to each JST sub-dimension independently after raw scoring, before final composite
  - Raw scores (pre-multiplier) stored in `jstRawTotal/Jobs/Skills/Talent` for audit trail
  - Certification level stored on user record, looked up during resume analysis
- FORGE card mapping based on category thresholds
- Generates 12 transferability vectors, 3 upskilling plans, 3 pivot opportunities
- Accepts PDF (via pdf-parse) and plain text files, max 10MB

## Dashboard Components (VIZ Payload Aligned)
- `JSTGauge` (VIZ-001) — Tri-dimensional JST score display (0-300) with 5 color zones (Needs Development/Fair/Good/Excellent/Exceptional), percentile rank, industry average comparison, trend arrow
- `JSTRadar` (VIZ-002) — Three-layer radar chart (Jobs/Skills/Talent) with industry average benchmark overlay
- `VulnerabilityMeter` (VIZ-004) — 5-level AI vulnerability indicator
- `TaskHeatmap` (VIZ-005) — Task-level automation potential heatmap with color scale (green→blue→yellow→orange→red), time allocation estimates, risk labels
- `VulnerabilityTimeline` (VIZ-006) — Recharts AreaChart showing automation milestone projections from current year to 2041, color-coded by impact level
- `ArchetypeHandicap` — Visual archetype percentage breakdown (Architect/Orchestrator/Conductor) with animated bars, trait tags, and composite vector bar
- `JnomicsCardList` — Matched FORGE cards display

## Pathways Components
- `TransferabilityRadar` — 12-vector radar chart for skill mobility
- `UpskillingTimeline` — 30/90/365-day phased upskilling roadmap
- `SkillGapMatrix` (VIZ-008) — Matrix showing required vs current skills for top pivot roles, color-coded by gap size (Minimal/Small/Medium/Large/Critical)

## Upload Pipeline (VIZ-012)
- 5-phase processing UI: Discovery & Extraction → JST Calculation → Vulnerability Assessment → Transferability Analysis → Recommendations
- Each phase shows step progress, descriptions, and animated state transitions

## Database Seeding
Run `POST /api/seed` to populate: 10 Jnomics cards (card-001 through card-010), 7 departments, 1 demo user with full assessment data.

## Deployment
Target: autoscale