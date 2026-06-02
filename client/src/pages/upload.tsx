import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FileText, ClipboardList, Linkedin, CheckCircle2, Circle, ArrowRight, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { ResumeUploader } from "@/components/upload/ResumeUploader";
import { SelfAssessmentForm } from "@/components/upload/SelfAssessmentForm";
import { LinkedInImporter } from "@/components/upload/LinkedInImporter";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

type IntakeMode = "resume" | "self" | "linkedin";

const MODES: Array<{ key: IntakeMode; label: string; sub: string; icon: React.ElementType }> = [
  { key: "resume", label: "Resume Upload", sub: "PDF / TXT", icon: FileText },
  { key: "self", label: "Self-Assessment", sub: "Questionnaire", icon: ClipboardList },
  { key: "linkedin", label: "LinkedIn", sub: "Paste Profile", icon: Linkedin },
];

interface SourceStatus {
  source: string;
  label: string;
  present: boolean;
  primary: boolean;
  updatedAt: string | null;
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<IntakeMode>("resume");
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [completeness, setCompleteness] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refreshSources = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getAssessmentSources();
      setSources(res.sources);
      setCompleteness(res.completeness);
    } catch {
      // Non-fatal — the meter just stays empty if the call fails.
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  // After any source is contributed, refresh the meter and bounce the user to
  // the active card's completed state — but stay on this page so they can layer
  // in additional sources rather than being thrown to the dashboard.
  const handleContributed = useCallback(() => {
    refreshSources();
  }, [refreshSources]);

  const statusFor = (key: IntakeMode): SourceStatus | undefined =>
    sources.find((s) => s.source === key);

  const anyContributed = sources.some((s) => s.primary && s.present);

  return (
    <div className="w-full max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center py-8">
      <div className="mb-6">
        <h2 className="text-3xl font-display font-bold text-white mb-2 uppercase tracking-wide">
          Intelligence Vector Input
        </h2>
        <p className="text-muted-foreground font-sans">
          Build one evolving ARK profile. Add your resume, self-assessment, and LinkedIn — each source
          refines the <em>same</em> report. The more you add, the more complete and confident your
          intelligence becomes.
        </p>
      </div>

      {/* Completeness / source-attribution panel */}
      <div
        className="glass-card rounded-xl p-5 mb-6 border-white/10"
        data-testid="panel-profile-completeness"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Profile Completeness
            </span>
          </div>
          <span
            className="font-display text-lg font-bold text-primary tabular-nums"
            data-testid="text-completeness-pct"
          >
            {completeness}%
          </span>
        </div>

        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${completeness}%` }}
            transition={{ duration: 0.6 }}
            data-testid="bar-completeness"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => {
            const st = statusFor(m.key);
            const done = !!st?.present;
            const Icon = m.icon;
            return (
              <div
                key={m.key}
                data-testid={`source-status-${m.key}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left ${
                  done
                    ? "border-primary/40 bg-primary/5"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={`font-display text-[11px] font-semibold uppercase tracking-wider truncate ${done ? "text-white" : "text-muted-foreground"}`}>
                    {m.label}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-widest opacity-70 truncate">
                    {done ? "Added" : "Not added"}
                  </p>
                </div>
                <Icon className={`w-4 h-4 ml-auto flex-shrink-0 ${done ? "text-primary/70" : "text-muted-foreground/40"}`} />
              </div>
            );
          })}
        </div>

        {anyContributed && (
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => setLocation("/dashboard")}
              data-testid="button-view-dashboard"
              className="bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 font-mono uppercase tracking-widest rounded-none text-xs"
            >
              View Intelligence Hub
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>

      {/* Mode tabs — pick which source to add/refine; all converge on one profile */}
      <div
        className="grid grid-cols-3 gap-2 mb-6"
        role="tablist"
        aria-label="Assessment intake mode"
        data-testid="tabs-intake-mode"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.key;
          const done = !!statusFor(m.key)?.present;
          return (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(m.key)}
              data-testid={`tab-mode-${m.key}`}
              className={`relative flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.02] text-muted-foreground hover:border-white/30 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-primary" : ""}`} />
              <div className="min-w-0">
                <p className="font-display text-sm font-semibold uppercase tracking-wider truncate">
                  {m.label}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-70 truncate">
                  {m.sub}
                </p>
              </div>
              {done && (
                <CheckCircle2 className="w-4 h-4 text-primary absolute top-2 right-2" />
              )}
            </button>
          );
        })}
      </div>

      {mode === "resume" && <ResumeUploader onComplete={handleContributed} />}
      {mode === "self" && <SelfAssessmentForm onComplete={handleContributed} />}
      {mode === "linkedin" && <LinkedInImporter onComplete={handleContributed} />}
    </div>
  );
}
