import { Link } from "wouter";
import { Lock, ArrowRight } from "lucide-react";

interface UpgradeGateProps {
  featureName: string;
  requiredPlan: string;
  children: React.ReactNode;
  hasAccess: boolean;
}

export default function UpgradeGate({ featureName, requiredPlan, children, hasAccess }: UpgradeGateProps) {
  if (hasAccess) return <>{children}</>;

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center" data-testid="upgrade-gate">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Lock className="h-10 w-10 text-primary/60" />
      </div>
      <h2 className="text-2xl font-display font-bold text-white">
        {featureName} Requires Upgrade
      </h2>
      <p className="text-muted-foreground font-mono text-sm max-w-md">
        This feature is available on the <span className="text-primary">{requiredPlan}</span> plan and above.
        Upgrade your subscription to unlock full access.
      </p>
      <Link
        href="/subscription"
        data-testid="button-upgrade-plan"
        className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 rounded-lg transition-all hover:scale-[1.02]"
      >
        View Plans <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
