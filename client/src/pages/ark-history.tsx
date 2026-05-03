import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, ArrowLeft, TrendingUp, Lightbulb, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { getWeakestPillar, getNextTier } from "@/lib/arkCoaching";
import type { CcmiPillarKey } from "@shared/schema";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  ReferenceDot,
} from "recharts";

type HistoryTriggerMeta = {
  capReason?: string | null;
  rawDelta?: number;
  selfOnly?: boolean;
  eventId?: string;
  [key: string]: unknown;
};

type HistoryRow = {
  id: string;
  arkScore: number;
  jstIndex: number;
  ccmi: number;
  delta: number;
  trigger: string;
  triggerMeta: HistoryTriggerMeta | null;
  createdAt: string;
};

const TRIGGER_LABEL: Record<string, string> = {
  "assessment.completed": "Assessment",
  "ccge.session": "CCGE Session",
  "cert.upgraded": "Cert Upgrade",
  "spc.published": "SPC Published",
  "spc.sold": "SPC Sold",
  "spc.purchased": "SPC Purchased",
  "endorsement.received": "Endorsement",
  "manual.recompute": "Manual Recalc",
  "backfill": "Backfill",
};

type CcmiPillarsLite = Record<"P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7", number>;
const PILLAR_LABELS: Record<keyof CcmiPillarsLite, string> = {
  P1: "System", P2: "Role", P3: "Instruction", P4: "Example",
  P5: "Constraint", P6: "Format", P7: "Data",
};

export default function ArkHistoryPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [pillars, setPillars] = useState<CcmiPillarsLite | null>(null);
  const [arkScore, setArkScore] = useState(0);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.getArkHistory(days).catch(() => [] as HistoryRow[]),
      api.getArkIdentity().catch(() => null),
    ])
      .then(([r, id]) => {
        setRows(Array.isArray(r) ? (r as HistoryRow[]) : []);
        const idTyped = id as { pillars?: CcmiPillarsLite; arkScore?: number } | null;
        setPillars(idTyped?.pillars ?? null);
        setArkScore(idTyped?.arkScore ?? 0);
      })
      .finally(() => setLoading(false));
  }, [user, days]);

  const weakest = getWeakestPillar(pillars as Partial<Record<CcmiPillarKey, number>> | null);
  const nextTier = getNextTier(arkScore);

  const chartData = rows.map((r, i) => ({
    label: `#${i + 1}`,
    date: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    ark: r.arkScore,
    jst: r.jstIndex,
    ccmi: r.ccmi,
    delta: r.delta,
    trigger: r.trigger,
  }));

  // Stat cards (PDD ARK-MVP-005 history surface):
  //   1) Highest ARK in window
  //   2) ΔARK this calendar month
  //   3) Best CCMI pillar lift over last 30 days (heuristic: ccmi delta)
  //   4) Days active = unique days with at least one recalc event
  const highest = rows.reduce((m, r) => Math.max(m, r.arkScore), 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthDelta = rows
    .filter((r) => new Date(r.createdAt) >= startOfMonth)
    .reduce((s, r) => s + r.delta, 0);
  const last30 = new Date(Date.now() - 30 * 86400_000);
  const recent = rows.filter((r) => new Date(r.createdAt) >= last30);
  const ccmiLift30 = recent.length
    ? recent[recent.length - 1].ccmi - recent[0].ccmi
    : 0;
  const daysActive = new Set(
    rows.map((r) => new Date(r.createdAt).toISOString().slice(0, 10)),
  ).size;

  // Annotate the chart with either large-magnitude events (|delta| ≥ 5)
  // or key trigger types (publish/purchase/cert) regardless of magnitude,
  // so low-delta but product-significant events still surface as markers.
  const KEY_TRIGGERS = new Set([
    "assessment.completed",
    "cert.upgraded",
    "spc.published",
    "spc.sold",
    "spc.purchased",
  ]);
  const annotations = chartData
    .map((d, idx) => ({ ...d, idx }))
    .filter((d) => Math.abs(d.delta) >= 5 || KEY_TRIGGERS.has(d.trigger))
    .slice(0, 12);

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading ARK timeline...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-mono text-muted-foreground hover:text-primary uppercase tracking-widest mb-2"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            ARK Score · Timeline
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Every recalc, capped delta, and flywheel trigger over the last {days} days.
          </p>
        </div>
        <div className="flex gap-2">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              data-testid={`button-window-${d}`}
              className={`px-3 py-1.5 font-mono text-xs uppercase tracking-widest border ${
                days === d
                  ? "bg-primary/20 border-primary text-primary"
                  : "border-white/10 text-muted-foreground hover:border-white/30"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Coaching panel — same "Why this score / What unlocks the next tier" surface as the dashboard. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          className="glass-card p-4 rounded-xl border border-secondary/20"
          data-testid="card-history-next-tier"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-secondary" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-secondary">
              What unlocks the next tier
            </p>
          </div>
          {nextTier.nextTier ? (
            <>
              <p className="font-display font-bold text-lg text-white">
                Next tier{" "}
                <span className="text-secondary" data-testid="text-history-next-tier-name">
                  {nextTier.nextTier}
                </span>{" "}
                in{" "}
                <span className="text-secondary tabular-nums" data-testid="text-history-next-tier-points">
                  {nextTier.pointsToNext}
                </span>{" "}
                pts
              </p>
              <p
                className="font-mono text-xs text-muted-foreground mt-1"
                data-testid="text-history-next-tier-path"
              >
                Cheapest path: {nextTier.pathLabel}
              </p>
            </>
          ) : (
            <p className="font-mono text-xs text-fuchsia-200">
              Top tier reached — maintain with a weekly CCGE drill.
            </p>
          )}
        </div>
        <div
          className="glass-card p-4 rounded-xl border border-rose-400/20"
          data-testid="card-history-weakest-tip"
        >
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-rose-300" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">
              Why this score
            </p>
          </div>
          {weakest ? (
            <>
              <p className="font-display font-bold text-sm text-white">
                {weakest.key} · {weakest.label}{" "}
                <span className="text-muted-foreground font-mono text-xs">
                  ({weakest.score}/100)
                </span>
              </p>
              <p
                className="font-mono text-xs text-white/80 mt-1 leading-relaxed"
                data-testid="text-history-weakest-tip"
              >
                {weakest.tip}
              </p>
              <Link
                href="/play"
                className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded border border-rose-400/40 hover:border-rose-300 hover:bg-rose-400/10 transition-all font-mono text-[10px] uppercase tracking-widest text-rose-200"
                data-testid="link-history-practice-pillar"
              >
                Practice in CCGE
                <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">
              Finish a CCGE session to unlock pillar coaching.
            </p>
          )}
        </div>
      </div>

      {/* PDD ARK-MVP-005 stat row — Highest / Month Δ / Best Pillar Lift / Days Active */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-4 rounded-xl border border-primary/20" data-testid="stat-highest">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Highest ARK
          </p>
          <p className="text-2xl font-display font-bold text-primary mt-1 tabular-nums">{highest}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-secondary/20" data-testid="stat-month-delta">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            This Month Δ
          </p>
          <p
            className={`text-2xl font-display font-bold mt-1 tabular-nums ${
              monthDelta >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {monthDelta >= 0 ? "+" : ""}{monthDelta}
          </p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-purple-400/20" data-testid="stat-best-pillar">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Top CCMI Pillar
          </p>
          {(() => {
            const entries = pillars
              ? (Object.entries(pillars) as [keyof CcmiPillarsLite, number][])
                  .sort((a, b) => b[1] - a[1])
              : [];
            const top = entries[0];
            return top ? (
              <>
                <p className="text-2xl font-display font-bold text-purple-300 mt-1 tabular-nums">
                  {PILLAR_LABELS[top[0]]}
                </p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {top[0]} · {top[1]}/100 · CCMI Δ {ccmiLift30 >= 0 ? "+" : ""}{ccmiLift30}
                </p>
              </>
            ) : (
              <p className="text-2xl font-display font-bold text-purple-300/40 mt-1">—</p>
            );
          })()}
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/10" data-testid="stat-days-active">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Days Active
          </p>
          <p className="text-2xl font-display font-bold text-white mt-1 tabular-nums">{daysActive}</p>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl" data-testid="card-history-chart">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">
            Score Trajectory
          </h3>
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {rows.length} recalc events
          </span>
        </div>
        {chartData.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground py-12 text-center">
            No score events yet. Upload a resume or play a CCGE session to begin.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="arkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00B4D8" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#00B4D8" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="jstGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFDD00" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#FFDD00" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ccmiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#AA44FF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#AA44FF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11, fontFamily: "monospace" }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} domain={[0, 600]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1f35",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }} />
              <Area type="monotone" dataKey="ark" stroke="#00B4D8" fill="url(#arkGrad)" strokeWidth={2} name="ARK" />
              <Area type="monotone" dataKey="jst" stroke="#FFDD00" fill="url(#jstGrad)" strokeWidth={1.5} name="JST" />
              <Area type="monotone" dataKey="ccmi" stroke="#AA44FF" fill="url(#ccmiGrad)" strokeWidth={1.5} name="CCMI" />
              {annotations.map((a) => (
                <ReferenceDot
                  key={`ann-${a.idx}`}
                  x={a.date}
                  y={a.ark}
                  r={4}
                  fill={a.delta >= 0 ? "#34D399" : "#F87171"}
                  stroke="#0B1020"
                  strokeWidth={1.5}
                  label={{
                    value: `${TRIGGER_LABEL[a.trigger] ?? a.trigger} ${a.delta >= 0 ? "+" : ""}${a.delta}`,
                    position: "top",
                    fill: "#888",
                    fontFamily: "monospace",
                    fontSize: 9,
                  }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="glass-card p-6 rounded-xl" data-testid="card-history-list">
        <h3 className="font-display font-bold text-sm text-primary uppercase tracking-widest mb-4">
          Event Log
        </h3>
        {rows.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No events.</p>
        ) : (
          <div className="space-y-1">
            {[...rows].reverse().map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs font-mono py-1.5 border-b border-white/5 last:border-0"
                data-testid={`row-history-${r.id}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(r.createdAt).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className="text-primary uppercase tracking-widest">
                    {TRIGGER_LABEL[r.trigger] ?? r.trigger}
                  </span>
                  {r.triggerMeta?.capReason && (
                    <span className="text-amber-400 text-[10px]">[{r.triggerMeta.capReason}]</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      r.delta > 0 ? "text-emerald-400" : r.delta < 0 ? "text-rose-400" : "text-muted-foreground"
                    }
                  >
                    {r.delta > 0 ? "+" : ""}{r.delta}
                  </span>
                  <span className="text-white tabular-nums">ARK {r.arkScore}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
