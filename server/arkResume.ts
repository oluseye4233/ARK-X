// ─────────────────────────────────────────────────────────────────────────
// ARK RESUME (Task #59)
// Aggregates the outward-facing, ATS-optimized resume artifact: the lifted
// static resume (contact, links, multi-company work history, education, certs)
// fused with the "living" verified layer (CODEC primitives verified Bronze→
// Platinum) and the third-party confirmation layer.
//
// Eligibility: subscriber must be Pro+ (plan grants reportAccess) AND hold at
// least one Primitive Card verified at SILVER or higher. Verified cards are
// surfaced BOTH as a global "Verified Skills & Roles" deck AND best-effort
// AI-mapped to the most relevant company in their work history.
// ─────────────────────────────────────────────────────────────────────────
import { storage } from "./storage";
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
  type WorkHistoryEntry,
  type CardVerification,
  type SkillConfirmation,
  type User,
  type Assessment,
} from "@shared/schema";
import { CODEC_BY_ID, type CodecPrimitive } from "@shared/codec-primitives";
import { getAnthropic, isClaudeAvailable, MODELS } from "./ai/client";

const SILVER_PLUS = new Set(["Silver", "Gold", "Platinum"]);

export interface ResumeEligibility {
  eligible: boolean;
  isPro: boolean;
  hasSilverVerification: boolean;
  silverPlusCount: number;
  reason: string | null;
}

// Pro+ = the same gate as ARK REPORT (plan limits.reportAccess). Silver gate =
// at least one card verified at Silver/Gold/Platinum.
export function checkResumeEligibility(
  user: Pick<User, "subscriptionPlan">,
  verifications: CardVerification[],
): ResumeEligibility {
  const plan = (user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
  const planData = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.INDIVIDUAL_FREE;
  const isPro = planData.limits.reportAccess === true;
  const silverPlus = verifications.filter((v) => v.tier && SILVER_PLUS.has(v.tier));
  const hasSilverVerification = silverPlus.length > 0;
  const eligible = isPro && hasSilverVerification;
  let reason: string | null = null;
  if (!isPro) {
    reason = "ARK RESUME requires a Pro, School, or Enterprise subscription.";
  } else if (!hasSilverVerification) {
    reason =
      "ARK RESUME unlocks once you verify at least one Primitive Card at Silver tier or higher.";
  }
  return { eligible, isPro, hasSilverVerification, silverPlusCount: silverPlus.length, reason };
}

export interface AtsBreakdownItem {
  label: string;
  points: number;
  max: number;
  detail: string;
}
export interface AtsScore {
  score: number;
  band: "Excellent" | "Strong" | "Fair" | "Needs Work";
  items: AtsBreakdownItem[];
}

const METRIC_RE = /(\d+\s?%|\$\s?\d|\d[\d,]{2,}|\b\d+(?:\.\d+)?\s?(?:x|k|m|bn|million|billion|users|customers|clients|projects|people|reports|teams|years)\b)/i;

function bandFor(score: number): AtsScore["band"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Fair";
  return "Needs Work";
}

// Deterministic ATS rubric (0-100). Mirrors what real ATS parsers reward:
// machine-readable contact block, structured multi-role history, quantified
// achievements, education + certifications, and recognized skill keywords
// (here, matched + verified CODEC primitives).
export function computeAtsScore(input: {
  assessment: Assessment;
  verifiedCount: number;
}): AtsScore {
  const a = input.assessment;
  const items: AtsBreakdownItem[] = [];

  // Contact block (20)
  let contactPts = 0;
  if (a.contactEmail) contactPts += 10;
  if (a.contactPhone) contactPts += 5;
  if (a.linkLinkedin || a.linkGithub || a.linkPortfolio) contactPts += 5;
  items.push({
    label: "Contact & Links",
    points: contactPts,
    max: 20,
    detail: "Machine-readable email, phone, and at least one professional link.",
  });

  // Work history structure (25)
  const wh = (a.workHistory ?? []) as WorkHistoryEntry[];
  let whPts = 0;
  if (wh.length >= 1) whPts += 10;
  if (wh.length >= 2) whPts += 5;
  const withHighlights = wh.filter((e) => (e.highlights ?? []).length > 0).length;
  whPts += Math.min(10, withHighlights * 3);
  items.push({
    label: "Work History Structure",
    points: whPts,
    max: 25,
    detail: `${wh.length} role(s) parsed; ${withHighlights} with achievement bullets.`,
  });

  // Quantified achievements (15)
  const allHighlights = wh.flatMap((e) => e.highlights ?? []);
  const quantified = allHighlights.filter((h) => METRIC_RE.test(h)).length;
  const quantPts = allHighlights.length
    ? Math.min(15, Math.round((quantified / allHighlights.length) * 15))
    : 0;
  items.push({
    label: "Quantified Impact",
    points: quantPts,
    max: 15,
    detail: `${quantified} of ${allHighlights.length} bullets carry measurable metrics.`,
  });

  // Education (10)
  const eduPts = (a.academicQuals ?? []).length ? 10 : 0;
  items.push({
    label: "Education",
    points: eduPts,
    max: 10,
    detail: `${(a.academicQuals ?? []).length} academic qualification(s).`,
  });

  // Certifications (10)
  const certPts = (a.professionalQuals ?? []).length ? 10 : 0;
  items.push({
    label: "Certifications",
    points: certPts,
    max: 10,
    detail: `${(a.professionalQuals ?? []).length} professional qualification(s).`,
  });

  // Recognized skill keywords — matched CODEC primitives (10)
  const matched = (a.matchedCardIds ?? []).length;
  const kwPts = Math.min(10, matched * 2);
  items.push({
    label: "Skill Keyword Coverage",
    points: kwPts,
    max: 10,
    detail: `${matched} skill primitive(s) detected against global standards.`,
  });

  // Verified skill layer (10)
  const verPts = Math.min(10, input.verifiedCount * 5);
  items.push({
    label: "Verified Skill Layer",
    points: verPts,
    max: 10,
    detail: `${input.verifiedCount} primitive(s) independently verified.`,
  });

  const score = Math.min(100, items.reduce((s, i) => s + i.points, 0));
  return { score, band: bandFor(score), items };
}

export interface VerifiedCard {
  cardId: string;
  name: string;
  emoji: string;
  category: string;
  persona: string;
  tier: string | null;
  score: number;
  status: string;
  mappings: CodecPrimitive["mappings"];
}

// Build the global verified deck from verification rows (Silver+ shown first,
// then any other verified/attempted with a tier). Only includes cards that
// resolve to a known CODEC primitive.
export function buildVerifiedDeck(verifications: CardVerification[]): VerifiedCard[] {
  const tierRank: Record<string, number> = { Platinum: 4, Gold: 3, Silver: 2, Bronze: 1 };
  return verifications
    .filter((v) => v.tier)
    .map((v) => {
      const p = CODEC_BY_ID[v.cardId];
      if (!p) return null;
      return {
        cardId: v.cardId,
        name: p.name,
        emoji: p.emoji,
        category: p.category,
        persona: p.persona,
        tier: v.tier,
        score: v.score,
        status: v.status,
        mappings: p.mappings,
      } as VerifiedCard;
    })
    .filter((x): x is VerifiedCard => x !== null)
    .sort((a, b) => (tierRank[b.tier ?? ""] ?? 0) - (tierRank[a.tier ?? ""] ?? 0));
}

// Deterministic card→company mapping: score each card's match keywords against
// the company's text blob (company + role + highlights). Returns, per company
// index, the ids of cards whose keywords hit. This is the reliable fallback the
// AI helper refines.
export function keywordMapCardsToCompanies(
  workHistory: WorkHistoryEntry[],
  cardIds: string[],
): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  workHistory.forEach((entry, idx) => {
    const blob = [
      entry.company,
      entry.role ?? "",
      ...(entry.highlights ?? []),
    ]
      .join(" ")
      .toLowerCase();
    const hits: string[] = [];
    for (const id of cardIds) {
      const p = CODEC_BY_ID[id];
      if (!p) continue;
      const matched = p.matchKeywords.some((kw) => blob.includes(kw.toLowerCase()));
      if (matched) hits.push(id);
    }
    out[idx] = hits.slice(0, 4);
  });
  return out;
}

// Best-effort AI mapping. Asks Claude (Haiku) to assign each verified card to
// the single most relevant company. Falls back to keyword mapping on any error
// or when Claude is unavailable. Never throws.
export async function aiMapCardsToCompanies(
  workHistory: WorkHistoryEntry[],
  cards: VerifiedCard[],
): Promise<Record<number, string[]>> {
  const fallback = keywordMapCardsToCompanies(
    workHistory,
    cards.map((c) => c.cardId),
  );
  if (!isClaudeAvailable() || workHistory.length === 0 || cards.length === 0) {
    return fallback;
  }
  try {
    const client = getAnthropic();
    const companies = workHistory.map((e, i) => ({
      index: i,
      company: e.company,
      role: e.role ?? "",
      highlights: (e.highlights ?? []).slice(0, 4),
    }));
    const cardList = cards.map((c) => ({
      id: c.cardId,
      name: c.name,
      persona: c.persona,
      skills: [...c.mappings.onet, ...c.mappings.wef].slice(0, 6),
    }));
    const prompt = `You map verified skill cards to the work experience where each skill was most clearly demonstrated. Return ONLY a JSON object mapping each company index (as a string key) to an array of card ids best evidenced by that role. Assign each card to AT MOST one company; omit cards with no good fit. Do not invent ids.

COMPANIES:
${JSON.stringify(companies)}

CARDS:
${JSON.stringify(cardList)}

Respond with JSON like {"0":["codec-elephant"],"1":["codec-platform"]}.`;
    const resp = await client.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 700,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const block = resp.content.find((b: any) => b.type === "text") as { text?: string } | undefined;
    const raw = block?.text ?? "";
    const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    if (!jsonStr) return fallback;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const validIds = new Set(cards.map((c) => c.cardId));
    const result: Record<number, string[]> = {};
    workHistory.forEach((_, i) => {
      const v = parsed[String(i)];
      result[i] = Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && validIds.has(x)).slice(0, 4)
        : [];
    });
    // If the model returned nothing useful, prefer the deterministic mapping.
    const anyMapped = Object.values(result).some((arr) => arr.length > 0);
    return anyMapped ? result : fallback;
  } catch (err) {
    console.error("[arkResume] AI card→company mapping failed, using keywords:", err);
    return fallback;
  }
}

export interface ResumeWorkEntry extends WorkHistoryEntry {
  mappedCards: VerifiedCard[];
  confirmation: SkillConfirmation | null;
}

export interface ArkResumePayload {
  user: {
    id: string;
    name: string;
    headshotDataUrl: string | null;
    arkScore: number;
    jstIndex: number;
    arkIdString: string | null;
    typology: string | null;
  };
  identity: {
    candidateName: string | null;
    currentRole: string | null;
    currentEmployer: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    linkLinkedin: string | null;
    linkGithub: string | null;
    linkPortfolio: string | null;
    location: string | null;
  };
  jst: { total: number; jobs: number; skills: number; talent: number };
  workHistory: ResumeWorkEntry[];
  education: string[];
  certifications: string[];
  verifiedDeck: VerifiedCard[];
  confirmations: SkillConfirmation[];
  ats: AtsScore;
  eligibility: ResumeEligibility;
}

// Full aggregation. Caller is responsible for the eligibility gate (this also
// returns eligibility so the client can render the locked state). When the user
// has no assessment yet, returns a minimal payload with eligibility info.
export async function buildArkResume(userId: string): Promise<ArkResumePayload | null> {
  const [user, assessment, verifications, confirmations] = await Promise.all([
    storage.getUser(userId),
    storage.getLatestAssessment(userId),
    storage.getCardVerifications(userId),
    storage.getSkillConfirmations(userId),
  ]);
  if (!user) return null;

  const eligibility = checkResumeEligibility(user, verifications);
  const verifiedDeck = buildVerifiedDeck(verifications);

  const a: Assessment | undefined = assessment;
  const workHistoryRaw = ((a?.workHistory ?? []) as WorkHistoryEntry[]) || [];

  // Map verified cards to companies (best-effort AI, keyword fallback).
  const mapping = await aiMapCardsToCompanies(workHistoryRaw, verifiedDeck);
  const deckById = new Map(verifiedDeck.map((c) => [c.cardId, c]));

  // Index confirmations by (type:targetRef) for quick attach.
  const confByKey = new Map<string, SkillConfirmation>();
  for (const c of confirmations) confByKey.set(`${c.type}:${c.targetRef.toLowerCase()}`, c);

  const workHistory: ResumeWorkEntry[] = workHistoryRaw.map((entry, idx) => ({
    ...entry,
    mappedCards: (mapping[idx] ?? [])
      .map((id) => deckById.get(id))
      .filter((x): x is VerifiedCard => !!x),
    confirmation: confByKey.get(`EMPLOYMENT:${entry.company.toLowerCase()}`) ?? null,
  }));

  const ats = a
    ? computeAtsScore({ assessment: a, verifiedCount: verifiedDeck.length })
    : { score: 0, band: "Needs Work" as const, items: [] };

  return {
    user: {
      id: user.id,
      name: user.name,
      headshotDataUrl: user.headshotDataUrl ?? null,
      arkScore: user.arkScore,
      jstIndex: user.jstIndex,
      arkIdString: user.arkIdString ?? null,
      typology: user.typology ?? null,
    },
    identity: {
      candidateName: a?.candidateName ?? user.name,
      currentRole: a?.currentRole ?? user.role ?? null,
      currentEmployer: a?.currentEmployer ?? null,
      contactEmail: a?.contactEmail ?? null,
      contactPhone: a?.contactPhone ?? null,
      linkLinkedin: a?.linkLinkedin ?? null,
      linkGithub: a?.linkGithub ?? null,
      linkPortfolio: a?.linkPortfolio ?? null,
      location: user.location ?? null,
    },
    jst: {
      total: a?.jstTotal ?? user.jstIndex ?? 0,
      jobs: a?.jstJobs ?? 0,
      skills: a?.jstSkills ?? 0,
      talent: a?.jstTalent ?? 0,
    },
    workHistory,
    education: a?.academicQuals ?? [],
    certifications: a?.professionalQuals ?? [],
    verifiedDeck,
    confirmations,
    ats,
    eligibility,
  };
}
