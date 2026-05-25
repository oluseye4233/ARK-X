import { useEffect, useState } from "react";

// ── M3 — notification & roundtable SSE multiplexing ──────────────────
// All consumers (dashboard, sidebar bell, toaster) share a single
// EventSource via a ref-counted singleton. Opening a second connection
// would double SSE socket pressure and break the per-user broadcast
// fan-out on the server (each subscriber gets its own row in the bus).

export type ArkNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type ArkRoundtableEvent = {
  seatNumber: number;
  listingId: string;
  creatorId: string;
  previousCreatorId?: string;
  score: number;
};

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
  identity?: ArkIdentityFull;
  pillars?: ArkPillarsBlock | null;
  lhcs?: ArkLhcsBlock | null;
  flywheel?: { top: ArkFlywheelCtaBlock | null; ranked: ArkFlywheelCtaBlock[] };
};

type Listener<T> = (v: T) => void;

interface StreamHub {
  refcount: number;
  es: EventSource | null;
  snapshot: ArkSnapshot | null;
  identity: ArkIdentityUpdate | null;
  events: ArkEvent[];
  pulse: number;
  // listeners
  onSnapshot: Set<Listener<ArkSnapshot>>;
  onEvent: Set<Listener<ArkEvent>>;
  onIdentity: Set<Listener<ArkIdentityUpdate>>;
  onNotif: Set<Listener<ArkNotification>>;
  onSeat: Set<Listener<ArkRoundtableEvent>>;
}

const hub: StreamHub = {
  refcount: 0,
  es: null,
  snapshot: null,
  identity: null,
  events: [],
  pulse: 0,
  onSnapshot: new Set(),
  onEvent: new Set(),
  onIdentity: new Set(),
  onNotif: new Set(),
  onSeat: new Set(),
};

function emit<T>(set: Set<Listener<T>>, v: T) {
  for (const l of Array.from(set)) {
    try { l(v); } catch {}
  }
}

function connect() {
  if (hub.es) return;
  const es = new EventSource("/api/ark-score/stream", { withCredentials: true });
  hub.es = es;

  es.addEventListener("ark.snapshot", (e: MessageEvent) => {
    try {
      const snap = JSON.parse(e.data) as ArkSnapshot;
      hub.snapshot = snap;
      hub.events = snap.recent || [];
      emit(hub.onSnapshot, snap);
    } catch {}
  });
  es.addEventListener("ark.event", (e: MessageEvent) => {
    try {
      const ev = JSON.parse(e.data) as ArkEvent;
      hub.events = [ev, ...hub.events].slice(0, 10);
      hub.pulse += 1;
      if (hub.snapshot) {
        const newJstTotal =
          ev.type === "game.session.finished" && typeof ev.payload.newJstTotal === "number"
            ? ev.payload.newJstTotal
            : hub.snapshot.jstTotal + ev.scoreDelta;
        hub.snapshot = { ...hub.snapshot, jstTotal: Math.min(300, newJstTotal) };
      }
      emit(hub.onEvent, ev);
    } catch {}
  });
  es.addEventListener("ark.identity", (e: MessageEvent) => {
    try {
      const upd = JSON.parse(e.data) as ArkIdentityUpdate;
      hub.identity = upd;
      if (hub.snapshot) {
        hub.snapshot = {
          ...hub.snapshot,
          arkScore: upd.arkScore,
          ccmi: upd.ccmi,
          ccmiTier: upd.ccmiTier,
          vmstLevel: upd.vmstLevel,
          arkIdString: upd.arkIdString,
          jstTotal: upd.jstIndex,
        };
      }
      emit(hub.onIdentity, upd);
    } catch {}
  });
  es.addEventListener("notification.new", (e: MessageEvent) => {
    try { emit(hub.onNotif, JSON.parse(e.data) as ArkNotification); } catch {}
  });
  es.addEventListener("roundtable.seat_rotation", (e: MessageEvent) => {
    try { emit(hub.onSeat, JSON.parse(e.data) as ArkRoundtableEvent); } catch {}
  });
  es.onerror = () => {};
}

function acquire(): () => void {
  hub.refcount += 1;
  if (hub.refcount === 1) connect();
  return () => {
    hub.refcount -= 1;
    if (hub.refcount <= 0) {
      hub.refcount = 0;
      hub.es?.close();
      hub.es = null;
    }
  };
}

/** Full hook — exposes snapshot/events/pulse/lastIdentity to subscribers. */
export function useArkStream(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<ArkSnapshot | null>(hub.snapshot);
  const [events, setEvents] = useState<ArkEvent[]>(hub.events);
  const [pulse, setPulse] = useState(hub.pulse);
  const [lastIdentity, setLastIdentity] = useState<ArkIdentityUpdate | null>(hub.identity);

  useEffect(() => {
    if (!enabled) return;
    const release = acquire();
    const sl = (s: ArkSnapshot) => { setSnapshot(s); setEvents(s.recent || []); };
    const el = (_e: ArkEvent) => {
      if (hub.snapshot) setSnapshot(hub.snapshot);
      setEvents(hub.events);
      setPulse(hub.pulse);
    };
    const il = (u: ArkIdentityUpdate) => {
      setLastIdentity(u);
      if (hub.snapshot) setSnapshot(hub.snapshot);
    };
    hub.onSnapshot.add(sl);
    hub.onEvent.add(el);
    hub.onIdentity.add(il);
    return () => {
      hub.onSnapshot.delete(sl);
      hub.onEvent.delete(el);
      hub.onIdentity.delete(il);
      release();
    };
  }, [enabled]);

  return { snapshot, events, pulse, lastIdentity };
}

/** Lightweight subscription hook for components that only care about
 *  notifications + roundtable rotations (e.g. the sidebar bell). */
export function useNotificationStream(
  enabled: boolean,
  onNotif?: Listener<ArkNotification>,
  onSeat?: Listener<ArkRoundtableEvent>,
) {
  useEffect(() => {
    if (!enabled) return;
    const release = acquire();
    if (onNotif) hub.onNotif.add(onNotif);
    if (onSeat) hub.onSeat.add(onSeat);
    return () => {
      if (onNotif) hub.onNotif.delete(onNotif);
      if (onSeat) hub.onSeat.delete(onSeat);
      release();
    };
  }, [enabled, onNotif, onSeat]);
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
