/**
 * Phase M4 — SPHINX × Matrix Synthesis Engine.
 *
 * createSession: validates 2+ source listings, locks current prices,
 *   computes proportional royalty split (70% creator pool / 30% platform),
 *   runs ZPOS over concatenated bodies, persists a preview session.
 *
 * finalizeSession: single DB transaction —
 *   1. Lock session row, re-check buyer + status === preview.
 *   2. Lock buyer credit row, verify balance ≥ totalCreditPrice.
 *   3. Lock each unique creator credit row in deterministic id-sorted order.
 *   4. Debit buyer, credit each creator their floored share, sweep rounding
 *      remainder to the platform 30%.
 *   5. Insert one synthesis_creators_split row per source listing.
 *   6. Mark session finalized, set finalizedAt.
 *
 * Royalty correctness invariant (asserted in test):
 *   sum(creditedAmount over all source listings) + platformShare === totalCreditPrice.
 */
import { db } from "./db";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  spcListings,
  userCredits,
  synthesisSessions,
  synthesisCreatorsSplit,
  platformCreditLedger,
  SPC_CREATOR_SHARE_PCT,
  SPC_STARTING_CREDITS,
  type SynthesisSession,
  type SynthesisSplitPreview,
  type ZposMethod,
} from "@shared/schema";
import { compress } from "./zpos";

export class SynthesisError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Compute the per-creator royalty split from locked source prices.
 *  Pure + side-effect free for unit testing. Floor-rounding remainder
 *  sweeps to the platform — never leaks. */
export function computeRoyaltySplit(
  lockedPrices: { listingId: string; creatorId: string; priceCredits: number }[],
  totalCreditPrice: number,
): { splits: SynthesisSplitPreview[]; platformShare: number } {
  const creatorPool = Math.floor((totalCreditPrice * SPC_CREATOR_SHARE_PCT) / 100);
  const weightSum = lockedPrices.reduce((s, p) => s + p.priceCredits, 0);
  let allocated = 0;
  const splits: SynthesisSplitPreview[] = lockedPrices.map((p) => {
    const weight = weightSum > 0 ? p.priceCredits / weightSum : 1 / lockedPrices.length;
    const credited = Math.floor((creatorPool * p.priceCredits) / Math.max(1, weightSum));
    allocated += credited;
    return {
      creatorId: p.creatorId,
      sourceListingId: p.listingId,
      sourcePriceCredits: p.priceCredits,
      weight: Math.round(weight * 10000) / 10000,
      creditedAmount: credited,
    };
  });
  // Floor remainder sweeps to platform (never split-leaked into the void).
  const platformShare = totalCreditPrice - allocated;
  return { splits, platformShare };
}

/** Default total price: 1.25× the sum of source prices (premium for the
 *  composed prompt). Anchored to the source weights, never user-controlled. */
function defaultSynthesisPrice(lockedPrices: { priceCredits: number }[]): number {
  const sum = lockedPrices.reduce((s, p) => s + p.priceCredits, 0);
  return Math.max(2, Math.round(sum * 1.25));
}

export async function createSynthesisSession(args: {
  buyerId: string;
  listingIds: string[];
  zposMethod?: ZposMethod;
}): Promise<SynthesisSession> {
  const uniqueIds = Array.from(new Set(args.listingIds));
  if (uniqueIds.length < 2) throw new SynthesisError("Synthesis requires 2+ source cards.");
  if (uniqueIds.length > 7) throw new SynthesisError("Synthesis caps at 7 source cards.");

  const rows = await db.select().from(spcListings).where(inArray(spcListings.id, uniqueIds));
  if (rows.length !== uniqueIds.length) {
    throw new SynthesisError("One or more source listings not found.");
  }
  for (const r of rows) {
    if (r.status !== "active") throw new SynthesisError(`Listing ${r.title} is not active.`);
    if (r.creatorId === args.buyerId) {
      throw new SynthesisError("You can't synthesize using your own listing.");
    }
  }
  // Preserve caller's ordering for the combined prompt.
  const ordered = uniqueIds.map((id) => rows.find((r) => r.id === id)!);

  const lockedPrices = ordered.map((l) => ({
    listingId: l.id, creatorId: l.creatorId, priceCredits: l.priceCredits,
  }));
  const totalCreditPrice = defaultSynthesisPrice(lockedPrices);
  const { splits } = computeRoyaltySplit(lockedPrices, totalCreditPrice);

  // Concatenate with section headers; ZPOS compresses across the seams.
  const combined = ordered
    .map((l, i) => `### Source ${i + 1}: ${l.title}\n${l.body}`)
    .join("\n\n");
  const z = compress(combined, args.zposMethod);

  const [session] = await db.insert(synthesisSessions).values({
    buyerId: args.buyerId,
    sourceListingIds: uniqueIds,
    lockedPrices,
    splitPreview: splits,
    totalCreditPrice,
    zposMethod: z.method,
    preTokens: z.preTokens,
    postTokens: z.postTokens,
    reductionPct: z.reductionPct,
    semanticPreservation: z.semanticPreservation,
    combinedOutput: z.output,
    status: "preview",
  }).returning();
  return session;
}

export type FinalizeOutcome = {
  session: SynthesisSession;
  buyerBalance: number;
  platformShare: number;
  splits: { creatorId: string; sourceListingId: string; creditedAmount: number }[];
};

export async function finalizeSynthesisSession(args: {
  buyerId: string;
  sessionId: string;
}): Promise<FinalizeOutcome> {
  return await db.transaction(async (tx) => {
    const [session] = await tx.select().from(synthesisSessions)
      .where(eq(synthesisSessions.id, args.sessionId))
      .for("update");
    if (!session) throw new SynthesisError("Synthesis session not found.", 404);
    if (session.buyerId !== args.buyerId) throw new SynthesisError("Not your synthesis session.", 403);
    if (session.status !== "preview") {
      throw new SynthesisError(`Session is ${session.status}, not finalizable.`);
    }

    // Re-validate that no source listing has been delisted in the meantime.
    const sourceIds = session.sourceListingIds;
    const liveSources = await tx.select().from(spcListings).where(inArray(spcListings.id, sourceIds));
    if (liveSources.length !== sourceIds.length) {
      throw new SynthesisError("A source listing has been removed.");
    }
    // Active-status re-check: prevents finalizing against a card that was
    // delisted between preview and finalize.
    const inactive = liveSources.filter((l) => l.status !== "active");
    if (inactive.length) {
      throw new SynthesisError(`Source listing "${inactive[0].title}" is no longer active.`);
    }

    // Recompute split from LOCKED prices — never reads live prices.
    const { splits, platformShare } = computeRoyaltySplit(
      session.lockedPrices, session.totalCreditPrice,
    );

    // Ensure buyer + creator credit rows exist, then lock in deterministic
    // id-sorted order to avoid deadlocks under concurrent finalizes.
    const lockTargets = Array.from(new Set<string>([args.buyerId, ...splits.map((s) => s.creatorId)]));
    for (const uid of lockTargets) {
      await tx.insert(userCredits).values({
        userId: uid, balance: SPC_STARTING_CREDITS,
        lifetimeEarned: SPC_STARTING_CREDITS, lifetimeSpent: 0,
      }).onConflictDoNothing();
    }
    const sorted = [...lockTargets].sort();
    const locked: Record<string, { balance: number; lifetimeEarned: number; lifetimeSpent: number }> = {};
    for (const uid of sorted) {
      const [row] = await tx.select().from(userCredits).where(eq(userCredits.userId, uid)).for("update");
      if (!row) throw new SynthesisError("Credit row missing — retry.");
      locked[uid] = { balance: row.balance, lifetimeEarned: row.lifetimeEarned, lifetimeSpent: row.lifetimeSpent };
    }
    const buyerLocked = locked[args.buyerId];
    if (buyerLocked.balance < session.totalCreditPrice) {
      throw new SynthesisError(
        `Insufficient credits — need ${session.totalCreditPrice}, you have ${buyerLocked.balance}.`,
      );
    }

    // Debit buyer.
    await tx.update(userCredits).set({
      balance: buyerLocked.balance - session.totalCreditPrice,
      lifetimeSpent: buyerLocked.lifetimeSpent + session.totalCreditPrice,
      updatedAt: new Date(),
    }).where(eq(userCredits.userId, args.buyerId));

    // Credit each unique creator their summed amount across this session.
    const creatorTotals = new Map<string, number>();
    for (const s of splits) {
      creatorTotals.set(s.creatorId, (creatorTotals.get(s.creatorId) ?? 0) + s.creditedAmount);
    }
    for (const [creatorId, amount] of creatorTotals.entries()) {
      if (amount <= 0) continue;
      const cur = locked[creatorId];
      await tx.update(userCredits).set({
        balance: cur.balance + amount,
        lifetimeEarned: cur.lifetimeEarned + amount,
        updatedAt: new Date(),
      }).where(eq(userCredits.userId, creatorId));
    }

    // Insert split rows (one per source listing for audit fidelity).
    const weightSum = session.lockedPrices.reduce((s, p) => s + p.priceCredits, 0) || 1;
    await tx.insert(synthesisCreatorsSplit).values(splits.map((s) => ({
      sessionId: session.id,
      creatorId: s.creatorId,
      sourceListingId: s.sourceListingId,
      sourcePriceCredits: s.sourcePriceCredits,
      weightBp: Math.round((s.sourcePriceCredits / weightSum) * 10000),
      creditedAmount: s.creditedAmount,
    })));

    // Persist the platform 30% share in the platform credit ledger so the
    // full creator + platform debit is auditable on-disk and reconciles
    // exactly to buyer.totalCreditPrice. Unique index on (source, sourceRefId)
    // makes this idempotent if the same session is somehow re-finalized.
    if (platformShare > 0) {
      await tx.insert(platformCreditLedger).values({
        source: "synthesis",
        sourceRefId: session.id,
        amount: platformShare,
      }).onConflictDoNothing();
    }

    const [finalized] = await tx.update(synthesisSessions)
      .set({ status: "finalized", finalizedAt: new Date() })
      .where(eq(synthesisSessions.id, session.id))
      .returning();

    return {
      session: finalized,
      buyerBalance: buyerLocked.balance - session.totalCreditPrice,
      platformShare,
      splits: splits.map((s) => ({
        creatorId: s.creatorId,
        sourceListingId: s.sourceListingId,
        creditedAmount: s.creditedAmount,
      })),
    };
  });
}

/** "Used in N syntheses" — finalized count for one listing. */
export async function countSynthesesForListing(listingId: string): Promise<number> {
  const rows = await db.select({ id: synthesisCreatorsSplit.sessionId })
    .from(synthesisCreatorsSplit)
    .where(eq(synthesisCreatorsSplit.sourceListingId, listingId));
  return new Set(rows.map((r) => r.id)).size;
}

/** Recent synthesis sessions a listing participated in (metadata only). */
export async function recentSynthesesForListing(listingId: string, limit = 5): Promise<{
  sessionId: string; createdAt: Date; reductionPct: number; zposMethod: string;
}[]> {
  const rows = await db.select({
    sessionId: synthesisSessions.id,
    createdAt: synthesisSessions.createdAt,
    reductionPct: synthesisSessions.reductionPct,
    zposMethod: synthesisSessions.zposMethod,
  }).from(synthesisSessions)
    .innerJoin(synthesisCreatorsSplit, eq(synthesisCreatorsSplit.sessionId, synthesisSessions.id))
    .where(and(
      eq(synthesisCreatorsSplit.sourceListingId, listingId),
      eq(synthesisSessions.status, "finalized"),
    ))
    .orderBy(sql`${synthesisSessions.createdAt} DESC`)
    .limit(limit);
  // De-dup by sessionId (a listing should only appear once per session anyway).
  const seen = new Set<string>();
  return rows.filter((r) => seen.has(r.sessionId) ? false : (seen.add(r.sessionId), true));
}

export async function getSessionForBuyer(sessionId: string, buyerId: string): Promise<SynthesisSession | null> {
  const [row] = await db.select().from(synthesisSessions).where(eq(synthesisSessions.id, sessionId));
  if (!row) return null;
  if (row.buyerId !== buyerId) return null;
  return row;
}
