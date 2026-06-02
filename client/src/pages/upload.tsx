import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FileText, ClipboardList, Linkedin, CheckCircle2, Circle, ArrowRight, Layers, Sparkles, Trash2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ResumeUploader } from "@/components/upload/ResumeUploader";
import { SelfAssessmentForm } from "@/components/upload/SelfAssessmentForm";
import { LinkedInImporter } from "@/components/upload/LinkedInImporter";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

type IntakeMode = "resume" | "self" | "linkedin";

const MODES: Array<{ key: IntakeMode; label: string; sub: string; icon: React.ElementType }> = [
  { key: "resume", label: "Resume Upload", sub: "PDF / TXT", icon: FileText },
  { key: "self", label: "Self-Assessment", sub: "Questionnaire", icon: ClipboardList },
  { key: "linkedin", label: "LinkedIn", sub: "Paste Profile", icon: Linkedin },
];

// Icons keyed by source so the status grid can render the archetype quiz card
// (contributed elsewhere) alongside the three primary intake modes.
const SOURCE_ICONS: Record<string, React.ElementType> = {
  resume: FileText,
  self: ClipboardList,
  linkedin: Linkedin,
  quiz: Sparkles,
};

interface SourceStatus {
  source: string;
  label: string;
  present: boolean;
  primary: boolean;
  updatedAt: string | null;
}

// Human-friendly "last contributed" label. Recent times read as relative
// ("just now", "3h ago"); older ones fall back to an absolute date.
function formatUpdated(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<IntakeMode>("resume");
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [completeness, setCompleteness] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<SourceStatus | null>(null);

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

  // Drop a source the user no longer wants. The server re-runs the cumulative
  // merge over the remaining sources, so we just refresh the meter afterwards.
  // Gated behind a confirm dialog so an accidental click can't silently drop a
  // source and lower the user's completeness / ARK score.
  const handleConfirmRemove = useCallback(async () => {
    if (!pendingRemove) return;
    const key = pendingRemove.source;
    setRemoving(key);
    setPendingRemove(null);
    try {
      await api.removeAssessmentSource(key);
      await refreshSources();
    } catch {
      // Non-fatal — leave the card as-is if removal fails.
    } finally {
      setRemoving(null);
    }
  }, [pendingRemove, refreshSources]);

  const statusFor = (key: IntakeMode): SourceStatus | undefined =>
    sources.find((s) => s.source === key);

  const anyContributed = sources.some((s) => s.primary && s.present);

  // Primary intake cards always show; the archetype quiz card only appears once
  // it's been contributed (it's added from the Context Craft flow, not here).
  const statusCards = sources.filter((s) => s.primary || s.present);

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
          {statusCards.map((st) => {
            const done = st.present;
            const Icon = SOURCE_ICONS[st.source] ?? FileText;
            const updated = formatUpdated(st.updatedAt);
            const isRemoving = removing === st.source;
            return (
              <div
                key={st.source}
                data-testid={`source-status-${st.source}`}
                className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-left ${
                  done
                    ? "border-primary/40 bg-primary/5"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-display text-[11px] font-semibold uppercase tracking-wider truncate ${done ? "text-white" : "text-muted-foreground"}`}>
                    {st.label}
                  </p>
                  <p
                    className="font-mono text-[9px] uppercase tracking-widest opacity-70 truncate"
                    data-testid={`text-source-updated-${st.source}`}
                  >
                    {done ? (updated ? `Updated ${updated}` : "Added") : "Not added"}
                  </p>
                </div>
                {done ? (
                  <button
                    type="button"
                    onClick={() => setPendingRemove(st)}
                    disabled={isRemoving}
                    aria-label={`Remove ${st.label}`}
                    title={`Remove ${st.label}`}
                    data-testid={`button-remove-source-${st.source}`}
                    className="flex-shrink-0 mt-0.5 text-muted-foreground/60 hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRemoving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground/40" />
                )}
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

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <AlertDialogContent data-testid="dialog-remove-source">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {pendingRemove?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This drops your {pendingRemove?.label} source and re-runs your
              cumulative ARK assessment over what's left. Your profile
              completeness and ARK score may go down. This can't be undone, but
              you can always add the source again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-source">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              data-testid="button-confirm-remove-source"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
