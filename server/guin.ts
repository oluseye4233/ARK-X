import { storage } from "./storage";
import {
  computeKnightRank,
  CERT_LEVEL_RANK,
  type ContextCraftLevel,
  type GameSession,
} from "@shared/schema";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function buildGuinProfile(userId: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const { password: _pw, ...safeUser } = user as any;

  const allSessions = await storage.getGameSessionsByUser(userId);
  const finished = allSessions.filter(
    (s) => s.status === "finished" && typeof s.kcseScore === "number"
  );
  const totalKcseEarned = finished.reduce((sum, s) => sum + (s.kcseScore || 0), 0);
  const knight = computeKnightRank(totalKcseEarned);

  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const recent = finished.filter((s) => {
    const t = s.finishedAt ? new Date(s.finishedAt).getTime() : 0;
    return t >= cutoff;
  });

  const radarAxes = ["knowledge", "clarity", "specificity", "efficiency"] as const;
  const radarTotals: Record<string, { sum: number; n: number }> = {
    knowledge: { sum: 0, n: 0 },
    clarity: { sum: 0, n: 0 },
    specificity: { sum: 0, n: 0 },
    efficiency: { sum: 0, n: 0 },
  };
  for (const s of recent) {
    const b = s.kcseBreakdown;
    if (!b) continue;
    for (const axis of radarAxes) {
      const v = (b as any)[axis];
      if (typeof v === "number") {
        radarTotals[axis].sum += v;
        radarTotals[axis].n += 1;
      }
    }
  }
  const kcseRadar = radarAxes.map((axis) => {
    const t = radarTotals[axis];
    return {
      axis: axis.charAt(0).toUpperCase() + axis.slice(1),
      value: t.n ? Math.round((t.sum / t.n) * 100) / 100 : 0,
    };
  });

  // Owned cards = ccgeCards used in finished sessions that earned a cert tier (won)
  const ownedIds = new Set<string>();
  for (const s of finished) {
    if (!s.certTierEarned) continue;
    for (const cid of s.played || []) ownedIds.add(cid);
  }
  const allCcgeCards = await storage.getAllCcgeCards();
  const ownedCards = allCcgeCards.filter((c) => ownedIds.has(c.id));

  // Published SPCs (active only)
  const allSpcs = await storage.getSpcListingsByCreator(userId);
  const publishedSpcs = allSpcs
    .filter((l) => l.status === "active")
    .map((l) => ({
      id: l.id,
      title: l.title,
      pillar: l.pillar,
      priceCredits: l.priceCredits,
      kcseScore: l.kcseScore,
      hiveScore: l.hiveScore,
      salesCount: l.salesCount,
    }));

  // Endorsements with endorser metadata
  const endorsementRows = await storage.getEndorsementsForUser(userId);
  const endorsementsEnriched = await Promise.all(
    endorsementRows.map(async (e) => {
      const endorser = await storage.getUser(e.endorserId);
      return {
        id: e.id,
        message: e.message,
        createdAt: e.createdAt,
        sessionId: e.sessionId,
        endorser: endorser
          ? {
              id: endorser.id,
              name: endorser.name,
              username: endorser.username,
              contextCraftCertLevel: endorser.contextCraftCertLevel,
            }
          : null,
      };
    })
  );

  // Recent finished sessions (lightweight)
  const sessionsLite = finished
    .slice(0, 20)
    .map((s) => ({
      id: s.id,
      scenarioId: s.scenarioId,
      kcseScore: s.kcseScore,
      certTierEarned: s.certTierEarned,
      finishedAt: s.finishedAt,
    }));

  return {
    user: {
      id: safeUser.id,
      username: safeUser.username,
      name: safeUser.name,
      role: safeUser.role,
      department: safeUser.department,
      seniority: safeUser.seniority,
      location: safeUser.location,
      contextCraftCertLevel: safeUser.contextCraftCertLevel,
      institution: safeUser.institution,
    },
    knight,
    stats: {
      totalKcseEarned: Math.round(totalKcseEarned * 100) / 100,
      sessionsFinished: finished.length,
      sessionsWon: finished.filter((s) => !!s.certTierEarned).length,
      ownedCardsCount: ownedCards.length,
      publishedSpcsCount: publishedSpcs.length,
      endorsementsCount: endorsementsEnriched.length,
    },
    kcseRadar,
    ownedCards,
    publishedSpcs,
    endorsements: endorsementsEnriched,
    recentSessions: sessionsLite,
  };
}

export type EndorsementGateResult =
  | { ok: true; session: GameSession }
  | { ok: false; status: number; message: string };

export async function validateEndorsement(input: {
  endorserId: string;
  recipientId: string;
  sessionId: string;
}): Promise<EndorsementGateResult> {
  if (input.endorserId === input.recipientId) {
    return { ok: false, status: 400, message: "You cannot endorse yourself." };
  }
  const endorser = await storage.getUser(input.endorserId);
  const recipient = await storage.getUser(input.recipientId);
  if (!endorser || !recipient) {
    return { ok: false, status: 404, message: "User not found." };
  }
  const eRank = CERT_LEVEL_RANK[(endorser.contextCraftCertLevel || "NONE") as ContextCraftLevel];
  const rRank = CERT_LEVEL_RANK[(recipient.contextCraftCertLevel || "NONE") as ContextCraftLevel];
  if (eRank < rRank) {
    return {
      ok: false,
      status: 403,
      message: "Endorser must hold a cert tier equal to or higher than the recipient.",
    };
  }
  const session = await storage.getGameSession(input.sessionId);
  if (!session) {
    return { ok: false, status: 404, message: "Evidence session not found." };
  }
  if (session.userId !== input.endorserId) {
    return {
      ok: false,
      status: 403,
      message: "Evidence session must belong to the endorser.",
    };
  }
  if (session.status !== "finished" || typeof session.kcseScore !== "number") {
    return {
      ok: false,
      status: 400,
      message: "Evidence session must be a finished, KCSE-scored session.",
    };
  }
  const existing = await storage.getEndorsementBetween(input.endorserId, input.recipientId);
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "You have already endorsed this user.",
    };
  }
  return { ok: true, session };
}
