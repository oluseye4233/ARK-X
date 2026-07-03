# ARK X — Advanced Resume & Karriere Synthesized Intelligence

AI-powered career intelligence platform. ARK X analyzes resumes, scores career readiness, assesses AI-automation vulnerability, and drives upskilling through gamified prompt-craft training and a super-prompt marketplace.

## Core Features

- **ARK Identity Score (0–600)** — composite of JST (Jobs-Skills-Talent, 0–300) and CCMI (Context Craft Mastery Index, 0–300), with live SSE updates and full score history.
- **Resume Intelligence** — PDF/text resume upload with a 5-phase analysis pipeline: keyword scoring across 6 categories, JST calculation, AI-vulnerability assessment (5 levels, task-level heatmap, timeline to 2041), 12-vector transferability radar, pivot opportunities, and 30/90/365-day upskilling roadmaps.
- **Archetype Handicap System** — classifies users as Architect / Orchestrator / Conductor from 228+ job titles, skill weights, and matched FORGE cards.
- **CCGE Arena** — single-player Context Craft card game that grades prompt-engineering hands (Knowledge, Clarity, Specificity, Efficiency) and feeds the ARK flywheel (+15 ARK/day cap).
- **SPHINX Marketplace** — publish and purchase Super Prompt Cards, gated by HIVE certification scores (Gold 80+ publish floor), with credits, sales, and transactional purchases (+20 ARK/30d cap).
- **ARK Resume** — ATS-optimized living resume artifact fusing the static resume with verified-card evidence and third-party confirmations; selectable-text PDF export.
- **Enterprise Workforce Intelligence** — org-wide aggregation, department drill-down, staff search, and upskill nudges with in-app + email notifications.
- **Institutional Cohorts** — instructor-managed cohorts, assignments, grade exports.
- **GUIN+ Identity** — public contributor profiles with endorsements and knight-rank gamification.
- **Multi-provider AI** — LLM-resilient chain across Anthropic Claude, OpenAI, and Gemini with user-selectable models, plan-based model policy, per-user token/cost budgets, and cross-provider fallback.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TailwindCSS, Recharts, Framer Motion, wouter |
| Backend | Express.js (TypeScript), server-side sessions, SSE event bus |
| Database | PostgreSQL + Drizzle ORM, idempotent SQL migrations auto-applied at startup |
| AI | Anthropic Claude, OpenAI, Google Gemini (resilient multi-provider chain) |
| Auth | express-session + bcrypt, PG-backed session store |
| Security | helmet CSP/HSTS, rate limiting, feature flags with 404 gating |

## Getting Started

```bash
npm install
npm run dev        # starts Express + Vite on port 5000
```

Required environment variables:

- `DATABASE_URL` — PostgreSQL connection string (migrations auto-apply at startup)
- `SESSION_SECRET` — required in production
- `AI_INTEGRATIONS_{ANTHROPIC,OPENAI,GEMINI}_{API_KEY,BASE_URL}` — optional; the app degrades gracefully per provider

Seed demo data (dev only):

```bash
curl -X POST localhost:5000/api/seed
# demo login: analyst@enterprise.com / arkplatform
```

## Scripts

```bash
npm run dev         # dev server (Express + Vite)
npm run check       # TypeScript typecheck
npm test            # full test suite
npm run db:migrate  # apply pending migrations standalone
npm run build       # production build
```

## Project Structure

```
client/          React frontend (pages, dashboard/pathways visualizations)
server/          Express API, storage layer, scoring engine, AI provider layer
  ai/            Multi-provider chain, KCSE, narrative, scenario gen, usage ledger
shared/          Drizzle schema, canonical constants, Zod schemas
migrations/      Idempotent SQL migrations
```

## Feature Flags

All 24 feature surfaces default **ON** and can be disabled without redeploying via `FEATURE_<SNAKE_CASE>=false`. Flagged-off routes return 404 (indistinguishable from unimplemented). Introspection: `GET /api/features`.

## License

All rights reserved.
