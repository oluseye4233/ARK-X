import { storage } from "./storage";
import type { InsertJnomicsCard, InsertCardSynergy } from "@shared/schema";
import { canonicalCardPair } from "@shared/schema";
import { db } from "./db";
import { cardSynergies } from "@shared/schema";

// ── Junglenomics M3 expansion — 147 generated cards (`jng-` prefix) ──
// Combined with the 22 CODEC primitives from `shared/codec-primitives.ts`
// (the 10 legacy `card-001..010` rows are dropped by the seed before this
// runs), the marketplace exposes a full **169-card** taxonomy across
// 6 disciplines × 5 rarities × 3 versions × 6 categories.
// The 147 count is intentional and locked: 22 + 147 = 169.

export const JNG_DISCIPLINES = [
  "Discovery", "Build", "Optimize", "Scale", "Defend", "Govern",
] as const;
export type JngDisc = typeof JNG_DISCIPLINES[number];

export const JNG_RARITIES = [
  "Common", "Uncommon", "Rare", "Epic", "Legendary",
] as const;
export type JngRarity = typeof JNG_RARITIES[number];

export const JNG_VERSIONS = ["v1", "v2", "v3"] as const;

// Categories mirror the marketplace category taxonomy.
export const JNG_CATEGORIES = [
  "Strategy", "Engineering", "Operations", "Growth", "Risk", "People",
] as const;

const DISC_EMOJI: Record<JngDisc, string> = {
  Discovery: "🔭", Build: "🔨", Optimize: "⚙️",
  Scale: "🚀", Defend: "🛡️", Govern: "⚖️",
};

const RARITY_PTS: Record<JngRarity, number> = {
  Common: 8, Uncommon: 12, Rare: 18, Epic: 26, Legendary: 36,
};

// Complementary disc pairs — moving "forward" in a workflow.
const COMPLEMENTARY: Record<JngDisc, JngDisc[]> = {
  Discovery: ["Build"],
  Build: ["Optimize", "Defend"],
  Optimize: ["Scale"],
  Scale: ["Govern", "Defend"],
  Defend: ["Govern"],
  Govern: ["Discovery"],
};

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generate 147 deterministic cards covering the full 6-dim taxonomy.
 *  22 CODEC + 147 JNG = 169 cards total (locked marketplace taxonomy size). */
export const JNG_EXPANSION_COUNT = 147;
/** Locked total card count served by the marketplace (CODEC + JNG). */
export const TOTAL_TAXONOMY_CARDS = 169;
export function generateJngCards(): InsertJnomicsCard[] {
  const cards: InsertJnomicsCard[] = [];
  for (let i = 1; i <= JNG_EXPANSION_COUNT; i++) {
    const id = `jng-${i.toString().padStart(3, "0")}`;
    const disc = JNG_DISCIPLINES[i % JNG_DISCIPLINES.length];
    const rarity = JNG_RARITIES[Math.floor(i / 6) % JNG_RARITIES.length];
    const version = JNG_VERSIONS[Math.floor(i / 30) % JNG_VERSIONS.length];
    const category = JNG_CATEGORIES[(i * 5) % JNG_CATEGORIES.length];
    const emoji = DISC_EMOJI[disc];
    const name = `${disc} ${rarity} ${id.slice(4)}`;
    cards.push({
      id,
      name,
      tier: rarity, // M3 repurposes `tier` to carry rarity for new cards.
      type: disc,
      emoji,
      description: `${rarity} ${disc.toLowerCase()} primitive (${category}, ${version}). Compose with complementary cards to multiply effect.`,
      basePts: RARITY_PTS[rarity],
      disc,
      rarity,
      version,
      category,
    });
  }
  return cards;
}

/** Deterministic synergy score for any two cards based on metadata. */
export function computePairSynergy(
  a: { disc?: string | null; rarity?: string | null; category?: string | null; id: string },
  b: { disc?: string | null; rarity?: string | null; category?: string | null; id: string },
): { score: number; rationale: string } {
  const reasons: string[] = [];
  let s = 20; // baseline
  if (a.disc && b.disc) {
    if (a.disc === b.disc) { s += 25; reasons.push(`Same discipline (${a.disc})`); }
    else if (COMPLEMENTARY[a.disc as JngDisc]?.includes(b.disc as JngDisc)
          || COMPLEMENTARY[b.disc as JngDisc]?.includes(a.disc as JngDisc)) {
      s += 35; reasons.push(`Complementary disciplines (${a.disc} → ${b.disc})`);
    }
  }
  if (a.rarity && b.rarity && a.rarity === b.rarity) {
    s += 8; reasons.push(`Matched rarity (${a.rarity})`);
  }
  if (a.category && b.category && a.category === b.category) {
    s += 12; reasons.push(`Same category (${a.category})`);
  }
  // Deterministic jitter so identical-metadata pairs still differ.
  const jitter = hashStr(`${a.id}|${b.id}`) % 11;
  s += jitter;
  const score = Math.max(0, Math.min(100, s));
  if (reasons.length === 0) reasons.push("Generic compositional fit");
  return { score, rationale: reasons.join(" · ") };
}

/** Seed ~120 curated card_synergies rows for the strongest matches. */
export async function seedCuratedSynergies(allCardIds: string[]) {
  // For each card, pick its top-3 partners by metadata and persist a row.
  const cards = await storage.getJnomicsCardsByIds(allCardIds);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const rows: InsertCardSynergy[] = [];
  const seen = new Set<string>();
  for (const card of cards.slice(0, 80)) {
    const partners = cards
      .filter((p) => p.id !== card.id)
      .map((p) => ({ p, ...computePairSynergy(card, p) }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 3);
    for (const { p, score, rationale } of partners) {
      const { cardAId, cardBId } = canonicalCardPair(card.id, p.id);
      const key = `${cardAId}|${cardBId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ cardAId, cardBId, synergyScore: score, rationale });
    }
  }
  if (rows.length === 0) return 0;
  // Upsert; tolerate duplicate-key on the unique pair index.
  for (const r of rows) {
    try {
      await db.insert(cardSynergies).values(r).onConflictDoUpdate({
        target: [cardSynergies.cardAId, cardSynergies.cardBId],
        set: { synergyScore: r.synergyScore, rationale: r.rationale, updatedAt: new Date() },
      });
    } catch {
      // Best-effort; missing constraint targets fall through.
    }
  }
  return rows.length;
}

export async function seedJnomicsExpansion(): Promise<{ cards: number; synergies: number }> {
  // Idempotent: drop & re-seed only the `jng-` namespace.
  await storage.deleteJnomicsCardsByIdPrefix("jng-");
  const cards = generateJngCards();
  for (const c of cards) {
    await storage.upsertJnomicsCard(c);
  }
  const allCards = await storage.getAllJnomicsCards();
  // Hard invariant: total taxonomy MUST equal TOTAL_TAXONOMY_CARDS (169)
  // after seed runs. CODEC primitives are inserted upstream by the seed
  // route; this guard catches count drift in either source.
  if (allCards.length !== TOTAL_TAXONOMY_CARDS) {
    throw new Error(
      `Taxonomy count drift: expected ${TOTAL_TAXONOMY_CARDS}, got ${allCards.length}. ` +
      `Check CODEC_PRIMITIVES (shared/codec-primitives.ts) and JNG_EXPANSION_COUNT.`,
    );
  }
  const synergies = await seedCuratedSynergies(allCards.map((c) => c.id));
  return { cards: cards.length, synergies };
}
