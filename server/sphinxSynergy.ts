import { db } from "./db";
import {
  cardSynergies, complementaryPairs, roundtableState,
  notifications, jnomicsCards, spcListings,
  canonicalCardPair,
  type JnomicsCard, type SpcListing, type RoundtableState,
  type InsertNotification, type Notification, type NotificationType,
} from "@shared/schema";
import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { computePairSynergy } from "./jnomicsSeed";
import { orchestrator } from "./orchestrator";

// ─────────────────────────────────────────────────────────────────────
// Synergy engine
// ─────────────────────────────────────────────────────────────────────

export interface SynergyBreakdownEntry {
  a: string;
  b: string;
  score: number;
  rationale: string;
  source: "table" | "computed";
}

export interface SynergyResult {
  synergyScore: number; // 0-100 averaged pair score
  pairCount: number;
  breakdown: SynergyBreakdownEntry[];
}

/** Look up a pair score from the card_synergies table; null if absent. */
async function lookupPair(a: string, b: string): Promise<{ score: number; rationale: string | null } | null> {
  const { cardAId, cardBId } = canonicalCardPair(a, b);
  const [row] = await db.select().from(cardSynergies).where(
    and(eq(cardSynergies.cardAId, cardAId), eq(cardSynergies.cardBId, cardBId)),
  );
  return row ? { score: row.synergyScore, rationale: row.rationale } : null;
}

/** Resolve a card metadata blob for fallback scoring. */
async function loadCardMeta(ids: string[]): Promise<Map<string, JnomicsCard>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(jnomicsCards).where(inArray(jnomicsCards.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Compute synergy across 2-5 cards. Triples/quads use averaged pairwise. */
export async function calculateSynergy(cardIds: string[]): Promise<SynergyResult> {
  if (cardIds.length < 2 || cardIds.length > 5) {
    throw new Error("calculateSynergy requires 2..5 card IDs.");
  }
  const meta = await loadCardMeta(cardIds);
  for (const id of cardIds) {
    if (!meta.has(id)) throw new Error(`Unknown card id: ${id}`);
  }
  const breakdown: SynergyBreakdownEntry[] = [];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < cardIds.length; i++) {
    for (let j = i + 1; j < cardIds.length; j++) {
      const a = cardIds[i];
      const b = cardIds[j];
      const seeded = await lookupPair(a, b);
      if (seeded) {
        breakdown.push({ a, b, score: seeded.score, rationale: seeded.rationale ?? "", source: "table" });
        sum += seeded.score;
      } else {
        const computed = computePairSynergy(meta.get(a)!, meta.get(b)!);
        breakdown.push({ a, b, score: computed.score, rationale: computed.rationale, source: "computed" });
        sum += computed.score;
      }
      count++;
    }
  }
  const avg = count === 0 ? 0 : Math.round(sum / count);
  return { synergyScore: avg, pairCount: count, breakdown };
}

// ─────────────────────────────────────────────────────────────────────
// Complementary pairs (per listing) — sparse cache
// ─────────────────────────────────────────────────────────────────────

/** Recompute top-N complementary partners for one listing. Stored in
 *  `complementary_pairs`. Uses synergy_tag_ids overlap when available;
 *  falls back to pillar match for listings with no synergy tags. */
export async function recomputeComplementaryFor(listingId: string, topN = 5): Promise<number> {
  const [src] = await db.select().from(spcListings).where(eq(spcListings.id, listingId));
  if (!src) return 0;
  const candidates = await db.select().from(spcListings).where(
    and(sql`${spcListings.id} <> ${src.id}`, eq(spcListings.status, "active")),
  );
  const scored: Array<{ partner: SpcListing; score: number }> = [];
  for (const c of candidates) {
    const srcTags = src.synergyTagIds ?? [];
    const cTags = c.synergyTagIds ?? [];
    let score: number;
    if (srcTags.length > 0 && cTags.length > 0) {
      // Average synergy across all cross-pairs of tag ids.
      let s = 0, n = 0;
      for (const a of srcTags) {
        for (const b of cTags) {
          const seeded = await lookupPair(a, b);
          if (seeded) { s += seeded.score; n++; }
        }
      }
      score = n === 0 ? 30 : Math.round(s / n);
    } else {
      // Pillar-affinity fallback.
      score = src.pillar === c.pillar ? 55 : 35;
    }
    // Bias toward higher HIVE partners.
    score = Math.min(100, Math.round(score * 0.7 + c.hiveScore * 0.3));
    scored.push({ partner: c, score });
  }
  scored.sort((x, y) => y.score - x.score);
  const top = scored.slice(0, topN);
  // Clear existing rows for this listing, then insert fresh.
  await db.delete(complementaryPairs).where(eq(complementaryPairs.listingId, listingId));
  if (top.length === 0) return 0;
  await db.insert(complementaryPairs).values(top.map((t, idx) => ({
    listingId, partnerListingId: t.partner.id, score: t.score, rank: idx + 1,
  })));
  return top.length;
}

export async function getComplementaryForListing(listingId: string) {
  const rows = await db.select().from(complementaryPairs)
    .where(eq(complementaryPairs.listingId, listingId))
    .orderBy(complementaryPairs.rank);
  if (rows.length === 0) return [];
  const partners = await db.select().from(spcListings)
    .where(inArray(spcListings.id, rows.map((r) => r.partnerListingId)));
  const byId = new Map(partners.map((p) => [p.id, p]));
  return rows.map((r) => ({
    rank: r.rank,
    score: r.score,
    partner: byId.get(r.partnerListingId) ?? null,
  })).filter((x) => x.partner !== null);
}

export async function getTopPairsPlatform(limit = 15) {
  // Top-N synergy_table rows where both cards exist, joined to listings
  // tagged with them. Falls back to simply the strongest seeded synergies.
  const rows = await db.select().from(cardSynergies)
    .orderBy(desc(cardSynergies.synergyScore)).limit(limit);
  return rows;
}

// ─────────────────────────────────────────────────────────────────────
// ARK Roundtable — Top-12 leaderboard + seat rotation broadcast
// ─────────────────────────────────────────────────────────────────────

const lastRotationNotifAt = new Map<string, number>();
const ROTATION_DEBOUNCE_MS = 60_000;

export interface RoundtableSeat {
  seatNumber: number;
  listingId: string;
  creatorId: string;
  score: number;
  hiveScore: number;
  salesCount: number;
  snapshotAt: Date;
  rankDelta?: number; // +N means moved up N seats since last snapshot
  seatSinceAt?: Date; // when current holder first arrived at this seat
}

export async function getRoundtableSnapshot(): Promise<RoundtableState[]> {
  return db.select().from(roundtableState).orderBy(roundtableState.seatNumber);
}

/** Recompute Top-12; persist, broadcast rotations, persist notifications. */
export async function recomputeRoundtable(): Promise<{ seats: RoundtableSeat[]; rotated: number }> {
  const all = await db.select().from(spcListings).where(eq(spcListings.status, "active"));
  if (all.length === 0) return { seats: [], rotated: 0 };
  const maxSales = Math.max(1, ...all.map((l) => l.salesCount));
  const ranked = all.map((l) => ({
    listing: l,
    score: 0.6 * l.hiveScore + 0.4 * (l.salesCount / maxSales) * 100,
  })).sort((a, b) => b.score - a.score).slice(0, 12);

  const prevRows = await db.select().from(roundtableState);
  const prevBySeat = new Map(prevRows.map((r) => [r.seatNumber, r]));
  const prevByListing = new Map(prevRows.map((r) => [r.listingId, r]));

  // Persist new snapshot. We carry forward the previous snapshotAt for any
  // (seat, listing) pair that hasn't changed so the client can render an
  // accurate "time held" duration without an extra schema column.
  await db.delete(roundtableState);
  const now = new Date();
  const seats: (RoundtableSeat & { seatSinceAt: Date })[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const seatNumber = i + 1;
    const { listing, score } = ranked[i];
    const prevAtSeat = prevBySeat.get(seatNumber);
    const stillHere = prevAtSeat && prevAtSeat.listingId === listing.id;
    const seatSinceAt = stillHere ? prevAtSeat!.snapshotAt : now;
    await db.insert(roundtableState).values({
      listingId: listing.id,
      creatorId: listing.creatorId,
      seatNumber,
      score,
      hiveScore: listing.hiveScore,
      salesCount: listing.salesCount,
      // Preserve original arrival timestamp so time-held survives recompute.
      snapshotAt: seatSinceAt as any,
    } as any);
    const prev = prevByListing.get(listing.id);
    const rankDelta = prev ? prev.seatNumber - seatNumber : undefined;
    seats.push({
      seatNumber, listingId: listing.id, creatorId: listing.creatorId,
      score, hiveScore: listing.hiveScore, salesCount: listing.salesCount,
      snapshotAt: now, rankDelta, seatSinceAt,
    });
  }

  // Detect rotations: any seat where the holder changed vs previous snapshot.
  let rotated = 0;
  for (const seat of seats) {
    const prev = prevBySeat.get(seat.seatNumber);
    if (!prev || prev.listingId === seat.listingId) continue;
    rotated++;
    // Notify the gainer (and the displaced creator, if any) — debounced.
    const targets = Array.from(new Set<string>([seat.creatorId, prev.creatorId]));
    for (const userId of targets) {
      const lastAt = lastRotationNotifAt.get(userId) ?? 0;
      if (Date.now() - lastAt < ROTATION_DEBOUNCE_MS) continue;
      lastRotationNotifAt.set(userId, Date.now());
      const isGain = userId === seat.creatorId;
      await persistAndBroadcastNotification(userId, {
        type: "roundtable.seat_rotation",
        title: isGain ? `You captured Roundtable seat #${seat.seatNumber}` : `You lost Roundtable seat #${seat.seatNumber}`,
        body: isGain
          ? `Your SPC is now ranked #${seat.seatNumber} in the ARK Roundtable Top-12.`
          : `Another creator has displaced you from seat #${seat.seatNumber}.`,
        link: "/marketplace/roundtable",
        payload: { seatNumber: seat.seatNumber, listingId: seat.listingId },
      });
    }
    // Always fire the public seat-rotation event so all online clients can
    // surface the toast (sidebar notification bell still listens to
    // notification.new, which is per-user only).
    orchestrator.broadcastAll("roundtable.seat_rotation", {
      seatNumber: seat.seatNumber,
      listingId: seat.listingId,
      creatorId: seat.creatorId,
      previousCreatorId: prev.creatorId,
      score: seat.score,
    });
  }
  return { seats, rotated };
}

// ─────────────────────────────────────────────────────────────────────
// Notifications — persist + broadcast over the existing SSE bus
// ─────────────────────────────────────────────────────────────────────

export async function persistAndBroadcastNotification(
  userId: string,
  data: Omit<InsertNotification, "userId"> & { type: NotificationType },
): Promise<Notification | null> {
  try {
    const [row] = await db.insert(notifications).values({
      userId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
      payload: (data.payload as Record<string, unknown>) ?? {},
    }).returning();
    orchestrator.broadcastToUser(userId, "notification.new", row);
    return row;
  } catch (err) {
    console.error("[notifications] persist/broadcast failed:", err);
    return null;
  }
}

export async function listNotifications(userId: string, limit = 25): Promise<Notification[]> {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(userId: string): Promise<number> {
  const rows = await db.select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} IS NULL`));
  return rows.length;
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  if (ids && ids.length > 0) {
    await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)));
    return ids.length;
  }
  // Mark-all-read
  const before = await countUnread(userId);
  await db.update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), sql`${notifications.readAt} IS NULL`));
  return before;
}
