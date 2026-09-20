import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, MotionConfig, useInView, useReducedMotion } from "framer-motion";
import {
  User,
  Sparkles,
  Crown,
  GraduationCap,
  Building2,
  Check,
  ArrowRight,
  Play,
  Pause,
  Upload,
  FileText,
  Gauge,
  Compass,
  Gamepad2,
  Users,
  QrCode,
  BookOpenCheck,
  Camera,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_PLANS, FLYWHEEL_CAPS, ARK_SCORE_DELTAS, type SubscriptionPlan } from "@shared/schema";
import shotDashboard from "@/assets/tour/demo_dashboard.jpg";
import shotLanding from "@/assets/tour/landing_hero.jpg";
import shotTour from "@/assets/tour/demo_tour_step1.jpg";
import shotLogin from "@/assets/tour/login.jpg";

// ─── ANIMATED DEMO PANELS ─────────────────────────────────────────────────
// Looping, gif-style motion demos. Each one plays forever (like a GIF) and
// visualizes the surface it describes without needing auth or backend calls.

const loop = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  repeatDelay: 1.2,
  ease: "easeInOut" as const,
});

/** 5-phase resume upload pipeline: file scan bar + phase labels lighting up. */
function DemoUpload() {
  const phases = ["Extraction", "JST Calc", "Vulnerability", "Transferability", "Recommendations"];
  return (
    <div className="p-5 space-y-4" data-testid="demo-anim-upload">
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-background/60 p-3">
        <FileText className="h-8 w-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-display font-bold text-white truncate">sarah_chen_resume.pdf</div>
          <div className="relative h-2 mt-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-fuchsia-400 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={loop(3.2)}
            />
          </div>
        </div>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="text-[10px] font-mono uppercase tracking-widest text-primary"
        >
          Parsing
        </motion.div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {phases.map((p, i) => (
          <motion.div
            key={p}
            className="rounded-md border border-border bg-background/40 px-1 py-2 text-center"
            animate={{
              borderColor: ["hsl(217 20% 25%)", "hsl(188 86% 53%)", "hsl(217 20% 25%)"],
              opacity: [0.5, 1, 0.5],
            }}
            transition={loop(1.1, i * 0.65)}
          >
            <div className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground leading-tight">
              {p}
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        PDF · DOCX · plain text — under 60 seconds
      </p>
    </div>
  );
}

/** JST score counting up with zone bar. */
function DemoScore() {
  const reduceMotion = useReducedMotion();
  const [n, setN] = useState(reduceMotion ? 247 : 0);
  useEffect(() => {
    // Static readout for reduced-motion users — no RAF loop at all.
    if (reduceMotion) {
      setN(247);
      return;
    }
    let raf: number;
    let start: number | null = null;
    const cycle = (t: number) => {
      if (start === null) start = t;
      const el = ((t - start) % 5000) / 5000; // 5s loop
      const progress = Math.min(1, el / 0.55); // count for first 55%
      setN(Math.round(247 * progress));
      raf = requestAnimationFrame(cycle);
    };
    raf = requestAnimationFrame(cycle);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);
  const zones = [
    { label: "Critical", color: "bg-rose-500" },
    { label: "Vulnerable", color: "bg-orange-400" },
    { label: "Exposed", color: "bg-amber-400" },
    { label: "Resilient", color: "bg-emerald-400" },
    { label: "Flourishing", color: "bg-cyan-400" },
  ];
  return (
    <div className="p-5 space-y-4" data-testid="demo-anim-score">
      <div className="text-center">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">JST Index</div>
        <div className="font-display text-5xl font-black text-primary neon-text tabular-nums">{n}</div>
        <div className="text-xs font-mono text-muted-foreground">/ 300 · Illustrative walkthrough score</div>
        <div className="mt-1 text-[9px] font-mono text-muted-foreground">Source: ARK Onecraft curated scoring model · Data as of 6 September 2026</div>
      </div>
      <div className="flex gap-1">
        {zones.map((z, i) => (
          <motion.div
            key={z.label}
            className={cn("h-2 flex-1 rounded-full", z.color)}
            animate={{ opacity: i === 3 ? [0.4, 1, 0.4] : 0.25 }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { k: "Jobs", v: 79 },
          { k: "Skills", v: 88 },
          { k: "Talent", v: 80 },
        ].map(({ k, v }, i) => (
          <div key={k} className="rounded-md border border-border bg-background/40 p-2 text-center">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{k}</div>
            <div className="relative h-1.5 mt-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${v}%` }}
                transition={loop(2.2, i * 0.3)}
              />
            </div>
            <div className="text-xs font-display font-bold text-white mt-1">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 12-vector radar as animated bars + pivot roles appearing. */
function DemoPathways() {
  const vectors = [78, 85, 88, 81, 74, 90, 72, 86, 68, 83, 65, 79];
  const pivots = ["AI Product Lead", "Ops Intelligence Mgr", "Solutions Strategist"];
  return (
    <div className="p-5 space-y-4" data-testid="demo-anim-pathways">
      <div className="flex items-end gap-1 h-20">
        {vectors.map((v, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-secondary/60 to-primary"
            initial={{ height: "8%" }}
            animate={{ height: `${v}%` }}
            transition={loop(1.8, i * 0.12)}
          />
        ))}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        12 transferability vectors · scored 0–100
      </div>
      <div className="space-y-1.5">
        {pivots.map((p, i) => (
          <motion.div
            key={p}
            className="flex items-center justify-between rounded-md border border-secondary/30 bg-secondary/5 px-3 py-1.5"
            animate={{ opacity: [0, 1, 1, 0], x: [-10, 0, 0, 0] }}
            transition={{ duration: 5.5, times: [0, 0.15, 0.9, 1], delay: i * 0.5, repeat: Infinity }}
          >
            <span className="text-xs font-display font-bold text-white">{p}</span>
            <span className="text-[10px] font-mono text-secondary">PIVOT {i + 1}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** CCGE: cards dealt then a JCSE score reveal. */
function DemoGame() {
  const cards = ["System Persona", "Role Lock", "Output Schema", "Tone: Formal", "Guardrails"];
  return (
    <div className="p-5 space-y-4" data-testid="demo-anim-game">
      <div className="flex justify-center gap-1.5">
        {cards.map((c, i) => (
          <motion.div
            key={c}
            className="w-16 h-22 rounded-md border border-fuchsia-400/40 bg-gradient-to-b from-fuchsia-500/15 to-background/60 p-1.5 flex flex-col justify-between"
            style={{ height: 84 }}
            animate={{ y: [40, 0, 0, 40], opacity: [0, 1, 1, 0], rotate: [0, (i - 2) * 3, (i - 2) * 3, 0] }}
            transition={{ duration: 6, times: [0, 0.12, 0.88, 1], delay: i * 0.18, repeat: Infinity }}
          >
            <div className="text-[8px] font-mono uppercase text-fuchsia-300 leading-tight">{c}</div>
            <Gamepad2 className="h-3 w-3 text-fuchsia-400/60 self-end" />
          </motion.div>
        ))}
      </div>
      <motion.div
        className="text-center"
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.9, 0.9, 1, 1, 0.9] }}
        transition={{ duration: 6, times: [0, 0.45, 0.55, 0.88, 1], repeat: Infinity }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/50 bg-yellow-400/10 px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
          <span className="font-display font-bold text-yellow-300 text-sm">
            JCSE 44 · GOLD · +{ARK_SCORE_DELTAS.SESSION_GOLD} ARK
          </span>
        </span>
      </motion.div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Build the strongest prompt hand — AI grades every session
      </p>
    </div>
  );
}

/** Enterprise workforce heatmap filling in. */
function DemoWorkforce() {
  const depts = [
    { name: "Operations", risk: 72, color: "bg-rose-400" },
    { name: "Finance", risk: 58, color: "bg-orange-400" },
    { name: "Marketing", risk: 44, color: "bg-amber-400" },
    { name: "Engineering", risk: 28, color: "bg-emerald-400" },
    { name: "Product", risk: 22, color: "bg-cyan-400" },
  ];
  return (
    <div className="p-5 space-y-3" data-testid="demo-anim-workforce">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Automation exposure by department
      </div>
      {depts.map((d, i) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="w-24 text-xs font-mono text-muted-foreground shrink-0">{d.name}</span>
          <div className="relative flex-1 h-4 rounded bg-white/5 overflow-hidden">
            <motion.div
              className={cn("absolute inset-y-0 left-0 rounded", d.color)}
              initial={{ width: "0%" }}
              animate={{ width: `${d.risk}%` }}
              transition={loop(2, i * 0.25)}
            />
          </div>
          <span className="w-8 text-xs font-display font-bold text-white text-right">{d.risk}%</span>
        </div>
      ))}
      <motion.div
        className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 mt-2"
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 5, times: [0, 0.2, 0.85, 1], repeat: Infinity }}
      >
        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          Upskill nudge sent to Operations · 34 staff · in-app + email
        </span>
      </motion.div>
    </div>
  );
}

/** School cohort: roster filling + grades. */
function DemoCohort() {
  const students = [
    { n: "A. Okafor", g: "A", ark: 412 },
    { n: "M. Reyes", g: "B+", ark: 356 },
    { n: "J. Park", g: "A-", ark: 388 },
    { n: "T. Nwosu", g: "B", ark: 331 },
  ];
  return (
    <div className="p-5 space-y-3" data-testid="demo-anim-cohort">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Fall 2026 · Prompt Architecture 101
        </span>
        <motion.span
          className="text-[10px] font-mono text-secondary"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          LIVE GRADEBOOK
        </motion.span>
      </div>
      {students.map((s, i) => (
        <motion.div
          key={s.n}
          className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2"
          animate={{ opacity: [0, 1, 1, 0], x: [-8, 0, 0, 0] }}
          transition={{ duration: 5.5, times: [0, 0.12, 0.9, 1], delay: i * 0.35, repeat: Infinity }}
        >
          <span className="text-xs font-display font-bold text-white">{s.n}</span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground">ARK {s.ark}</span>
            <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-secondary/15 text-secondary text-xs font-display font-bold">
              {s.g}
            </span>
          </div>
        </motion.div>
      ))}
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Instructors: cohorts · assignments · CSV export
      </p>
    </div>
  );
}

/** Executive report shimmer + PDF export. */
function DemoReport() {
  return (
    <div className="p-5 space-y-3" data-testid="demo-anim-report">
      <div className="rounded-lg border border-border bg-white/[0.03] p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 rounded bg-white/20" />
          <div className="text-[9px] font-mono uppercase tracking-widest text-primary">Executive Brief</div>
        </div>
        {[90, 75, 82, 60, 70].map((w, i) => (
          <motion.div
            key={i}
            className="h-2 rounded bg-white/10"
            style={{ width: `${w}%` }}
            animate={{ opacity: [0.15, 0.5, 0.15] }}
            transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
          />
        ))}
      </div>
      <motion.div
        className="flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 py-2"
        animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.02, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-xs font-mono uppercase tracking-widest text-primary">Export PDF — print-perfect</span>
      </motion.div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        FORGE cards + AI narrative included on Pro
      </p>
    </div>
  );
}

/** F1000 QR claim pulse. */
function DemoF1000() {
  return (
    <div className="p-5 flex flex-col items-center gap-4" data-testid="demo-anim-f1000">
      <motion.div
        className="relative rounded-xl border-2 border-secondary/60 bg-white p-4"
        animate={{ boxShadow: ["0 0 0px hsl(152 69% 45% / 0)", "0 0 34px hsl(152 69% 45% / 0.55)", "0 0 0px hsl(152 69% 45% / 0)"] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      >
        <QrCode className="h-20 w-20 text-background" />
        <motion.div
          className="absolute inset-x-2 h-0.5 bg-secondary"
          animate={{ top: ["12%", "85%", "12%"] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
      <motion.span
        className="inline-flex items-center gap-2 rounded-full border border-secondary/50 bg-secondary/10 px-4 py-1.5 text-xs font-mono uppercase tracking-widest text-secondary"
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4.5, times: [0, 0.2, 0.85, 1], repeat: Infinity }}
      >
        <Check className="h-3.5 w-3.5" /> Seat claimed — Explorer unlocked
      </motion.span>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        1,000 single-use codes · first come, first served
      </p>
    </div>
  );
}

/** Enterprise upskill nudge: notification + email + cooldown. */
function DemoNudge() {
  const channels = [
    { label: "In-app notification", detail: "Delivered live via SSE stream" },
    { label: "Email", detail: "Best-effort — sent to each staff inbox" },
    { label: "7-day cooldown", detail: "Per-person — nudges never spam" },
  ];
  return (
    <div className="p-5 space-y-3" data-testid="demo-anim-nudge">
      <motion.div
        className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3"
        animate={{ opacity: [0, 1, 1, 0], y: [-8, 0, 0, 0] }}
        transition={{ duration: 5.5, times: [0, 0.12, 0.9, 1], repeat: Infinity }}
      >
        <Users className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-display font-bold text-white">Upskill nudge → Operations · 34 staff</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            "Your team's automation exposure is rising — start here"
          </div>
        </div>
      </motion.div>
      {channels.map((c, i) => (
        <motion.div
          key={c.label}
          className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2"
          animate={{ opacity: [0, 1, 1, 0], x: [-6, 0, 0, 0] }}
          transition={{ duration: 5.5, times: [0, 0.15, 0.9, 1], delay: 0.5 + i * 0.4, repeat: Infinity }}
        >
          <span className="text-xs font-display font-bold text-white">{c.label}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{c.detail}</span>
        </motion.div>
      ))}
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Nudge where the ROI is highest — before attrition does
      </p>
    </div>
  );
}

/** Training-provider matches appearing. */
function DemoTraining() {
  const providers = [
    { n: "Coursera — AI Product Cert", fit: 94 },
    { n: "Google Cloud Skills Boost", fit: 88 },
    { n: "Stanford Online XCS229i", fit: 81 },
  ];
  return (
    <div className="p-5 space-y-3" data-testid="demo-anim-training">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        JST-matched training providers
      </div>
      {providers.map((p, i) => (
        <motion.div
          key={p.n}
          className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2"
          animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, 0] }}
          transition={{ duration: 5.5, times: [0, 0.15, 0.9, 1], delay: i * 0.45, repeat: Infinity }}
        >
          <span className="text-xs font-display font-bold text-white">{p.n}</span>
          <span className="text-[10px] font-mono text-secondary">{p.fit}% FIT</span>
        </motion.div>
      ))}
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        Ranked against your exact skill gaps — not generic ads
      </p>
    </div>
  );
}

const DEMOS = {
  upload: DemoUpload,
  score: DemoScore,
  pathways: DemoPathways,
  game: DemoGame,
  workforce: DemoWorkforce,
  cohort: DemoCohort,
  report: DemoReport,
  f1000: DemoF1000,
  training: DemoTraining,
  nudge: DemoNudge,
} as const;

type DemoKey = keyof typeof DEMOS;

// ─── WALKTHROUGH DATA ─────────────────────────────────────────────────────

type StepVisual =
  | { kind: "screenshot"; src: string; alt: string }
  | { kind: "demo"; demo: DemoKey };

interface WalkStep {
  title: string;
  body: string;
  bullets: string[];
  visual: StepVisual;
}

interface PlanWalk {
  key: SubscriptionPlan;
  icon: typeof User;
  tagline: string;
  cta: { href: string; label: string };
  steps: WalkStep[];
}

const WALKS: PlanWalk[] = [
  {
    key: "INDIVIDUAL_FREE",
    icon: User,
    tagline: "See your worth in under a minute — zero cost, zero card.",
    cta: { href: "/signup", label: "Create your free account" },
    steps: [
      {
        title: "Create your account",
        body: "Sign up with just a name, email and password — no credit card, no trial timer. You land on the platform in under 30 seconds.",
        bullets: ["Email + password only", "No payment details ever requested on Free", "Instant access after signup"],
        visual: { kind: "screenshot", src: shotLogin, alt: "ARK sign-in screen" },
      },
      {
        title: "Upload your CV",
        body: "Drop in a PDF, DOCX or pasted text. The 5-phase pipeline extracts your experience, computes your JST sub-scores, and assesses AI vulnerability — live, on screen.",
        bullets: ["1 upload per month on Free", "PDF, DOCX or plain text, up to 10MB", "Analysis completes in under 60 seconds"],
        visual: { kind: "demo", demo: "upload" },
      },
      {
        title: "Read your JST score",
        body: "Your basic JST Index (0–300) lands in one of five zones — from Critical to Flourishing — with Jobs, Skills and Talent sub-scores broken out. Source: ARK Onecraft curated scoring model; data as of 6 September 2026; not a live labour-market feed.",
        bullets: ["Single defensible number, no black-box rating", "Jobs 30% · Skills 40% · Talent 30% weighting", "See exactly which dimension drags you down"],
        visual: { kind: "demo", demo: "score" },
      },
      {
        title: "Check your AI vulnerability level",
        body: "The same analysis classifies your role's automation exposure on a 5-level scale, so you know how urgent your next move is.",
        bullets: ["5-level vulnerability classification", "Derived from your actual task mix", "Included free — no upgrade needed"],
        visual: { kind: "screenshot", src: shotDashboard, alt: "Intelligence Hub with ARK identity, JST and CCMI scores" },
      },
      {
        title: "Upgrade when you're ready",
        body: "Free shows you the headline. When you want the full picture — pathways, unlimited uploads, FORGE cards — Pro is one click away, and F1000 members get it price-capped.",
        bullets: ["Keep your scores and history when you upgrade", "Pro unlocks pathways, reports and the flywheel", "No lock-in — cancel any time"],
        visual: { kind: "screenshot", src: shotLanding, alt: "ARK landing page with plans" },
      },
    ],
  },
  {
    key: "INDIVIDUAL_EXPLORER",
    icon: Sparkles,
    tagline: "The First-1000 tier — free forever, with training-provider matching.",
    cta: { href: "/f1000", label: "Claim your F1000 seat" },
    steps: [
      {
        title: "Scan the F1000 QR code",
        body: "The landing page carries a QR code tied to 1,000 single-use codes. Scan it (or tap the link) and you're on the claim page.",
        bullets: ["Exactly 1,000 seats — the counter on the landing page is live", "Each code works once", "No payment details required"],
        visual: { kind: "screenshot", src: shotLanding, alt: "Landing page with the F1000 QR code and live seat counter" },
      },
      {
        title: "Claim your seat",
        body: "Redeem the code and your account is provisioned as Explorer on the spot — everything in Free, plus the Explorer extras, at $0 forever.",
        bullets: ["Instant provisioning — no approval queue", "Explorer is permanent, not a trial", "Your seat number is yours for good"],
        visual: { kind: "demo", demo: "f1000" },
      },
      {
        title: "Upload and get scored",
        body: "Same 5-phase analysis as every tier: JST Index, sub-scores, and your AI-vulnerability level from a single CV upload. Score source: ARK Onecraft curated scoring model; data as of 6 September 2026.",
        bullets: ["1 upload per month", "Full basic JST + vulnerability readout", "Analysis in under 60 seconds"],
        visual: { kind: "demo", demo: "upload" },
      },
      {
        title: "Get matched training providers",
        body: "The Explorer exclusive: ARK ranks real training providers against your exact JST gaps, so the next course you take is the one that moves your score.",
        bullets: ["Providers ranked by fit to your skill gaps", "JST-matched upskilling path included", "Not available on plain Free"],
        visual: { kind: "demo", demo: "training" },
      },
      {
        title: "Upgrade at the capped price",
        body: "F1000 members keep a permanent price cap on paid tiers — Pro at $10/mo instead of $29. The earlier you claim, the better the deal you lock.",
        bullets: ["Pro price-capped at $10/mo for F1000 members", "School capped at $9/mo", "Cap follows your account forever"],
        visual: { kind: "screenshot", src: shotTour, alt: "Guided demo tour of the platform" },
      },
    ],
  },
  {
    key: "INDIVIDUAL_PRO",
    icon: Crown,
    tagline: "The full career-intelligence engine — unlimited, with the flywheel.",
    cta: { href: "/signup", label: "Start with Pro" },
    steps: [
      {
        title: "Upload without limits",
        body: "Re-run your analysis every time your resume changes. Unlimited uploads keep your account history current. Score source: ARK Onecraft curated scoring model; data as of 6 September 2026.",
        bullets: ["Unlimited resume uploads", "Score history tracked over time", "Compare resume versions with the dated ARK Onecraft curated scoring model"],
        visual: { kind: "demo", demo: "upload" },
      },
      {
        title: "Open the full Intelligence Hub",
        body: "The complete dashboard: ARK identity (0–600), JST gauge and radar, CCMI pillars, LHCS readiness signal, vulnerability heatmap and timeline, FORGE cards, archetype handicap.",
        bullets: ["Everything the demo shows — on your real data", "AI-written career narrative included", "Live score updates streamed as you act"],
        visual: { kind: "screenshot", src: shotDashboard, alt: "Full Intelligence Hub dashboard" },
      },
      {
        title: "Map your career mobility",
        body: "The 12-Vector Transferability Radar projects your skills across twelve dimensions, surfaces three best-fit pivot roles, and lays out a 30/90/365-day upskilling plan.",
        bullets: ["12-vector radar + skill-gap matrix", "Pivots filtered by your archetype, with comp deltas", "Phased plan: ready- / up- / new-skilling"],
        visual: { kind: "demo", demo: "pathways" },
      },
      {
        title: "Spin the flywheel",
        body: `Play Skill Games in the CCGE Arena (up to +${FLYWHEEL_CAPS.CCGE_PER_DAY} ARK/day) and trade on the SPHINX marketplace (up to +${FLYWHEEL_CAPS.SPHINX_PER_30D} ARK/30 days). Your ARK score compounds as you practice.`,
        bullets: [
          `CCGE sessions: capped at +${FLYWHEEL_CAPS.CCGE_PER_DAY} ARK per day`,
          `Marketplace activity: capped at +${FLYWHEEL_CAPS.SPHINX_PER_30D} ARK per 30 days`,
          "Context Craft certs multiply your JST up to 1.5×",
        ],
        visual: { kind: "demo", demo: "game" },
      },
      {
        title: "Export the Executive Report",
        body: "A print-optimized brief of your entire profile — scores, vulnerability, pathways, FORGE cards — exportable as PDF for recruiters, managers or your own records.",
        bullets: ["One-click PDF export", "Recruiter-ready formatting", "ARK Resume unlocks with a Silver+ verification"],
        visual: { kind: "demo", demo: "report" },
      },
    ],
  },
  {
    key: "SCHOOL_STUDENT",
    icon: GraduationCap,
    tagline: "Everything in Pro, plus your institution's cohort — for $9/mo.",
    cta: { href: "/signup", label: "Join as a student" },
    steps: [
      {
        title: "Sign up and get invited",
        body: "Create your account, then your instructor adds you to a cohort by email. The invite reconciles automatically the moment your address matches.",
        bullets: ["Instructors bulk-invite by email", "Invite links up automatically on signup", "One student seat = full platform access"],
        visual: { kind: "screenshot", src: shotLogin, alt: "ARK sign-in screen" },
      },
      {
        title: "Run your full analysis",
        body: "Students get the complete Pro toolset: unlimited uploads, full dashboard, 12-vector radar, career pathways, FORGE cards and the executive report.",
        bullets: ["All Pro features included", "Unlimited uploads all semester", "Track your JST slope as you learn"],
        visual: { kind: "demo", demo: "score" },
      },
      {
        title: "See your cohort",
        body: "The institution dashboard shows your cohort, its assignments and where you stand — while instructors see aggregate progress across every student.",
        bullets: ["Your cohort view: assignments + standing", "Instructor view: roster, grades, comparisons", "Grades exportable to CSV"],
        visual: { kind: "demo", demo: "cohort" },
      },
      {
        title: "Complete assignments in the Arena",
        body: "Coursework maps to real CCGE sessions — you're graded on the same JCSE scale the industry rubric uses, and every session feeds your ARK score.",
        bullets: ["Assignments tied to real Skill Game sessions", "JCSE-graded: Bronze → Platinum", "ARK score grows with your coursework"],
        visual: { kind: "demo", demo: "game" },
      },
      {
        title: "Graduate with a portable profile",
        body: "Your ARK identity, cert level and verified history leave school with you — the same profile recruiters see on the public GUIN+ page.",
        bullets: ["Public GUIN+ profile at /u/your-name", "Context Craft certs persist after the course", "Same account upgrades to Pro later"],
        visual: { kind: "screenshot", src: shotTour, alt: "Guided demo tour" },
      },
    ],
  },
  {
    key: "ENTERPRISE",
    icon: Building2,
    tagline: "Workforce-level intelligence — see AI risk across your whole org.",
    cta: { href: "/login", label: "Talk to us / sign in" },
    steps: [
      {
        title: "Provision your workforce",
        body: "Bulk-assess your teams: every employee gets the full individual analysis, and the results roll up into one org-wide intelligence layer.",
        bullets: ["Bulk assessment across departments", "Every seat includes the full Pro toolset", "Custom integrations available"],
        visual: { kind: "demo", demo: "upload" },
      },
      {
        title: "Open Workforce Intelligence",
        body: "The enterprise dashboard aggregates live: per-department JST averages, vulnerability mix, and automation-exposure hotspots — before they become attrition.",
        bullets: ["Live aggregation, not stale reports", "Org-wide vulnerability split", "Department heatmap surfaces concentrated risk"],
        visual: { kind: "demo", demo: "workforce" },
      },
      {
        title: "Drill into departments",
        body: "Stack tenure and location filters, drill into any department with search and paging, or find one person across the whole org instantly.",
        bullets: ["AND-stacked tenure/location filters", "Bounded drill-down with search + paging", "Org-wide staff search"],
        visual: { kind: "screenshot", src: shotDashboard, alt: "Analytics dashboard" },
      },
      {
        title: "Send upskill nudges",
        body: "Spot an at-risk team and nudge them into action: an in-app notification plus email lands with each staff member, with a 7-day cooldown so it never spams.",
        bullets: ["In-app real-time notification + email", "7-day per-person cooldown built in", "Track who acted on the nudge"],
        visual: { kind: "demo", demo: "nudge" },
      },
      {
        title: "Report to the board",
        body: "Executive reporting across the workforce: exportable briefs, priority support, and a partner team for custom integrations into your HRIS.",
        bullets: ["Executive-grade exports", "Priority support", "Custom pricing — scaled to your headcount"],
        visual: { kind: "demo", demo: "report" },
      },
    ],
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────

const AUTO_ADVANCE_MS = 8000;

export function PlanWalkthroughs({ embedded = false }: { embedded?: boolean }) {
  const [planIdx, setPlanIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const sectionRef = React.useRef<HTMLElement | null>(null);
  // Only animate/advance while the section is actually on screen — the
  // landing page mounts this below the fold, so we skip all background work
  // until the visitor scrolls to it.
  const inView = useInView(sectionRef, { amount: 0.15 });
  const reduceMotion = useReducedMotion();

  const walk = WALKS[planIdx];
  const plan = SUBSCRIPTION_PLANS[walk.key];
  const step = walk.steps[stepIdx];
  const PlanIcon = walk.icon;

  // Auto-advance through steps (gif-style slideshow) while playing, visible,
  // and the visitor hasn't asked for reduced motion.
  const advancing = playing && inView && !reduceMotion;
  useEffect(() => {
    if (!advancing) return;
    const t = setInterval(() => {
      setStepIdx((i) => (i + 1) % walk.steps.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [advancing, planIdx, walk.steps.length]);

  const selectPlan = (i: number) => {
    setPlanIdx(i);
    setStepIdx(0);
    setPlaying(true); // switching plans restarts the slideshow
  };
  const selectStep = (i: number) => {
    setStepIdx(i);
    setPlaying(false);
  };

  const priceLabel = useMemo(() => {
    if (walk.key === "ENTERPRISE") return "Custom";
    if (plan.price === 0) return "Free";
    return `$${plan.price}/${plan.period}`;
  }, [walk.key, plan]);

  return (
    <MotionConfig reducedMotion="user">
    <section
      ref={sectionRef}
      className={cn("space-y-8", !embedded && "pt-12 border-t border-white/10")}
      data-testid="section-plan-walkthroughs"
    >
      {!embedded && (
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-display font-bold text-white tracking-tight">
            Step-by-Step <span className="text-primary neon-text">Walkthroughs</span>
          </h2>
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
            Every subscription, explained screen by screen
          </p>
        </div>
      )}

      {/* Plan tabs */}
      <div className="flex flex-wrap justify-center gap-2" data-testid="walkthrough-plan-tabs">
        {WALKS.map((w, i) => {
          const p = SUBSCRIPTION_PLANS[w.key];
          const Icon = w.icon;
          const active = i === planIdx;
          return (
            <button
              key={w.key}
              onClick={() => selectPlan(i)}
              data-testid={`tab-walkthrough-${w.key.toLowerCase()}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 transition-all font-display font-bold text-sm uppercase tracking-wide",
                active
                  ? "border-primary bg-primary/10 text-white shadow-[0_0_24px_-6px_hsl(var(--primary))]"
                  : "border-border bg-background/40 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" style={{ color: active ? p.color : undefined }} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Active walkthrough */}
      <AnimatePresence mode="wait">
        <motion.div
          key={walk.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="glass-card rounded-xl border border-primary/20 overflow-hidden"
          data-testid={`walkthrough-${walk.key.toLowerCase()}`}
        >
          {/* Plan header */}
          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-white/10 px-5 py-4 bg-background/40">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ borderColor: `${plan.color}66`, background: `${plan.color}1a` }}
              >
                <PlanIcon className="h-5 w-5" style={{ color: plan.color }} />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-white uppercase tracking-wide flex items-center gap-2 flex-wrap">
                  {plan.label}
                  <span className="text-xs font-mono text-muted-foreground normal-case tracking-normal">
                    {priceLabel}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{walk.tagline}</p>
              </div>
            </div>
            <button
              onClick={() => setPlaying((p) => !p)}
              data-testid="button-walkthrough-playpause"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition-all"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? "Auto-playing" : "Paused"}
            </button>
          </div>

          <div className="grid lg:grid-cols-5 gap-0">
            {/* Step list */}
            <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-white/10 p-4 space-y-2">
              {walk.steps.map((s, i) => {
                const active = i === stepIdx;
                return (
                  <button
                    key={s.title}
                    onClick={() => selectStep(i)}
                    data-testid={`walkthrough-step-${walk.key.toLowerCase()}-${i + 1}`}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-all flex items-start gap-3 relative overflow-hidden",
                      active
                        ? "border-primary/60 bg-primary/10"
                        : "border-transparent hover:border-border hover:bg-background/40",
                    )}
                  >
                    {/* Auto-advance progress bar on the active step */}
                    {active && playing && (
                      <motion.span
                        key={`${walk.key}-${stepIdx}`}
                        className="absolute bottom-0 left-0 h-0.5 bg-primary/70"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: "linear" }}
                      />
                    )}
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold border",
                        active
                          ? "bg-primary text-background border-primary"
                          : "bg-background/40 text-muted-foreground border-border",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block font-display font-bold text-sm leading-tight",
                          active ? "text-white" : "text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      {active && (
                        <span className="block text-xs text-muted-foreground mt-1 leading-snug">{s.body}</span>
                      )}
                    </span>
                  </button>
                );
              })}

              <Link
                href={walk.cta.href}
                data-testid={`link-walkthrough-cta-${walk.key.toLowerCase()}`}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-none neon-border bg-primary px-4 h-11 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.02]"
              >
                {walk.cta.label} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Visual panel */}
            <div className="lg:col-span-3 p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${walk.key}-${stepIdx}`}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.25 }}
                  className="h-full flex flex-col"
                >
                  <div className="relative flex-1 rounded-lg border border-border bg-background/60 overflow-hidden min-h-[280px] flex flex-col justify-center">
                    <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/80 border border-border px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                      {step.visual.kind === "screenshot" ? (
                        <>
                          <Camera className="h-3 w-3" /> Live screenshot
                        </>
                      ) : (
                        <>
                          <Clapperboard className="h-3 w-3" /> Animated preview
                        </>
                      )}
                    </span>
                    {step.visual.kind === "screenshot" ? (
                      <img
                        src={step.visual.src}
                        alt={step.visual.alt}
                        loading="lazy"
                        className="w-full h-full object-cover object-top"
                        data-testid={`img-walkthrough-${walk.key.toLowerCase()}-${stepIdx + 1}`}
                      />
                    ) : (
                      React.createElement(DEMOS[step.visual.demo])
                    )}
                  </div>
                  <ul className="grid sm:grid-cols-3 gap-2 mt-3">
                    {step.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex gap-1.5 rounded-md border border-border bg-background/40 p-2 text-[11px] text-muted-foreground leading-snug"
                      >
                        <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
    </MotionConfig>
  );
}
