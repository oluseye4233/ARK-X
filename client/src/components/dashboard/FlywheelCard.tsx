import { Link } from "wouter";
import { Sparkles, ArrowRight } from "lucide-react";

export type FlywheelUrgency = "critical" | "high" | "medium" | "low";

export type FlywheelCta = {
  position: number;
  id: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  ctaHref: string;
  pillar?: string;
  expectedDelta: number;
  urgency: FlywheelUrgency;
};

const URGENCY_BADGE: Record<FlywheelUrgency, string> = {
  critical: "border-rose-500/60 text-rose-300 bg-rose-500/10",
  high: "border-rose-400/40 text-rose-300",
  medium: "border-amber-300/40 text-amber-200",
  low: "border-emerald-400/40 text-emerald-300",
};

export function FlywheelCard({
  top,
  ranked,
}: {
  top: FlywheelCta | null;
  ranked: FlywheelCta[];
}) {
  if (!top) {
    return (
      <div className="glass-card p-5 rounded-xl border border-secondary/30" data-testid="card-flywheel-cta">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-secondary" />
          <h3 className="font-display font-bold text-sm text-secondary uppercase tracking-widest">
            Flywheel · Idle
          </h3>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          No high-leverage moves queued. Upload a resume or play a CCGE round to seed the flywheel.
        </p>
      </div>
    );
  }
  const badge = URGENCY_BADGE[top.urgency];
  return (
    <div
      className="glass-card p-5 rounded-xl border border-secondary/30"
      data-testid="card-flywheel-cta"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-secondary" />
          <h3 className="font-display font-bold text-sm text-secondary uppercase tracking-widest">
            Flywheel · Branch {top.position} of 10
          </h3>
        </div>
        <span
          className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded ${badge}`}
          data-testid="badge-flywheel-urgency"
        >
          {top.urgency}
        </span>
      </div>
      <Link
        href={top.ctaHref}
        className="block border border-secondary/40 hover:border-secondary hover:bg-secondary/10 transition-all rounded-lg p-4"
        data-testid={`button-flywheel-cta-${top.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p
              className="font-display font-bold text-white text-base"
              data-testid="text-flywheel-cta-headline"
            >
              {top.headline}
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-1 leading-relaxed">{top.subtext}</p>
            <p className="font-mono text-[11px] text-secondary mt-2 uppercase tracking-widest">
              → {top.ctaLabel}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-secondary text-sm font-bold">
              +{top.expectedDelta}
            </span>
            <ArrowRight className="h-4 w-4 text-secondary" />
          </div>
        </div>
      </Link>
      {ranked.length > 1 && (
        <div className="mt-3 space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Also worth doing
          </p>
          {ranked.slice(1, 3).map((c) => (
            <Link
              key={c.id}
              href={c.ctaHref}
              className="flex items-center justify-between text-xs font-mono text-white/70 hover:text-white border-l-2 border-white/10 hover:border-secondary pl-2 py-0.5"
              data-testid={`link-flywheel-cta-${c.id}`}
            >
              <span className="truncate">{c.headline}</span>
              <span className="text-secondary/70">+{c.expectedDelta}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
