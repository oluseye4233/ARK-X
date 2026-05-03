/**
 * PDD §3.4 — LHCS (Life-Career Health Signal) computation.
 *
 * Three sub-signals, 0-100 each:
 *   CPR  (Career Pivot Readiness)        — derived from transferability vectors + pivot feasibility
 *   MPS  (Marketplace Performance Score) — derived from SPC sales / purchases / publishing
 *   LCIS (Learning Cycle Intensity)      — derived from CCGE sessions + cert upgrades over 30 days
 *
 * Each becomes a green/amber/red light at 70 / 40 thresholds (per-component).
 *
 * Composite readiness % follows PDD §3.4 — a WEIGHTED blend, not an average:
 *   readiness = round(0.35·CPR + 0.35·MPS + 0.30·LCIS)
 * Aggregate status is the categorical bucket of that composite (green ≥70,
 * amber 40-69, red <40), NOT a roll-up of the three lights. This matches the
 * PDD MVP-011 status semantics (BASELINE / DEVELOPING / ACTIVE).
 */
import {
  lhcsLight,
  lhcsReadiness,
  lhcsStatusFromReadiness,
  type LhcsLight,
  type LhcsStatus,
} from "@shared/schema";
import { storage } from "./storage";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

export type LhcsBundle = {
  cprScore: number;
  mpsScore: number;
  lcisScore: number;
  cprLight: LhcsLight;
  mpsLight: LhcsLight;
  lcisLight: LhcsLight;
  status: LhcsStatus;
  readinessPct: number;
};

export async function computeLhcsForUser(userId: string): Promise<LhcsBundle> {
  // CPR: average of transferability vectors from latest assessment, blended with pivot feasibility max.
  let cprScore = 0;
  try {
    const a = await storage.getLatestAssessment(userId);
    if (a) {
      const vectors = await storage.getVectorsByAssessment(a.id);
      const pivots = await storage.getPivotsByAssessment(a.id);
      const vAvg = vectors.length ? vectors.reduce((s, v) => s + (v.score ?? 0), 0) / vectors.length : 0;
      const pMax = pivots.length ? Math.max(...pivots.map((p) => p.feasibility ?? 0)) : 0;
      // 60% vector breadth, 40% best-pivot feasibility.
      cprScore = clamp(vAvg * 0.6 + pMax * 0.4);
    }
  } catch {
    cprScore = 0;
  }

  // MPS: sales count + first-sale bonus + active-listing presence + buyer activity.
  let mpsScore = 0;
  try {
    const sales = await storage.getSpcPurchasesByCreator(userId).catch(() => []);
    const listings = await storage.getSpcListingsByCreator(userId).catch(() => []);
    const purchases = await storage.getSpcPurchasesByBuyer(userId).catch(() => []);
    const activeListings = listings.filter((l) => l.status === "active").length;
    const salesPts = Math.min(50, sales.length * 10);
    const firstSale = sales.length > 0 ? 15 : 0;
    const listingPts = Math.min(20, activeListings * 5);
    const buyerPts = Math.min(15, purchases.length * 3);
    mpsScore = clamp(salesPts + firstSale + listingPts + buyerPts);
  } catch {
    mpsScore = 0;
  }

  // LCIS: CCGE sessions in last 30 days + cert level rank.
  let lcisScore = 0;
  try {
    const sessions = await storage.getGameSessionsByUser(userId).catch(() => []);
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = sessions.filter((s) => {
      const t = s.finishedAt ? new Date(s.finishedAt).getTime() : 0;
      return t >= since && s.status === "finished";
    });
    const sessionPts = Math.min(60, recent.length * 12);
    const u = await storage.getUser(userId);
    const certPts = u?.contextCraftCertLevel && u.contextCraftCertLevel !== "NONE" ? 30 : 10;
    const avgKcse = recent.length
      ? recent.reduce((sum, x) => sum + (x.kcseScore ?? 0), 0) / recent.length
      : 0;
    const qualityPts = Math.min(10, Math.round(avgKcse / 10));
    lcisScore = clamp(sessionPts + certPts + qualityPts);
  } catch {
    lcisScore = 0;
  }

  const cprLight = lhcsLight(cprScore);
  const mpsLight = lhcsLight(mpsScore);
  const lcisLight = lhcsLight(lcisScore);
  // PDD §3.4 — weighted composite, threshold-categorical status.
  const readinessPct = lhcsReadiness(cprScore, mpsScore, lcisScore);
  const status = lhcsStatusFromReadiness(readinessPct);

  return { cprScore, mpsScore, lcisScore, cprLight, mpsLight, lcisLight, status, readinessPct };
}
