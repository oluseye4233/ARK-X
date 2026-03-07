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
- `server/routes.ts` — Express API routes (auth, assessments, jnomics-cards, departments, seed)
- `server/storage.ts` — DatabaseStorage class implementing IStorage interface
- `server/db.ts` — Drizzle + pg Pool setup
- `client/src/lib/api.ts` — Frontend API client
- `client/src/lib/useAuth.ts` — Auth hook (localStorage)
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
- `POST /api/assessments` — Create assessment with plans, pivots, vectors
- `GET /api/assessments/user/:userId/latest` — Latest assessment with full data
- `GET /api/jnomics-cards` — All FORGE cards
- `POST /api/jnomics-cards/by-ids` — Cards by ID array
- `GET /api/departments` — All departments
- `POST /api/seed` — Seed demo data

## Database Seeding
Run `POST /api/seed` to populate: 10 Jnomics cards (card-001 through card-010), 7 departments, 1 demo user with full assessment data.

## Deployment
Target: autoscale