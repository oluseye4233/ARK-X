import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Gauge,
  Gamepad2,
  Store,
  Compass,
  Building2,
  Check,
  ExternalLink,
  Crown,
  Trophy,
  Zap,
  TrendingUp,
  Users,
  ShieldAlert,
  BookOpen,
  QrCode,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FEATURES, type FeatureKey } from "@shared/featureFlags";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { JSTRadar } from "@/components/dashboard/JSTRadar";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { TransferabilityRadar } from "@/components/pathways/TransferabilityRadar";
import { UpskillingTimeline } from "@/components/pathways/UpskillingTimeline";
import { ARK_SCORE_DELTAS, CONTEXT_CRAFT_LEVELS, FLYWHEEL_CAPS, SPC_HIVE_MIN_TO_PUBLISH, SPC_FEEDBACK_BONUS_BY_STARS, LHCS_WEIGHTS } from "@shared/schema";
import { BOOK_TITLE, BOOK_TOTAL_NODES, JOURNEY_STAGES, JOURNEY_NODES } from "@shared/bookCompanion";
import { Star } from "lucide-react";

// ─── DEMO DATA ────────────────────────────────────────────────────────────
// Self-contained sample data for the guided tour. No auth, no backend calls.

const PERSONA = {
  name: "Sarah Chen",
  title: "Senior Product Manager · Atlas Logistics",
};

// Derive JST from the canonical formula so the demo never drifts from
// `server/scoringEngine.ts` math: JST = (J·.30 + S·.40 + T·.30) · 3.
const _RAW = { jobs: 79, skills: 88, talent: 80 };
const _RAW_TOTAL = Math.round((_RAW.jobs * 0.3 + _RAW.skills * 0.4 + _RAW.talent * 0.3) * 3);
const _CC_LEVEL = "CC_400" as const;
const _CC_MULT = CONTEXT_CRAFT_LEVELS[_CC_LEVEL].multiplier; // canonical 1.35×
const JST = {
  total: Math.min(300, Math.round(_RAW_TOTAL * _CC_MULT)),
  jobs: _RAW.jobs,
  skills: _RAW.skills,
  talent: _RAW.talent,
  rawTotal: _RAW_TOTAL,
  contextCraftLevel: _CC_LEVEL,
  contextCraftMultiplier: _CC_MULT,
  percentileRank: 91,
  previousScore: 282,
  industryAverage: 168,
};

const TRANSFER = [
  { subject: "Tech Fluency", A: 78, fullMark: 100 },
  { subject: "Innovation Trans.", A: 85, fullMark: 100 },
  { subject: "Agility Index", A: 88, fullMark: 100 },
  { subject: "Leadership Scal.", A: 81, fullMark: 100 },
  { subject: "Data Literacy", A: 74, fullMark: 100 },
  { subject: "Strategic Vision", A: 90, fullMark: 100 },
  { subject: "Industry Mobility", A: 72, fullMark: 100 },
  { subject: "Comm. Impact", A: 86, fullMark: 100 },
  { subject: "Domain Breadth", A: 68, fullMark: 100 },
  { subject: "Execution Speed", A: 83, fullMark: 100 },
  { subject: "Geographic Port.", A: 65, fullMark: 100 },
  { subject: "Creative Problem", A: 79, fullMark: 100 },
];

const UPSKILLING: Array<{
  id: string;
  phase: "30-Day" | "90-Day" | "12-Month";
  title: string;
  description: string;
  type: "new-skilling" | "up-skilling" | "ready-skilling";
  hours: number;
}> = [
  { id: "u1", phase: "30-Day", title: "Prompt Engineering Foundations", description: "Master CCMI Pillars 1-3: structured prompting, role-conditioning, output formatting", type: "ready-skilling", hours: 12 },
  { id: "u2", phase: "90-Day", title: "AI Workflow Orchestration", description: "Multi-agent pipelines using LangGraph or n8n", type: "new-skilling", hours: 30 },
  { id: "u3", phase: "12-Month", title: "ML Product Strategy", description: "Stanford XCS229i — model selection, evaluation, MLOps fluency", type: "new-skilling", hours: 120 },
];

// Tier ARK awards pulled from canonical ARK_SCORE_DELTAS so they always
// match what `server/arkRecalc.ts` actually grants.
const CCGE_TIERS = [
  { tier: "Bronze", range: "JCSE 30–35", color: "from-amber-700 to-orange-500", boost: `+${ARK_SCORE_DELTAS.SESSION_BRONZE} ARK / session` },
  { tier: "Silver", range: "JCSE 36–42", color: "from-slate-400 to-slate-200", boost: `+${ARK_SCORE_DELTAS.SESSION_SILVER} ARK / session` },
  { tier: "Gold", range: "JCSE 43–47", color: "from-yellow-500 to-amber-300", boost: `+${ARK_SCORE_DELTAS.SESSION_GOLD} ARK / session` },
  { tier: "Platinum", range: "JCSE 48–50", color: "from-fuchsia-500 to-cyan-400", boost: `+${ARK_SCORE_DELTAS.SESSION_PLATINUM} ARK / session` },
];

const CCGE_SAMPLE = {
  title: "SOC-2 Audit Response Drafter",
  tier: "Gold" as const,
  industry: "FinTech / Compliance",
  difficulty: 4,
  prompt:
    "A tenant is requesting your company's full data-retention policy as part of their vendor review. Draft a polite, complete, accurate response that cites the right policy sections without leaking internal infrastructure detail.",
  pillars: ["P1: Context", "P3: Specificity", "P5: Constraints"],
  budget: 600,
  yourCards: ["System Persona", "Role Lock", "Output Schema", "Tone: Formal", "Guardrails"],
};

const MARKETPLACE = [
  {
    id: "spc-001",
    title: "Investor Update — Series A Operator's Template",
    creator: "@elena_vc",
    tier: "Platinum",
    pillar: "P4: Reasoning",
    price: 25,
    rating: 4.9,
    purchases: 412,
    blurb: "Battle-tested monthly update structure used by 30+ portfolio cos. Hits MRR, runway, risks, asks.",
  },
  {
    id: "spc-002",
    title: "Cardiology Discharge Note Synthesizer",
    creator: "@dr_amir",
    tier: "Gold",
    pillar: "P3: Specificity",
    price: 18,
    rating: 4.7,
    purchases: 287,
    blurb: "Converts EHR fragments into a patient-friendly discharge summary. HIPAA-aware guardrails baked in.",
  },
  {
    id: "spc-003",
    title: "Enterprise RFP Decomposer",
    creator: "@rfp_killer",
    tier: "Gold",
    pillar: "P2: Decomposition",
    price: 20,
    rating: 4.8,
    purchases: 356,
    blurb: "Breaks a 60-page RFP into a structured response plan with owner suggestions and risk flags.",
  },
];

// Phase J — ARK = JST + CCMI, max 600
const CCMI = {
  total: 240,
  pillars: [
    { id: "P1", name: "Context", score: 36 },
    { id: "P2", name: "Decomposition", score: 33 },
    { id: "P3", name: "Specificity", score: 38 },
    { id: "P4", name: "Reasoning", score: 34 },
    { id: "P5", name: "Constraints", score: 30 },
    { id: "P6", name: "Synthesis", score: 35 },
    { id: "P7", name: "Iteration", score: 34 },
  ],
};
const LHCS = { cpr: 78, mps: 72, lcis: 81 };
const LHCS_COMPOSITE = Math.round(
  LHCS.cpr * LHCS_WEIGHTS.cpr + LHCS.mps * LHCS_WEIGHTS.mps + LHCS.lcis * LHCS_WEIGHTS.lcis,
);

// Phase K — Corporate marketplace listings (flag-gated CLASS C preview)
const CORPORATE_LISTINGS = [
  { id: "corp-1", title: "Atlas Logistics — Q3 OKR Synthesizer", scope: "CORPORATE", price: 0, stars: 4.8, feedbackCount: 27 },
  { id: "corp-2", title: "Atlas — Vendor Security Review Drafter", scope: "CORPORATE", price: 0, stars: 4.6, feedbackCount: 14 },
  { id: "corp-3", title: "Atlas — Incident Post-Mortem Template", scope: "BOTH", price: 8, stars: 4.9, feedbackCount: 41 },
];

const PIVOTS = [
  { role: "AI Integration Manager", feasibility: 87, gapCost: "$2,400", time: "4 months", salary: "+18%" },
  { role: "Product Ops Director", feasibility: 82, gapCost: "$1,800", time: "6 months", salary: "+24%" },
  { role: "Data Strategy Lead", feasibility: 74, gapCost: "$3,200", time: "8 months", salary: "+31%" },
];

const WORKFORCE_DEPTS = [
  { dept: "Engineering", headcount: 142, avgJst: 218, vuln: "Resilient", color: "text-emerald-400" },
  { dept: "Product", headcount: 38, avgJst: 234, vuln: "Flourishing", color: "text-cyan-400" },
  { dept: "Marketing", headcount: 67, avgJst: 162, vuln: "Exposed", color: "text-amber-400" },
  { dept: "Operations", headcount: 91, avgJst: 138, vuln: "Critical", color: "text-rose-400" },
  { dept: "Sales", headcount: 124, avgJst: 174, vuln: "Vulnerable", color: "text-orange-400" },
  { dept: "Finance", headcount: 29, avgJst: 191, vuln: "Resilient", color: "text-emerald-400" },
];

const WORKFORCE_VULN_MIX = [
  { label: "Flourishing", pct: 14, color: "bg-cyan-400" },
  { label: "Resilient", pct: 31, color: "bg-emerald-400" },
  { label: "Exposed", pct: 28, color: "bg-amber-400" },
  { label: "Vulnerable", pct: 19, color: "bg-orange-400" },
  { label: "Critical", pct: 8, color: "bg-rose-400" },
];

// Phase / Task #22 — Context Craft Book Companion (flag-gated reader journey)
const BOOK_TIER_ART: Record<string, string> = {
  Bronze: "from-amber-700 to-orange-500",
  Silver: "from-slate-400 to-slate-200",
  Gold: "from-yellow-500 to-amber-300",
  Platinum: "from-fuchsia-500 to-cyan-400",
};
// Demo Ledger — baseline captured at the Prologue, final at the Epilogue.
const BOOK_LEDGER = {
  baselineArk: 312,
  finalArk: JST.total + CCMI.total,
};

// ─── STEPS ────────────────────────────────────────────────────────────────

type Step = {
  id: string;
  num: number;
  icon: typeof Gauge;
  title: string;
  subtitle: string;
  route: string;
  routeLabel: string;
  /**
   * Feature flag that gates the deep-link target. When set and the flag is OFF
   * the surface's `<Route>` isn't registered in `App.tsx`, so the in-tour
   * "Open ..." button must NOT link there (it would land on the 404 page).
   * Undefined ⇒ a CLASS A surface that's always reachable.
   */
  flag?: FeatureKey;
  narrative: string;
  takeaways: string[];
  render: () => React.ReactElement;
};

const StepJst = () => {
  const ark = JST.total + CCMI.total;
  return (
    <div className="space-y-6">
      {/* ARK Identity strip (Phase J) */}
      <div className="glass-card rounded-xl border-2 border-secondary/40 p-5" data-testid="tour-ark-identity">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-secondary">ARK Identity · JST + CCMI</div>
            <div className="font-display text-xs text-muted-foreground">The canonical 0–600 score. Both engines move together.</div>
          </div>
          <div className="font-display text-4xl text-secondary neon-text">{ark}<span className="text-base text-muted-foreground"> / 600</span></div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <Stat icon={Gauge} label="JST" value={`${JST.total} / 300`} tone="text-primary" />
          <Stat icon={Crown} label="CCMI" value={`${CCMI.total} / 300`} tone="text-fuchsia-300" />
          <Stat icon={Trophy} label="LHCS" value={`${LHCS_COMPOSITE} · ${LHCS_COMPOSITE >= 70 ? "ACTIVE" : LHCS_COMPOSITE >= 40 ? "DEVELOPING" : "BASELINE"}`} tone="text-emerald-300" />
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {CCMI.pillars.map((p) => (
            <div key={p.id} className="text-center" data-testid={`tour-ccmi-${p.id}`}>
              <div className="h-12 bg-background/40 border border-border rounded relative overflow-hidden flex items-end">
                <div className="w-full bg-gradient-to-t from-fuchsia-500 to-cyan-400" style={{ height: `${(p.score / 50) * 100}%` }} />
              </div>
              <div className="text-[9px] font-mono text-muted-foreground mt-1">{p.id}</div>
              <div className="text-[9px] font-mono text-foreground">{p.score}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border text-[11px] font-mono text-muted-foreground flex items-center gap-4 flex-wrap">
          <span>Flywheel caps: <span className="text-cyan-300">+{FLYWHEEL_CAPS.CCGE_PER_DAY} ARK/day (CCGE)</span></span>
          <span>·</span>
          <span><span className="text-fuchsia-300">+{FLYWHEEL_CAPS.SPHINX_PER_30D} ARK/30-day (SPHINX)</span></span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <JSTGauge
          score={JST.total}
          jobsScore={JST.jobs}
          skillsScore={JST.skills}
          talentScore={JST.talent}
          rawTotal={JST.rawTotal}
          contextCraftLevel={JST.contextCraftLevel}
          contextCraftMultiplier={JST.contextCraftMultiplier}
          percentileRank={JST.percentileRank}
          previousScore={JST.previousScore}
          industryAverage={JST.industryAverage}
        />
        <div className="space-y-4">
          <JSTRadar jobsScore={JST.jobs} skillsScore={JST.skills} talentScore={JST.talent} />
          <VulnerabilityMeter level={3} />
        </div>
      </div>
    </div>
  );
};

const StepSkillGames = () => (
  <div className="space-y-6">
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {CCGE_TIERS.map((t) => (
        <div
          key={t.tier}
          className={cn(
            "glass-card rounded-xl p-4 border-2 text-center",
            t.tier === "Gold" ? "border-yellow-400/60" : "border-border",
          )}
          data-testid={`demo-tier-${t.tier.toLowerCase()}`}
        >
          <Crown className={cn("h-6 w-6 mx-auto mb-2 bg-gradient-to-br bg-clip-text text-transparent", t.color)} />
          <div className={cn("font-display font-bold text-lg bg-gradient-to-br bg-clip-text text-transparent", t.color)}>
            {t.tier}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">{t.range}</div>
          <div className="text-xs text-cyan-300 mt-2 font-mono">{t.boost}</div>
        </div>
      ))}
    </div>

    <div className="glass-card rounded-xl border-2 border-yellow-400/40 p-6">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-gradient-to-br from-yellow-500 to-amber-300 text-background font-display">Gold</Badge>
            <span className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300">{CCGE_SAMPLE.industry}</span>
          </div>
          <h3 className="font-display font-bold text-xl text-foreground">{CCGE_SAMPLE.title}</h3>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-right">
          Diff {CCGE_SAMPLE.difficulty}/5 · {CCGE_SAMPLE.budget}t budget
        </div>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{CCGE_SAMPLE.prompt}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {CCGE_SAMPLE.pillars.map((p) => (
          <Badge key={p} variant="outline" className="font-mono text-[10px] text-cyan-300 border-cyan-400/40">
            {p}
          </Badge>
        ))}
      </div>
      <div className="border-t border-border pt-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Your Hand</div>
        <div className="flex flex-wrap gap-2">
          {CCGE_SAMPLE.yourCards.map((c) => (
            <div
              key={c}
              className="px-3 py-2 rounded-md border border-primary/40 bg-primary/10 text-xs font-mono text-primary"
            >
              {c}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-border">
        <Stat icon={Trophy} label="Last JCSE" value="44/50" tone="text-yellow-300" />
        <Stat icon={Zap} label="ARK Boost" value={`+${ARK_SCORE_DELTAS.SESSION_GOLD}`} tone="text-cyan-300" />
        <Stat icon={TrendingUp} label="Streak" value="12 days" tone="text-emerald-300" />
      </div>
    </div>
  </div>
);

const StepMarketplace = () => (
  <div className="space-y-6">
    {/* Public marketplace */}
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-3 flex items-center gap-2">
        <Store className="h-3 w-3" /> Public Scope · OPEN
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {MARKETPLACE.map((m) => (
      <div
        key={m.id}
        className="glass-card rounded-xl border-2 border-border hover:border-secondary/40 transition-colors p-5 flex flex-col"
        data-testid={`demo-spc-${m.id}`}
      >
        <div className="flex items-center justify-between mb-3">
          <Badge
            className={cn(
              "font-display",
              m.tier === "Platinum"
                ? "bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-background"
                : "bg-gradient-to-br from-yellow-500 to-amber-300 text-background",
            )}
          >
            {m.tier}
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px] text-cyan-300 border-cyan-400/40">
            {m.pillar}
          </Badge>
        </div>
        <h3 className="font-display font-bold text-base text-foreground leading-tight mb-1">{m.title}</h3>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">by {m.creator}</div>
        <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">{m.blurb}</p>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="text-[10px] font-mono text-muted-foreground">
            ★ {m.rating} · {m.purchases} sold
          </div>
          <div className="font-display font-bold text-secondary">{m.price} cr</div>
        </div>
      </div>
        ))}
      </div>
    </div>

    {/* Corporate shelf (Phase K) */}
    <div className="glass-card rounded-xl border-2 border-fuchsia-400/40 p-5" data-testid="tour-corporate-shelf">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-fuchsia-300" />
          <div>
            <div className="font-display text-sm text-foreground">Atlas Logistics · Corporate Shelf</div>
            <div className="text-[10px] font-mono text-muted-foreground">Visible only to employees of the publishing org.</div>
          </div>
        </div>
        <Badge variant="outline" className="border-fuchsia-400/40 text-fuchsia-200 font-mono text-[10px]">CLASS C · flag-gated</Badge>
      </div>
      <div className="space-y-2">
        {CORPORATE_LISTINGS.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3" data-testid={`tour-corp-${l.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className={cn("font-mono text-[9px]", l.scope === "CORPORATE" ? "border-fuchsia-400/40 text-fuchsia-200" : "border-cyan-400/40 text-cyan-200")}>{l.scope}</Badge>
                <span className="text-sm text-foreground truncate">{l.title}</span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <Star className="h-3 w-3 text-amber-300 fill-amber-300" /> {l.stars} · {l.feedbackCount} ratings
              </div>
            </div>
            <span className="font-display text-sm text-secondary shrink-0">{l.price === 0 ? "Internal" : `${l.price} cr`}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Star-feedback bonus schedule */}
    <div className="glass-card rounded-xl border border-border p-5" data-testid="tour-feedback-bonus">
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-amber-300" />
        <h3 className="font-display text-sm uppercase tracking-widest text-foreground">Star Feedback → ARK Credits</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Verified buyers rate cards 1–5★. A rating of 3★ or higher mints fresh credits to the creator — quality compounds, low ratings cost nothing.</p>
      <div className="grid grid-cols-3 gap-3">
        {[5, 4, 3].map((stars) => (
          <div key={stars} className="rounded-md bg-background/40 border border-border p-3 text-center" data-testid={`tour-feedback-${stars}`}>
            <div className="flex items-center justify-center gap-0.5 mb-1">
              {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} className="h-3 w-3 text-amber-300 fill-amber-300" />
              ))}
            </div>
            <div className="font-display text-lg text-secondary">+{SPC_FEEDBACK_BONUS_BY_STARS[stars as 3 | 4 | 5]} cr</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const StepMobility = () => (
  <div className="space-y-6">
    <TransferabilityRadar data={TRANSFER} />
    <div className="grid md:grid-cols-3 gap-3">
      {PIVOTS.map((p) => (
        <div
          key={p.role}
          className="glass-card rounded-xl border border-border p-4"
          data-testid={`demo-pivot-${p.role.replace(/\s+/g, "-").toLowerCase()}`}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-display font-bold text-sm text-foreground">{p.role}</h4>
            <Badge variant="outline" className="font-mono text-[10px] text-emerald-300 border-emerald-400/40">
              {p.feasibility}% fit
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-[10px] font-mono">
            <div>
              <div className="text-muted-foreground uppercase tracking-widest">Cost</div>
              <div className="text-cyan-300 text-sm mt-0.5">{p.gapCost}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-widest">Time</div>
              <div className="text-cyan-300 text-sm mt-0.5">{p.time}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-widest">Comp</div>
              <div className="text-emerald-300 text-sm mt-0.5">{p.salary}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <UpskillingTimeline items={UPSKILLING} />
  </div>
);

const StepWorkforce = () => {
  const total = WORKFORCE_DEPTS.reduce((s, d) => s + d.headcount, 0);
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <Stat icon={Users} label="Total Headcount" value={total.toLocaleString()} tone="text-cyan-300" />
        <Stat icon={TrendingUp} label="Org Avg JST" value="186 / 300" tone="text-emerald-300" />
        <Stat icon={ShieldAlert} label="At-Risk Roles" value="27%" tone="text-rose-300" />
      </div>

      <div className="glass-card rounded-xl border border-border p-5">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">Department Heatmap</h3>
        <div className="space-y-2">
          {WORKFORCE_DEPTS.map((d) => {
            const pct = Math.round((d.avgJst / 300) * 100);
            return (
              <div key={d.dept} className="grid grid-cols-12 gap-3 items-center" data-testid={`demo-dept-${d.dept.toLowerCase()}`}>
                <div className="col-span-3 font-display text-sm text-foreground">{d.dept}</div>
                <div className="col-span-7 h-4 bg-background/40 rounded overflow-hidden border border-border">
                  <div
                    className={cn(
                      "h-full transition-all",
                      pct >= 70 ? "bg-emerald-400" : pct >= 55 ? "bg-amber-400" : "bg-rose-400",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="col-span-2 text-right font-mono text-xs">
                  <span className="text-foreground">{d.avgJst}</span>{" "}
                  <span className={d.color}>· {d.vuln}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card rounded-xl border border-border p-5">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">
          Vulnerability Mix (org-wide)
        </h3>
        <div className="flex h-6 rounded overflow-hidden border border-border">
          {WORKFORCE_VULN_MIX.map((v) => (
            <div key={v.label} className={cn("h-full", v.color)} style={{ width: `${v.pct}%` }} title={`${v.label}: ${v.pct}%`} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
          {WORKFORCE_VULN_MIX.map((v) => (
            <div key={v.label} className="flex items-center gap-2 text-[11px]">
              <span className={cn("w-3 h-3 rounded", v.color)} />
              <span className="text-muted-foreground">{v.label}</span>
              <span className="text-foreground font-mono">{v.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StepBook = () => {
  const delta = BOOK_LEDGER.finalArk - BOOK_LEDGER.baselineArk;
  return (
    <div className="space-y-6">
      {/* Book header + Ledger */}
      <div className="glass-card rounded-xl border-2 border-fuchsia-400/40 p-6" data-testid="tour-book-header">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-400/20 border border-fuchsia-400/40 flex items-center justify-center shrink-0">
              <BookOpen className="h-6 w-6 text-fuchsia-300" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300">The Book Companion</div>
              <h3 className="font-display font-bold text-xl text-foreground leading-tight">{BOOK_TITLE}</h3>
              <div className="text-xs text-muted-foreground mt-0.5">{BOOK_TOTAL_NODES} chapters · {JOURNEY_STAGES.length} stages · scan a QR in the book, land on the real surface.</div>
            </div>
          </div>
          <Badge variant="outline" className="border-fuchsia-400/40 text-fuchsia-200 font-mono text-[10px]">CLASS C · flag-gated</Badge>
        </div>

        {/* Ledger: baseline → final */}
        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          <Stat icon={Compass} label="Baseline ARK · Prologue" value={`${BOOK_LEDGER.baselineArk} / 600`} tone="text-muted-foreground" />
          <Stat icon={Award} label="Final ARK · Epilogue" value={`${BOOK_LEDGER.finalArk} / 600`} tone="text-secondary" />
          <Stat icon={TrendingUp} label="Proven Delta" value={`+${delta} ARK`} tone="text-emerald-300" />
        </div>
        <div className="mt-3 text-[11px] font-mono text-muted-foreground">
          The Ledger captures an immutable baseline when you start and a final snapshot at the Epilogue — the book proves your growth, not a marketing claim.
        </div>
      </div>

      {/* Stage-by-stage journey */}
      <div className="space-y-5">
        {JOURNEY_STAGES.map((stage, si) => {
          const nodes = JOURNEY_NODES.filter((n) => n.stage === stage.id);
          return (
            <div key={stage.id} className="glass-card rounded-xl border border-border p-5" data-testid={`tour-book-stage-${stage.id}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="h-6 w-6 rounded-md bg-primary/15 border border-primary/40 flex items-center justify-center font-display text-xs text-primary">{si + 1}</span>
                <h4 className="font-display text-sm uppercase tracking-widest text-foreground">{stage.label}</h4>
              </div>
              <p className="text-xs text-muted-foreground mb-4 ml-8">{stage.blurb}</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {nodes.map((n) => (
                  <div key={n.id} className="rounded-md border border-border bg-background/40 p-3 flex items-start gap-3" data-testid={`tour-book-node-${n.id}`}>
                    <div className={cn("h-8 w-8 rounded-md bg-gradient-to-br flex items-center justify-center shrink-0", BOOK_TIER_ART[n.tierArt] ?? "from-slate-500 to-slate-300")}>
                      <Award className="h-4 w-4 text-background" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        {n.chapterLabel}
                        {n.pillar && <span className="text-cyan-300">· {n.pillar}</span>}
                      </div>
                      <div className="font-display text-sm text-foreground leading-tight truncate">{n.title}</div>
                      <div className="text-[10px] font-mono text-fuchsia-200 mt-1 flex items-center gap-1">
                        <QrCode className="h-3 w-3" /> {n.badge}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const STEPS: Step[] = [
  {
    id: "jst",
    num: 1,
    icon: Gauge,
    title: "JST Index",
    subtitle: "Jobs · Skills · Talent — your single AI-readiness score",
    route: "/dashboard",
    routeLabel: "Open Intelligence Hub",
    narrative:
      "Every resume is parsed into three weighted sub-scores — Jobs (30%), Skills (40%), Talent (30%) — then multiplied by your Context Craft handicap. The 0–300 result lands you in one of five zones, from Critical to Flourishing, with industry percentile and AI-vulnerability level computed at the same time.",
    takeaways: [
      "Single number, defensible math — no black-box AI rating",
      "Context Craft certification acts as a multiplier (0.5× → 1.5×)",
      "Tracked over time so you can see the slope of your career",
    ],
    render: StepJst,
  },
  {
    id: "skill-games",
    num: 2,
    icon: Gamepad2,
    title: "Skill Games",
    subtitle: "The CCGE Arena — learn prompt engineering by playing",
    route: "/play",
    routeLabel: "Enter the Arena",
    narrative:
      "Pick a scenario, get dealt 5 Context Craft cards, build the strongest prompt, and Claude scores you on Knowledge, Clarity, Specificity, and Efficiency. Hit Bronze and above to earn ARK score. New in J.1: forge your own scenarios from your industry and role.",
    takeaways: [
      "Four tiers (Bronze → Platinum) gated by JCSE score",
      `Each session feeds your ARK score, capped at +${FLYWHEEL_CAPS.CCGE_PER_DAY}/day`,
      "Custom industry scenarios for nurses, lawyers, ops leads, anyone",
    ],
    render: StepSkillGames,
  },
  {
    id: "marketplace",
    num: 3,
    icon: Store,
    title: "SPHINX Marketplace",
    subtitle: "Battle-tested prompts, bought and sold by experts",
    route: "/marketplace",
    routeLabel: "Browse the Marketplace",
    narrative:
      "Once you hit Context Craft Gold (CC-400), you can publish Super Prompt Cards (SPCs) — production-grade prompts with a HIVE quality pre-check. Buyers spend ARK credits; creators earn passively. Every listing is pillar-tagged so search actually works.",
    takeaways: [
      `Publish gate: HIVE ≥ ${SPC_HIVE_MIN_TO_PUBLISH} (Gold) — quality bar enforced server-side`,
      "Pillar-indexed (P1–P7) so buyers find prompts that fix their gap",
      "Transactional purchase: credits + ownership flip in one DB write",
    ],
    render: StepMarketplace,
  },
  {
    id: "mobility",
    num: 4,
    icon: Compass,
    title: "Career Mobility",
    subtitle: "12-vector transferability + concrete pivots + upskilling",
    route: "/pathways",
    routeLabel: "Explore Pathways",
    narrative:
      "Your skills get projected across 12 transferability vectors — tech fluency, leadership scalability, geographic portability, and so on. Three top-fit pivot roles surface with realistic cost / time / comp deltas, and a 30 / 90 / 365-day plan tells you exactly what to learn next.",
    takeaways: [
      "Pivots aren't generic — they're filtered by your archetype",
      "Cost / time / salary lift are estimates with sourced assumptions",
      "Upskilling plan tagged ready- / up- / new-skilling for clarity",
    ],
    render: StepMobility,
  },
  {
    id: "workforce",
    num: 5,
    icon: Building2,
    title: "Workforce Intelligence",
    subtitle: "Enterprise dashboard — where AI risk lives inside your org",
    route: "/enterprise",
    routeLabel: "Open Workforce Dashboard",
    flag: "enterpriseDashboard",
    narrative:
      "Roll up every assessed employee into a per-department JST heatmap and an org-wide vulnerability mix. Spot the team that's three quarters away from automation displacement before HR does, and stage upskilling investment where ROI is highest.",
    takeaways: [
      "Department-level heatmap surfaces concentrated risk",
      "Org-wide vulnerability split — % Flourishing vs Critical",
      "Connects to cohort assignments for institutional rollouts",
    ],
    render: StepWorkforce,
  },
  {
    id: "book",
    num: 6,
    icon: BookOpen,
    title: "Book Companion",
    subtitle: `${BOOK_TITLE} — the book that walks you through the platform`,
    route: "/book",
    routeLabel: "Open the Journey",
    flag: "bookCompanion",
    narrative:
      `Every chapter of "${BOOK_TITLE}" prints a QR code that drops you straight onto a real ARK surface — no marketing detour. Work the ${BOOK_TOTAL_NODES}-chapter journey across ${JOURNEY_STAGES.length} stages, earn a named badge per chapter by actually playing the matching CCGE challenge, and let the Ledger prove your ARK growth from Prologue baseline to Epilogue.`,
    takeaways: [
      "Each chapter badge is earned on a real surface — never granted for reading",
      "QR slugs resolve to live deep links (works even when logged out)",
      "The Ledger captures an immutable baseline and a final delta",
    ],
    render: StepBook,
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="glass-card rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn("font-display text-xl font-bold", tone)}>{value}</div>
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────

export default function DemoTourPage() {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];
  const StepIcon = step.icon;

  const goTo = (i: number) => {
    setIdx(Math.max(0, Math.min(STEPS.length - 1, i)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Only deep-link when the step's target surface is actually registered (i.e.
  // its feature flag is on). For flagged-off surfaces, route visitors to /login
  // so the tour never dead-ends on the 404 page.
  const stepReachable = !step.flag || FEATURES[step.flag];
  const openHref = stepReachable ? step.route : "/login";
  const openLabel = stepReachable ? step.routeLabel : "Sign in to explore";

  return (
    <div className="min-h-screen pb-24" data-testid="demo-tour-page">
      {/* Top banner */}
      <div className="bg-gradient-to-r from-primary/20 via-fuchsia-500/10 to-primary/20 border-b border-primary/30 sticky top-0 z-30 backdrop-blur">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-primary">Guided Tour</span>
            <span className="text-muted-foreground">
              · Step {step.num} of {STEPS.length} · No Login Required
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              data-testid="link-classic-demo"
            >
              Classic Demo
            </Link>
            <Link
              href="/login"
              data-testid="link-tour-login"
              className="text-xs font-mono uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              Try with your resume <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 pt-8">
        {/* Step rail */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-8" data-testid="step-rail">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < idx;
            const active = i === idx;
            return (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                data-testid={`rail-step-${s.id}`}
                className={cn(
                  "text-left rounded-lg border p-3 transition-all flex items-start gap-2",
                  active
                    ? "border-primary bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary))]"
                    : done
                    ? "border-emerald-400/40 bg-emerald-400/5 hover:border-emerald-400/70"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center shrink-0 font-display font-bold text-sm",
                    active
                      ? "bg-primary text-background"
                      : done
                      ? "bg-emerald-400/20 text-emerald-300"
                      : "bg-background/40 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : s.num}
                </div>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-[10px] font-mono uppercase tracking-widest flex items-center gap-1",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" /> Step {s.num}
                  </div>
                  <div
                    className={cn(
                      "font-display text-sm font-bold leading-tight truncate",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step header + body */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
            data-testid={`step-body-${step.id}`}
          >
            <div className="glass-card rounded-xl border border-primary/20 p-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/30 to-fuchsia-500/20 border border-primary/40 flex items-center justify-center shrink-0">
                  <StepIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-[240px]">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">
                    Step {step.num} · For: {PERSONA.name}, {PERSONA.title}
                  </div>
                  <h1 className="font-display text-3xl text-white neon-text">{step.title}</h1>
                  <p className="text-sm text-muted-foreground mt-1">{step.subtitle}</p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-primary/40 text-primary hover:bg-primary/10"
                  data-testid={`button-open-${step.id}`}
                >
                  <Link href={openHref}>
                    {openLabel} <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
              <p className="text-base text-foreground/90 leading-relaxed mt-5 max-w-4xl">{step.narrative}</p>
              <ul className="grid sm:grid-cols-3 gap-3 mt-5">
                {step.takeaways.map((t) => (
                  <li
                    key={t}
                    className="text-xs text-muted-foreground bg-background/40 border border-border rounded-md p-3 flex gap-2"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>{step.render()}</div>
          </motion.div>
        </AnimatePresence>

        {/* Nav footer */}
        <div className="mt-10 flex items-center justify-between gap-4 flex-wrap" data-testid="step-nav">
          <Button
            variant="outline"
            onClick={() => goTo(idx - 1)}
            disabled={idx === 0}
            data-testid="button-prev-step"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Previous
          </Button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to step ${i + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === idx ? "w-8 bg-primary" : i < idx ? "w-2 bg-emerald-400" : "w-2 bg-muted",
                )}
                data-testid={`dot-step-${i + 1}`}
              />
            ))}
          </div>

          {idx < STEPS.length - 1 ? (
            <Button
              onClick={() => goTo(idx + 1)}
              className="bg-gradient-to-r from-primary to-fuchsia-500 text-background hover:opacity-90"
              data-testid="button-next-step"
            >
              Next: {STEPS[idx + 1].title} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              asChild
              className="bg-gradient-to-r from-primary to-emerald-400 text-background hover:opacity-90"
              data-testid="button-tour-complete"
            >
              <Link href="/login">
                Start with your resume <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
