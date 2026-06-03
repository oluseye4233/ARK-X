/**
 * Context Craft Book Companion (Task #22)
 * ----------------------------------------
 * Canonical, framework-authoritative map between the 13 journey nodes of the
 * book *Context Craft: An AI Survival Guide* (Prologue + Chapters 1–11 + Epilogue)
 * and the REAL platform surfaces that prove each chapter's skill.
 *
 * HONESTY GATE (threat_model G3): every destination resolves to a live in-app
 * route. There are NO on-chain / NFT / Polygon mechanics, NO fake ROI or token
 * calculators, and NO external ideafactory.io billing. Aspirational artefacts
 * from the manuscript are mapped to the closest honest in-app action:
 *   - "mint your badge as an NFT"  → earn a named in-app chapter badge.
 *   - "Token-Cost Calculator"      → play the ECONOMICS Platinum CCGE challenge.
 *   - "Readiness Guide / Rollout Planner" → the live Enterprise / Pathways pages.
 *
 * This module is the single source of truth shared by client and server. Badges
 * are AUTO-AWARDED off existing flywheel events (server/bookCompanion.ts) — a
 * reader never self-marks a chapter complete.
 */

import type { CCPillar, ContextCraftLevel, CcgeTier } from "./schema";
import { JCSE_TIER_THRESHOLDS } from "./schema";

// ── Stages ───────────────────────────────────────────────────────────
// Five narrative acts, aligned to the CC certification ladder so the journey
// climbs Foundational → Master Architect as the reader progresses.
export const JOURNEY_STAGES = [
  { id: "diagnosis", label: "Diagnosis", blurb: "See where you stand. Baseline your ARK identity and frame the AI you'll command." },
  { id: "confrontation", label: "Confrontation", blurb: "Name the task. Turn vague intent into precise instructions and grounded data." },
  { id: "practice", label: "Practice", blurb: "Add discipline. Constrain the output and lock its shape." },
  { id: "navigation", label: "Navigation", blurb: "Compose mastery. Calibrate with examples, integrate the Super Prompt, forge an SPC." },
  { id: "proof", label: "Proof", blurb: "Show the delta. Economics, organisation, and the Ledger that proves your growth." },
] as const;

export type JourneyStageId = (typeof JOURNEY_STAGES)[number]["id"];

// ── Unlock model ─────────────────────────────────────────────────────
// How a node's named badge is auto-awarded. Every kind maps to an existing
// flywheel event the orchestrator already emits.
export type UnlockKind = "assessment" | "ccge" | "spc_publish" | "ledger_final";

export interface JourneyUnlock {
  kind: UnlockKind;
  /** For `ccge`: the bc-* scenario the chapter challenge runs. */
  scenarioId?: string;
  /** For `ccge`: minimum JCSE (0-50) the session must reach to earn the badge. */
  minKcse?: number;
  /** For `ccge`: the human-readable tier that `minKcse` corresponds to. */
  tierTarget?: CcgeTier;
}

export interface JourneyNode {
  id: string; // "prologue" | "ch1".."ch11" | "epilogue"
  order: number; // 0..12
  stage: JourneyStageId;
  chapterLabel: string; // "Prologue", "Chapter 1", …, "Epilogue"
  title: string; // narrative chapter title
  pillar: CCPillar | null; // Context Craft pillar this chapter teaches
  badge: string; // canonical named badge
  ccLevel: ContextCraftLevel | null; // cert level the chapter aligns to
  tierArt: CcgeTier; // badge art colourway
  slug: string; // QR / deep-link slug printed in the book → /b/:slug
  deepLink: string; // real in-app destination
  quest: string[]; // honest, real-surface quest steps
  unlock: JourneyUnlock;
  /** Prologue captures the immutable baseline Ledger snapshot on assessment. */
  capturesBaseline?: boolean;
  /** Epilogue captures the final Ledger snapshot when the reader closes out. */
  capturesFinal?: boolean;
}

const BRONZE = JCSE_TIER_THRESHOLDS.BRONZE; // 30
const SILVER = JCSE_TIER_THRESHOLDS.SILVER; // 36
const GOLD = JCSE_TIER_THRESHOLDS.GOLD; // 43
const PLATINUM = JCSE_TIER_THRESHOLDS.PLATINUM; // 48

export const JOURNEY_NODES: readonly JourneyNode[] = [
  {
    id: "prologue",
    order: 0,
    stage: "diagnosis",
    chapterLabel: "Prologue",
    title: "The Reckoning",
    pillar: null,
    badge: "The Reckoning",
    ccLevel: null,
    tierArt: "Bronze",
    slug: "prologue",
    deepLink: "/upload",
    quest: [
      "Upload your résumé to run the JST / ARK assessment.",
      "Your baseline ARK identity is captured in the Ledger automatically.",
    ],
    unlock: { kind: "assessment" },
    capturesBaseline: true,
  },
  {
    id: "ch1",
    order: 1,
    stage: "diagnosis",
    chapterLabel: "Chapter 1",
    title: "The System Frame",
    pillar: "System",
    badge: "System Architect",
    ccLevel: "CC_100",
    tierArt: "Bronze",
    slug: "start",
    deepLink: "/play?scenario=bc-f1-system",
    quest: [
      "Play the SYSTEM chapter challenge in the CCGE Arena.",
      "Reach Bronze (JCSE 30+) to earn the System Architect badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f1-system", minKcse: BRONZE, tierTarget: "Bronze" },
  },
  {
    id: "ch2",
    order: 2,
    stage: "diagnosis",
    chapterLabel: "Chapter 2",
    title: "The Role You Cast",
    pillar: "Role",
    badge: "Role Engineer",
    ccLevel: "CC_100",
    tierArt: "Bronze",
    slug: "role",
    deepLink: "/play?scenario=bc-f2-role",
    quest: [
      "Play the ROLE chapter challenge in the CCGE Arena.",
      "Reach Bronze (JCSE 30+) to earn the Role Engineer badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f2-role", minKcse: BRONZE, tierTarget: "Bronze" },
  },
  {
    id: "ch3",
    order: 3,
    stage: "confrontation",
    chapterLabel: "Chapter 3",
    title: "The Instruction",
    pillar: "Instruction",
    badge: "Instruction Architect",
    ccLevel: "CC_200",
    tierArt: "Silver",
    slug: "instruction",
    deepLink: "/play?scenario=bc-f3-instruction",
    quest: [
      "Play the INSTRUCTION chapter challenge in the CCGE Arena.",
      "Reach Silver (JCSE 36+) to earn the Instruction Architect badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f3-instruction", minKcse: SILVER, tierTarget: "Silver" },
  },
  {
    id: "ch4",
    order: 4,
    stage: "confrontation",
    chapterLabel: "Chapter 4",
    title: "The Data You Feed",
    pillar: "Data",
    badge: "Data Architect",
    ccLevel: "CC_200",
    tierArt: "Bronze",
    slug: "data",
    deepLink: "/play?scenario=bc-f4-data",
    quest: [
      "Play the DATA chapter challenge in the CCGE Arena.",
      "Reach Bronze (JCSE 30+) to earn the Data Architect badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f4-data", minKcse: BRONZE, tierTarget: "Bronze" },
  },
  {
    id: "ch5",
    order: 5,
    stage: "practice",
    chapterLabel: "Chapter 5",
    title: "The Constraints",
    pillar: "Constraint",
    badge: "Constraint Master",
    ccLevel: "CC_300",
    tierArt: "Silver",
    slug: "constraint",
    deepLink: "/play?scenario=bc-f5-constraint",
    quest: [
      "Play the CONSTRAINT chapter challenge in the CCGE Arena.",
      "Reach Silver (JCSE 36+) to earn the Constraint Master badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f5-constraint", minKcse: SILVER, tierTarget: "Silver" },
  },
  {
    id: "ch6",
    order: 6,
    stage: "practice",
    chapterLabel: "Chapter 6",
    title: "The Format",
    pillar: "Format",
    badge: "Format Architect",
    ccLevel: "CC_300",
    tierArt: "Silver",
    slug: "format",
    deepLink: "/play?scenario=bc-f6-format",
    quest: [
      "Play the FORMAT chapter challenge in the CCGE Arena.",
      "Reach Silver (JCSE 36+) to earn the Format Architect badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f6-format", minKcse: SILVER, tierTarget: "Silver" },
  },
  {
    id: "ch7",
    order: 7,
    stage: "navigation",
    chapterLabel: "Chapter 7",
    title: "The Examples",
    pillar: "Example",
    badge: "Example Calibrator",
    ccLevel: "CC_400",
    tierArt: "Gold",
    slug: "example",
    deepLink: "/play?scenario=bc-f7-example",
    quest: [
      "Play the EXAMPLE chapter challenge in the CCGE Arena.",
      "Reach Gold (JCSE 43+) to earn the Example Calibrator badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f7-example", minKcse: GOLD, tierTarget: "Gold" },
  },
  {
    id: "ch8",
    order: 8,
    stage: "navigation",
    chapterLabel: "Chapter 8",
    title: "The Integration",
    pillar: "SuperPrompt" as CCPillar,
    badge: "Super Prompt Master",
    ccLevel: "CC_400",
    tierArt: "Gold",
    slug: "superprompt",
    deepLink: "/play?scenario=bc-f8-integration",
    quest: [
      "Play the INTEGRATION chapter challenge — all seven pillars in one hand.",
      "Reach Gold (JCSE 43+) to earn the Super Prompt Master badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f8-integration", minKcse: GOLD, tierTarget: "Gold" },
  },
  {
    id: "ch9",
    order: 9,
    stage: "navigation",
    chapterLabel: "Chapter 9",
    title: "The Super Prompt Card",
    pillar: null,
    badge: "SPC Builder",
    ccLevel: "CC_400",
    tierArt: "Gold",
    slug: "forge",
    deepLink: "/marketplace/publish",
    quest: [
      "Publish a Super Prompt Card to the SPHINX marketplace (CC-400+ required).",
      "Your first published SPC earns the SPC Builder badge.",
    ],
    unlock: { kind: "spc_publish" },
  },
  {
    id: "ch10",
    order: 10,
    stage: "proof",
    chapterLabel: "Chapter 10",
    title: "The Economics",
    pillar: null,
    badge: "Token Master",
    ccLevel: "CC_500",
    tierArt: "Platinum",
    slug: "economics",
    deepLink: "/play?scenario=bc-f10-economics",
    quest: [
      "Play the ECONOMICS chapter challenge — minimise token cost while holding quality.",
      "Reach Platinum (JCSE 48+) to earn the Token Master badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f10-economics", minKcse: PLATINUM, tierTarget: "Platinum" },
  },
  {
    id: "ch11",
    order: 11,
    stage: "proof",
    chapterLabel: "Chapter 11",
    title: "The Organisation",
    pillar: null,
    badge: "Organisational Intelligence",
    ccLevel: "CC_500",
    tierArt: "Platinum",
    slug: "enterprise",
    deepLink: "/play?scenario=bc-f11-organisation",
    quest: [
      "Play the ORGANISATION chapter challenge — orchestrate a multi-team workflow.",
      "Reach Platinum (JCSE 48+) to earn the Organisational Intelligence badge.",
    ],
    unlock: { kind: "ccge", scenarioId: "bc-f11-organisation", minKcse: PLATINUM, tierTarget: "Platinum" },
  },
  {
    id: "epilogue",
    order: 12,
    stage: "proof",
    chapterLabel: "Epilogue",
    title: "Proof of Growth",
    pillar: null,
    badge: "Proof of Growth",
    ccLevel: null,
    tierArt: "Platinum",
    slug: "epilogue",
    deepLink: "/ark/history",
    quest: [
      "Close the loop: capture your final Ledger snapshot.",
      "Review your ARK trajectory and the delta from your baseline.",
    ],
    unlock: { kind: "ledger_final" },
    capturesFinal: true,
  },
] as const;

// ── Lookups ──────────────────────────────────────────────────────────
const BY_ID = new Map(JOURNEY_NODES.map((n) => [n.id, n]));
const BY_SLUG = new Map(JOURNEY_NODES.map((n) => [n.slug, n]));
const BY_SCENARIO = new Map(
  JOURNEY_NODES.filter((n) => n.unlock.kind === "ccge" && n.unlock.scenarioId).map(
    (n) => [n.unlock.scenarioId as string, n],
  ),
);

export function getNodeById(id: string): JourneyNode | undefined {
  return BY_ID.get(id);
}

export function getNodeBySlug(slug: string): JourneyNode | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function getNodeByScenarioId(scenarioId: string): JourneyNode | undefined {
  return BY_SCENARIO.get(scenarioId);
}

/**
 * Resolve a book QR slug to its real in-app destination, tagging the journey
 * node so the landing page can highlight the active chapter. Returns null for
 * unknown slugs so the caller can fall back to the journey hub.
 */
export function resolveSlugDestination(slug: string): string | null {
  const node = getNodeBySlug(slug);
  if (!node) return null;
  const sep = node.deepLink.includes("?") ? "&" : "?";
  return `${node.deepLink}${sep}book=${node.id}`;
}

/** Canonical slug → destination table (for /api/book/slugs introspection). */
export function slugDirectory(): Array<{
  slug: string;
  nodeId: string;
  chapterLabel: string;
  title: string;
  badge: string;
  deepLink: string;
}> {
  return JOURNEY_NODES.map((n) => ({
    slug: n.slug,
    nodeId: n.id,
    chapterLabel: n.chapterLabel,
    title: n.title,
    badge: n.badge,
    deepLink: n.deepLink,
  }));
}

export const BOOK_TITLE = "Context Craft: An AI Survival Guide" as const;
export const BOOK_TOTAL_NODES = JOURNEY_NODES.length; // 13
