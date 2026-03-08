import type { InsertAssessment, InsertUpskillingPlan, InsertPivotOpportunity, InsertTransferabilityVector } from "@shared/schema";

interface AnalysisResult {
  assessment: Omit<InsertAssessment, "userId">;
  upskillingPlans: Omit<InsertUpskillingPlan, "assessmentId">[];
  pivotOpportunities: Omit<InsertPivotOpportunity, "assessmentId">[];
  transferabilityVectors: Omit<InsertTransferabilityVector, "assessmentId">[];
}

const SKILL_CATEGORIES = {
  technical: {
    keywords: ["python", "javascript", "typescript", "java", "react", "angular", "vue", "node", "sql", "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "devops", "api", "rest", "graphql", "microservices", "machine learning", "deep learning", "tensorflow", "pytorch", "data science", "algorithm", "git", "linux", "cloud", "agile", "scrum", "html", "css", "c++", "rust", "go", "swift", "kotlin", "ruby", "php", "mongodb", "postgresql", "redis", "elasticsearch", "spark", "hadoop", "kafka", "rabbitmq"],
    weight: 1.2,
  },
  leadership: {
    keywords: ["led", "managed", "directed", "oversaw", "supervised", "mentored", "coached", "spearheaded", "orchestrated", "championed", "drove", "headed", "founded", "established", "built team", "cross-functional", "stakeholder", "executive", "strategy", "roadmap", "vision", "c-suite", "vp", "director", "head of", "chief", "principal"],
    weight: 1.3,
  },
  analytical: {
    keywords: ["analyzed", "evaluated", "assessed", "measured", "forecasted", "modeled", "optimized", "researched", "investigated", "audited", "diagnosed", "quantified", "data-driven", "metrics", "kpi", "roi", "analytics", "statistical", "regression", "hypothesis", "bayesian", "a/b testing", "dashboard", "reporting", "insights", "trend"],
    weight: 1.1,
  },
  communication: {
    keywords: ["presented", "communicated", "negotiated", "collaborated", "facilitated", "published", "authored", "trained", "consulted", "advised", "client-facing", "public speaking", "stakeholder management", "documentation", "proposal", "presentation", "workshop", "conference"],
    weight: 1.0,
  },
  innovation: {
    keywords: ["innovated", "designed", "created", "developed", "invented", "prototyped", "architected", "engineered", "automated", "transformed", "modernized", "disrupted", "patent", "novel", "pioneered", "first-of-its-kind", "startup", "entrepreneurial", "r&d"],
    weight: 1.15,
  },
  ai_adjacent: {
    keywords: ["ai", "artificial intelligence", "machine learning", "nlp", "natural language", "computer vision", "neural network", "llm", "gpt", "prompt engineering", "generative ai", "chatbot", "automation", "rpa", "robotic process", "intelligent automation", "cognitive", "predictive", "recommendation engine", "transformer"],
    weight: 1.4,
  },
};

const AUTOMATION_RISK_TASKS: Array<{ pattern: RegExp; task: string; baseRisk: number }> = [
  { pattern: /data\s*entry|data\s*input|transcription|typing/i, task: "Data Entry & Transcription", baseRisk: 95 },
  { pattern: /report\s*(generation|writing|creation)|routine\s*report/i, task: "Routine Report Generation", baseRisk: 85 },
  { pattern: /customer\s*(service|support)|help\s*desk|ticket/i, task: "Customer Service Operations", baseRisk: 80 },
  { pattern: /schedul(e|ing)|calendar|booking|appointment/i, task: "Scheduling & Calendar Mgmt", baseRisk: 90 },
  { pattern: /accounting|bookkeep|invoice|payroll/i, task: "Accounting & Bookkeeping", baseRisk: 75 },
  { pattern: /testing|qa|quality\s*assurance|test\s*case/i, task: "Software Testing & QA", baseRisk: 65 },
  { pattern: /data\s*analy(sis|tics|ze)|sql|query|bi\b/i, task: "Routine Data Analysis", baseRisk: 70 },
  { pattern: /configur(e|ation)|setup|deploy|provision/i, task: "System Configuration", baseRisk: 60 },
  { pattern: /stakeholder|client\s*meeting|present(ation|ed)|negotiat/i, task: "Stakeholder Communication", baseRisk: 15 },
  { pattern: /strateg(y|ic)|roadmap|vision|planning/i, task: "Strategic Planning", baseRisk: 10 },
  { pattern: /mentor|coach|train|develop\s*talent/i, task: "People Development", baseRisk: 12 },
  { pattern: /creative|design|brand|content\s*creation/i, task: "Creative & Design Work", baseRisk: 35 },
  { pattern: /research|r&d|experiment|hypothesis/i, task: "Research & Development", baseRisk: 25 },
  { pattern: /architect|system\s*design|infrastructure/i, task: "Systems Architecture", baseRisk: 20 },
];

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function estimateYearsExperience(text: string): number {
  const yearPatterns = [
    /(\d{1,2})\+?\s*years?\s*(of\s*)?(experience|exp)/gi,
    /experience[:\s]*(\d{1,2})\+?\s*years?/gi,
  ];
  let maxYears = 0;
  for (const pat of yearPatterns) {
    let match;
    while ((match = pat.exec(text)) !== null) {
      const y = parseInt(match[1]);
      if (y > maxYears && y < 50) maxYears = y;
    }
  }
  if (maxYears === 0) {
    const dateRanges = text.match(/20\d{2}\s*[-–]\s*(20\d{2}|present|current)/gi);
    if (dateRanges && dateRanges.length > 0) {
      maxYears = Math.min(dateRanges.length * 2, 20);
    }
  }
  return maxYears;
}

function determineSeniority(yearsExp: number, leadershipScore: number): string {
  if (yearsExp >= 12 || leadershipScore > 15) return "Senior";
  if (yearsExp >= 5 || leadershipScore > 8) return "Mid-Level";
  return "Junior";
}

function pickMatchedCards(scores: Record<string, number>): string[] {
  const cards: string[] = [];
  if (scores.technical > 8) cards.push("card-002");
  if (scores.leadership > 8) cards.push("card-004");
  if (scores.analytical > 6) cards.push("card-003");
  if (scores.innovation > 5) cards.push("card-001");
  if (scores.ai_adjacent > 4) cards.push("card-010");
  if (scores.communication > 6) cards.push("card-007");
  if (cards.length < 2) {
    if (!cards.includes("card-005")) cards.push("card-005");
    if (!cards.includes("card-008")) cards.push("card-008");
  }
  return cards.slice(0, 5);
}

const JST_ARCHETYPE_MAP: Record<string, "ARCHITECT" | "ORCHESTRATOR" | "CONDUCTOR"> = {
  "financial analyst": "ARCHITECT", "budget analyst": "ORCHESTRATOR", "management analyst": "ARCHITECT",
  "market research analyst": "ARCHITECT", "financial examiner": "CONDUCTOR", "credit analyst": "ORCHESTRATOR",
  "insurance underwriter": "ARCHITECT", "loan officer": "ORCHESTRATOR", "tax examiner": "CONDUCTOR",
  "accountant": "ORCHESTRATOR", "auditor": "CONDUCTOR", "cost estimator": "ARCHITECT",
  "personal financial advisor": "ARCHITECT", "purchasing agent": "ORCHESTRATOR", "compliance officer": "CONDUCTOR",
  "software developer": "ARCHITECT", "software engineer": "ARCHITECT", "web developer": "ORCHESTRATOR",
  "database administrator": "ORCHESTRATOR", "network administrator": "ORCHESTRATOR",
  "information security analyst": "ARCHITECT", "computer systems analyst": "ARCHITECT",
  "computer programmer": "ARCHITECT", "programmer": "ARCHITECT", "computer support specialist": "CONDUCTOR",
  "data scientist": "ARCHITECT", "devops engineer": "ORCHESTRATOR", "qa analyst": "CONDUCTOR",
  "it project manager": "ORCHESTRATOR", "ux designer": "ARCHITECT", "ui designer": "ARCHITECT",
  "ux/ui designer": "ARCHITECT", "cloud architect": "ARCHITECT", "data engineer": "ORCHESTRATOR",
  "physician": "ARCHITECT", "surgeon": "ARCHITECT", "registered nurse": "CONDUCTOR", "nurse": "CONDUCTOR",
  "pharmacist": "ORCHESTRATOR", "physical therapist": "CONDUCTOR", "radiologic technologist": "ORCHESTRATOR",
  "medical lab technician": "CONDUCTOR", "respiratory therapist": "CONDUCTOR",
  "diagnostic medical sonographer": "ORCHESTRATOR", "occupational therapist": "ARCHITECT",
  "medical records specialist": "ORCHESTRATOR", "clinical laboratory scientist": "CONDUCTOR",
  "physician assistant": "ORCHESTRATOR", "nurse practitioner": "ARCHITECT",
  "health information manager": "ORCHESTRATOR",
  "elementary school teacher": "CONDUCTOR", "secondary school teacher": "ARCHITECT", "teacher": "CONDUCTOR",
  "special education teacher": "CONDUCTOR", "postsecondary teacher": "ARCHITECT", "professor": "ARCHITECT",
  "instructional coordinator": "ARCHITECT", "training specialist": "ORCHESTRATOR",
  "training and development specialist": "ORCHESTRATOR", "librarian": "ORCHESTRATOR",
  "educational administrator": "ORCHESTRATOR", "school counselor": "ARCHITECT", "tutor": "CONDUCTOR",
  "adult literacy teacher": "CONDUCTOR", "career counselor": "ARCHITECT",
  "education technology specialist": "ORCHESTRATOR",
  "lawyer": "ARCHITECT", "attorney": "ARCHITECT", "paralegal": "ORCHESTRATOR",
  "legal secretary": "ORCHESTRATOR", "court reporter": "CONDUCTOR", "judge": "ARCHITECT",
  "arbitrator": "CONDUCTOR", "title examiner": "CONDUCTOR", "legal researcher": "ORCHESTRATOR",
  "contract specialist": "ARCHITECT", "compliance attorney": "ARCHITECT", "patent agent": "ARCHITECT",
  "architect": "ARCHITECT", "civil engineer": "ARCHITECT", "mechanical engineer": "ARCHITECT",
  "electrical engineer": "ARCHITECT", "industrial engineer": "ORCHESTRATOR", "chemical engineer": "ARCHITECT",
  "environmental engineer": "ARCHITECT", "aerospace engineer": "ARCHITECT", "biomedical engineer": "ARCHITECT",
  "structural engineer": "ARCHITECT", "cad technician": "ORCHESTRATOR", "engineering technician": "CONDUCTOR",
  "surveyor": "ORCHESTRATOR", "urban planner": "ARCHITECT", "construction manager": "ORCHESTRATOR",
  "sales manager": "ORCHESTRATOR", "sales representative": "ARCHITECT", "retail salesperson": "CONDUCTOR",
  "real estate agent": "ORCHESTRATOR", "insurance sales agent": "ARCHITECT",
  "advertising sales agent": "ORCHESTRATOR", "securities sales agent": "ARCHITECT",
  "sales engineer": "ARCHITECT", "account executive": "ORCHESTRATOR",
  "business development manager": "ARCHITECT", "customer success manager": "CONDUCTOR",
  "marketing manager": "ARCHITECT", "public relations specialist": "ORCHESTRATOR",
  "social media manager": "ORCHESTRATOR", "content marketing manager": "ARCHITECT",
  "copywriter": "CONDUCTOR", "graphic designer": "ORCHESTRATOR", "brand manager": "ARCHITECT",
  "event planner": "ORCHESTRATOR", "communications director": "ARCHITECT",
  "seo specialist": "ORCHESTRATOR", "email marketing specialist": "ORCHESTRATOR",
  "production manager": "ORCHESTRATOR", "quality control inspector": "CONDUCTOR",
  "industrial production manager": "ORCHESTRATOR", "manufacturing engineer": "ARCHITECT",
  "assembly line worker": "CONDUCTOR", "cnc machinist": "ORCHESTRATOR", "welder": "CONDUCTOR",
  "maintenance technician": "ORCHESTRATOR", "production planner": "ORCHESTRATOR",
  "process engineer": "ARCHITECT", "supply chain coordinator": "ORCHESTRATOR",
  "warehouse manager": "ORCHESTRATOR",
  "customer service representative": "CONDUCTOR", "call center manager": "ORCHESTRATOR",
  "technical support specialist": "CONDUCTOR", "help desk analyst": "ORCHESTRATOR",
  "account manager": "ORCHESTRATOR", "concierge": "CONDUCTOR",
  "client relations specialist": "CONDUCTOR",
  "human resources manager": "ARCHITECT", "hr manager": "ARCHITECT", "recruiter": "ORCHESTRATOR",
  "training and development manager": "ARCHITECT", "compensation and benefits manager": "ARCHITECT",
  "hr specialist": "ORCHESTRATOR", "talent development specialist": "CONDUCTOR",
  "employee relations manager": "CONDUCTOR", "organizational development consultant": "ARCHITECT",
  "hr analytics specialist": "ARCHITECT", "payroll manager": "ORCHESTRATOR",
  "art director": "ARCHITECT", "multimedia artist": "ORCHESTRATOR", "film editor": "CONDUCTOR",
  "music director": "CONDUCTOR", "photographer": "ARCHITECT", "video producer": "ORCHESTRATOR",
  "sound engineer": "CONDUCTOR", "creative director": "ARCHITECT", "ux writer": "CONDUCTOR",
  "game designer": "ARCHITECT", "animator": "ORCHESTRATOR",
  "research scientist": "ARCHITECT", "researcher": "ARCHITECT", "chemist": "ARCHITECT",
  "biologist": "ARCHITECT", "environmental scientist": "ARCHITECT",
  "clinical research coordinator": "ORCHESTRATOR", "laboratory technician": "CONDUCTOR",
  "statistician": "ARCHITECT", "materials scientist": "ARCHITECT", "microbiologist": "ARCHITECT",
  "epidemiologist": "ARCHITECT",
  "social worker": "CONDUCTOR", "counselor": "CONDUCTOR", "community health worker": "ORCHESTRATOR",
  "case manager": "ORCHESTRATOR", "social service manager": "ARCHITECT",
  "probation officer": "ORCHESTRATOR", "mental health counselor": "CONDUCTOR",
  "substance abuse counselor": "CONDUCTOR", "youth counselor": "CONDUCTOR",
  "executive assistant": "ORCHESTRATOR", "administrative assistant": "ORCHESTRATOR",
  "office manager": "ORCHESTRATOR", "data entry clerk": "CONDUCTOR", "receptionist": "CONDUCTOR",
  "bookkeeper": "ORCHESTRATOR", "scheduler": "ORCHESTRATOR", "file clerk": "CONDUCTOR",
  "office clerk": "ORCHESTRATOR",
  "logistician": "ORCHESTRATOR", "transportation manager": "ORCHESTRATOR",
  "truck driver": "CONDUCTOR", "delivery driver": "CONDUCTOR", "airline pilot": "CONDUCTOR",
  "air traffic controller": "ORCHESTRATOR", "ship captain": "ORCHESTRATOR",
  "rail conductor": "CONDUCTOR", "dispatcher": "ORCHESTRATOR", "freight agent": "ORCHESTRATOR",
  "hotel manager": "ORCHESTRATOR", "restaurant manager": "ORCHESTRATOR", "chef": "ARCHITECT",
  "event coordinator": "ORCHESTRATOR", "sommelier": "CONDUCTOR", "catering manager": "ORCHESTRATOR",
  "food service manager": "ORCHESTRATOR",
  "real estate broker": "ARCHITECT", "property manager": "ORCHESTRATOR", "appraiser": "CONDUCTOR",
  "leasing agent": "ORCHESTRATOR", "facilities manager": "ORCHESTRATOR",
  "real estate analyst": "ARCHITECT",
  "project manager": "ORCHESTRATOR", "program manager": "ORCHESTRATOR", "product manager": "ARCHITECT",
  "scrum master": "ORCHESTRATOR", "business analyst": "ARCHITECT", "systems administrator": "ORCHESTRATOR",
  "technical writer": "CONDUCTOR", "consultant": "ARCHITECT", "analyst": "ARCHITECT",
  "coordinator": "ORCHESTRATOR", "specialist": "ORCHESTRATOR", "manager": "ORCHESTRATOR",
  "director": "ARCHITECT", "vice president": "ARCHITECT", "chief": "ARCHITECT", "cto": "ARCHITECT",
  "ceo": "ARCHITECT", "cfo": "ARCHITECT", "coo": "ORCHESTRATOR", "cio": "ARCHITECT",
};

const CARD_ARCHETYPE_MAP: Record<string, "ARCHITECT" | "ORCHESTRATOR" | "CONDUCTOR"> = {
  "card-001": "ARCHITECT",
  "card-002": "ARCHITECT",
  "card-003": "ARCHITECT",
  "card-004": "ORCHESTRATOR",
  "card-005": "ORCHESTRATOR",
  "card-006": "CONDUCTOR",
  "card-007": "CONDUCTOR",
  "card-008": "CONDUCTOR",
  "card-009": "ORCHESTRATOR",
  "card-010": "ARCHITECT",
};

const SKILL_ARCHETYPE_WEIGHTS: Record<string, { architect: number; orchestrator: number; conductor: number }> = {
  technical:     { architect: 0.50, orchestrator: 0.30, conductor: 0.20 },
  leadership:    { architect: 0.20, orchestrator: 0.55, conductor: 0.25 },
  analytical:    { architect: 0.45, orchestrator: 0.25, conductor: 0.30 },
  communication: { architect: 0.15, orchestrator: 0.35, conductor: 0.50 },
  innovation:    { architect: 0.60, orchestrator: 0.25, conductor: 0.15 },
  ai_adjacent:   { architect: 0.55, orchestrator: 0.30, conductor: 0.15 },
};

function computeArchetypeHandicap(
  resumeText: string,
  scores: Record<string, number>,
  matchedCardIds: string[]
): { architect: number; orchestrator: number; conductor: number } {
  let arch = 0, orch = 0, cond = 0;
  let totalWeight = 0;

  const lowerText = resumeText.toLowerCase();

  const titleMatches: Array<{ title: string; archetype: "ARCHITECT" | "ORCHESTRATOR" | "CONDUCTOR" }> = [];
  for (const [title, archetype] of Object.entries(JST_ARCHETYPE_MAP)) {
    if (lowerText.includes(title)) {
      titleMatches.push({ title, archetype });
    }
  }

  const titleWeight = 40;
  if (titleMatches.length > 0) {
    let tA = 0, tO = 0, tC = 0;
    for (const m of titleMatches) {
      if (m.archetype === "ARCHITECT") tA++;
      else if (m.archetype === "ORCHESTRATOR") tO++;
      else tC++;
    }
    const tTotal = tA + tO + tC;
    arch += (tA / tTotal) * titleWeight;
    orch += (tO / tTotal) * titleWeight;
    cond += (tC / tTotal) * titleWeight;
    totalWeight += titleWeight;
  }

  const skillWeight = 35;
  let sA = 0, sO = 0, sC = 0;
  let totalSkillScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    const weights = SKILL_ARCHETYPE_WEIGHTS[cat];
    if (!weights || score === 0) continue;
    sA += score * weights.architect;
    sO += score * weights.orchestrator;
    sC += score * weights.conductor;
    totalSkillScore += score;
  }
  if (totalSkillScore > 0) {
    const skillTotal = sA + sO + sC;
    arch += (sA / skillTotal) * skillWeight;
    orch += (sO / skillTotal) * skillWeight;
    cond += (sC / skillTotal) * skillWeight;
    totalWeight += skillWeight;
  }

  const cardWeight = 25;
  if (matchedCardIds.length > 0) {
    let cA = 0, cO = 0, cC = 0;
    for (const cardId of matchedCardIds) {
      const a = CARD_ARCHETYPE_MAP[cardId];
      if (a === "ARCHITECT") cA++;
      else if (a === "ORCHESTRATOR") cO++;
      else if (a === "CONDUCTOR") cC++;
    }
    const cTotal = cA + cO + cC;
    if (cTotal > 0) {
      arch += (cA / cTotal) * cardWeight;
      orch += (cO / cTotal) * cardWeight;
      cond += (cC / cTotal) * cardWeight;
      totalWeight += cardWeight;
    }
  }

  if (totalWeight === 0) {
    return { architect: 34, orchestrator: 33, conductor: 33 };
  }

  let rawArch = (arch / totalWeight) * 100;
  let rawOrch = (orch / totalWeight) * 100;
  let rawCond = (cond / totalWeight) * 100;

  rawArch = Math.max(rawArch, 1);
  rawOrch = Math.max(rawOrch, 1);
  rawCond = Math.max(rawCond, 1);

  const rawSum = rawArch + rawOrch + rawCond;
  let pArch = Math.round((rawArch / rawSum) * 100);
  let pOrch = Math.round((rawOrch / rawSum) * 100);
  let pCond = 100 - pArch - pOrch;

  if (pCond < 1) { pCond = 1; pArch = Math.round((rawArch / (rawArch + rawOrch)) * 99); pOrch = 99 - pArch; }

  return { architect: pArch, orchestrator: pOrch, conductor: pCond };
}

function determineProfile(scores: Record<string, number>): string {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top = sorted[0][0];
  if (top === "technical" || top === "ai_adjacent") return "Architect";
  if (top === "leadership") return "Orchestrator";
  if (top === "innovation") return "Architect";
  return "Conductor";
}

function generateVulnerabilityLevel(avgAutomation: number, aiScore: number, leadershipScore: number): number {
  let base = avgAutomation / 25;
  if (aiScore > 8) base -= 1.5;
  if (leadershipScore > 10) base -= 1;
  return clamp(Math.round(base), 0, 4);
}

function generateUpskilling(profile: string, scores: Record<string, number>, vulnerabilityLevel: number): Omit<InsertUpskillingPlan, "assessmentId">[] {
  const plans: Omit<InsertUpskillingPlan, "assessmentId">[] = [];

  if (scores.ai_adjacent < 5) {
    plans.push({
      phase: "30-Day",
      type: "ready-skilling",
      title: "Prompt Engineering & AI Fluency",
      description: "Build foundational competency in LLM interaction, prompt design, and AI tool integration to close the primary automation-readiness gap.",
      hours: 20,
    });
  } else {
    plans.push({
      phase: "30-Day",
      type: "ready-skilling",
      title: "Advanced AI Orchestration Patterns",
      description: "Extend existing AI proficiency with multi-agent workflows, fine-tuning strategies, and production ML pipeline management.",
      hours: 15,
    });
  }

  if (scores.technical > 10) {
    plans.push({
      phase: "90-Day",
      type: "up-skilling",
      title: "Cloud-Native Architecture Mastery",
      description: "Deepen multi-cloud expertise across AWS/Azure/GCP with focus on serverless, containerization, and infrastructure-as-code.",
      hours: 45,
    });
  } else if (scores.leadership > 8) {
    plans.push({
      phase: "90-Day",
      type: "up-skilling",
      title: "AI Strategy & Transformation Leadership",
      description: "Develop expertise in enterprise AI adoption frameworks, change management for automation transitions, and workforce transformation.",
      hours: 40,
    });
  } else {
    plans.push({
      phase: "90-Day",
      type: "up-skilling",
      title: "Data Literacy & Analytical Thinking",
      description: "Build core competency in data analysis, statistical reasoning, and dashboard creation to increase JST skills score.",
      hours: 50,
    });
  }

  if (vulnerabilityLevel <= 1) {
    plans.push({
      phase: "12-Month",
      type: "new-skilling",
      title: "AI Integration Leadership Track",
      description: "Position for AI Integration Manager or Technical Program Lead role. Focus on cross-functional AI deployment and governance.",
      hours: 120,
    });
  } else if (vulnerabilityLevel <= 3) {
    plans.push({
      phase: "12-Month",
      type: "new-skilling",
      title: "Digital Transformation Specialist",
      description: "Transition into a hybrid role combining domain expertise with digital-first methodologies and automation oversight capabilities.",
      hours: 150,
    });
  } else {
    plans.push({
      phase: "12-Month",
      type: "new-skilling",
      title: "Career Pivot: Human-AI Collaboration",
      description: "Comprehensive reskilling program to transition from high-automation-risk functions into human-centered roles augmented by AI tools.",
      hours: 200,
    });
  }

  return plans;
}

function generateAutomationMilestones(vulnerabilityLevel: number, avgAutomation: number): Array<{ year: number; event: string; automationPct: number; impact: string }> {
  const currentYear = new Date().getFullYear();

  if (vulnerabilityLevel >= 4) {
    return [
      { year: currentYear, event: "Current State", automationPct: Math.round(avgAutomation * 0.2), impact: "medium" },
      { year: currentYear + 2, event: "AI Assistants Replace Routine Tasks", automationPct: 35, impact: "high" },
      { year: currentYear + 4, event: "Process Automation Wave", automationPct: 55, impact: "critical" },
      { year: currentYear + 6, event: "Autonomous Systems Deployed", automationPct: 72, impact: "critical" },
      { year: currentYear + 9, event: "Full Workflow Automation", automationPct: 85, impact: "critical" },
      { year: currentYear + 12, event: "Role Displacement Threshold", automationPct: 92, impact: "critical" },
      { year: 2041, event: "Projected Saturation", automationPct: 95, impact: "critical" },
    ];
  }

  if (vulnerabilityLevel >= 3) {
    return [
      { year: currentYear, event: "Current State", automationPct: Math.round(avgAutomation * 0.15), impact: "low" },
      { year: currentYear + 2, event: "AI Tool Integration", automationPct: 22, impact: "medium" },
      { year: currentYear + 5, event: "Partial Task Automation", automationPct: 40, impact: "high" },
      { year: currentYear + 8, event: "Role Restructuring", automationPct: 55, impact: "high" },
      { year: currentYear + 11, event: "Hybrid Workforce Models", automationPct: 65, impact: "high" },
      { year: 2041, event: "Projected Saturation", automationPct: 72, impact: "high" },
    ];
  }

  if (vulnerabilityLevel >= 2) {
    return [
      { year: currentYear, event: "Current State", automationPct: Math.round(avgAutomation * 0.1), impact: "low" },
      { year: currentYear + 3, event: "AI Augmentation Phase", automationPct: 18, impact: "low" },
      { year: currentYear + 6, event: "Selective Task Automation", automationPct: 30, impact: "medium" },
      { year: currentYear + 10, event: "Role Evolution", automationPct: 42, impact: "medium" },
      { year: 2041, event: "Projected Plateau", automationPct: 50, impact: "medium" },
    ];
  }

  if (vulnerabilityLevel >= 1) {
    return [
      { year: currentYear, event: "Current State", automationPct: Math.round(avgAutomation * 0.08), impact: "low" },
      { year: currentYear + 4, event: "AI Co-Pilot Integration", automationPct: 12, impact: "low" },
      { year: currentYear + 8, event: "Enhanced Productivity Tools", automationPct: 22, impact: "low" },
      { year: 2041, event: "Projected Stability", automationPct: 30, impact: "low" },
    ];
  }

  return [
    { year: currentYear, event: "Current State", automationPct: 3, impact: "low" },
    { year: currentYear + 5, event: "Minimal AI Augmentation", automationPct: 8, impact: "low" },
    { year: 2041, event: "Projected Stability", automationPct: 15, impact: "low" },
  ];
}

function generatePivots(profile: string, scores: Record<string, number>): Omit<InsertPivotOpportunity, "assessmentId">[] {
  const pivots: Omit<InsertPivotOpportunity, "assessmentId">[] = [];

  if (scores.technical > 8 || scores.ai_adjacent > 4) {
    pivots.push({ role: "AI Integration Manager", feasibility: clamp(60 + scores.technical * 2 + scores.ai_adjacent * 3, 50, 95), gapCost: "$2,400", time: "6 Months" });
  }
  if (scores.analytical > 5) {
    pivots.push({ role: "Data Strategy Lead", feasibility: clamp(55 + scores.analytical * 3, 45, 90), gapCost: "$4,100", time: "9 Months" });
  }
  if (scores.leadership > 6) {
    pivots.push({ role: "Product Operations Director", feasibility: clamp(50 + scores.leadership * 2, 40, 85), gapCost: "$5,500", time: "12 Months" });
  }
  if (scores.communication > 5) {
    pivots.push({ role: "Client Success Strategist", feasibility: clamp(55 + scores.communication * 3, 45, 88), gapCost: "$3,200", time: "8 Months" });
  }
  if (scores.innovation > 4) {
    pivots.push({ role: "Innovation Program Lead", feasibility: clamp(50 + scores.innovation * 3, 40, 85), gapCost: "$4,800", time: "10 Months" });
  }

  if (pivots.length < 3) {
    pivots.push({ role: "Digital Transformation Analyst", feasibility: 62, gapCost: "$3,800", time: "9 Months" });
  }

  return pivots.sort((a, b) => b.feasibility - a.feasibility).slice(0, 3);
}

function generateVectors(scores: Record<string, number>, yearsExp: number): Omit<InsertTransferabilityVector, "assessmentId">[] {
  const techFluency = clamp(scores.technical * 5 + 30, 25, 95);
  const dataLiteracy = clamp(scores.analytical * 5 + 25, 20, 95);
  const creativeProblem = clamp(scores.innovation * 5 + 30, 25, 90);
  const commImpact = clamp(scores.communication * 5 + 25, 20, 90);
  const leadershipScal = clamp(scores.leadership * 4 + 20, 15, 90);
  const industryMobility = clamp(Math.round((techFluency + dataLiteracy) / 2) + 5, 30, 95);
  const geographicPort = clamp(techFluency - 10 + (scores.communication > 5 ? 15 : 0), 25, 90);
  const innovationTrans = clamp(creativeProblem + 5, 30, 95);
  const agilityIndex = clamp(scores.ai_adjacent * 6 + scores.technical * 3 + 20, 25, 95);
  const domainBreadth = clamp(yearsExp * 4 + 20, 20, 85);
  const executionSpeed = clamp(scores.technical * 3 + scores.analytical * 3 + 25, 25, 90);
  const strategicVision = clamp(scores.leadership * 4 + scores.innovation * 3 + 15, 20, 90);

  return [
    { subject: "Industry Mobility", score: industryMobility },
    { subject: "Geographic Port.", score: geographicPort },
    { subject: "Innovation Trans.", score: innovationTrans },
    { subject: "Leadership Scal.", score: leadershipScal },
    { subject: "Tech Fluency", score: techFluency },
    { subject: "Data Literacy", score: dataLiteracy },
    { subject: "Creative Problem", score: creativeProblem },
    { subject: "Comm. Impact", score: commImpact },
    { subject: "Agility Index", score: agilityIndex },
    { subject: "Domain Breadth", score: domainBreadth },
    { subject: "Execution Speed", score: executionSpeed },
    { subject: "Strategic Vision", score: strategicVision },
  ];
}

export function analyzeResume(resumeText: string): AnalysisResult {
  const categoryScores: Record<string, number> = {};
  let totalWeightedScore = 0;

  for (const [category, config] of Object.entries(SKILL_CATEGORIES)) {
    const rawCount = countMatches(resumeText, config.keywords);
    const weighted = Math.round(rawCount * config.weight);
    categoryScores[category] = weighted;
    totalWeightedScore += weighted;
  }

  const yearsExp = estimateYearsExperience(resumeText);
  const seniority = determineSeniority(yearsExp, categoryScores.leadership);

  const jobsRaw = (categoryScores.technical * 3 + categoryScores.ai_adjacent * 4 + yearsExp * 2);
  const skillsRaw = (categoryScores.analytical * 3 + categoryScores.innovation * 3 + categoryScores.technical * 2);
  const talentRaw = (categoryScores.leadership * 3 + categoryScores.communication * 3 + categoryScores.innovation * 2);

  const jstJobs = clamp(Math.round(jobsRaw * 0.8 + 30), 20, 100);
  const jstSkills = clamp(Math.round(skillsRaw * 0.8 + 25), 20, 100);
  const jstTalent = clamp(Math.round(talentRaw * 0.8 + 25), 20, 100);
  const jstTotal = jstJobs + jstSkills + jstTalent;

  const riskModifiers: Array<{ task: string; automatable: number }> = [];
  for (const riskTask of AUTOMATION_RISK_TASKS) {
    if (riskTask.pattern.test(resumeText)) {
      let adjustedRisk = riskTask.baseRisk;
      if (categoryScores.ai_adjacent > 6) adjustedRisk = Math.max(adjustedRisk - 15, 5);
      if (categoryScores.leadership > 8) adjustedRisk = Math.max(adjustedRisk - 10, 5);
      riskModifiers.push({ task: riskTask.task, automatable: adjustedRisk });
    }
  }

  if (riskModifiers.length === 0) {
    riskModifiers.push(
      { task: "General Task Execution", automatable: 45 },
      { task: "Domain-Specific Analysis", automatable: 30 },
    );
  }

  const riskSlice = riskModifiers.sort((a, b) => b.automatable - a.automatable).slice(0, 5);
  const avgAutomation = riskSlice.reduce((s, r) => s + r.automatable, 0) / riskSlice.length;

  const vulnerabilityLevel = generateVulnerabilityLevel(avgAutomation, categoryScores.ai_adjacent, categoryScores.leadership);
  const matchedCardIds = pickMatchedCards(categoryScores);

  const archetypeHandicap = computeArchetypeHandicap(resumeText, categoryScores, matchedCardIds);

  let readinessProfile: string;
  if (archetypeHandicap.architect >= archetypeHandicap.orchestrator && archetypeHandicap.architect >= archetypeHandicap.conductor) {
    readinessProfile = "Architect";
  } else if (archetypeHandicap.orchestrator >= archetypeHandicap.conductor) {
    readinessProfile = "Orchestrator";
  } else {
    readinessProfile = "Conductor";
  }

  const automationMilestones = generateAutomationMilestones(vulnerabilityLevel, avgAutomation);
  const upskillingPlans = generateUpskilling(readinessProfile, categoryScores, vulnerabilityLevel);
  const pivotOpportunities = generatePivots(readinessProfile, categoryScores);
  const transferabilityVectors = generateVectors(categoryScores, yearsExp);

  return {
    assessment: {
      jstTotal,
      jstJobs,
      jstSkills,
      jstTalent,
      vulnerabilityLevel,
      readinessProfile,
      riskModifiers: riskSlice,
      matchedCardIds,
      archetypeArchitect: archetypeHandicap.architect,
      archetypeOrchestrator: archetypeHandicap.orchestrator,
      archetypeConductor: archetypeHandicap.conductor,
      automationMilestones,
    },
    upskillingPlans,
    pivotOpportunities,
    transferabilityVectors,
  };
}