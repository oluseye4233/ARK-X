import { useState, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  FileText, Linkedin, ListChecks, ArrowRight, ArrowLeft, Upload,
  Sparkles, Loader2, ShieldCheck, Zap, Lock, Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { VulnerabilityMeter } from "@/components/dashboard/VulnerabilityMeter";
import { SUBSCRIPTION_PLANS } from "@shared/schema";

type Archetype = "Architect" | "Orchestrator" | "Conductor";
type Phase = "choose" | "questionnaire" | "linkedin" | "resume" | "loading" | "result";

const QUESTIONS: { question: string; options: { text: string; type: Archetype }[] }[] = [
  {
    question: "When approaching a complex data synthesis task, your primary instinct is to:",
    options: [
      { text: "Design a systemic prompt architecture to handle it completely.", type: "Architect" },
      { text: "Delegate sub-tasks to specialized models and combine the output.", type: "Orchestrator" },
      { text: "Iteratively guide a single model through the problem step-by-step.", type: "Conductor" },
    ],
  },
  {
    question: "How do you view AI's role in your daily workflow?",
    options: [
      { text: "As a foundational layer to build new operational frameworks upon.", type: "Architect" },
      { text: "As a team of specialists to manage and coordinate.", type: "Orchestrator" },
      { text: "As a powerful collaborative tool that enhances my execution speed.", type: "Conductor" },
    ],
  },
  {
    question: "If an AI-generated output fails to meet standards, you immediately:",
    options: [
      { text: "Rewrite the underlying system instructions and constraints.", type: "Architect" },
      { text: "Switch to a different model or adjust the processing pipeline.", type: "Orchestrator" },
      { text: "Engage in a conversational feedback loop to correct the errors.", type: "Conductor" },
    ],
  },
  {
    question: "When presented with a new technology, your first move is to:",
    options: [
      { text: "Map it into a system blueprint and identify integration points.", type: "Architect" },
      { text: "Evaluate how it fits into the existing tool ecosystem and workflows.", type: "Orchestrator" },
      { text: "Try it hands-on and build a prototype to test its limits.", type: "Conductor" },
    ],
  },
  {
    question: "Your team faces a major strategic pivot. You contribute by:",
    options: [
      { text: "Designing the new architecture and long-term technical vision.", type: "Architect" },
      { text: "Coordinating the migration plan and aligning cross-functional teams.", type: "Orchestrator" },
      { text: "Leading the execution, shipping deliverables and keeping momentum.", type: "Conductor" },
    ],
  },
  {
    question: "When documenting a complex process, you prioritize:",
    options: [
      { text: "Comprehensive system diagrams and constraint specifications.", type: "Architect" },
      { text: "Workflow maps showing dependencies between teams and tools.", type: "Orchestrator" },
      { text: "Step-by-step runbooks with examples and edge cases.", type: "Conductor" },
    ],
  },
  {
    question: "In a high-pressure deadline scenario, your strength is:",
    options: [
      { text: "Quickly simplifying the system to reduce complexity and risk.", type: "Architect" },
      { text: "Reallocating resources and re-prioritizing across the pipeline.", type: "Orchestrator" },
      { text: "Rolling up your sleeves and grinding through the critical path.", type: "Conductor" },
    ],
  },
  {
    question: "Your ideal career growth path involves:",
    options: [
      { text: "Becoming a technical visionary who shapes platform strategy.", type: "Architect" },
      { text: "Leading cross-functional programs at increasing scale.", type: "Orchestrator" },
      { text: "Mastering execution and becoming the go-to problem solver.", type: "Conductor" },
    ],
  },
];

interface FreeResult {
  method: string;
  jstTotal: number;
  jstJobs: number;
  jstSkills: number;
  jstTalent: number;
  vulnerabilityLevel: number;
  readinessProfile: string;
  archetype: { architect: number; orchestrator: number; conductor: number };
  riskModifiers: { task: string; automatable: number }[];
  pivotOpportunities: { role: string; feasibility: number; gapCost: string; time: string }[];
  spots: { claimed: number; limit: number; remaining: number };
}

export default function FreeAssessment() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Archetype[]>([]);
  const [linkedinText, setLinkedinText] = useState("");
  const [result, setResult] = useState<FreeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const spotsQuery = useQuery<{ claimed: number; limit: number; remaining: number }>({
    queryKey: ["/api/free-assessment/spots"],
    queryFn: () => api.getFreeAssessmentSpots(),
    refetchOnWindowFocus: false,
  });
  const remaining = result?.spots.remaining ?? spotsQuery.data?.remaining ?? 100;
  const limit = result?.spots.limit ?? spotsQuery.data?.limit ?? 100;

  function reset() {
    setPhase("choose");
    setQIndex(0);
    setAnswers([]);
    setLinkedinText("");
    setResult(null);
    setError(null);
  }

  async function runSubmit(fn: () => Promise<FreeResult>) {
    setError(null);
    setPhase("loading");
    try {
      const r = await fn();
      setResult(r);
      setPhase("result");
      spotsQuery.refetch();
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
      setPhase("choose");
    }
  }

  function answerQuestion(type: Archetype) {
    const next = [...answers];
    next[qIndex] = type;
    setAnswers(next);
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(qIndex + 1);
    } else {
      runSubmit(() => api.submitFreeAssessment({ method: "questionnaire", answers: next }));
    }
  }

  function submitLinkedin() {
    if (linkedinText.trim().length < 50) {
      setError("Please paste at least a few lines from your LinkedIn profile.");
      return;
    }
    runSubmit(() => api.submitFreeAssessment({ method: "linkedin", text: linkedinText }));
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    runSubmit(() => api.submitFreeAssessmentResume(file));
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* ambient grid glow */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "linear-gradient(hsl(188 86% 53%) 1px, transparent 1px), linear-gradient(90deg, hsl(188 86% 53%) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      <div className="relative max-w-5xl mx-auto px-4 py-10 md:py-16">
        {/* Scarcity ribbon */}
        <div className="flex justify-center mb-6">
          <div
            className="glass neon-border rounded-full px-5 py-2 flex items-center gap-2 text-sm font-mono uppercase tracking-widest text-primary"
            data-testid="badge-spots"
          >
            <Sparkles className="w-4 h-4" />
            {remaining <= 0 ? (
              <span data-testid="text-spots-remaining">All {limit} free spots claimed — still free to try</span>
            ) : (
              <>First 100 Free · <span className="text-secondary font-bold" data-testid="text-spots-remaining">{remaining}</span> / {limit} spots left</>
            )}
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="font-display font-black text-4xl md:text-5xl neon-text tracking-tight" data-testid="text-page-title">
            Free JST Assessment
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto font-body">
            Discover your Jobs–Skills–Talent index and AI vulnerability in under 60 seconds. No account, no card. Pick how you want to start.
          </p>
        </div>

        {error && (
          <div className="mb-6 max-w-2xl mx-auto glass-card border border-destructive/50 rounded-lg p-4 text-destructive text-sm text-center" data-testid="text-error">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── CHOOSER ───────────────────────────────── */}
          {phase === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="grid md:grid-cols-3 gap-5"
            >
              <ChooserCard
                icon={ListChecks} title="Quick Questionnaire" desc="8 fast questions about how you work with AI." badge="~60 sec"
                testid="card-method-questionnaire" onClick={() => { setQIndex(0); setAnswers([]); setPhase("questionnaire"); }}
              />
              <ChooserCard
                icon={FileText} title="Upload Resume" desc="Drop a PDF or TXT — we parse it instantly." badge="Most accurate"
                testid="card-method-resume" onClick={() => fileInputRef.current?.click()}
              />
              <ChooserCard
                icon={Linkedin} title="Paste LinkedIn" desc="Copy your About / Experience sections." badge="No file needed"
                testid="card-method-linkedin" onClick={() => { setLinkedinText(""); setPhase("linkedin"); }}
              />
              <input
                ref={fileInputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden"
                data-testid="input-resume-file"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </motion.div>
          )}

          {/* ── QUESTIONNAIRE ─────────────────────────── */}
          {phase === "questionnaire" && (
            <motion.div
              key="questionnaire"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="max-w-2xl mx-auto glass-card rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => qIndex === 0 ? reset() : setQIndex(qIndex - 1)}
                  className="text-muted-foreground hover:text-primary flex items-center gap-1 text-sm"
                  data-testid="button-question-back"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <span className="font-mono text-xs text-primary tracking-widest" data-testid="text-question-progress">
                  {qIndex + 1} / {QUESTIONS.length}
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-6">
                <motion.div className="h-full bg-primary" animate={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }} />
              </div>
              <h2 className="font-display font-bold text-xl mb-6" data-testid="text-question">{QUESTIONS[qIndex].question}</h2>
              <div className="space-y-3">
                {QUESTIONS[qIndex].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => answerQuestion(opt.type)}
                    className="w-full text-left glass neon-border hover:bg-primary/10 transition-colors rounded-xl p-4 flex items-center justify-between group"
                    data-testid={`button-answer-${i}`}
                  >
                    <span className="font-body">{opt.text}</span>
                    <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── LINKEDIN ─────────────────────────────── */}
          {phase === "linkedin" && (
            <motion.div
              key="linkedin"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              className="max-w-2xl mx-auto glass-card rounded-2xl p-6 md:p-8"
            >
              <button onClick={reset} className="text-muted-foreground hover:text-primary flex items-center gap-1 text-sm mb-4" data-testid="button-linkedin-back">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="font-display font-bold text-xl mb-2 flex items-center gap-2"><Linkedin className="w-5 h-5 text-primary" /> Paste your LinkedIn profile</h2>
              <p className="text-sm text-muted-foreground mb-4">Copy your <strong>About</strong> and <strong>Experience</strong> text — the more detail, the sharper your score.</p>
              <textarea
                value={linkedinText}
                onChange={(e) => setLinkedinText(e.target.value)}
                rows={10}
                placeholder="e.g. Senior Product Manager with 8 years leading cross-functional teams across data platforms and AI tooling..."
                className="w-full glass rounded-xl p-4 font-body text-sm border border-border focus:border-primary focus:outline-none resize-y"
                data-testid="input-linkedin-text"
              />
              <Button className="w-full mt-4 neon-border" onClick={submitLinkedin} data-testid="button-submit-linkedin">
                Analyze My Profile <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* ── LOADING ──────────────────────────────── */}
          {phase === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-24" data-testid="status-loading">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-5" />
              <p className="font-display text-lg neon-text">Synthesizing your JST Index…</p>
              <p className="text-sm text-muted-foreground mt-2">Computing Jobs · Skills · Talent and AI vulnerability.</p>
            </motion.div>
          )}

          {/* ── RESULT ───────────────────────────────── */}
          {phase === "result" && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <ResultView result={result} />
              <SubscribePanel />
              <div className="text-center">
                <button onClick={reset} className="text-sm text-muted-foreground hover:text-primary" data-testid="button-retake">
                  ← Take it again with a different method
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ChooserCard({ icon: Icon, title, desc, badge, testid, onClick }: {
  icon: any; title: string; desc: string; badge: string; testid: string; onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="glass-card neon-border rounded-2xl p-6 text-left flex flex-col h-full hover:bg-primary/5 transition-colors"
      data-testid={testid}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="text-xs font-mono uppercase tracking-widest text-secondary mb-1">{badge}</div>
      <h3 className="font-display font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground flex-1">{desc}</p>
      <div className="mt-4 flex items-center gap-1 text-primary text-sm font-medium">
        Start <ArrowRight className="w-4 h-4" />
      </div>
    </motion.button>
  );
}

function ResultView({ result }: { result: FreeResult }) {
  const sub = [
    { label: "Jobs", value: result.jstJobs },
    { label: "Skills", value: result.jstSkills },
    { label: "Talent", value: result.jstTalent },
  ];
  const arche = [
    { label: "Architect", value: result.archetype.architect },
    { label: "Orchestrator", value: result.archetype.orchestrator },
    { label: "Conductor", value: result.archetype.conductor },
  ].sort((a, b) => b.value - a.value);
  const topPivots = (result.pivotOpportunities || []).slice(0, 3);

  return (
    <div className="glass-card rounded-2xl p-6 md:p-8" data-testid="result-view">
      <div className="text-center mb-8">
        <div className="text-xs font-mono uppercase tracking-widest text-primary mb-1">Your Result</div>
        <h2 className="font-display font-black text-2xl md:text-3xl">
          You are a <span className="neon-text" data-testid="text-readiness-profile">{result.readinessProfile}</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* JST card */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">JST Index</h3>
            <div className="font-display font-black text-3xl" data-testid="text-jst-total">{result.jstTotal}<span className="text-base text-muted-foreground font-normal"> / 300</span></div>
          </div>
          <div className="space-y-3">
            {sub.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-mono" data-testid={`text-jst-${s.label.toLowerCase()}`}>{s.value}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (s.value / 100) * 100)}%` }} transition={{ duration: 0.8 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vulnerability */}
        <VulnerabilityMeter level={result.vulnerabilityLevel} />
      </div>

      {/* Archetype split */}
      <div className="glass rounded-xl p-6 mt-6">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Archetype Mix</h3>
        <div className="space-y-3">
          {arche.map((a) => (
            <div key={a.label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{a.label}</span>
                <span className="font-mono" data-testid={`text-archetype-${a.label.toLowerCase()}`}>{a.value}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-secondary" initial={{ width: 0 }} animate={{ width: `${a.value}%` }} transition={{ duration: 0.8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pivot teaser */}
      {topPivots.length > 0 && (
        <div className="glass rounded-xl p-6 mt-6 relative overflow-hidden">
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Top Career Pivots</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            {topPivots.map((p, i) => (
              <div key={i} className="glass-card rounded-lg p-4" data-testid={`card-pivot-${i}`}>
                <div className="font-display font-bold text-sm mb-1">{p.role}</div>
                <div className="text-xs text-muted-foreground">Feasibility</div>
                <div className="font-mono text-primary text-lg">{p.feasibility}%</div>
                <div className="text-xs text-muted-foreground mt-1">{p.time} · {p.gapCost}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubscribePanel() {
  const pro = SUBSCRIPTION_PLANS.INDIVIDUAL_PRO;
  return (
    <div className="glass-card neon-border rounded-2xl p-6 md:p-8 text-center relative overflow-hidden" data-testid="panel-subscribe">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-secondary mb-3">
          <Lock className="w-4 h-4" /> Unlock the full picture
        </div>
        <h2 className="font-display font-black text-2xl md:text-3xl mb-2">
          This is just your <span className="neon-text">snapshot</span>
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
          Create a free account to save this result — or go Pro for the full JST dashboard, 12-vector career radar, upskilling roadmaps, FORGE cards and the executive report.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto text-left mb-7">
          {pro.features.slice(0, 6).map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-secondary shrink-0" /> {f}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link href="/login">
            <Button size="lg" className="neon-border w-full sm:w-auto" data-testid="button-create-account">
              <Zap className="w-4 h-4 mr-2" /> Create Free Account
            </Button>
          </Link>
          <Link href="/subscription">
            <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-view-plans">
              Go Pro — ${pro.price}/mo <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5" /> No credit card required to create an account.
        </div>
      </div>
    </div>
  );
}
