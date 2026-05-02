import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import {
  userCredits,
  spcListings,
  spcPurchases,
  users,
  assessments,
  type SpcListing,
  type SpcPurchase,
  type UserCredits,
  type HivePrecheck,
  ALL_CARD_PILLARS,
  type CardPillar,
  SPC_CREATOR_SHARE_PCT,
  SPC_PLATFORM_SHARE_PCT,
  SPC_STARTING_CREDITS,
  SPC_HIVE_MIN_TO_PUBLISH,
  SPC_FIRST_SALE_TALENT_BOOST,
  ARK_SCORE_DELTAS,
} from "@shared/schema";

const QUALITY_KEYWORDS = [
  "system", "role", "instruction", "example", "constraint", "format", "data",
  "you are", "your task", "context", "must", "should", "do not", "respond",
  "output", "json", "markdown", "step", "first", "then", "finally",
];

const RED_FLAG_TERMS = ["lorem ipsum", "todo", "placeholder", "test test"];

/**
 * Deterministic HIVE pre-check that estimates the SPC's quality before it's
 * listed in the marketplace. In Phase F this gets replaced by a Claude call
 * that scores the prompt against the same rubric.
 */
export function runHivePrecheck(input: {
  title: string;
  description: string;
  body: string;
  pillar: string;
}): HivePrecheck {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let hive = 50;

  const title = input.title.trim();
  const desc = input.description.trim();
  const body = input.body.trim();
  const bodyLower = body.toLowerCase();

  if (!ALL_CARD_PILLARS.includes(input.pillar as CardPillar)) {
    reasons.push("Invalid pillar.");
  }

  if (title.length < 6) {
    reasons.push("Title too short (min 6 characters).");
  } else if (title.length > 80) {
    warnings.push("Title is very long — consider shortening.");
  } else {
    hive += 5;
    reasons.push("Title length ok.");
  }

  if (desc.length < 20) {
    reasons.push("Description too short (min 20 characters).");
  } else {
    hive += 5;
    reasons.push("Description length ok.");
  }

  if (body.length < 80) {
    reasons.push("Prompt body too short (min 80 characters).");
  } else if (body.length < 200) {
    hive += 5;
    reasons.push("Prompt body has minimum length.");
  } else if (body.length < 800) {
    hive += 12;
    reasons.push("Prompt body well-developed.");
  } else if (body.length < 2000) {
    hive += 8;
    warnings.push("Prompt body is long — verify every section earns its tokens.");
  } else {
    hive += 2;
    warnings.push("Prompt body is very long — efficiency may suffer.");
  }

  const matchedKeywords = QUALITY_KEYWORDS.filter((kw) => bodyLower.includes(kw));
  const kwBoost = Math.min(20, matchedKeywords.length * 2);
  hive += kwBoost;
  reasons.push(`Matched ${matchedKeywords.length} structural keywords (+${kwBoost}).`);

  for (const flag of RED_FLAG_TERMS) {
    if (bodyLower.includes(flag)) {
      hive -= 25;
      reasons.push(`Red flag detected: "${flag}" (-25).`);
    }
  }

  if (/\n\n/.test(body) || /^\s*[-*#0-9]/m.test(body)) {
    hive += 4;
    reasons.push("Body uses structural formatting (sections / lists).");
  }

  hive = Math.max(0, Math.min(100, Math.round(hive)));

  // KCSE proxy: scale HIVE 0-100 down to 0-50 with a small specificity bonus
  const specificity = Math.min(8, matchedKeywords.length);
  const kcse = Math.max(0, Math.min(50, Math.round(((hive / 100) * 45 + specificity) * 10) / 10));

  const passes = hive >= SPC_HIVE_MIN_TO_PUBLISH && reasons.every((r) => !r.startsWith("Red flag")) &&
    title.length >= 6 && desc.length >= 20 && body.length >= 80 &&
    ALL_CARD_PILLARS.includes(input.pillar as CardPillar);

  return { hiveScore: hive, kcseScore: kcse, passes, reasons, warnings };
}

export async function getOrCreateCredits(userId: string): Promise<UserCredits> {
  const [existing] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(userCredits)
    .values({
      userId,
      balance: SPC_STARTING_CREDITS,
      lifetimeEarned: SPC_STARTING_CREDITS,
      lifetimeSpent: 0,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [refetch] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
  return refetch;
}

export type PurchaseOutcome = {
  purchase: SpcPurchase;
  listing: SpcListing;
  buyerBalance: number;
  creatorBalance: number;
  isFirstSaleForCreator: boolean;
  creatorTalentBoost: number;
  creatorJstSkillsAfter: number | null;
  creatorJstTotalAfter: number | null;
  arkScoreDelta: { buyer: number; creator: number };
};

/**
 * Atomically execute a marketplace purchase:
 *  1. Lock buyer + creator credit rows (FOR UPDATE)
 *  2. Verify buyer has enough credits + isn't the creator
 *  3. Debit buyer, credit creator (70/30 split, platform takes 30)
 *  4. Insert purchase row, bump listing sales counters
 *  5. If first sale for the creator, bump JST Talent (capped 100/300)
 * All in a single DB transaction so a partial failure rolls everything back.
 */
export async function executePurchase(
  buyerId: string,
  listingId: string,
): Promise<PurchaseOutcome> {
  return await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(spcListings)
      .where(eq(spcListings.id, listingId))
      .for("update");
    if (!listing) throw new Error("Listing not found.");
    if (listing.status !== "active") throw new Error("Listing is not available for purchase.");
    if (listing.creatorId === buyerId) throw new Error("You can't buy your own SPC.");

    // Initialize credit rows inside the txn — idempotent via ON CONFLICT.
    // Lock ordering: always buyer-then-creator (sorted by id) to avoid deadlocks
    // when two concurrent purchases involve the same two users in opposite roles.
    await tx
      .insert(userCredits)
      .values({ userId: buyerId, balance: SPC_STARTING_CREDITS, lifetimeEarned: SPC_STARTING_CREDITS, lifetimeSpent: 0 })
      .onConflictDoNothing();
    await tx
      .insert(userCredits)
      .values({ userId: listing.creatorId, balance: SPC_STARTING_CREDITS, lifetimeEarned: SPC_STARTING_CREDITS, lifetimeSpent: 0 })
      .onConflictDoNothing();

    const lockOrder = [buyerId, listing.creatorId].sort();
    const [first] = await tx.select().from(userCredits).where(eq(userCredits.userId, lockOrder[0])).for("update");
    const [second] = await tx.select().from(userCredits).where(eq(userCredits.userId, lockOrder[1])).for("update");
    const buyer = first?.userId === buyerId ? first : second;
    const creator = first?.userId === listing.creatorId ? first : second;
    if (!buyer || !creator) throw new Error("Credit rows missing — try again.");
    if (buyer.balance < listing.priceCredits) {
      throw new Error(
        `Insufficient credits — need ${listing.priceCredits}, you have ${buyer.balance}.`,
      );
    }

    const creatorShare = Math.floor((listing.priceCredits * SPC_CREATOR_SHARE_PCT) / 100);
    const platformShare = listing.priceCredits - creatorShare;

    // First sale = creator has zero prior purchases across ALL their listings.
    // Lock is held on creator's userCredits row above, so concurrent purchases
    // for the same creator (even across different listings) serialize here and
    // cannot both observe count=0. Per-listing salesCount would let a creator
    // farm boosts by publishing many SPCs.
    const [{ count: priorSalesCount }] = await tx
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(spcPurchases)
      .where(eq(spcPurchases.creatorId, listing.creatorId));
    const isFirstSale = priorSalesCount === 0;

    await tx
      .update(userCredits)
      .set({
        balance: buyer.balance - listing.priceCredits,
        lifetimeSpent: buyer.lifetimeSpent + listing.priceCredits,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, buyerId));

    await tx
      .update(userCredits)
      .set({
        balance: creator.balance + creatorShare,
        lifetimeEarned: creator.lifetimeEarned + creatorShare,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, listing.creatorId));

    const [purchase] = await tx
      .insert(spcPurchases)
      .values({
        buyerId,
        listingId,
        creatorId: listing.creatorId,
        priceCredits: listing.priceCredits,
        creatorShare,
        platformShare,
        isFirstSaleForCreator: isFirstSale,
      })
      .returning();

    const [updatedListing] = await tx
      .update(spcListings)
      .set({
        salesCount: listing.salesCount + 1,
        totalEarned: listing.totalEarned + creatorShare,
      })
      .where(eq(spcListings.id, listingId))
      .returning();

    let creatorJstSkillsAfter: number | null = null;
    let creatorJstTotalAfter: number | null = null;
    let creatorTalentBoost = 0;
    if (isFirstSale) {
      const [latestAssessment] = await tx
        .select()
        .from(assessments)
        .where(eq(assessments.userId, listing.creatorId))
        .orderBy(sql`${assessments.createdAt} DESC`)
        .limit(1);
      if (latestAssessment) {
        const newTalent = Math.min(100, latestAssessment.jstTalent + SPC_FIRST_SALE_TALENT_BOOST);
        const talentDelta = newTalent - latestAssessment.jstTalent;
        const newTotal = Math.min(300, latestAssessment.jstTotal + talentDelta);
        creatorTalentBoost = talentDelta;
        await tx
          .update(assessments)
          .set({ jstTalent: newTalent, jstTotal: newTotal })
          .where(eq(assessments.id, latestAssessment.id));
        creatorJstSkillsAfter = latestAssessment.jstSkills;
        creatorJstTotalAfter = newTotal;
      }
    }

    return {
      purchase,
      listing: updatedListing,
      buyerBalance: buyer.balance - listing.priceCredits,
      creatorBalance: creator.balance + creatorShare,
      isFirstSaleForCreator: isFirstSale,
      creatorTalentBoost,
      creatorJstSkillsAfter,
      creatorJstTotalAfter,
      arkScoreDelta: {
        buyer: ARK_SCORE_DELTAS.SPC_PURCHASED_AS_BUYER,
        creator: isFirstSale
          ? ARK_SCORE_DELTAS.SPC_FIRST_SALE_AS_CREATOR
          : ARK_SCORE_DELTAS.SPC_PUBLISHED,
      },
    };
  });
}
