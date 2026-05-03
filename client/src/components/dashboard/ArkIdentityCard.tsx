import { Hexagon, Fingerprint, TrendingUp } from "lucide-react";
import { ARK_TIERS, type ArkTierKey } from "@shared/schema";
import { getNextTier } from "@/lib/arkCoaching";

export type ArkIdentity = {
  arkScore: number;
  jstIndex: number;
  ccmi: number;
  ccmiTier: string;
  vmstLevel: string;
  typology: string | null;
  arkIdString: string | null;
  resumeReplacementPct: number;
};

const TIER_COLOR: Record<ArkTierKey, string> = {
  Legendary: "text-fuchsia-400 border-fuchsia-400/40",
  Exceptional: "text-cyan-300 border-cyan-300/40",
  Strong: "text-emerald-400 border-emerald-400/40",
  Capable: "text-amber-300 border-amber-300/40",
  Developing: "text-orange-400 border-orange-400/40",
  Foundation: "text-rose-400 border-rose-400/40",
};

// Single source of truth for tier thresholds — derived directly from
// shared/schema.ts ARK_TIERS so the client can never drift from the
// PDD-canonical bands enforced server-side.
function tierFromScore(s: number): ArkTierKey {
  const band = ARK_TIERS.find((b) => s >= b.min && s <= b.max);
  return (band?.key ?? "Foundation") as ArkTierKey;
}

export function ArkIdentityCard({ identity }: { identity: ArkIdentity }) {
  const tier = tierFromScore(identity.arkScore);
  const tierClass = TIER_COLOR[tier];
  const next = getNextTier(identity.arkScore);
  return (
    <div
      className={`glass-card p-6 rounded-xl border-2 ${tierClass.split(" ")[1]}`}
      data-testid="card-ark-identity"
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Hexagon className={`h-10 w-10 ${tierClass.split(" ")[0]}`} />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              ARK Score
            </p>
            <p
              className="text-5xl font-display font-bold text-white leading-none"
              data-testid="text-ark-score"
            >
              {identity.arkScore}
              <span className="text-base text-muted-foreground font-mono ml-1">/600</span>
            </p>
            <p className={`text-xs font-mono uppercase tracking-widest mt-1 ${tierClass.split(" ")[0]}`}>
              {tier} · VMST {identity.vmstLevel}
            </p>
            {next.nextTier ? (
              <div
                className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-white/10 bg-white/5"
                data-testid="badge-next-tier"
              >
                <TrendingUp className="h-3 w-3 text-secondary" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-white">
                  Next tier{" "}
                  <span className="text-secondary" data-testid="text-next-tier-name">
                    {next.nextTier}
                  </span>{" "}
                  in{" "}
                  <span className="text-secondary tabular-nums" data-testid="text-next-tier-points">
                    {next.pointsToNext}
                  </span>{" "}
                  pts
                </span>
                <span
                  className="font-mono text-[10px] text-muted-foreground normal-case ml-1"
                  data-testid="text-next-tier-path"
                >
                  · {next.pathLabel}
                </span>
              </div>
            ) : (
              <div
                className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-fuchsia-400/30 bg-fuchsia-400/5"
                data-testid="badge-next-tier"
              >
                <TrendingUp className="h-3 w-3 text-fuchsia-300" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-200">
                  Top tier · maintain weekly
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">JST</p>
            <p className="text-xl font-display font-bold text-secondary" data-testid="text-jst-index">
              {identity.jstIndex}<span className="text-xs text-muted-foreground">/300</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">CCMI</p>
            <p className="text-xl font-display font-bold text-primary" data-testid="text-ccmi">
              {identity.ccmi}<span className="text-xs text-muted-foreground">/300</span>
            </p>
            <p className="text-[10px] font-mono text-muted-foreground">{identity.ccmiTier}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Typology</p>
            <p className="text-xs font-mono text-white">{identity.typology ?? "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-muted-foreground tracking-widest">Replacement %</p>
            <p className="text-xs font-mono text-rose-300" data-testid="text-replacement-pct">
              {identity.resumeReplacementPct}%
            </p>
          </div>
        </div>
      </div>
      {identity.arkIdString && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
          <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
          <p
            className="font-mono text-xs text-muted-foreground uppercase tracking-widest flex-1"
            data-testid="text-ark-id-string"
          >
            ARK-ID · {identity.arkIdString}
          </p>
          <button
            type="button"
            onClick={() => {
              if (identity.arkIdString) {
                navigator.clipboard?.writeText(identity.arkIdString).catch(() => {});
              }
            }}
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-white transition-colors px-2 py-0.5 rounded border border-white/10 hover:border-white/30"
            data-testid="button-copy-ark-id"
            aria-label="Copy ARK ID"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
