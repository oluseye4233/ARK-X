import { Hexagon } from "lucide-react";
import UpgradeGate from "@/components/UpgradeGate";
import type { LivingResumePrefill } from "./types";

interface Props {
  arkScore: LivingResumePrefill["arkScore"] | null;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  hasAccess: boolean;
}

// LRD-301 (badge half): renders the ARK Score/JST tier as a static value at
// the time the resume is generated — this panel never live-refetches after
// export, matching the "static file by design" rule shared with the SPC
// Auto-Sync toggle.
export function ArkScoreBadge({ arkScore, enabled, onToggle, hasAccess }: Props) {
  return (
    <UpgradeGate hasAccess={hasAccess} requiredPlan="Pro" featureName="ARK Score Badge">
      <div className="space-y-2" data-testid="ark-score-badge-step">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            data-testid="checkbox-ark-score-enabled"
          />
          Show my ARK Score badge on the exported resume
        </label>
        {enabled && arkScore && (
          <div className="glass-card rounded-lg border border-white/10 p-3 inline-flex items-center gap-3 w-fit">
            <Hexagon className="h-6 w-6 text-secondary" />
            <div>
              <p className="font-display text-2xl font-bold text-white leading-none">
                {arkScore.total}
                <span className="text-xs text-muted-foreground font-mono ml-1">/600</span>
              </p>
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                JST {arkScore.jstIndex} · {arkScore.ccmiTier ?? "—"}
              </p>
            </div>
          </div>
        )}
      </div>
    </UpgradeGate>
  );
}
