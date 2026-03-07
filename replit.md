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
- `/dashboard` — Intelligence Hub (JST gauge, vulnerability meter, risk modifiers, FORGE cards)
- `/pathways` — Career Mobility (12-vector radar, pivot opportunities, upskilling timeline)
- `/enterprise` — Workforce Intelligence (department heatmap, vulnerability pie, JST trend)
- `/report` — Executive Summary (print-optimized brief)

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
- `POST /api/seed` — Seed demo data

## Resume Analysis Engine (`server/resumeAnalyzer.ts`)
- Keyword-based scoring across 6 categories: technical, leadership, analytical, communication, innovation, ai_adjacent
- Each category has weighted keyword lists; scores determine JST sub-dimensions (Jobs, Skills, Talent)
- Automation risk detection via regex patterns matched against resume text (14 task patterns)
- Vulnerability level (0-4) computed from average automation risk adjusted by AI/leadership scores
- Readiness profile (Architect/Orchestrator/Conductor) from top scoring category
- FORGE card mapping based on category thresholds
- Generates 12 transferability vectors, 3 upskilling plans, 3 pivot opportunities
- Accepts PDF (via pdf-parse) and plain text files, max 10MB

## Database Seeding
Run `POST /api/seed` to populate: 10 Jnomics cards (card-001 through card-010), 7 departments, 1 demo user with full assessment data.

## Deployment
Target: autoscale