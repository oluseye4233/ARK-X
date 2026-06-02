/**
 * Training-provider ranking engine.
 *
 * Pure functions that rank training courses against the JST engine's suggested
 * upskilling path for a user. The signal comes straight from a user's latest
 * assessment — the upskilling plans, pivot opportunities, transferability
 * vectors, and vulnerability level the analyzer already produced — so the
 * ranking is the "independent finding of the JST index", not a self-reported
 * preference.
 *
 * `matchScore` (0-100) is the pure JST alignment. `finalScore` layers the
 * monetized sponsored boost on top for ordering only — sponsorship never
 * changes the displayed match quality, it only re-orders ties/near-ties so the
 * boost is honest and visible (the UI shows a "Sponsored" badge).
 */
import {
  TRAINING_CATEGORIES,
  TRAINING_CATEGORY_LABELS,
  type TrainingCategory,
  type TrainingCourse,
  type TrainingProvider,
} from "@shared/schema";

export interface PathSignals {
  upskilling: { phase?: string | null; type?: string | null; title: string; description?: string | null }[];
  pivots: { role: string }[];
  vectors: { subject: string; score: number }[];
  vulnerabilityLevel: number;
}

export interface MatchableCourse {
  course: TrainingCourse;
  provider: TrainingProvider;
}

export interface RankedTrainingResult {
  course: TrainingCourse;
  provider: TrainingProvider;
  /** Pure JST alignment, 0-100. */
  matchScore: number;
  /** matchScore + sponsored boost; used only for ordering. */
  finalScore: number;
  sponsored: boolean;
  reasons: string[];
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "your", "you", "into", "from", "this", "that",
  "are", "was", "will", "have", "has", "can", "to", "of", "in", "on", "a", "an",
  "or", "as", "at", "by", "be", "is", "it", "via", "per", "new", "day", "days",
  "month", "months", "year", "skill", "skills", "learn", "build", "develop",
]);

const CATEGORY_KEYWORDS: Record<TrainingCategory, string[]> = {
  technical: ["technical", "engineering", "software", "cloud", "programming", "developer", "architecture", "systems", "cyber", "devops", "infrastructure", "coding"],
  leadership: ["leadership", "management", "manager", "strategy", "executive", "team", "stakeholder", "people", "coaching", "delegation"],
  analytical: ["analytical", "analytics", "analysis", "data", "research", "statistics", "insight", "reporting", "metrics", "modeling"],
  communication: ["communication", "writing", "presentation", "storytelling", "negotiation", "facilitation", "influence", "narrative"],
  innovation: ["innovation", "design", "creative", "product", "entrepreneur", "ideation", "transformation", "discovery"],
  ai_adjacent: ["ai", "artificial", "intelligence", "machine", "learning", "prompt", "automation", "genai", "llm", "science"],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Derive the per-category priority (0..1-ish, un-normalized) the user's path
 * implies. Higher = the JST path points harder at that capability.
 */
function categoryPriorities(signals: PathSignals): Record<TrainingCategory, number> {
  // Token set (not substring) so short keywords like "ai" don't false-match
  // words such as "training"/"maintain"/"available". Keep length>=2 here (unlike
  // the >2 course tokenizer) precisely so the standalone "ai" token survives.
  const needsTokens = new Set(
    [
      ...signals.upskilling.map((u) => `${u.title} ${u.description ?? ""}`),
      ...signals.pivots.map((p) => p.role),
      // Weak transferability vectors (low score) are gaps worth training.
      ...signals.vectors.filter((v) => v.score < 55).map((v) => v.subject),
    ]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
  );

  const out = {} as Record<TrainingCategory, number>;
  for (const cat of TRAINING_CATEGORIES) {
    let hits = 0;
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (needsTokens.has(kw)) hits += 1;
    }
    out[cat] = hits;
  }
  // Automation exposure pushes toward future-proof capability.
  if (signals.vulnerabilityLevel >= 3) {
    out.ai_adjacent += 3;
    out.technical += 1;
  } else if (signals.vulnerabilityLevel >= 2) {
    out.ai_adjacent += 1;
  }
  return out;
}

/**
 * Rank a set of courses against a user's JST-derived path. Returns every course
 * scored and sorted by `finalScore` (match + sponsored boost) descending.
 */
export function rankTrainingCourses(
  signals: PathSignals,
  courses: MatchableCourse[],
): RankedTrainingResult[] {
  const priorities = categoryPriorities(signals);
  const maxPriority = Math.max(1, ...Object.values(priorities));

  // Per-upskilling-goal token sets, so we can name the specific goal a course hits.
  const goals = signals.upskilling.map((u) => ({
    label: u.phase ? `${u.phase} goal: ${u.title}` : u.title,
    tokens: new Set(tokenize(`${u.title} ${u.description ?? ""}`)),
  }));
  const pivotGoals = signals.pivots.map((p) => ({
    role: p.role,
    tokens: new Set(tokenize(p.role)),
  }));

  const results: RankedTrainingResult[] = courses.map(({ course, provider }) => {
    const courseTokens = tokenize(`${course.title} ${(course.skills ?? []).join(" ")} ${course.description ?? ""}`);
    const courseSet = new Set(courseTokens);
    const reasons: string[] = [];

    // 1) Direct overlap with named upskilling goals (strongest signal).
    let goalOverlap = 0;
    for (const g of goals) {
      const shared = Array.from(g.tokens).filter((t) => courseSet.has(t)).length;
      if (shared >= 1) {
        goalOverlap += shared;
        if (reasons.length < 3) reasons.push(`Aligns with your ${g.label}`);
      }
    }
    const goalScore = Math.min(45, goalOverlap * 9);

    // 2) Overlap with pivot-opportunity role language.
    let pivotOverlap = 0;
    for (const p of pivotGoals) {
      const shared = Array.from(p.tokens).filter((t) => courseSet.has(t)).length;
      if (shared >= 1) {
        pivotOverlap += shared;
        if (reasons.length < 3) reasons.push(`Supports your pivot toward ${p.role}`);
      }
    }
    const pivotScore = Math.min(20, pivotOverlap * 6);

    // 3) Category alignment with the path's priority capabilities.
    const cat = (TRAINING_CATEGORIES as readonly string[]).includes(course.category)
      ? (course.category as TrainingCategory)
      : "technical";
    const catScore = Math.round((priorities[cat] / maxPriority) * 25);
    if (catScore >= 13 && reasons.length < 3) {
      reasons.push(`Builds ${TRAINING_CATEGORY_LABELS[cat]} capability flagged in your pathway`);
    }

    // 4) Future-proofing for high automation exposure.
    let vulnScore = 0;
    if (signals.vulnerabilityLevel >= 3 && (cat === "ai_adjacent" || cat === "technical")) {
      vulnScore = 8;
      if (reasons.length < 3) {
        reasons.push(`Future-proofs against your automation exposure (Level ${signals.vulnerabilityLevel})`);
      }
    }

    // Base relevance so the directory still ranks sensibly when signals are thin.
    const base = 8;
    const matchScore = Math.max(0, Math.min(100, base + goalScore + pivotScore + catScore + vulnScore));

    if (reasons.length === 0) {
      reasons.push(`Relevant ${TRAINING_CATEGORY_LABELS[cat]} certification for your profile`);
    }

    // Sponsored boost is additive and capped — ordering only, never matchScore.
    const sponsoredBoost = provider.sponsored ? Math.min(30, Math.round(provider.sponsoredWeight * 0.3)) : 0;
    const finalScore = matchScore + sponsoredBoost;

    return { course, provider, matchScore, finalScore, sponsored: provider.sponsored, reasons };
  });

  results.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (a.sponsored !== b.sponsored) return a.sponsored ? -1 : 1;
    return b.matchScore - a.matchScore;
  });

  return results;
}
