// ─────────────────────────────────────────────────────────────────────────
// JUNGLENOMICS CODEC — 22 PRIMITIVE CARDS
// Source: "JUNGLENOMICS.CODEC^LJ00001" (Managers Codec, Oluseye Amusa, 2021)
// IF · Idea Factory Ltd Nigeria, JungleNomics Trademark / Patent Pending
//
// These are the canonical primitives of the deck. Each primitive is mapped
// to global skill standards so user assessments can be expressed in a
// shared vocabulary that recruiters, L&D platforms, and labour market
// analysts already understand:
//
//   • O*NET   — U.S. Department of Labor occupational skill taxonomy
//   • SFIA v8 — Skills Framework for the Information Age (3-letter codes)
//   • WEF     — World Economic Forum Future of Jobs 2023 core skills
//
// Tier values reuse the JnomicsCard table's `tier` column to denote the
// CODEC card category (Animal / Relational / People / Give / Get /
// Innovation). The `type` column carries the primitive's persona label.
// ─────────────────────────────────────────────────────────────────────────

export type CodecCategory =
  | "Animal"
  | "Relational"
  | "People"
  | "Give"
  | "Get"
  | "Innovation";

export interface SkillStandardMapping {
  onet: string[];   // O*NET skill / DWA names
  sfia: string[];   // SFIA v8 3-letter skill codes
  wef: string[];    // WEF Future of Jobs 2023 core skills
}

export interface CodecPrimitive {
  id: string;
  name: string;
  category: CodecCategory;
  persona: string;        // The deck's "personality" / role tag
  emoji: string;
  basePts: number;        // Card face value from the deck
  multiplier: string;     // Star/Innovation multiplier shorthand from deck
  description: string;    // Short blurb (first-person voice from deck)
  insight: string;        // Coaching insight from the deck's INSIGHT panel
  matchKeywords: string[];// Resume terms that activate this primitive
  archetype: "ARCHITECT" | "ORCHESTRATOR" | "CONDUCTOR";
  mappings: SkillStandardMapping;
}

export const CODEC_PRIMITIVES: CodecPrimitive[] = [
  // ── ANIMAL · COGNATE TRIBE (Mindset DNA) ────────────────────────────
  {
    id: "codec-ant",
    name: "The Ant",
    category: "Animal",
    persona: "Builder of Economies",
    emoji: "🐜",
    basePts: 10,
    multiplier: "x3",
    description: "Builder of economies. Weak alone, strong in a group. Everyone starts here.",
    insight: "Small enterprise / startup mindset. Will appear on the cover of an entrepreneurship magazine.",
    matchKeywords: ["startup", "founder", "co-founder", "small business", "bootstrap", "entrepreneur", "solo", "build team", "established"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Entrepreneurship", "Operation and Control"],
      sfia: ["INOV", "ENRE"],
      wef: ["Resilience, flexibility & agility", "Motivation & self-awareness"],
    },
  },
  {
    id: "codec-butterfly",
    name: "The Butterfly",
    category: "Animal",
    persona: "Exclusive Luxury",
    emoji: "🦋",
    basePts: 10,
    multiplier: "x3",
    description: "Exclusive, expensive, customized and rare.",
    insight: "Luxury / premium enterprise mindset. Appreciates the finer things.",
    matchKeywords: ["luxury", "premium", "exclusive", "bespoke", "couture", "high-end", "concierge", "boutique"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Customer and Personal Service", "Quality Control Analysis"],
      sfia: ["MKTG", "RLMT"],
      wef: ["Service orientation & customer service", "Creative thinking"],
    },
  },
  {
    id: "codec-bumble-bee",
    name: "The Bumble Bee",
    category: "Animal",
    persona: "Social Good Propagator",
    emoji: "🐝",
    basePts: 10,
    multiplier: "x3",
    description: "Giver and propagator of social good.",
    insight: "Benevolent / not-for-profit enterprise mindset. Holds high ethical and moral standards.",
    matchKeywords: ["nonprofit", "non-profit", "ngo", "charity", "social impact", "esg", "sustainability", "philanthropy", "volunteer", "community"],
    archetype: "CONDUCTOR",
    mappings: {
      onet: ["Social Perceptiveness", "Service Orientation"],
      sfia: ["SUST", "RLMT"],
      wef: ["Empathy & active listening", "Environmental stewardship"],
    },
  },
  {
    id: "codec-cheetah",
    name: "The Cheetah",
    category: "Animal",
    persona: "Knowledge Hunter",
    emoji: "🐆",
    basePts: 10,
    multiplier: "x3",
    description: "Swift, flexible and smart. Hunts large animals — knowledge is the product.",
    insight: "Knowledge enterprise mindset. Sees themselves as a maverick with world-changing ideas.",
    matchKeywords: ["consulting", "consultant", "advisory", "research", "knowledge", "thought leadership", "ip", "intellectual property", "publication", "expertise"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Critical Thinking", "Active Learning", "Complex Problem Solving"],
      sfia: ["RSCH", "INOV"],
      wef: ["Analytical thinking", "Curiosity & lifelong learning"],
    },
  },
  {
    id: "codec-elephant",
    name: "The Elephant",
    category: "Animal",
    persona: "Large Enterprise",
    emoji: "🐘",
    basePts: 10,
    multiplier: "x3",
    description: "Huge, slow, strong and structured. Feeds on little things to survive.",
    insight: "Large enterprise mindset. Ambitious — sees themselves on the Board of a large company one day.",
    matchKeywords: ["enterprise", "corporation", "fortune 500", "multinational", "conglomerate", "board", "c-suite", "executive", "vp", "director", "chief"],
    archetype: "ORCHESTRATOR",
    mappings: {
      onet: ["Management of Personnel Resources", "Coordination", "Systems Analysis"],
      sfia: ["STPL", "ITSP"],
      wef: ["Leadership & social influence", "Systems thinking"],
    },
  },
  {
    id: "codec-wasp",
    name: "The Wasp",
    category: "Animal",
    persona: "Parasitic Antagonist",
    emoji: "🐝",
    basePts: 100,
    multiplier: "x3 (penalty)",
    description: "Taker, destroyer, parasite. Converts good to bad.",
    insight: "ANTAGONIST CARD. Thrives in administrative loopholes, politicised environments, stagnated roles. History full of dysfunction but always 'the good guy' in their own story.",
    matchKeywords: ["politics", "loophole", "workaround", "cover-up", "scapegoat"],
    archetype: "CONDUCTOR",
    mappings: {
      onet: ["Judgment and Decision Making", "Negotiation"],
      sfia: ["BURM", "AUDT"],
      wef: ["Quality control", "Dependability & attention to detail"],
    },
  },

  // ── RELATIONAL · CORPORATE VALUES ───────────────────────────────────
  {
    id: "codec-core-values",
    name: "Core Values",
    category: "Relational",
    persona: "What do you believe?",
    emoji: "🧭",
    basePts: 20,
    multiplier: "x2 / x3 / x5",
    description: "The source of value, vision and culture.",
    insight: "Skills/Careers — Human Resources, Audit, Company Secretary, Control, Regulatory Agency Professional.",
    matchKeywords: ["values", "ethics", "integrity", "governance", "compliance", "audit", "regulatory", "company secretary", "control"],
    archetype: "CONDUCTOR",
    mappings: {
      onet: ["Judgment and Decision Making", "Active Listening"],
      sfia: ["GOVN", "AUDT"],
      wef: ["Motivation & self-awareness", "Quality control"],
    },
  },
  {
    id: "codec-culture",
    name: "Culture",
    category: "Relational",
    persona: "Who are you?",
    emoji: "🎭",
    basePts: 20,
    multiplier: "x3",
    description: "Language, brand identity, norms.",
    insight: "Skills/Careers — HR, Training, Policy Formulation, Fashion, Quality Control, Compliance, Trend Analysis, Popular Culture, Religion, Corporate Communications.",
    matchKeywords: ["culture", "brand", "branding", "identity", "communications", "internal comms", "engagement", "values", "training"],
    archetype: "ORCHESTRATOR",
    mappings: {
      onet: ["Persuasion", "Active Listening", "Speaking"],
      sfia: ["MKTG", "PEMT"],
      wef: ["Talent management", "Empathy & active listening"],
    },
  },
  {
    id: "codec-core-objectives",
    name: "Core Objectives",
    category: "Relational",
    persona: "What are you aiming at?",
    emoji: "🎯",
    basePts: 20,
    multiplier: "x3",
    description: "Growth, propagation, satisfaction.",
    insight: "Skills/Careers — Project Management, Scrum Master, ISO Auditor, Business Planning, Accounting, Legal.",
    matchKeywords: ["objectives", "okr", "kpi", "business planning", "strategic planning", "project management", "scrum", "iso", "roadmap"],
    archetype: "ORCHESTRATOR",
    mappings: {
      onet: ["Management of Personnel Resources", "Time Management", "Monitoring"],
      sfia: ["PRMG", "PROF"],
      wef: ["Analytical thinking", "Resource management & operations"],
    },
  },

  // ── PEOPLE · BUSINESS ECOSYSTEM ─────────────────────────────────────
  {
    id: "codec-personnel",
    name: "Personnel",
    category: "People",
    persona: "Build your tribe",
    emoji: "👥",
    basePts: 15,
    multiplier: "x6 / x3",
    description: "Who are your tribesmen and tribeswomen?",
    insight: "Skills/Careers — HR, Training, Legal, Policy Formulation, Search & Selection, Testing, Certification Training, Outsourcing, In-Sourcing, all HR Mgmt Certifications.",
    matchKeywords: ["recruiting", "recruitment", "talent acquisition", "hr", "human resources", "people ops", "hiring", "onboarding", "talent development"],
    archetype: "ORCHESTRATOR",
    mappings: {
      onet: ["Management of Personnel Resources", "Social Perceptiveness"],
      sfia: ["HRMG", "RESC"],
      wef: ["Talent management", "Leadership & social influence"],
    },
  },
  {
    id: "codec-partners",
    name: "Partners",
    category: "People",
    persona: "Who are your allies?",
    emoji: "🤝",
    basePts: 15,
    multiplier: "x3",
    description: "Strategic alliances, joint ventures, channel and ecosystem partners.",
    insight: "Skills/Careers — Legal, Financial Analyst, Negotiations, Marketing, Corporate Communications, Business Forecasting. Combo upgrade with Target Market.",
    matchKeywords: ["partnership", "partner", "alliance", "joint venture", "ecosystem", "vendor", "supplier", "channel", "negotiation", "bd", "business development"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Negotiation", "Persuasion", "Coordination"],
      sfia: ["RLMT", "SUPP"],
      wef: ["Leadership & social influence", "Service orientation & customer service"],
    },
  },
  {
    id: "codec-target-mass",
    name: "Target Market — Mass",
    category: "People",
    persona: "Mass market customers",
    emoji: "🌐",
    basePts: 15,
    multiplier: "x2 / x3",
    description: "Who are your customers? Structure must be purpose-designed for their needs.",
    insight: "Skills/Careers — Marketing, Product Research & Development, UX Research.",
    matchKeywords: ["b2c", "consumer", "mass market", "retail", "marketing", "product research", "growth marketing", "performance marketing", "user research"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Sales and Marketing", "Customer and Personal Service"],
      sfia: ["MKTG", "USEV"],
      wef: ["Marketing & media", "Design and user experience"],
    },
  },
  {
    id: "codec-target-select",
    name: "Target Market — Select",
    category: "People",
    persona: "Select market customers",
    emoji: "🎯",
    basePts: 15,
    multiplier: "x2 / x3",
    description: "Niche / select clients. Structure must be purpose-designed for their problems.",
    insight: "Skills/Careers — Marketing, Product Research & Development, UX Research (specialised).",
    matchKeywords: ["b2b", "enterprise sales", "account-based", "abm", "niche", "vertical", "key account", "strategic accounts", "solutions"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Sales and Marketing", "Service Orientation"],
      sfia: ["SCAD", "RLMT"],
      wef: ["Marketing & media", "Empathy & active listening"],
    },
  },

  // ── GIVE · BUSINESS SYSTEMS ─────────────────────────────────────────
  {
    id: "codec-compliance",
    name: "Compliance",
    category: "Give",
    persona: "Structure & integrity",
    emoji: "📋",
    basePts: 10,
    multiplier: "x10",
    description: "Is your structure fully defined, in words and numbers, independently verifiable and viable?",
    insight: "The deck's highest multiplier. Structure must be purpose-designed.",
    matchKeywords: ["compliance", "regulation", "audit", "iso", "soc 2", "gdpr", "hipaa", "policy", "controls", "governance"],
    archetype: "CONDUCTOR",
    mappings: {
      onet: ["Quality Control Analysis", "Critical Thinking"],
      sfia: ["AUDT", "COCO"],
      wef: ["Quality control", "Dependability & attention to detail"],
    },
  },
  {
    id: "codec-products",
    name: "Products",
    category: "Give",
    persona: "What are your products?",
    emoji: "📦",
    basePts: 10,
    multiplier: "x1",
    description: "Market acceptance · trademark · standardized process.",
    insight: "Skills/Careers — 3D & 2D Design, UI Design, Architecture, Engineering, Sciences, Manufacturing, Packaging, Health & Safety, Biologist.",
    matchKeywords: ["product", "product management", "product design", "manufacturing", "trademark", "patent", "engineering", "industrial design"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Operations Analysis", "Technology Design"],
      sfia: ["PROD", "DESN"],
      wef: ["Design and user experience", "Technological literacy"],
    },
  },
  {
    id: "codec-services",
    name: "Services",
    category: "Give",
    persona: "What are your services?",
    emoji: "🛎️",
    basePts: 10,
    multiplier: "x1",
    description: "Market acceptance · servicemark · standardized procedures.",
    insight: "Skills/Careers — Service design, customer experience, professional services.",
    matchKeywords: ["service", "services", "consulting", "professional services", "customer experience", "cx", "service design", "delivery"],
    archetype: "ORCHESTRATOR",
    mappings: {
      onet: ["Service Orientation", "Customer and Personal Service"],
      sfia: ["SLMO", "USUP"],
      wef: ["Service orientation & customer service", "Empathy & active listening"],
    },
  },
  {
    id: "codec-business-processes",
    name: "Business Processes",
    category: "Give",
    persona: "Codified, repeatable execution",
    emoji: "⚙️",
    basePts: 10,
    multiplier: "x2",
    description: "Codification · standardization · algorithm · automation.",
    insight: "Skills/Careers — Process engineering, business analysis, RPA, automation.",
    matchKeywords: ["process", "process improvement", "lean", "six sigma", "automation", "rpa", "workflow", "operations", "business analyst"],
    archetype: "ORCHESTRATOR",
    mappings: {
      onet: ["Operations Analysis", "Systems Analysis", "Programming"],
      sfia: ["BPRE", "METL"],
      wef: ["Systems thinking", "Analytical thinking"],
    },
  },
  {
    id: "codec-platform",
    name: "Platform",
    category: "Give",
    persona: "Delivery channels & networks",
    emoji: "🛰️",
    basePts: 10,
    multiplier: "x1",
    description: "Workspace · channels · logistics · networks · last mile.",
    insight: "Skills/Careers — Platform engineering, supply chain, logistics, network design.",
    matchKeywords: ["platform", "infrastructure", "cloud", "saas", "logistics", "supply chain", "distribution", "channels", "networks", "fulfillment"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Technology Design", "Systems Evaluation"],
      sfia: ["ARCH", "ITOP"],
      wef: ["Networks and cybersecurity", "Technological literacy"],
    },
  },

  // ── GET · THE MARKETPLACE ───────────────────────────────────────────
  {
    id: "codec-revenue",
    name: "Revenue",
    category: "Get",
    persona: "How do you generate revenue?",
    emoji: "💰",
    basePts: 25,
    multiplier: "x2",
    description: "Profit · budgets · reserves · costs · investments.",
    insight: "Skills/Careers — Accounting, Financial, Analytics, Sales, Management.",
    matchKeywords: ["revenue", "sales", "finance", "accounting", "p&l", "budget", "forecast", "fp&a", "cfo", "controller", "treasury"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Mathematics", "Judgment and Decision Making"],
      sfia: ["FMIT", "BUSA"],
      wef: ["Analytical thinking", "Reading, writing & mathematics"],
    },
  },
  {
    id: "codec-goodwill",
    name: "Goodwill",
    category: "Get",
    persona: "How do you generate goodwill?",
    emoji: "🌟",
    basePts: 25,
    multiplier: "x2",
    description: "Credibility · culture · value · values.",
    insight: "Brand reputation, public trust, ESG capital.",
    matchKeywords: ["brand", "reputation", "pr", "public relations", "communications", "esg", "sustainability", "thought leadership"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Persuasion", "Social Perceptiveness", "Speaking"],
      sfia: ["MKTG", "RLMT"],
      wef: ["Marketing & media", "Empathy & active listening"],
    },
  },
  {
    id: "codec-loyalty",
    name: "Loyalty",
    category: "Get",
    persona: "How do you generate loyalty?",
    emoji: "💎",
    basePts: 25,
    multiplier: "x2 / x3",
    description: "Rewards · culture · value · values.",
    insight: "Skills/Careers — Customer Relationship Management, Customer Care, Sociology.",
    matchKeywords: ["loyalty", "retention", "crm", "customer success", "customer care", "nps", "lifetime value", "ltv", "churn"],
    archetype: "CONDUCTOR",
    mappings: {
      onet: ["Service Orientation", "Customer and Personal Service", "Active Listening"],
      sfia: ["CSMG", "RLMT"],
      wef: ["Service orientation & customer service", "Empathy & active listening"],
    },
  },

  // ── INNOVATION (multiplier card) ────────────────────────────────────
  {
    id: "codec-innovation",
    name: "Innovation",
    category: "Innovation",
    persona: "Combine · Connect · Disrupt · Improve · Create",
    emoji: "💡",
    basePts: 0,
    multiplier: "x3 (activator)",
    description: "Activated when any two or more identical cards are played together.",
    insight: "Skills/Careers — Philosophy, Logic, Storytelling, Creative Thinking, Idea Generation, Conceptualization, Game Design, Algorithm, Flowcharts.",
    matchKeywords: ["innovation", "r&d", "patent", "invented", "designed", "prototype", "novel", "first-of-its-kind", "creative", "ideation", "design thinking"],
    archetype: "ARCHITECT",
    mappings: {
      onet: ["Originality", "Fluency of Ideas", "Complex Problem Solving"],
      sfia: ["INOV", "EMRG"],
      wef: ["Creative thinking", "Curiosity & lifelong learning"],
    },
  },
];

// ── Helper indices ─────────────────────────────────────────────────────
export const CODEC_BY_ID: Record<string, CodecPrimitive> =
  Object.fromEntries(CODEC_PRIMITIVES.map(p => [p.id, p]));

export const CODEC_ARCHETYPE_MAP: Record<string, "ARCHITECT" | "ORCHESTRATOR" | "CONDUCTOR"> =
  Object.fromEntries(CODEC_PRIMITIVES.map(p => [p.id, p.archetype]));

// Category → ids, useful for grouped UI panels.
export const CODEC_BY_CATEGORY: Record<CodecCategory, string[]> = CODEC_PRIMITIVES.reduce(
  (acc, p) => {
    (acc[p.category] ||= []).push(p.id);
    return acc;
  },
  {} as Record<CodecCategory, string[]>,
);

// Resume keyword → primitive ids that the keyword activates.
// Built lazily so the catalog stays the single source of truth.
export function buildKeywordIndex(): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const p of CODEC_PRIMITIVES) {
    for (const kw of p.matchKeywords) {
      const lower = kw.toLowerCase();
      const list = idx.get(lower) ?? [];
      list.push(p.id);
      idx.set(lower, list);
    }
  }
  return idx;
}
