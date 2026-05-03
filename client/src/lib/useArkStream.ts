import { useEffect, useState } from "react";

export type ArkEvent = {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, any>;
  scoreDelta: number;
  createdAt: string;
};

export type ArkSnapshot = {
  jstTotal: number;
  jstSkills: number;
  arkScore: number;
  ccmi: number;
  ccmiTier: string;
  vmstLevel: string;
  arkIdString: string | null;
  lhcsStatus: "green" | "amber" | "red";
  recent: ArkEvent[];
};

export type ArkIdentityFull = {
  arkScore: number;
  jstIndex: number;
  ccmi: number;
  ccmiTier: string;
  vmstLevel: string;
  typology: string | null;
  arkIdString: string | null;
  resumeReplacementPct: number;
};

export type ArkPillarsBlock = {
  P1: number; P2: number; P3: number; P4: number; P5: number; P6: number; P7: number;
  composite: number;
  tier: string;
  multiplier: number;
};

export type ArkLhcsBlock = {
  cprScore: number;
  mpsScore: number;
  lcisScore: number;
  cprLight: "green" | "amber" | "red";
  mpsLight: "green" | "amber" | "red";
  lcisLight: "green" | "amber" | "red";
  status: "green" | "amber" | "red";
  readinessPct: number;
};

export type ArkFlywheelCtaBlock = {
  position: number;
  id: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  ctaHref: string;
  pillar?: string;
  expectedDelta: number;
  urgency: "critical" | "high" | "medium" | "low";
};

export type ArkIdentityUpdate = {
  arkScore: number;
  jstIndex: number;
  ccmi: number;
  ccmiTier: string;
  vmstLevel: string;
  arkTier: string;
  arkIdString: string | null;
  appliedDelta: number;
  capReason: string | null;
  // Full payload added so dashboard cards can update in place without an
  // extra fetch on every score tick. Optional for back-compat with any
  // older server build still emitting the minimal shape.
  identity?: ArkIdentityFull;
  pillars?: ArkPillarsBlock | null;
  lhcs?: ArkLhcsBlock | null;
  flywheel?: { top: ArkFlywheelCtaBlock | null; ranked: ArkFlywheelCtaBlock[] };
};

export function useArkStream(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(null);
  const [events, setEvents] = useState<ArkEvent[]>([]);
  const [pulse, setPulse] = useState(0);
  const [lastIdentity, setLastIdentity] = useState<ArkIdentityUpdate | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/ark-score/stream", { withCredentials: true });

    es.addEventListener("ark.snapshot", (e: MessageEvent) => {
      const snap = JSON.parse(e.data) as ArkSnapshot;
      setSnapshot(snap);
      setEvents(snap.recent || []);
    });

    es.addEventListener("ark.event", (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as ArkEvent;
      setEvents((prev) => [ev, ...prev].slice(0, 10));
      setPulse((p) => p + 1);
      setSnapshot((s) => {
        if (!s) return s;
        const newJstTotal =
          ev.type === "game.session.finished" && typeof ev.payload.newJstTotal === "number"
            ? ev.payload.newJstTotal
            : s.jstTotal + ev.scoreDelta;
        return { ...s, jstTotal: Math.min(300, newJstTotal) };
      });
    });

    es.addEventListener("ark.identity", (e: MessageEvent) => {
      const upd = JSON.parse(e.data) as ArkIdentityUpdate;
      setLastIdentity(upd);
      setSnapshot((s) =>
        s
          ? {
              ...s,
              arkScore: upd.arkScore,
              ccmi: upd.ccmi,
              ccmiTier: upd.ccmiTier,
              vmstLevel: upd.vmstLevel,
              arkIdString: upd.arkIdString,
              jstTotal: upd.jstIndex,
            }
          : s,
      );
    });

    es.onerror = () => {};
    return () => es.close();
  }, [enabled]);

  return { snapshot, events, pulse, lastIdentity };
}

export function describeEvent(e: ArkEvent): string {
  switch (e.type) {
    case "game.session.finished": {
      const tier = e.payload.tier ? ` — ${e.payload.tier}` : "";
      return `CCGE session finished${tier} (KCSE ${e.payload.kcseScore})`;
    }
    case "cert.upgraded":
      return `Cert upgraded ${e.payload.from} → ${e.payload.to}`;
    case "spc.published":
      return `Published "${e.payload.title}"`;
    case "spc.purchased":
      return e.payload.asRole === "creator"
        ? `SPC sold${e.payload.isFirstSaleForCreator ? " (first sale!)" : ""}`
        : `SPC purchased`;
    case "assessment.completed":
      return `Assessment completed (JST ${e.payload.jstTotal})`;
    default:
      return e.type;
  }
}
