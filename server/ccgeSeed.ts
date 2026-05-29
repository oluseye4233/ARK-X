import { storage } from "./storage";
import type { InsertCcgeCard, InsertCcgeScenario } from "@shared/schema";
import { COMPENDIUM_CARD_SEEDS } from "./ccgeCompendiumSeeds";

export const CCGE_CARD_SEEDS: InsertCcgeCard[] = [
  // System pillar (defines AI's role/persona at the framework level)
  { id: "ccc-sys-01", name: "Sentinel System Frame", pillar: "System", type: "Standard", baseKcse: 80, tokenCost: 6, emoji: "🛡️", description: "Sets baseline guardrails: tone, scope, refuse-list.", body: "You are an enterprise AI assistant. Stay within scope, refuse unsafe requests, surface uncertainty." },
  { id: "ccc-sys-02", name: "Sovereign System Frame", pillar: "System", type: "Ultra", baseKcse: 92, tokenCost: 11, emoji: "👑", description: "Production-grade system frame with explicit operating principles, escalation paths, and audit logging hooks.", body: "You operate under a sovereign-class instruction frame: deterministic outputs, explicit refusals, audit-traceable reasoning, escalation if confidence < 0.8." },

  // Role pillar (the persona / job the AI plays)
  { id: "ccc-rol-01", name: "Domain Specialist", pillar: "Role", type: "Standard", baseKcse: 82, tokenCost: 5, emoji: "🎓", description: "Anchors the model to a single professional persona.", body: "Act as a senior subject-matter expert in this domain with 10+ years of operational experience." },
  { id: "ccc-rol-02", name: "Multi-Hat Strategist", pillar: "Role", type: "Ultra", baseKcse: 90, tokenCost: 10, emoji: "🎩", description: "Composite persona that sequences analyst → strategist → reviewer perspectives.", body: "Adopt three sequential roles: (1) data analyst surfacing facts, (2) strategist proposing options with trade-offs, (3) skeptical reviewer stress-testing the strategy." },

  // Instruction pillar (the actual task spec)
  { id: "ccc-ins-01", name: "Direct Task Brief", pillar: "Instruction", type: "Standard", baseKcse: 85, tokenCost: 6, emoji: "📋", description: "Plain, single-step instruction.", body: "Complete the task described in the user message. Be concise and accurate." },
  { id: "ccc-ins-02", name: "Stepwise Decomposition", pillar: "Instruction", type: "Premium", baseKcse: 88, tokenCost: 9, emoji: "🪜", description: "Forces the model to plan, then execute, then verify.", body: "Decompose the request into ordered steps. For each step: (a) state the goal, (b) execute, (c) verify against the goal before continuing." },

  // Example pillar (few-shot anchors)
  { id: "ccc-exm-01", name: "Single Reference Sample", pillar: "Example", type: "Standard", baseKcse: 84, tokenCost: 7, emoji: "📎", description: "One worked example of the desired output.", body: "Mirror the structure, tone, and depth of this exemplar: <SAMPLE/>." },
  { id: "ccc-exm-02", name: "Counter-Example Pair", pillar: "Example", type: "Premium", baseKcse: 89, tokenCost: 10, emoji: "⚖️", description: "Good vs bad example pair to clarify boundaries.", body: "Here is one acceptable answer and one rejected answer. Diagnose what makes the difference, then produce output matching the acceptable pattern." },

  // Constraint pillar (limits, refusals, must-haves)
  { id: "ccc-con-01", name: "Hard Constraint List", pillar: "Constraint", type: "Standard", baseKcse: 83, tokenCost: 6, emoji: "🚧", description: "Explicit must / must-not list.", body: "Hard constraints: must include all required fields; must not invent citations; refuse if input is ambiguous." },
  { id: "ccc-con-02", name: "Risk-Tier Gate", pillar: "Constraint", type: "Ultra", baseKcse: 91, tokenCost: 11, emoji: "🛑", description: "Forces explicit risk tagging before any high-impact recommendation.", body: "Before recommending any action, classify it as LOW / MEDIUM / HIGH risk. For MEDIUM+: list reversibility, blast radius, and one rollback path. Refuse to recommend any HIGH-risk action without an explicit human-in-the-loop checkpoint." },

  // Format pillar (output shape)
  { id: "ccc-fmt-01", name: "Markdown Sections", pillar: "Format", type: "Standard", baseKcse: 80, tokenCost: 5, emoji: "📝", description: "Standard markdown headers + bullets.", body: "Output as markdown with H2 sections and bulleted lists. No prose paragraphs longer than 3 sentences." },
  { id: "ccc-fmt-02", name: "Strict JSON Schema", pillar: "Format", type: "Premium", baseKcse: 87, tokenCost: 8, emoji: "🧱", description: "Forces machine-parseable JSON with explicit schema.", body: "Return only a JSON object matching this schema: {summary: string, findings: Array<{id: string, severity: 'low'|'med'|'high', evidence: string}>, next_actions: string[]}. No prose, no code fences." },

  // Data pillar (context injection)
  { id: "ccc-dat-01", name: "Source Bundle", pillar: "Data", type: "Standard", baseKcse: 82, tokenCost: 7, emoji: "📦", description: "Inlines source documents as context.", body: "Use only the following source bundle as ground truth. Cite source IDs in every claim: <SOURCES/>." },

  // SuperPrompt pillar (composite playbook card)
  { id: "ccc-spr-01", name: "Sphinx Super Prompt", pillar: "SuperPrompt", type: "SuperPrompt", baseKcse: 96, tokenCost: 15, emoji: "🏛️", description: "Composite playbook that auto-supplies a hardened System+Role+Constraint frame.", body: "ULTRA SI mode: Sovereign system frame + multi-hat strategist + risk-tier gate + JSON output. Decompose, execute, self-critique once, return JSON." },
];

export const CCGE_SCENARIO_SEEDS: InsertCcgeScenario[] = [
  // Bronze (foundational) — 2 scenarios
  {
    id: "scn-brz-01",
    tier: "Bronze",
    title: "Customer Support Auto-Response",
    prompt: "Build a prompt that auto-replies to a tier-1 support email asking about password reset. Must be polite, on-brand, and never invent policy.",
    targetPillars: ["System", "Role", "Instruction"],
    tokenBudget: 30,
    difficulty: 1,
  },
  {
    id: "scn-brz-02",
    tier: "Bronze",
    title: "Daily Standup Summary Bot",
    prompt: "Summarise three engineers' standup notes into a one-paragraph team digest with blockers called out.",
    targetPillars: ["Role", "Instruction", "Format"],
    tokenBudget: 30,
    difficulty: 2,
  },
  // Silver (practitioner) — 2 scenarios
  {
    id: "scn-slv-01",
    tier: "Silver",
    title: "Code Review Assistant",
    prompt: "Review a TypeScript pull request. Flag bugs, security issues, and style violations. Output must be actionable for the author.",
    targetPillars: ["System", "Role", "Instruction", "Example"],
    tokenBudget: 45,
    difficulty: 3,
  },
  {
    id: "scn-slv-02",
    tier: "Silver",
    title: "Sales Pipeline Forecast",
    prompt: "Given a CRM export, classify each opportunity by close-probability tier and produce a quarter-end revenue forecast with confidence band.",
    targetPillars: ["Role", "Instruction", "Example", "Data"],
    tokenBudget: 45,
    difficulty: 3,
  },
  // Gold (specialist) — 2 scenarios
  {
    id: "scn-gld-01",
    tier: "Gold",
    title: "Multi-Source Market Intelligence Brief",
    prompt: "Synthesise 4 news sources, 1 internal memo, and a competitor 10-K into a CEO-ready market brief with cited claims and a recommendation.",
    targetPillars: ["System", "Role", "Instruction", "Example", "Constraint", "Format", "Data"],
    tokenBudget: 60,
    difficulty: 4,
  },
  {
    id: "scn-gld-02",
    tier: "Gold",
    title: "Compliance Audit Report Generator",
    prompt: "Generate a SOC 2 control-by-control audit report from raw evidence. Every claim must cite an evidence ID. Refuse if evidence is missing.",
    targetPillars: ["System", "Role", "Instruction", "Constraint", "Format", "Data"],
    tokenBudget: 60,
    difficulty: 5,
  },

  // ── Book Companion (Task #22) — one pillar-targeted challenge per chapter ──
  // Tiers escalate with the CC ladder: Ch1/2/4 Bronze, Ch3/5/6 Silver,
  // Ch7/8 Gold, Ch10/11 Platinum. Ch9 (SPC Builder) is a publish action, not a
  // CCGE scenario, so there is no bc-f9. Each scenario's first targetPillar is
  // the chapter's pillar; supporting pillars make a qualifying hand reachable.
  {
    id: "bc-f1-system",
    tier: "Bronze",
    title: "Ch1 · The System Frame",
    prompt: "Stand up the system frame for an enterprise assistant: define its scope, tone, and refuse-list before any task is given.",
    targetPillars: ["System", "Role", "Instruction"],
    tokenBudget: 30,
    difficulty: 1,
  },
  {
    id: "bc-f2-role",
    tier: "Bronze",
    title: "Ch2 · The Role You Cast",
    prompt: "Cast the AI as a single, credible professional persona for a domain task — anchor its expertise, voice, and point of view.",
    targetPillars: ["Role", "System", "Instruction"],
    tokenBudget: 30,
    difficulty: 2,
  },
  {
    id: "bc-f3-instruction",
    tier: "Silver",
    title: "Ch3 · The Instruction",
    prompt: "Turn a vague request into a precise, decomposed instruction the model can execute and self-verify step by step.",
    targetPillars: ["Instruction", "System", "Role", "Format"],
    tokenBudget: 45,
    difficulty: 3,
  },
  {
    id: "bc-f4-data",
    tier: "Bronze",
    title: "Ch4 · The Data You Feed",
    prompt: "Ground the model in a supplied source bundle and force every claim to cite its source ID — no outside knowledge.",
    targetPillars: ["Data", "Instruction", "Constraint"],
    tokenBudget: 30,
    difficulty: 2,
  },
  {
    id: "bc-f5-constraint",
    tier: "Silver",
    title: "Ch5 · The Constraints",
    prompt: "Impose hard constraints and a risk-tier gate so the assistant refuses unsafe asks and flags high-impact actions.",
    targetPillars: ["Constraint", "System", "Instruction", "Format"],
    tokenBudget: 45,
    difficulty: 3,
  },
  {
    id: "bc-f6-format",
    tier: "Silver",
    title: "Ch6 · The Format",
    prompt: "Lock the output to a strict, machine-parseable shape (schema'd JSON) without sacrificing the substance of the answer.",
    targetPillars: ["Format", "Instruction", "Constraint", "System"],
    tokenBudget: 45,
    difficulty: 3,
  },
  {
    id: "bc-f7-example",
    tier: "Gold",
    title: "Ch7 · The Examples",
    prompt: "Calibrate the model with a good/bad example pair so it infers the boundary and matches the accepted pattern exactly.",
    targetPillars: ["Example", "System", "Role", "Instruction", "Constraint", "Format"],
    tokenBudget: 60,
    difficulty: 4,
  },
  {
    id: "bc-f8-integration",
    tier: "Gold",
    title: "Ch8 · The Integration",
    prompt: "Integrate all seven pillars into one Super Prompt: a hardened, end-to-end brief that needs no follow-up corrections.",
    targetPillars: ["System", "Role", "Instruction", "Example", "Constraint", "Format", "Data"],
    tokenBudget: 60,
    difficulty: 5,
  },
  {
    id: "bc-f10-economics",
    tier: "Platinum",
    title: "Ch10 · The Economics",
    prompt: "Deliver a CEO-ready brief at the lowest token cost that still holds quality — every pillar must earn its place in the budget.",
    targetPillars: ["System", "Role", "Instruction", "Example", "Constraint", "Format", "Data"],
    tokenBudget: 75,
    difficulty: 5,
  },
  {
    id: "bc-f11-organisation",
    tier: "Platinum",
    title: "Ch11 · The Organisation",
    prompt: "Orchestrate a multi-team workflow: sequence roles, constraints, and data hand-offs into one organisational-grade prompt.",
    targetPillars: ["System", "Role", "Instruction", "Example", "Constraint", "Format", "Data"],
    tokenBudget: 75,
    difficulty: 5,
  },
];

export async function seedCcge() {
  const allCards: InsertCcgeCard[] = [...CCGE_CARD_SEEDS, ...COMPENDIUM_CARD_SEEDS];
  for (const card of allCards) {
    await storage.upsertCcgeCard(card);
  }
  for (const scenario of CCGE_SCENARIO_SEEDS) {
    await storage.upsertCcgeScenario(scenario);
  }
  return { cards: allCards.length, scenarios: CCGE_SCENARIO_SEEDS.length };
}
