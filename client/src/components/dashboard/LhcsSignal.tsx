import { Activity } from "lucide-react";

type Light = "green" | "amber" | "red";

const LIGHT_CLASS: Record<Light, string> = {
  green: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]",
  amber: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.7)]",
  red: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)]",
};

const LIGHT_LABEL: Record<Light, string> = {
  green: "READY",
  amber: "WARMING",
  red: "OFFLINE",
};

export type LhcsData = {
  cprScore: number;
  mpsScore: number;
  lcisScore: number;
  cprLight: Light;
  mpsLight: Light;
  lcisLight: Light;
  status: Light;
  readinessPct: number;
};

export function LhcsSignal({ data }: { data: LhcsData | null }) {
  const status: Light = data?.status ?? "red";
  return (
    <div
      className="glass-card p-5 rounded-xl border border-primary/30"
      data-testid="card-lhcs-signal"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-sm text-primary uppercase tracking-widest">
            LHCS — Live Human Career Signal
          </h3>
        </div>
        <div className="flex items-center gap-2" data-testid="status-lhcs-overall">
          <span className={`h-3 w-3 rounded-full ${LIGHT_CLASS[status]}`} />
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/80">
            {LIGHT_LABEL[status]} · {data?.readinessPct ?? 0}%
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "cpr", label: "CPR", sub: "Career Pivot Readiness", score: data?.cprScore ?? 0, light: data?.cprLight ?? "red" },
          { key: "mps", label: "MPS", sub: "Marketplace Productivity", score: data?.mpsScore ?? 0, light: data?.mpsLight ?? "red" },
          { key: "lcis", label: "LCIS", sub: "Live Career Intent", score: data?.lcisScore ?? 0, light: data?.lcisLight ?? "red" },
        ].map((s) => (
          <div
            key={s.key}
            className="border border-white/10 rounded-lg p-3 bg-black/20"
            data-testid={`card-lhcs-${s.key}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.label}
              </span>
              <span className={`h-2.5 w-2.5 rounded-full ${LIGHT_CLASS[s.light as Light]}`} />
            </div>
            <p
              className="text-2xl font-display font-bold text-white"
              data-testid={`text-lhcs-${s.key}-score`}
            >
              {s.score}
              <span className="text-xs text-muted-foreground font-mono">/100</span>
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase tracking-wider">
              {s.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
