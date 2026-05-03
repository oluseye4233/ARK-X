import { EventEmitter } from "events";
import type { Response } from "express";
import { db } from "./db";
import { arkEvents, type ArkEvent, type ArkEventType, type ArkTriggerType } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { RecalcResult } from "./arkRecalc";

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
          this.broadcastIdentity(userId, result);
        } catch (recalcErr) {
          console.error("[orchestrator] recalc failed (best-effort):", trigger, recalcErr);
        }
      }
      return row;
    } catch (err) {
      console.error("[orchestrator] emit failed (best-effort):", type, err);
      return null;
    }
  }

  broadcastIdentity(userId: string, result: RecalcResult) {
    const payload = JSON.stringify({
      arkScore: result.snapshot.arkScore,
      jstIndex: result.snapshot.jstIndex,
      ccmi: result.snapshot.ccmi,
      ccmiTier: result.snapshot.ccmiTier,
      vmstLevel: result.snapshot.vmstLevel,
      arkTier: result.snapshot.arkTierKey,
      arkIdString: result.snapshot.arkIdString,
      appliedDelta: result.appliedDelta,
      capReason: result.capReason,
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
