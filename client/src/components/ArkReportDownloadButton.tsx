import { Link } from "wouter";
import { FileText, Lock } from "lucide-react";
import { FEATURES } from "@shared/featureFlags";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";

/* Dashboard / profile entry point into the ARK Report. Routes to /report — the
   single surface that views, shares (public link), and downloads the full
   artifact (ARK Report + Career Adviser sheet via native print). */
export function ArkReportDownloadButton({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { canAccessReport } = useSubscription();

  if (!FEATURES.executiveReport || !user) return null;

  // Gated surface — route the user to upgrade rather than into a Pro-only report.
  if (!canAccessReport) {
    return (
      <Link href="/subscription" data-testid="link-unlock-ark-report">
        <a
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider border border-amber-300/30 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20 transition-colors ${className}`}
        >
          <Lock className="h-3.5 w-3.5" />
          Unlock ARK Report
        </a>
      </Link>
    );
  }

  return (
    <Link href="/report" data-testid="button-download-ark-report">
      <a
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:scale-[1.02] border border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground ${className}`}
      >
        <FileText className="h-3.5 w-3.5" />
        View &amp; Download ARK Report
      </a>
    </Link>
  );
}

export default ArkReportDownloadButton;
