/**
 * Book Companion (Task #22) — server evaluator.
 *
 * Named chapter badges are AUTO-AWARDED off the flywheel events the
 * orchestrator already emits — a reader never self-marks a chapter complete.
 * The evaluator is invoked from `orchestrator.emit` (best-effort, gated by the
 * `bookCompanion` feature flag) for the three event types that prove a chapter:
 *
 *   - `assessment.completed` → Prologue (and capture the immutable baseline Ledger)
 *   - `game.session.finished` → the chapter whose bc-* scenario matches, IF the
 *     session reached the chapter's required JCSE tier
 *   - `spc.published`        → Chapter 9 (SPC Builder)
 *
 * The Epilogue badge is awarded when the reader captures their final Ledger.
 */

import { storage } from "./storage";
import { isFeatureEnabled } from "./featureFlags";
import {
  JOURNEY_NODES,
  getNodeById,
  getNodeByScenarioId,
  type JourneyNode,
} from "@shared/bookCompanion";
import type { ArkEventType } from "@shared/schema";
import type { BookJourneyBadge, BookLedgerSnapshot } from "@shared/schema";

type EvalEvent =
  | { type: "assessment.completed"; assessmentId?: string }
  | { type: "game.session.finished"; sessionId: string; scenarioId: string; kcseScore: number }
  | { type: "spc.published"; listingId: string };

function nodeAwardPayload(node: JourneyNode, earnedVia: string, refId: string | null) {
  return {
    nodeId: node.id,
    badge: node.badge,
    pillar: node.pillar,
    ccLevel: node.ccLevel,
    earnedVia,
    refId: refId ?? undefined,
  };
}

/**
 * Evaluate a flywheel event and award any chapter badge it unlocks. Safe to
 * call for any event type; only the mapped types do work. Never throws — the
 * caller treats this as best-effort side-effect.
 */
export async function evaluateBookJourney(userId: string, event: EvalEvent): Promise<void> {
  if (!isFeatureEnabled("bookCompanion")) return;
  try {
    if (event.type === "assessment.completed") {
      const prologue = getNodeById("prologue")!;
      await storage.awardBookBadge({
        userId,
        ...nodeAwardPayload(prologue, "assessment", event.assessmentId ?? null),
      });
      // Capture the immutable baseline Ledger on the first assessment.
      await captureLedgerSnapshot(userId, "baseline");
      return;
    }

    if (event.type === "spc.published") {
      const node = getNodeById("ch9")!;
      await storage.awardBookBadge({
        userId,
        ...nodeAwardPayload(node, "spc_publish", event.listingId),
      });
      return;
    }

    if (event.type === "game.session.finished") {
      const node = getNodeByScenarioId(event.scenarioId);
      if (!node || node.unlock.kind !== "ccge") return;
      const min = node.unlock.minKcse ?? 0;
      if (event.kcseScore < min) return; // didn't reach the chapter's tier
      await storage.awardBookBadge({
        userId,
        ...nodeAwardPayload(node, "ccge", event.sessionId),
      });
      return;
    }
  } catch (err) {
    console.error("[bookCompanion] evaluate failed (best-effort):", event.type, err);
  }
}

/** Current live identity + progress counters used by both Ledger snapshots. */
async function currentLedgerValues(userId: string): Promise<{
  jstIndex: number;
  ccmi: number;
  arkScore: number;
  badgesEarned: number;
  spcPublished: number;
}> {
  const [user, badges, listings] = await Promise.all([
    storage.getUser(userId),
    storage.getBookBadges(userId),
    storage.getSpcListingsByCreator(userId),
  ]);
  return {
    jstIndex: user?.jstIndex ?? 0,
    ccmi: user?.ccmi ?? 0,
    arkScore: user?.arkScore ?? 0,
    badgesEarned: badges.length,
    spcPublished: listings.length,
  };
}

/**
 * Capture a Ledger snapshot. `baseline` is immutable (insert-once); `final`
 * refreshes on each capture and also awards the Epilogue badge.
 */
export async function captureLedgerSnapshot(
  userId: string,
  kind: "baseline" | "final",
): Promise<BookLedgerSnapshot> {
  const vals = await currentLedgerValues(userId);
  const snap = await storage.upsertLedgerSnapshot({ userId, kind, ...vals });
  if (kind === "final") {
    const epilogue = getNodeById("epilogue")!;
    await storage.awardBookBadge({
      userId,
      ...nodeAwardPayload(epilogue, "ledger_final", snap.id),
    });
  }
  return snap;
}

export interface LedgerView {
  baseline: BookLedgerSnapshot | null;
  final: BookLedgerSnapshot | null;
  current: {
    jstIndex: number;
    ccmi: number;
    arkScore: number;
    badgesEarned: number;
    spcPublished: number;
  };
  delta: { jstIndex: number; ccmi: number; arkScore: number } | null;
}

/** Build the full Ledger view (baseline + final + live + delta). */
export async function buildLedger(userId: string): Promise<LedgerView> {
  const [snapshots, current] = await Promise.all([
    storage.getLedgerSnapshots(userId),
    currentLedgerValues(userId),
  ]);
  const baseline = snapshots.find((s) => s.kind === "baseline") ?? null;
  const final = snapshots.find((s) => s.kind === "final") ?? null;
  const delta = baseline
    ? {
        jstIndex: current.jstIndex - baseline.jstIndex,
        ccmi: current.ccmi - baseline.ccmi,
        arkScore: current.arkScore - baseline.arkScore,
      }
    : null;
  return { baseline, final, current, delta };
}

export interface JourneyView {
  bookTitle: string;
  totalNodes: number;
  earnedCount: number;
  nodes: Array<{
    id: string;
    order: number;
    stage: string;
    chapterLabel: string;
    title: string;
    pillar: string | null;
    badge: string;
    ccLevel: string | null;
    tierArt: string;
    slug: string;
    deepLink: string;
    quest: string[];
    unlock: JourneyNode["unlock"];
    earned: boolean;
    earnedAt: string | null;
    earnedVia: string | null;
  }>;
}

/** Build the per-user journey view: every node + earned status. */
export async function buildJourney(userId: string): Promise<JourneyView> {
  const badges = await storage.getBookBadges(userId);
  const byNode = new Map<string, BookJourneyBadge>(badges.map((b) => [b.nodeId, b]));
  const nodes = JOURNEY_NODES.map((n) => {
    const earned = byNode.get(n.id);
    return {
      id: n.id,
      order: n.order,
      stage: n.stage,
      chapterLabel: n.chapterLabel,
      title: n.title,
      pillar: n.pillar,
      badge: n.badge,
      ccLevel: n.ccLevel,
      tierArt: n.tierArt,
      slug: n.slug,
      deepLink: n.deepLink,
      quest: [...n.quest],
      unlock: n.unlock,
      earned: !!earned,
      earnedAt: earned ? earned.earnedAt.toISOString() : null,
      earnedVia: earned ? earned.earnedVia : null,
    };
  });
  return {
    bookTitle: "Context Craft: An AI Survival Guide",
    totalNodes: JOURNEY_NODES.length,
    earnedCount: badges.filter((b) => JOURNEY_NODES.some((n) => n.id === b.nodeId)).length,
    nodes,
  };
}

// Re-export for callers that only need the event type alias surface.
export type { ArkEventType };
