import { useEffect, useState } from "react";
import { JSTGauge } from "@/components/dashboard/JSTGauge";
import { JSTRadar } from "@/components/dashboard/JSTRadar";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { JnomicsCardList } from "@/components/dashboard/JnomicsCardList";
import { ArchetypeHandicap } from "@/components/dashboard/ArchetypeHandicap";
import { TaskHeatmap } from "@/components/dashboard/TaskHeatmap";
import { VulnerabilityTimeline } from "@/components/dashboard/VulnerabilityTimeline";
import { Cpu, FileText, Loader2, TrendingUp, Mail, CheckCircle2, Activity, Zap, History, Info, ArrowUpRight, Upload as UploadIcon, BookOpen, GraduationCap } from "lucide-react";
import { useArkStream, describeEvent } from "@/lib/useArkStream";
import { Link } from "wouter";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, CartesianGrid } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ArkIdentityCard, type ArkIdentity } from "@/components/dashboard/ArkIdentityCard";
import { LhcsSignal, type LhcsData } from "@/components/dashboard/LhcsSignal";
import { CcmiPillars, type CcmiPillarData } from "@/components/dashboard/CcmiPillars";
import { JstCcmiDoughnuts } from "@/components/dashboard/JstCcmiDoughnuts";
import { FlywheelCard, type FlywheelCta } from "@/components/dashboard/FlywheelCard";
import { FEATURES } from "@shared/featureFlags";
import { isEmptyProfile } from "@shared/assessmentMerge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AssessmentData {
  id: string;
  userId: string;
  jstTotal: number;
  jstJobs: number;
  jstSkills: number;
  jstTalent: number;
  vulnerabilityLevel: number;
  readinessProfile: string;
  riskModifiers: Array<{ task: string; automatable: number }> | null;
  matchedCardIds: string[] | null;
  percentileRank?: number;
  previousScore?: number;
  industryAverage?: number;
  archetypeArchitect: number;
  archetypeOrchestrator: number;
  archetypeConductor: number;
  automationMilestones?: Array<{ year: number; event: string; automationPct: number; impact: string }> | null;
  contextCraftLevel?: string | null;
  contextCraftMultiplier?: number | null;
  jstRawTotal?: number | null;
  jstRawJobs?: number | null;
  jstRawSkills?: number | null;
  jstRawTalent?: number | null;
  upskillingPlans: unknown[];
  pivotOpportunities: unknown[];
  transferabilityVectors: unknown[];
  sourcesUsed?: string[] | null;
  completeness?: number | null;
  createdAt?: string;
}

// Human labels for the intake sources that fed the cumulative ARK profile.
const SOURCE_LABELS: Record<string, string> = {
  resume: "Resume",
  self: "Self-Assessment",
  linkedin: "LinkedIn",
  quiz: "Archetype Quiz",
};

// Plain-English glossary for the dashboard's house jargon. Surfaced via the
// little (i) buttons next to section headings so first-time users aren't
// staring at acronyms.
function Glossary({ term }: { term: string }) {
  const text = GLOSSARY[term];
  if (!text) return null;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${term}?`}
          data-testid={`glossary-${term.toLowerCase().replace(/\s+/g, '-')}`}
          className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs bg-card text-foreground border border-primary/30 leading-snug">
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary block mb-1">{term}</span>
        <span className="text-xs">{text}</span>
      </TooltipContent>
    </Tooltip>
  );
}

const GLOSSARY: Record<string, string> = {
  "JST": "Job–Skills–Talent index. Your overall career capital score from 0–300, calibrated against live labour market data.",
  "CCMI": "Career Capital Maturity Index. A 0–100 measure of how durable and transferable your career capital is.",
  "ARK Score": "Composite score (0–600) blending JST, CCMI and your CODEC archetype profile. The single number to watch.",
  "CODEC": "Junglenomics CODEC — 22 enterprise primitives mapped to global skill standards (O*NET, SFIA v8, WEF Future of Jobs).",
  "Vulnerability": "5-level classification of how much of your role today's AI tools can already do.",
  "Archetype": "Your dominant work style: Architect (designs systems), Orchestrator (coordinates people), or Conductor (executes plays).",
  "LHCS": "Live Human-Capital Signal. Real-time pulse of your trajectory across the platform.",
  "Flywheel": "The CCGE → JST → Marketplace loop. Each turn compounds your ARK Score.",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [allAssessments, setAllAssessments] = useState<AssessmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [identity, setIdentity] = useState<ArkIdentity | null>(null);
  const [pillars, setPillars] = useState<CcmiPillarData | null>(null);
  const [lhcs, setLhcs] = useState<LhcsData | null>(null);
  const [cta, setCta] = useState<{ top: FlywheelCta | null; ranked: FlywheelCta[] }>({ top: null, ranked: [] });
  const { snapshot, events, pulse, lastIdentity } = useArkStream(!!user);

  const loadIdentity = () => {
    Promise.all([
      api.getArkIdentity().catch(() => null),
      api.getArkFlywheelCta().catch(() => ({ top: null, ranked: [] })),
    ]).then(([id, ctaResp]) => {
      const idResp = id as
        | (ArkIdentity & { pillars?: CcmiPillarData; lhcs?: LhcsData })
        | null;
      if (idResp) {
        setIdentity({
          arkScore: idResp.arkScore, jstIndex: idResp.jstIndex, ccmi: idResp.ccmi,
          ccmiTier: idResp.ccmiTier, vmstLevel: idResp.vmstLevel, typology: idResp.typology,
          arkIdString: idResp.arkIdString, resumeReplacementPct: idResp.resumeReplacementPct,
        });
        if (idResp.pillars) setPillars(idResp.pillars);
        if (idResp.lhcs) setLhcs(idResp.lhcs);
      }
      const ctaTyped = ctaResp as { top: FlywheelCta | null; ranked: FlywheelCta[] } | null;
      setCta(ctaTyped || { top: null, ranked: [] });
    });
  };

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getLatestAssessment(user.id).catch(() => null),
      api.getAllAssessments(user.id).catch(() => []),
    ]).then(([latest, all]) => {
      setAssessment(latest);
      setAllAssessments(Array.isArray(all) ? all : []);
    }).finally(() => setLoading(false));
    // Initial load — re-fetch only once on mount. From here on, ark.identity
    // SSE events update the cards in place (PDD §3.4 perf hardening) so we
    // no longer hammer /api/ark/identity + /api/ark/flywheel-cta on every
    // CCGE round / marketplace event.
    loadIdentity();
  }, [user]);

  // Apply full-payload SSE updates directly without re-fetching.
  useEffect(() => {
    if (!lastIdentity) return;
    if (lastIdentity.identity) {
      setIdentity(lastIdentity.identity);
    }
    if (lastIdentity.pillars !== undefined) {
      setPillars(lastIdentity.pillars);
    }
    if (lastIdentity.lhcs !== undefined) {
      setLhcs(lastIdentity.lhcs);
    }
    if (lastIdentity.flywheel) {
      setCta({
        top: lastIdentity.flywheel.top,
        ranked: lastIdentity.flywheel.ranked ?? [],
      });
    }
  }, [lastIdentity]);

  const handleSendEmail = async () => {
    if (!user) return;
    setSendingEmail(true);
    try {
      await api.requestEmailNotification(user.id, user.username);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    } catch (err) {
      console.error("Email notification failed:", err);
      setEmailError(true);
      setTimeout(() => setEmailError(false), 4000);
    } finally {
      setSendingEmail(false);
    }
  };

  const historyData = [...allAssessments]
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .map((a, i) => ({
      label: `#${i + 1}`,
      date: a.createdAt
        ? new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : `Assessment ${i + 1}`,
      total: a.jstTotal,
      jobs: a.jstJobs,
      skills: a.jstSkills,
      talent: a.jstTalent,
    }));

  // Friendlier loading state — sentence case, hint at what's actually happening.
  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center" data-testid="dashboard-loading">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-display text-lg text-white mb-1">Crunching your career data…</p>
        <p className="text-sm text-muted-foreground font-sans max-w-md text-center">
          We're matching your résumé against 22 CODEC primitives and live labour-market signals. This usually takes a couple of seconds.
        </p>
      </div>
    );
  }

  // Friendlier empty state — looks like a guide instead of an error.
  if (!assessment) {
    return (
      <div className="w-full max-w-3xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center" data-testid="dashboard-empty">
        <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-5">
          <UploadIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">Let's get your first reading</h2>
        <p className="text-sm text-muted-foreground font-sans max-w-md mb-6 leading-relaxed">
          Upload your CV to generate your JST score, vulnerability profile and personalised pivot opportunities. It takes about a minute.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/upload"
            data-testid="button-start-first-assessment"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider px-6 py-3 text-sm font-medium rounded-md transition-all hover:scale-[1.02]"
          >
            <UploadIcon className="h-4 w-4" /> Upload your CV
          </Link>
          <button
            type="button"
            onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="button-launch-onboarding"]')?.click()}
            data-testid="button-empty-take-tour"
            className="inline-flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/10 font-mono uppercase tracking-wider px-6 py-3 text-sm font-medium rounded-md transition-all"
          >
            Take the 60-second tour
          </button>
        </div>
      </div>
    );
  }

  // Empty-profile state: the user removed every contributed source, so the
  // server rebuilt the profile over empty input and persisted an honest zeroed
  // assessment. Show an explicit "no sources" guide instead of the misleading
  // floor-baseline scores. Re-adding any source restores the normal hub.
  if (isEmptyProfile(assessment.sourcesUsed, assessment.completeness)) {
    return (
      <div className="w-full max-w-3xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center" data-testid="dashboard-no-sources">
        <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-5">
          <UploadIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">No sources contributed yet</h2>
        <p className="text-sm text-muted-foreground font-sans max-w-md mb-6 leading-relaxed">
          You've removed every source that fed your ARK profile, so there's nothing to score right now. Add a résumé, self-assessment or LinkedIn profile to rebuild your reading.
        </p>
        <Link
          href="/upload"
          data-testid="button-add-source-empty"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider px-6 py-3 text-sm font-medium rounded-md transition-all hover:scale-[1.02]"
        >
          <UploadIcon className="h-4 w-4" /> Add a source
        </Link>
      </div>
    );
  }

  const userName = user?.name || "Unknown";
  const userRole = user?.role || "Unknown";

  // Hero metric: lead with one number — the ARK Score — plus a single
  // human-readable interpretation so users get an answer before scrolling
  // through nine charts. Falls back to JST if ARK identity hasn't loaded.
  const heroScore = identity?.arkScore ?? assessment.jstTotal;
  const heroMax = identity?.arkScore !== undefined ? 600 : 300;
  const heroLabel = identity?.arkScore !== undefined ? "ARK Score" : "JST Score";
  const previousHero = assessment.previousScore ?? Math.round(heroScore * 0.95);
  const heroDelta = heroScore - previousHero;
  const percentile = assessment.percentileRank ?? 72;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">
              Intelligence Hub
            </h2>
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            SUBJECT: <span className="text-primary">{userName}</span> · ROLE: {userRole}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link href="/ark/history" className="inline-flex items-center justify-center border border-secondary/50 text-secondary hover:bg-secondary/10 font-mono text-xs uppercase tracking-widest h-10 px-4 rounded-md" data-testid="link-ark-history">
            <History className="w-4 h-4 mr-2" /> ARK History
          </Link>
          {FEATURES.bookCompanion && (
            <Link href="/book" className="inline-flex items-center justify-center border border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-widest h-10 px-4 rounded-md" data-testid="link-book-companion">
              <BookOpen className="w-4 h-4 mr-2" /> Book Companion
            </Link>
          )}
          {FEATURES.executiveReport && (
            <Link href="/report" className="inline-flex items-center justify-center border border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-widest h-10 px-4 rounded-md">
              <FileText className="w-4 h-4 mr-2" /> Export Brief
            </Link>
          )}
        </div>
      </div>

      {/* Hero: the single answer */}
      <div className="glass-card p-6 md:p-8 rounded-xl border border-primary/40" data-testid="card-hero-summary">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Your {heroLabel}</span>
              <Glossary term={heroLabel === "ARK Score" ? "ARK Score" : "JST"} />
            </div>
            <div className="flex items-baseline gap-3">
              <motion.span
                key={heroScore}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl sm:text-5xl md:text-6xl font-display font-black text-primary neon-text leading-none"
                data-testid="text-hero-score"
              >
                {heroScore}
              </motion.span>
              <span className="text-lg font-mono text-muted-foreground">/ {heroMax}</span>
            </div>
            <p className="mt-3 text-base text-white/90 font-sans leading-relaxed">
              You're a <span className="font-display text-secondary">{assessment.readinessProfile}</span> in the top <span className="text-primary font-bold">{100 - percentile}%</span> for your role.
              {heroDelta !== 0 && (
                <span className={heroDelta > 0 ? "text-secondary" : "text-destructive"}>
                  {" "}{heroDelta > 0 ? "↑" : "↓"} {Math.abs(heroDelta)} since last reading.
                </span>
              )}
            </p>

            {/* Cumulative-profile attribution: which intake sources fed this
                report + how complete the picture is. Grows as the user layers
                in resume / self-assessment / LinkedIn. */}
            {(assessment.sourcesUsed?.length || assessment.completeness != null) && (
              <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="strip-sources-used">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Built from
                </span>
                {(assessment.sourcesUsed ?? []).map((s) => (
                  <span
                    key={s}
                    data-testid={`badge-source-${s}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-primary font-mono text-[10px] uppercase tracking-wider"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {SOURCE_LABELS[s] ?? s}
                  </span>
                ))}
                {!assessment.sourcesUsed?.length && (
                  <span className="text-[10px] font-mono text-muted-foreground/60">single assessment</span>
                )}
                {assessment.completeness != null && (
                  <span
                    className="ml-1 text-[10px] font-mono uppercase tracking-widest text-secondary"
                    data-testid="text-dashboard-completeness"
                  >
                    · {assessment.completeness}% complete
                  </span>
                )}
                <Link
                  href="/upload"
                  data-testid="link-add-source"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Add a source <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          <div className="flex md:flex-col gap-3 md:items-end">
            <div className="glass px-4 py-3 rounded-lg border-primary/30 flex items-center gap-3">
              <Cpu className="w-5 h-5 text-primary" />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Archetype</p>
                  <Glossary term="Archetype" />
                </div>
                <p className="text-primary font-display font-bold uppercase tracking-wider text-sm" data-testid="text-hero-archetype">{assessment.readinessProfile}</p>
              </div>
            </div>
            <Link
              href="/pathways"
              data-testid="link-hero-pathways"
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-secondary hover:text-secondary/80 transition-colors"
            >
              See pivot opportunities <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Live activity strip */}
      <div className="glass-card p-5 rounded-xl border border-primary/30" data-testid="card-ark-flywheel">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              key={pulse}
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <Activity className="h-5 w-5 text-primary" />
              {pulse > 0 && (
                <span className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
              )}
            </motion.div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono">Live ARK Score</p>
                <Glossary term="Flywheel" />
              </div>
              <motion.p
                key={lastIdentity?.arkScore ?? identity?.arkScore ?? 0}
                initial={{ scale: 0.95, color: "#FFDD00" }}
                animate={{ scale: 1, color: "#00B4D8" }}
                transition={{ duration: 0.6 }}
                className="text-2xl font-display font-bold"
                data-testid="text-live-ark-score"
              >
                {lastIdentity?.arkScore ?? identity?.arkScore ?? snapshot?.arkScore ?? 0}
                <span className="text-xs text-muted-foreground/70 font-mono ml-1">/600</span>
              </motion.p>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-secondary" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono">Recent activity</p>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1" data-testid="list-ark-events">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground font-mono italic">No activity yet — finish a Skill Games session to see the loop turn.</p>
              ) : (
                events.slice(0, 5).map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between text-xs font-mono border-l-2 border-primary/30 pl-2"
                    data-testid={`event-${ev.type}-${ev.id}`}
                  >
                    <span className="text-white/80 truncate">{describeEvent(ev)}</span>
                    {ev.scoreDelta !== 0 && (
                      <span className={ev.scoreDelta > 0 ? "text-secondary" : "text-destructive"}>
                        {ev.scoreDelta > 0 ? "+" : ""}{ev.scoreDelta}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed content: progressively disclose the supporting visuals */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full grid grid-cols-3 bg-card/60 border border-white/10 h-auto p-1" data-testid="tabs-dashboard">
          <TabsTrigger
            value="profile"
            data-testid="tab-profile"
            className="font-mono text-xs uppercase tracking-widest py-2.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
          >
            Your Profile
          </TabsTrigger>
          <TabsTrigger
            value="risk"
            data-testid="tab-risk"
            className="font-mono text-xs uppercase tracking-widest py-2.5 data-[state=active]:bg-destructive/15 data-[state=active]:text-destructive"
          >
            Your Risk
          </TabsTrigger>
          <TabsTrigger
            value="path"
            data-testid="tab-path"
            className="font-mono text-xs uppercase tracking-widest py-2.5 data-[state=active]:bg-secondary/15 data-[state=active]:text-secondary"
          >
            Your Path
          </TabsTrigger>
        </TabsList>

        {/* PROFILE — who you are: identity, scores breakdown, archetype, primitives */}
        <TabsContent value="profile" className="mt-6 space-y-8 focus-visible:outline-none" data-testid="tab-content-profile">
          {identity && <ArkIdentityCard identity={identity} />}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {identity && (
              <JstCcmiDoughnuts jst={identity.jstIndex} ccmi={identity.ccmi} />
            )}
            <div className="lg:col-span-2">
              <CcmiPillars data={pillars} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <JSTGauge
              score={identity?.jstIndex ?? assessment.jstTotal}
              jobsScore={assessment.jstJobs}
              skillsScore={assessment.jstSkills}
              talentScore={assessment.jstTalent}
              percentileRank={assessment.percentileRank ?? 72}
              previousScore={assessment.previousScore ?? Math.round((identity?.jstIndex ?? assessment.jstTotal) * 0.95)}
              industryAverage={assessment.industryAverage ?? 195}
              contextCraftLevel={assessment.contextCraftLevel || undefined}
              contextCraftMultiplier={assessment.contextCraftMultiplier || undefined}
              rawTotal={assessment.jstRawTotal || undefined}
            />
            <JSTRadar
              jobsScore={assessment.jstJobs}
              skillsScore={assessment.jstSkills}
              talentScore={assessment.jstTalent}
            />
          </div>

          <ArchetypeHandicap
            architect={assessment.archetypeArchitect}
            orchestrator={assessment.archetypeOrchestrator}
            conductor={assessment.archetypeConductor}
            profile={assessment.readinessProfile}
          />

          <JnomicsCardList matchedCardIds={assessment.matchedCardIds || []} />
        </TabsContent>

        {/* RISK — where you're exposed */}
        <TabsContent value="risk" className="mt-6 space-y-8 focus-visible:outline-none" data-testid="tab-content-risk">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <VulnerabilityMeter level={assessment.vulnerabilityLevel} />
            <TaskHeatmap riskModifiers={assessment.riskModifiers || []} />
          </div>

          <VulnerabilityTimeline
            vulnerabilityLevel={assessment.vulnerabilityLevel}
            milestones={assessment.automationMilestones}
          />
        </TabsContent>

        {/* PATH — what to do next */}
        <TabsContent value="path" className="mt-6 space-y-8 focus-visible:outline-none" data-testid="tab-content-path">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LhcsSignal data={lhcs} />
            <FlywheelCard top={cta.top} ranked={cta.ranked} />
          </div>

          {FEATURES.trainingProviders && (
            <Link
              href="/training"
              data-testid="link-training-providers"
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-xl border border-secondary/30 hover:border-secondary/60 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                  <GraduationCap className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-secondary uppercase tracking-widest">Suggested Training Providers</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Certifications ranked against your JST-matched upskilling path — close the gaps the engine surfaced.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-secondary group-hover:text-secondary/80 transition-colors whitespace-nowrap">
                Explore providers <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          )}

          {historyData.length > 1 && (
            <div className="glass-card p-6 rounded-xl" data-testid="card-assessment-history">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">Assessment History</h3>
                </div>
                <span className="text-xs font-mono text-muted-foreground">{historyData.length} assessments</span>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "monospace" }} />
                  <YAxis tick={{ fill: "#aaa", fontSize: 11 }} domain={[0, 300]} />
                  <ReTooltip
                    contentStyle={{
                      backgroundColor: "#1a1f35",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="total" stroke="#00B4D8" strokeWidth={2} dot={{ fill: "#00B4D8", r: 4 }} name="Total JST" />
                  <Line type="monotone" dataKey="jobs" stroke="#44AA44" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Jobs" />
                  <Line type="monotone" dataKey="skills" stroke="#AA44FF" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Skills" />
                  <Line type="monotone" dataKey="talent" stroke="#FFDD00" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Talent" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Email summary — gated on `assessmentEmail` flag (CLASS C). */}
      {FEATURES.assessmentEmail && (
      <div className="glass-card p-6 rounded-xl" data-testid="card-email-summary">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display font-bold text-sm text-white uppercase tracking-widest">Email Summary</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">Send your latest assessment results to your inbox</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {emailSent && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-secondary text-xs font-mono flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Queued
                </motion.span>
              )}
              {emailError && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-destructive text-xs font-mono"
                >
                  Failed to send
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSendEmail}
              disabled={sendingEmail || emailSent}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all disabled:opacity-40"
              data-testid="button-send-email-summary"
            >
              {sendingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              {sendingEmail ? "Sending..." : "Send Report"}
            </button>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}
