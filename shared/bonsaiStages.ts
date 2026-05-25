// 18-stage Bonsai seller-onboarding walkthrough (M5).
// Static content — no DB rows. Progress is tracked per-user in `bonsai_progress`.
// Pure data; no ARK/HIVE bonuses are awarded for completing stages.

export interface BonsaiStage {
  id: number;            // 1..18
  title: string;
  phase: "Roots" | "Trunk" | "Branches" | "Canopy";
  goal: string;
  actions: string[];
  dependencies: number[]; // stage ids that must complete first
}

export const BONSAI_STAGES: BonsaiStage[] = [
  {
    id: 1,
    title: "Plant the Seed",
    phase: "Roots",
    goal: "Understand what SPHINX is and what a Super Prompt Card (SPC) actually is.",
    actions: [
      "Read the SPHINX marketplace overview.",
      "Browse 3 top-rated SPCs in any pillar.",
      "Note one element that makes them feel polished.",
    ],
    dependencies: [],
  },
  {
    id: 2,
    title: "Soil & Nutrients",
    phase: "Roots",
    goal: "Identify a problem domain you can solve repeatably with a prompt.",
    actions: [
      "List 3 tasks you do weekly that involve an LLM.",
      "Pick the one with the clearest input/output contract.",
    ],
    dependencies: [1],
  },
  {
    id: 3,
    title: "Root System",
    phase: "Roots",
    goal: "Map the inputs, constraints and success criteria for your chosen task.",
    actions: [
      "Write the user persona in one sentence.",
      "List required inputs (variables, examples, data shapes).",
      "Define what 'good output' looks like — be specific.",
    ],
    dependencies: [2],
  },
  {
    id: 4,
    title: "Sprout",
    phase: "Trunk",
    goal: "Draft v0 of the prompt — minimum viable instructions.",
    actions: [
      "Write Role + Task + Output Format in plain prose.",
      "Test it once against a real input.",
    ],
    dependencies: [3],
  },
  {
    id: 5,
    title: "First Leaves",
    phase: "Trunk",
    goal: "Add structural framing — sections, headings, lists.",
    actions: [
      "Convert prose into labelled sections (## Role, ## Task, ## Constraints, ## Format).",
      "Make every section earn its tokens.",
    ],
    dependencies: [4],
  },
  {
    id: 6,
    title: "Strengthen the Stem",
    phase: "Trunk",
    goal: "Add 1-3 worked examples (few-shot) to anchor tone and shape.",
    actions: [
      "Pick examples that span the easy and edge cases.",
      "Mark inputs/outputs clearly in each example.",
    ],
    dependencies: [5],
  },
  {
    id: 7,
    title: "Prune Deadwood",
    phase: "Trunk",
    goal: "Cut anything that doesn't move the output. Tokens cost money.",
    actions: [
      "Remove redundant instructions.",
      "Replace verbose phrases with imperatives.",
      "Re-test that output quality holds.",
    ],
    dependencies: [6],
  },
  {
    id: 8,
    title: "First Branch — Constraints",
    phase: "Branches",
    goal: "Add explicit do/don't rules and refusal behaviour.",
    actions: [
      "List 3 'must' rules and 3 'must not' rules.",
      "Specify what the model should do when input is malformed.",
    ],
    dependencies: [7],
  },
  {
    id: 9,
    title: "Branch — Output Schema",
    phase: "Branches",
    goal: "Lock down the output format (JSON shape, markdown skeleton, etc.).",
    actions: [
      "Write the exact schema/skeleton with placeholders.",
      "Add 'respond ONLY with X' guard rails.",
    ],
    dependencies: [8],
  },
  {
    id: 10,
    title: "Branch — Failure Modes",
    phase: "Branches",
    goal: "Stress-test against 5+ adversarial or unusual inputs.",
    actions: [
      "Try empty input, very long input, off-topic input.",
      "Note where the prompt breaks; patch with targeted instructions.",
    ],
    dependencies: [9],
  },
  {
    id: 11,
    title: "Canopy Spread — Pillar Fit",
    phase: "Canopy",
    goal: "Pick the right SPHINX pillar (System / Persona / Task / Constraint / Example / Format / Meta).",
    actions: [
      "Match your prompt's center of gravity to one pillar.",
      "Decide which secondary pillar to highlight in your description.",
    ],
    dependencies: [10],
  },
  {
    id: 12,
    title: "Title & Description",
    phase: "Canopy",
    goal: "Craft a marketplace-ready title (≤80 chars) and a sharp description (≥20 chars).",
    actions: [
      "Title = persona/role + outcome (e.g. 'Tier-1 Triage Architect').",
      "Description should sell the outcome, not the prompt.",
    ],
    dependencies: [11],
  },
  {
    id: 13,
    title: "Pricing the Tree",
    phase: "Canopy",
    goal: "Decide a fair credit price for your SPC.",
    actions: [
      "Run the HIVE pre-check first.",
      "Use the suggested price band from the pre-check result.",
    ],
    dependencies: [12],
  },
  {
    id: 14,
    title: "HIVE Pre-Check",
    phase: "Canopy",
    goal: "Run the deterministic quality scanner and clear all red flags.",
    actions: [
      "Paste body into /marketplace/publish or use the Forge Lab .docx upload.",
      "Aim for HIVE ≥ 80 (Gold) for the strongest signal.",
    ],
    dependencies: [13],
  },
  {
    id: 15,
    title: "Roundtable Awareness",
    phase: "Canopy",
    goal: "Understand how the Top-12 Roundtable ranks SPCs and what gets you seated.",
    actions: [
      "Visit /marketplace/roundtable.",
      "Read the ranking signal mix (HIVE, sales, synergy).",
    ],
    dependencies: [14],
  },
  {
    id: 16,
    title: "Synergy & Pairing",
    phase: "Canopy",
    goal: "Identify complementary cards your SPC will pair well with.",
    actions: [
      "Use the Synergy Lab to test 2-card combinations.",
      "Note 1-2 cards that lift your card's effective output.",
    ],
    dependencies: [15],
  },
  {
    id: 17,
    title: "Publish & Watch",
    phase: "Canopy",
    goal: "Submit the listing and watch first impressions land.",
    actions: [
      "Publish via /marketplace/publish.",
      "Monitor sales count and synergy edges for the first 7 days.",
    ],
    dependencies: [16],
  },
  {
    id: 18,
    title: "Iterate Like a Bonsai Master",
    phase: "Canopy",
    goal: "Update, refine, and republish based on real buyer signal.",
    actions: [
      "Read any buyer endorsements / sales velocity.",
      "Refine wording or examples; consider publishing a v2.",
    ],
    dependencies: [17],
  },
];

export const TOTAL_BONSAI_STAGES = BONSAI_STAGES.length;

export function getBonsaiStage(id: number): BonsaiStage | undefined {
  return BONSAI_STAGES.find((s) => s.id === id);
}
