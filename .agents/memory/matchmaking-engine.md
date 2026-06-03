---
name: ARK Matchmaking (Cognitive Talent Exchange)
description: Design principles & data coupling for the job/team matchmaking engine.
---

# ARK Matchmaking — Cognitive Talent Exchange

The engine matches people to opportunities (jobs/projects) and forms project
teams scored ONLY on banked `card_verifications` (verified primitive tiers),
plus JST evidence and archetype fit. It deliberately ignores resume keywords
and self-claims — "how much VERIFIED evidence exists?" not "can they do it?".

**Why:** The whole product premise (per GUIN MAX advisory) is verified-only
matching; if you ever add keyword/self-claim signals to the scorer you break the
core trust guarantee. Coverage is weighted 0.7, JST-floor factor 0.2, archetype
0.1. Under-tier verifications get 0.5 partial credit (still real capability).

**How to apply:**
- The pure scorer lives in `server/matchmaking.ts` (unit-tested via
  `npm run test:matchmaking`). Keep it pure (no DB/IO) so the contract stays
  testable.
- Candidate pool (team formation) has a non-obvious coupling: a person only
  appears with an archetype if they have BOTH `users.jstIndex` AND a latest
  `assessments` row carrying archetypeArchitect/Orchestrator/Conductor weights.
  Seeding a candidate therefore needs user + assessment + finalized
  verifications, or team formation can't place them.
- Whole surface is gated by the `matchmaking` feature flag; routes put
  `requireFeature("matchmaking")` BEFORE `requireAuth` so it 404s while off.
- Deferred (follow-up scope): Layer 3 (AI-agent matching) and Layer 5 (startup
  formation). Layer 4 shipped "lite" as the skill-gap "what to verify next".
