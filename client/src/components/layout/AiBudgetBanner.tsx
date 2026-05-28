import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

type AiStatus = {
  available: boolean;
  plan: string;
  guardrailActive: boolean;
  ratioPct: number;
  upgradeAtPct: 80;
  hardStopAtPct: 100;
  usage: { total: number; costCents: number };
  caps: { tokenCap: number; costCapCents: number };
  remaining: { tokens: number; costCents: number };
};

export function AiBudgetBanner() {
  const { user } = useAuth();
  const { data } = useQuery<AiStatus>({
    queryKey: ["/api/ai/status"],
    enabled: !!user,
    refetchInterval: 60_000,
  });

  if (!user || !data || !data.guardrailActive) return null;
  if (data.ratioPct < data.upgradeAtPct) return null;

  const hardStop = data.ratioPct >= data.hardStopAtPct;
  const ctaHref = data.plan === "ENTERPRISE" ? "/contact" : "/subscription";

  return (
    <div
      className={
        hardStop
          ? "border-b border-destructive/60 bg-destructive/10 text-destructive-foreground"
          : "border-b border-amber-500/60 bg-amber-500/10 text-amber-100"
      }
      data-testid="banner-ai-budget"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          {hardStop ? (
            <ShieldAlert className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span data-testid="text-ai-budget-message">
            {hardStop
              ? `AI cap reached — ${data.ratioPct}% of your ${data.plan.replace("_", " ").toLowerCase()} budget consumed.`
              : `${data.ratioPct}% of your AI budget used. Upgrade to keep generating.`}
          </span>
        </div>
        <Link
          href={ctaHref}
          className={
            hardStop
              ? "rounded bg-destructive px-3 py-1 text-xs font-semibold text-white hover:bg-destructive/80"
              : "rounded border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/20"
          }
          data-testid="link-ai-budget-upgrade"
        >
          {data.plan === "ENTERPRISE" ? "Contact sales" : "Upgrade plan"}
        </Link>
      </div>
    </div>
  );
}
