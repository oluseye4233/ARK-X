import { EventEmitter } from "events";
import type { Response } from "express";
import { db } from "./db";
import { arkEvents, type ArkEvent, type ArkEventType, type ArkTriggerType } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { RecalcResult } from "./arkRecalc";
import { storage } from "./storage";
import { pickFlywheelCta, rankAllCtas } from "./flywheelCta";

// Map legacy ArkEventType → PDD §3.4 ArkTriggerType for the recalc pipeline.
// `assessment.completed` is intentionally absent — the route handlers call
// recalcArkForUser directly with their own pillarOverride/freshScores.
const EVENT_TO_TRIGGER: Partial<Record<ArkEventType, ArkTriggerType>> = {
  "game.session.finished": "ccge.session",
  "cert.upgraded": "cert.upgraded",
  "spc.published": "spc.published",
  "spc.purchased": "spc.purchased",
};

export type ArkEventPayloads = {
  "assessment.completed": { assessmentId: string; jstTotal: number };
  "billing.checkout.completed": {
    sessionId?: string; plan?: string; fromPlan?: string | null;
    toPlan?: string | null; amountCents?: number; transition?: string | null;
  };
  "billing.subscription.canceled": {
    plan: string; immediate?: boolean; effectiveAt?: string;
  };
  "billing.payment.failed": {
    sessionId?: string; plan?: string; amountCents?: number; reason?: string;
  };
  "game.session.finished": {
    sessionId: string;
    scenarioId: string;
    kcseScore: number;
    tier: string | null;
    certUpgradedFrom: string | null;
    certUpgradedTo: string | null;
    newJstTotal: number | null;
  };
  "cert.upgraded": { from: string; to: string };
  "spc.published": { listingId: string; title: string };
  "spc.purchased": {
    listingId: string;
    asRole: "buyer" | "creator";
    isFirstSaleForCreator?: boolean;
  };
};

type Subscriber = { userId: string; res: Response };

class Orchestrator {
  private bus = new EventEmitter();
  private subs = new Set<Subscriber>();

  constructor() {
    this.bus.setMaxListeners(0);
  }

  async emit<T extends keyof ArkEventPayloads>(
    userId: string,
    type: T,
    payload: ArkEventPayloads[T],
    scoreDelta: number,
  ): Promise<ArkEvent | null> {
    try {
      const [row] = await db
        .insert(arkEvents)
        .values({ userId, type, payload: payload as Record<string, unknown>, scoreDelta })
        .returning();
      this.broadcast(userId, row);

      // PDD §3.4 — fire ARK score recalc on every meaningful flywheel event.
      const trigger = EVENT_TO_TRIGGER[type];
      if (trigger) {
        try {
          const { recalcArkForUser } = await import("./arkRecalc");
          const result = await recalcArkForUser({
            userId,
            trigger,
            triggerMeta: { eventId: row.id, payload },
            // cert.upgraded is unbounded; gameplay/marketplace use caps.
            bypassCaps: trigger === "cert.upgraded",
          });
          await this.broadcastIdentity(userId, result);
        } catch (recalcErr) {
          console.error("[orchestrator] recalc failed (best-effort):", trigger, recalcErr);
        }
      }

      // Book Companion (Task #22) — auto-award chapter badges off the same
      // flywheel events. Best-effort + flag-gated inside evaluateBookJourney.
      try {
        const { evaluateBookJourney } = await import("./bookCompanion");
        if (type === "assessment.completed") {
          await evaluateBookJourney(userId, {
            type: "assessment.completed",
            assessmentId: (payload as ArkEventPayloads["assessment.completed"]).assessmentId,
          });
        } else if (type === "game.session.finished") {
          const p = payload as ArkEventPayloads["game.session.finished"];
          await evaluateBookJourney(userId, {
            type: "game.session.finished",
            sessionId: p.sessionId,
            scenarioId: p.scenarioId,
            kcseScore: p.kcseScore,
          });
        } else if (type === "spc.published") {
          const p = payload as ArkEventPayloads["spc.published"];
          await evaluateBookJourney(userId, { type: "spc.published", listingId: p.listingId });
        }
      } catch (bookErr) {
        console.error("[orchestrator] book companion eval failed (best-effort):", type, bookErr);
      }
      return row;
    } catch (err) {
      console.error("[orchestrator] emit failed (best-effort):", type, err);
      return null;
    }
  }

  async broadcastIdentity(userId: string, result: RecalcResult) {
    // Build a *complete* identity payload so subscribed clients can update
    // their dashboard cards in place — no follow-up GET /api/ark/identity or
    // /api/ark/flywheel-cta required (PDD §3.4 perf hardening). The recalc
    // pipeline already persisted user/pillars/lhcs in the same transaction;
    // we re-read so the payload exactly matches what the REST endpoints
    // would have served on the next refetch.
    const snap = result.snapshot;
    let pillarsBlock: Record<string, unknown> | null = null;
    let lhcsBlock: Record<string, unknown> | null = null;
    let flywheel: { top: unknown; ranked: unknown[] } = { top: null, ranked: [] };
    try {
      const [pillarsRow, lhcsRow, latestAssessment] = await Promise.all([
        storage.getCcmiPillars(userId),
        storage.getLhcsSignals(userId),
        storage.getLatestAssessment(userId),
      ]);
      if (pillarsRow) {
        pillarsBlock = {
          P1: pillarsRow.p1, P2: pillarsRow.p2, P3: pillarsRow.p3, P4: pillarsRow.p4,
          P5: pillarsRow.p5, P6: pillarsRow.p6, P7: pillarsRow.p7,
          composite: pillarsRow.composite,
          tier: pillarsRow.tier,
          multiplier: pillarsRow.multiplier,
        };
      }
      if (lhcsRow) {
        lhcsBlock = {
          cprScore: lhcsRow.cprScore,
          mpsScore: lhcsRow.mpsScore,
          lcisScore: lhcsRow.lcisScore,
          cprLight: lhcsRow.cprLight,
          mpsLight: lhcsRow.mpsLight,
          lcisLight: lhcsRow.lcisLight,
          status: lhcsRow.status,
          readinessPct: lhcsRow.readinessPct,
        };
      }
      const ctaInput = {
        user: result.user,
        pillars: pillarsRow ?? null,
        lhcs: lhcsRow ?? null,
        hasResumeUploaded: !!latestAssessment,
      };
      flywheel = {
        top: pickFlywheelCta(ctaInput),
        ranked: rankAllCtas(ctaInput, 3),
      };
    } catch (err) {
      console.error("[orchestrator] identity payload enrichment failed:", err);
    }

    const payload = JSON.stringify({
      // Top-level (back-compat) summary fields used by the live ARK score badge.
      arkScore: snap.arkScore,
      jstIndex: snap.jstIndex,
      ccmi: snap.ccmi,
      ccmiTier: snap.ccmiTier,
      vmstLevel: snap.vmstLevel,
      arkTier: snap.arkTierKey,
      arkIdString: snap.arkIdString,
      appliedDelta: result.appliedDelta,
      capReason: result.capReason,
      // Full identity block — mirrors GET /api/ark/identity response shape so
      // the dashboard can update ArkIdentityCard / pillars / lhcs / flywheel
      // without a follow-up fetch.
      identity: {
        arkScore: snap.arkScore,
        jstIndex: snap.jstIndex,
        ccmi: snap.ccmi,
        ccmiTier: snap.ccmiTier,
        vmstLevel: snap.vmstLevel,
        typology: snap.typology,
        arkIdString: snap.arkIdString,
        resumeReplacementPct: snap.resumeReplacementPct,
      },
      pillars: pillarsBlock,
      lhcs: lhcsBlock,
      flywheel,
    });
    for (const s of Array.from(this.subs)) {
      if (s.userId !== userId) continue;
      try { s.res.write(`event: ark.identity\ndata: ${payload}\n\n`); }
      catch (err) {
        console.error("[orchestrator] identity write failed, removing sub:", err);
        this.subs.delete(s);
        try { s.res.end(); } catch {}
      }
    }
  }

  private broadcast(userId: string, event: ArkEvent) {
    for (const s of Array.from(this.subs)) {
      if (s.userId !== userId) continue;
      try {
        s.res.write(`event: ark.event\ndata: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        console.error("[orchestrator] subscriber write failed, removing:", err);
        this.subs.delete(s);
        try { s.res.end(); } catch {}
      }
    }
  }

  subscribe(userId: string, res: Response): () => void {
    const sub: Subscriber = { userId, res };
    this.subs.add(sub);
    return () => this.subs.delete(sub);
  }

  /** M3 — emit a custom SSE event to a single user across all of their
   *  open EventSource connections. Used by the notification bell. */
  broadcastToUser(userId: string, event: string, payload: unknown): void {
    const json = JSON.stringify(payload);
    for (const s of Array.from(this.subs)) {
      if (s.userId !== userId) continue;
      try { s.res.write(`event: ${event}\ndata: ${json}\n\n`); }
      catch (err) {
        this.subs.delete(s);
        try { s.res.end(); } catch {}
      }
    }
  }

  /** M3 — broadcast a custom SSE event to every connected subscriber. Used
   *  by the ARK Roundtable seat rotation surface so all online clients can
   *  surface the toast without per-user fan-out logic. */
  broadcastAll(event: string, payload: unknown): void {
    const json = JSON.stringify(payload);
    for (const s of Array.from(this.subs)) {
      try { s.res.write(`event: ${event}\ndata: ${json}\n\n`); }
      catch (err) {
        this.subs.delete(s);
        try { s.res.end(); } catch {}
      }
    }
  }

  async getRecentEvents(userId: string, limit = 10): Promise<ArkEvent[]> {
    return db
      .select()
      .from(arkEvents)
      .where(eq(arkEvents.userId, userId))
      .orderBy(desc(arkEvents.createdAt))
      .limit(limit);
  }
}

export const orchestrator = new Orchestrator();
