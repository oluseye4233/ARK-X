import { EventEmitter } from "events";
import type { Response } from "express";
import { db } from "./db";
import { arkEvents, type ArkEvent, type ArkEventType } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export type ArkEventPayloads = {
  "assessment.completed": { assessmentId: string; jstTotal: number };
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

  async emit<T extends ArkEventType>(
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
      return row;
    } catch (err) {
      console.error("[orchestrator] emit failed (best-effort):", type, err);
      return null;
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
