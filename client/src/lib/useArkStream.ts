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
  recent: ArkEvent[];
};

export function useArkStream(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(null);
  const [events, setEvents] = useState<ArkEvent[]>([]);
  const [pulse, setPulse] = useState(0);

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

    es.onerror = () => {
    };

    return () => es.close();
  }, [enabled]);

  return { snapshot, events, pulse };
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
