import { Sparkles } from "lucide-react";
import UpgradeGate from "@/components/UpgradeGate";
import type { LivingResumeSpcListing } from "./types";

interface Props {
  listings: LivingResumeSpcListing[];
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  hasAccess: boolean;
}

// LRD-201: read-only cards over the subscriber's own SPHINX Marketplace
// listings (already fetched server-side in the prefill payload — no
// duplicate marketplace write path here). Gated Pro+ per PDD §5.
export function SpcPortfolioPanel({ listings, enabled, onToggle, hasAccess }: Props) {
  return (
    <UpgradeGate hasAccess={hasAccess} requiredPlan="Pro" featureName="SPC Portfolio Panel">
      <div className="space-y-3" data-testid="spc-portfolio-panel">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            data-testid="checkbox-spc-panel-enabled"
          />
          Show my SPC Portfolio on the exported resume
        </label>

        {enabled && (
          listings.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              You haven't published any active SPHINX Marketplace listings yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {listings.map((l) => (
                <div key={l.id} className="glass-card rounded-lg border border-white/10 p-3" data-testid={`spc-listing-${l.id}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <p className="font-display text-sm text-white truncate">{l.title}</p>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                    {l.pillar}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-muted-foreground">
                    {l.hiveScore != null && <span>HIVE {l.hiveScore}</span>}
                    {l.kcseScore != null && <span>JCSE {l.kcseScore}</span>}
                    <span>{l.salesCount} sold</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </UpgradeGate>
  );
}
