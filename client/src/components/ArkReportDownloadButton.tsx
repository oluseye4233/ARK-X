import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { FileText, Loader2, Lock } from "lucide-react";
import { FEATURES } from "@shared/featureFlags";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { api } from "@/lib/api";
import { ArkReportSheet } from "@/pages/report";
import { reportFileStamp, exportReportPdf } from "@/lib/arkReportExport";

/* One-click "Download My ARK Report" — fetches the user's ARK data, renders the
   branded report sheet off-screen, and exports it as a single-page PDF. Reuses
   ArkReportSheet + the shared export helpers so it stays identical to /report. */
export function ArkReportDownloadButton({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { canAccessReport } = useSubscription();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [identity, setIdentity] = useState<any>(null);
  const [lhcs, setLhcs] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !canAccessReport) return;
    let active = true;
    Promise.all([
      api.getLatestAssessment(user.id).catch(() => null),
      api.getArkIdentity().catch(() => null),
      api.getArkLhcs().catch(() => null),
    ]).then(([a, id, l]) => {
      if (!active) return;
      setAssessment(a);
      setIdentity(id);
      setLhcs(l || id?.lhcs || null);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [user, canAccessReport]);

  if (!FEATURES.executiveReport || !user) return null;

  // Gated surface — route the user to upgrade rather than hand them a button
  // that can't produce the Pro-tier report.
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

  const hasData = !!(assessment || identity);

  const handleDownload = async () => {
    if (!sheetRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      await exportReportPdf(sheetRef.current, reportFileStamp(user?.name));
    } catch (e: any) {
      console.error("ARK Report download failed:", e);
      setError("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={busy || !loaded || !hasData}
        data-testid="button-download-ark-report"
        title={!hasData && loaded ? "Run an assessment first to generate your report" : undefined}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:scale-[1.02] border border-primary/40 bg-primary/15 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-primary/15 disabled:hover:text-primary ${className}`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        {busy ? "Generating PDF…" : "Download My ARK Report"}
      </button>
      {error && (
        <span className="font-mono text-[11px] text-destructive" data-testid="text-download-report-error">
          {error}
        </span>
      )}

      {/* Off-screen branded sheet used as the capture source for the PDF. */}
      {loaded && hasData && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -10000, top: 0, width: 860, pointerEvents: "none" }}
        >
          <ArkReportSheet
            ref={sheetRef}
            name={user?.name}
            role={user?.role}
            identity={identity}
            lhcs={lhcs}
            assessment={assessment}
          />
        </div>
      )}
    </>
  );
}

export default ArkReportDownloadButton;
