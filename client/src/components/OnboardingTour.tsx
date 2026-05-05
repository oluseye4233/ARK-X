import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  Upload,
  ClipboardCheck,
  Map,
  Gamepad2,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingTourProps {
  open: boolean;
  onClose: (markCompleted?: boolean) => void;
}

interface Step {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  ctaLabel?: string;
  ctaHref?: string;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    icon: Sparkles,
    eyebrow: "System initialized",
    title: "Welcome to ARK Platform",
    body: "ARK gives you a single career-intelligence identity — a live score that fuses how relevant your job is, how irreplaceable your skills are, and how transferable your talent is.",
    bullets: [
      "Tracks your career resilience as the AI economy shifts",
      "Surfaces personalized upskilling and pivot opportunities",
      "Connects you to a marketplace of expert career operators",
    ],
  },
  {
    id: "identity",
    icon: Activity,
    eyebrow: "Your ARK identity",
    title: "JST + CCMI = your ARK score",
    body: "Every action you take updates your identity in real time. JST measures market position; CCMI measures career capital. Together they form your ARK band — a 0–600 readiness signal.",
    bullets: [
      "JST Index — Jobs · Skills · Talent (live market signal)",
      "CCMI Pillars — seven dimensions of long-term capital",
      "LHCS lights — green / amber / red readiness composite",
    ],
    ctaLabel: "View live identity",
    ctaHref: "/dashboard",
  },
  {
    id: "upload",
    icon: Upload,
    eyebrow: "Step 1 — onboard your data",
    title: "Upload your resume",
    body: "We extract your skills, role history, and risk modifiers in seconds, then score you against an AI-vulnerability model trained on automation milestones.",
    bullets: [
      "PDF or DOCX — parsed locally on the server",
      "Generates JST score, vulnerability tier, and FORGE card matches",
      "Refresh anytime to recompute your identity",
    ],
    ctaLabel: "Upload resume",
    ctaHref: "/upload",
  },
  {
    id: "assessment",
    icon: ClipboardCheck,
    eyebrow: "Step 2 — calibrate",
    title: "Take the Context Craft assessment",
    body: "Eight short questions place you on the Architect / Orchestrator / Conductor archetype map and unlock a multiplier on your JST score.",
    bullets: [
      "Roughly 3 minutes to complete",
      "Repeatable — your highest level becomes your cert tier",
      "Powers the Career Mobility radar and pivot suggestions",
    ],
    ctaLabel: "Start assessment",
    ctaHref: "/assessment",
  },
  {
    id: "pathways",
    icon: Map,
    eyebrow: "Step 3 — explore",
    title: "Map your career mobility",
    body: "The 12-vector transferability radar shows where your existing skills already qualify you for adjacent roles — and an upskilling timeline shows what closes the remaining gaps.",
    bullets: [
      "Pivot opportunities ranked by fit and market demand",
      "Skill-gap matrix with concrete learning resources",
      "Timeline view across 30 / 60 / 90-day horizons",
    ],
    ctaLabel: "Open Career Mobility",
    ctaHref: "/pathways",
  },
  {
    id: "ecosystem",
    icon: ShoppingBag,
    eyebrow: "Step 4 — engage the flywheel",
    title: "Play Skill Games · Browse the Marketplace",
    body: "Earn ARK by playing Skill Games scenarios (CCGE Arena) and by buying or selling expert prompts and playbooks in the Marketplace (SPHINX). Both feed back into your live identity.",
    bullets: [
      "Skill Games (CCGE Arena) — up to +15 ARK / day from gameplay",
      "Marketplace (SPHINX) — up to +20 ARK / 30 days from trades",
      "Track every event in your ARK history feed",
    ],
    ctaLabel: "Open Skill Games",
    ctaHref: "/play",
  },
];

export function OnboardingTour({ open, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [, setLocation] = useLocation();

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const Icon = step.icon;

  const progressPct = useMemo(
    () => Math.round(((stepIndex + 1) / STEPS.length) * 100),
    [stepIndex],
  );

  // Single normalized close path: reset wizard state + mark completed exactly once.
  const finishTour = (navigateTo?: string) => {
    setStepIndex(0);
    onClose(true);
    if (navigateTo) setLocation(navigateTo);
  };

  const handleNext = () => {
    if (isLast) {
      finishTour();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const handlePrev = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleSkip = () => finishTour();

  const handleCta = () => {
    if (!step.ctaHref) return;
    finishTour(step.ctaHref);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleSkip();
      }}
    >
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border-primary/30 bg-background/95 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.15)]"
        data-testid="dialog-onboarding"
        aria-describedby="onboarding-description"
      >
        {/* Accessible name + description for screen readers (visual content
            already conveys the same information, so we hide these visually). */}
        <VisuallyHidden>
          <DialogTitle>ARK Platform onboarding tour</DialogTitle>
          <DialogDescription id="onboarding-description">
            A six-step walkthrough of the ARK identity, resume upload, Context
            Craft assessment, Career Mobility, and the Marketplace / Skill Games flywheel.
          </DialogDescription>
        </VisuallyHidden>

        {/* Decorative cyan glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-primary/20 blur-[100px]" />
          <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-secondary/15 blur-[100px]" />
        </div>

        <div className="relative z-10 p-8 md:p-10 space-y-6">
          {/* Header — progress + skip */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span data-testid="text-onboarding-progress">
                Step {stepIndex + 1} of {STEPS.length} · {progressPct}%
              </span>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              data-testid="button-onboarding-skip"
              className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              Skip tour <X className="h-3 w-3" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-cyan-400 to-secondary transition-all duration-500"
              style={{ width: `${progressPct}%` }}
              data-testid="bar-onboarding-progress"
            />
          </div>

          {/* Step body */}
          <div className="space-y-5 pt-2">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center neon-border">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary/80 mb-1">
                  {step.eyebrow}
                </p>
                <h2
                  className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight"
                  data-testid={`text-onboarding-title-${step.id}`}
                >
                  {step.title}
                </h2>
              </div>
            </div>

            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              {step.body}
            </p>

            <ul className="space-y-2 pt-1">
              {step.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-foreground/90"
                >
                  <CheckCircle2 className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Per-step deep link CTA */}
            {step.ctaHref && step.ctaLabel && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCta}
                  data-testid={`button-onboarding-cta-${step.id}`}
                  className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-wider text-primary hover:text-cyan-300 transition-colors group"
                >
                  {step.ctaLabel}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
          </div>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                data-testid={`dot-onboarding-${i}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === stepIndex
                    ? "w-8 bg-primary shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                    : i < stepIndex
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-white/10 hover:bg-white/20",
                )}
              />
            ))}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={isFirst}
              data-testid="button-onboarding-prev"
              className="font-mono uppercase tracking-wider text-xs disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Previous
            </Button>

            {isLast ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => finishTour("/upload")}
                  data-testid="button-onboarding-finish-upload"
                  className="font-mono uppercase tracking-wider text-xs border-primary/40 hover:bg-primary/10 hover:text-primary"
                >
                  Upload resume
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  data-testid="button-onboarding-finish"
                  className="font-mono uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
                >
                  Finish <CheckCircle2 className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                data-testid="button-onboarding-next"
                className="font-mono uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(34,211,238,0.3)]"
              >
                Next <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
