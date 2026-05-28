import { useEffect, useMemo, useState } from "react";
import { FEATURES } from "@shared/featureFlags";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Gamepad2,
  Sparkles,
  Trophy,
  Coins,
  Zap,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Loader2,
  Crown,
  Target,
  Wand2,
  Briefcase,
  X,
  Share2,
  Link as LinkIcon,
  Download,
  Check,
} from "lucide-react";
import { CCGE_INDUSTRY_PRESETS } from "@shared/schema";
import { CcgeCard } from "@/components/play/CcgeCard";
import { FlippableCard } from "@/components/ui/flippable-card";

// Short rationale per pillar shown on the back face of scenario cards so
// players know WHY the scenario targets them. Sourced from the same KCSE
// framing used by CcgeCard back faces.
const PILLAR_RATIONALE: Record<string, string> = {
  System: "Sets the AI's operating frame and guardrails.",
  Role: "Establishes persona, voice, and authority.",
  Instruction: "Spells out the task and required steps.",
  Example: "Anchors the model with a worked precedent.",
  Constraint: "Bounds the response (length, tone, policy).",
  Format: "Pins the output structure and schema.",
  Data: "Injects domain context and grounding.",
  SuperPrompt: "Composite play covering all four KCSE context types.",
};

const TIER_REWARD: Record<string, string> = {
  Bronze: "Foundation pass — earns Bronze certification at JCSE 30+.",
  Silver: "Solid prompt craft — Silver certification unlocks at JCSE 36+.",
  Gold: "Senior tier — Gold certification gates SPHINX publishing (JCSE 43+).",
  Platinum: "Apex tier — Platinum certification at JCSE 48+ marks top 1%.",
};

type Card = {
  id: string;
  name: string;
  pillar: string;
  type: string;
  baseKcse: number;
  tokenCost: number;
  emoji: string;
  description: string;
  body: string;
};

type Scenario = {
  id: string;
  tier: string;
  title: string;
  prompt: string;
  targetPillars: string[];
  tokenBudget: number;
  difficulty: number;
  creatorUserId?: string | null;
  industry?: string | null;
  isCustom?: boolean;
};

type Session = {
  id: string;
  userId: string;
  scenarioId: string;
  hand: string[];
  played: string[];
  status: string;
  kcseScore: number | null;
  certTierEarned: string | null;
  arkScoreDelta: number | null;
  certUpgradedFrom: string | null;
  certUpgradedTo: string | null;
};

type Breakdown = {
  knowledge: number;
  clarity: number;
  specificity: number;
  efficiency: number;
  pillarsCovered: string[];
  synergies: { name: string; multiplier: number }[];
  tokenUsed: number;
  tokenBudget: number;
  base: number;
  final: number;
};

type FinishResult = {
  session: Session;
  scenario: Scenario;
  breakdown: Breakdown;
  tier: string | null;
  flywheel: {
    arkScoreDelta: number;
    certUpgradedFrom: string | null;
    certUpgradedTo: string | null;
    newJstTotal: number | null;
    newJstSkills: number | null;
  };
};

const TIER_COLORS: Record<string, string> = {
  Bronze: "from-amber-700 to-orange-600",
  Silver: "from-slate-400 to-slate-300",
  Gold: "from-yellow-500 to-amber-400",
  Platinum: "from-cyan-300 to-fuchsia-400",
};

const TIER_BORDER: Record<string, string> = {
  Bronze: "border-amber-600/40",
  Silver: "border-slate-400/40",
  Gold: "border-yellow-500/50",
  Platinum: "border-fuchsia-400/60",
};

const PILLAR_COLORS: Record<string, string> = {
  System: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  Role: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
  Instruction: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Example: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  Constraint: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  Format: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  Data: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  SuperPrompt: "bg-gradient-to-br from-yellow-400/20 to-fuchsia-500/20 text-yellow-200 border-yellow-400/50",
};

const TYPE_BADGE: Record<string, string> = {
  Standard: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  Premium: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  Ultra: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
  SuperPrompt: "bg-yellow-400/20 text-yellow-200 border-yellow-400/50",
};

export default function PlayPage() {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [played, setPlayed] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("All");

  // Phase J.1 — Custom scenario builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderIndustry, setBuilderIndustry] = useState<string>(CCGE_INDUSTRY_PRESETS[0]);
  const [builderIndustryOther, setBuilderIndustryOther] = useState<string>("");
  const [builderRole, setBuilderRole] = useState<string>("");
  const [builderProblem, setBuilderProblem] = useState<string>("");
  const [builderTier, setBuilderTier] = useState<"Bronze" | "Silver" | "Gold" | "Platinum">("Silver");
  const [builderBusy, setBuilderBusy] = useState(false);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([api.getCcgeScenarios(), api.getCcgeCards()]);
      setScenarios(s);
      setCards(c);
      if (s.length === 0 || c.length === 0) {
        await api.seed();
        const [s2, c2] = await Promise.all([api.getCcgeScenarios(), api.getCcgeCards()]);
        setScenarios(s2);
        setCards(c2);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const startSession = async (scenarioId: string) => {
    if (!user?.id) {
      setError("Please log in to start a session.");
      return;
    }
    setError(null);
    try {
      const { session: s, scenario } = await api.startCcgeSession(user.id, scenarioId);
      setSession(s);
      setActiveScenario(scenario);
      setPlayed([]);
      setResult(null);
    } catch (err: any) {
      if (String(err.message).includes("not seeded")) {
        await api.seed();
        try {
          const { session: s, scenario } = await api.startCcgeSession(user.id, scenarioId);
          setSession(s);
          setActiveScenario(scenario);
          setPlayed([]);
          setResult(null);
        } catch (err2: any) {
          setError(err2.message);
        }
      } else {
        setError(err.message);
      }
    }
  };

  const playCard = (id: string) => {
    if (played.includes(id)) return;
    if (played.length >= 5) return;
    setPlayed([...played, id]);
  };

  const removePlayed = (id: string) => {
    setPlayed(played.filter((p) => p !== id));
  };

  const submitSession = async () => {
    if (!session || played.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.finishCcgeSession(session.id, played);
      setResult(r);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetToLobby = () => {
    setSession(null);
    setActiveScenario(null);
    setPlayed([]);
    setResult(null);
    setError(null);
  };

  const tokensUsed = played.reduce((sum, id) => sum + (cardMap.get(id)?.tokenCost ?? 0), 0);
  const filteredScenarios = tierFilter === "All" ? scenarios : scenarios.filter((s) => s.tier === tierFilter);

  const submitBuilder = async () => {
    setBuilderError(null);
    const industry = builderIndustry === "Other" ? builderIndustryOther.trim() : builderIndustry;
    if (!industry || industry.length < 2) {
      setBuilderError("Please choose or enter your industry.");
      return;
    }
    if (builderRole.trim().length < 2) {
      setBuilderError("Tell us your role (e.g. 'Compliance Analyst').");
      return;
    }
    if (builderProblem.trim().length < 10) {
      setBuilderError("Describe the problem in at least 10 characters.");
      return;
    }
    setBuilderBusy(true);
    try {
      const { scenario } = await api.createCustomCcgeScenario({
        industry,
        role: builderRole.trim(),
        problem: builderProblem.trim(),
        tier: builderTier,
      });
      // Prepend so the player sees their new scenario at the top
      setScenarios((prev) => [scenario, ...prev]);
      setShowBuilder(false);
      setBuilderRole("");
      setBuilderProblem("");
      setBuilderIndustryOther("");
      // Immediately start the session for a frictionless flow
      if (user?.id) {
        await startSession(scenario.id);
      }
    } catch (err: any) {
      setBuilderError(err.message || "Could not generate scenario.");
    } finally {
      setBuilderBusy(false);
    }
  };

  // ─── RESULT VIEW ─────────────────────────────────────
  if (result) {
    const { breakdown, tier, flywheel } = result;
    const tierClass = tier ? TIER_BORDER[tier] : "border-muted-foreground/30";
    const shareUrl = tier
      ? `${window.location.origin}/badge/${result.session.id}`
      : null;
    const badgePngUrl = tier
      ? `${window.location.origin}/badge/${result.session.id}.png`
      : null;
    return (
      <div className="max-w-5xl mx-auto space-y-6" data-testid="ccge-result-view">
        <div className={cn("glass-card border-2 p-8 rounded-xl", tierClass)}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Trophy className="h-12 w-12 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">JCSE Final Score</p>
                <h1 className="text-5xl font-display font-bold text-primary tabular-nums" data-testid="text-jcse-score">{breakdown.final}</h1>
                <p className="text-sm text-muted-foreground mt-1">out of 50.0</p>
              </div>
            </div>
            <div className="text-right">
              {tier ? (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Tier Earned</p>
                  <div className={cn("inline-block px-4 py-2 rounded-md font-display text-2xl font-bold bg-gradient-to-br", TIER_COLORS[tier], "text-background")} data-testid="text-tier-earned">
                    {tier}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground font-mono text-sm">
                  <AlertCircle className="inline h-4 w-4 mr-1" />
                  Below Bronze threshold — try again
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Flywheel impact */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-lg neon-border">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Zap className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-mono">ARK Score Boost</span>
            </div>
            <div className="text-3xl font-display font-bold text-cyan-300 tabular-nums" data-testid="text-ark-delta">
              +{flywheel.arkScoreDelta}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {flywheel.newJstTotal !== null
                ? `New JST Total: ${flywheel.newJstTotal}`
                : "Run a CV assessment first to see your ARK Score update."}
            </p>
          </div>

          <div className={cn("glass-card p-5 rounded-lg", flywheel.certUpgradedTo ? "border-2 border-fuchsia-500/50" : "")}>
            <div className="flex items-center gap-2 text-fuchsia-400 mb-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-mono">Cert Upgrade</span>
            </div>
            {flywheel.certUpgradedTo ? (
              <>
                <div className="text-xl font-display font-bold text-fuchsia-300" data-testid="text-cert-upgrade">
                  {flywheel.certUpgradedFrom} → {flywheel.certUpgradedTo}
                </div>
                <p className="text-xs text-fuchsia-400/70 mt-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> JST multiplier increased
                </p>
              </>
            ) : (
              <>
                <div className="text-base text-muted-foreground font-mono">No upgrade this round</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Need JCSE ≥ 30 (Bronze), 36 (Silver), 43 (Gold), 48 (Platinum)
                </p>
              </>
            )}
          </div>

          <div className="glass-card p-5 rounded-lg">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Coins className="h-4 w-4" />
              <span className="text-xs uppercase tracking-widest font-mono">Token Efficiency</span>
            </div>
            <div className="text-3xl font-display font-bold text-amber-300 tabular-nums">
              {breakdown.tokenUsed}<span className="text-base text-muted-foreground">/{breakdown.tokenBudget}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {breakdown.tokenUsed > breakdown.tokenBudget ? "Over budget — penalty applied" : "Within budget"}
            </p>
          </div>
        </div>

        {/* KCSE breakdown */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">KCSE Breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Knowledge", value: breakdown.knowledge, weight: "30%" },
              { label: "Clarity", value: breakdown.clarity, weight: "30%" },
              { label: "Specificity", value: breakdown.specificity, weight: "20%" },
              { label: "Efficiency", value: breakdown.efficiency, weight: "20%" },
            ].map((m) => (
              <div key={m.label} data-testid={`metric-${m.label.toLowerCase()}`}>
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>{m.label}</span>
                  <span>{m.weight}</span>
                </div>
                <div className="text-2xl font-display font-bold text-foreground tabular-nums mt-1">
                  {m.value}<span className="text-sm text-muted-foreground">/50</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${(m.value / 50) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Pillars Covered</p>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.pillarsCovered.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None</span>
                ) : (
                  breakdown.pillarsCovered.map((p) => (
                    <Badge key={p} variant="outline" className={cn("font-mono text-[10px]", PILLAR_COLORS[p])}>
                      {p}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Synergies Triggered</p>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.synergies.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None — try combining card types</span>
                ) : (
                  breakdown.synergies.map((s) => (
                    <Badge key={s.name} variant="outline" className="font-mono text-[10px] bg-secondary/10 text-secondary border-secondary/40">
                      {s.name} ×{s.multiplier}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {tier && shareUrl && badgePngUrl ? (
          <ShareWinCard shareUrl={shareUrl} pngUrl={badgePngUrl} tier={tier} />
        ) : null}

        <div className="flex gap-3">
          <Button onClick={resetToLobby} className="flex-1" data-testid="button-back-to-lobby">
            <ArrowRight className="h-4 w-4 mr-2" />
            Back to Arena
          </Button>
          <Button variant="outline" onClick={() => activeScenario && startSession(activeScenario.id)} className="flex-1" data-testid="button-replay-scenario">
            <RotateCcw className="h-4 w-4 mr-2" />
            Replay this scenario
          </Button>
        </div>
      </div>
    );
  }

  // ─── ACTIVE SESSION VIEW ─────────────────────────────
  if (session && activeScenario) {
    const handCards = session.hand
      .map((id) => cardMap.get(id))
      .filter((c): c is Card => !!c);
    const playedCards = played
      .map((id) => cardMap.get(id))
      .filter((c): c is Card => !!c);

    return (
      <div className="max-w-6xl mx-auto space-y-6" data-testid="ccge-session-view">
        {/* Scenario header */}
        <div className="glass-card p-6 rounded-xl">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("font-display", `bg-gradient-to-br ${TIER_COLORS[activeScenario.tier]} text-background`)}>
                  {activeScenario.tier}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">
                  Difficulty {activeScenario.difficulty}/5
                </span>
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-scenario-title">{activeScenario.title}</h1>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{activeScenario.prompt}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest mr-1">Target Pillars:</span>
                {activeScenario.targetPillars.map((p) => (
                  <Badge key={p} variant="outline" className={cn("font-mono text-[10px]", PILLAR_COLORS[p])}>
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Token Budget</div>
              <div className={cn("text-3xl font-display font-bold tabular-nums", tokensUsed > activeScenario.tokenBudget ? "text-destructive" : "text-amber-400")}>
                {tokensUsed}<span className="text-base text-muted-foreground">/{activeScenario.tokenBudget}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={resetToLobby} className="mt-2 text-xs" data-testid="button-abandon-session">
                Abandon
              </Button>
            </div>
          </div>
        </div>

        {/* Played slot */}
        <div className="glass-card p-6 rounded-xl border-2 border-dashed border-primary/30 min-h-[180px]">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Played Stack — {played.length}/5 cards
            </span>
          </div>
          {playedCards.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 italic">Click a card from your hand to play it into your prompt. Tap the eye icon to reveal the underlying prompt.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {playedCards.map((c, i) => (
                <CcgeCard
                  key={c.id}
                  card={c}
                  variant="played"
                  index={i + 1}
                  onRemove={() => removePlayed(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hand */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Your Hand</span>
            <Button
              onClick={submitSession}
              disabled={played.length === 0 || submitting}
              data-testid="button-submit-session"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Score My Prompt
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {handCards.map((c) => {
              const isPlayed = played.includes(c.id);
              const handFull = played.length >= 5;
              return (
                <CcgeCard
                  key={c.id}
                  card={c}
                  variant="hand"
                  disabled={isPlayed || handFull}
                  onPlay={() => playCard(c.id)}
                />
              );
            })}
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 rounded-lg border border-destructive/40 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
      </div>
    );
  }

  // ─── LOBBY VIEW ───────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="ccge-lobby-view">
      <div className="glass-card p-6 rounded-xl neon-border">
        <div className="flex items-center gap-3 mb-3">
          <Gamepad2 className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-wide text-primary">CCGE Arena</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The <span className="text-foreground font-semibold">Context Craft Game Engine</span> measures your AI engineering skill in real time.
          Pick a scenario, play prompt-engineering cards from your hand, score JCSE 30+ to earn certifications, and watch your ARK Score climb.
        </p>
        <div className="grid sm:grid-cols-4 gap-3 mt-5">
          <div className="text-center p-3 rounded-lg bg-amber-700/10 border border-amber-600/40">
            <Crown className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <div className="font-display text-amber-400 text-sm">Bronze</div>
            <div className="text-[10px] font-mono text-muted-foreground">JCSE 30–35</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-slate-400/10 border border-slate-400/40">
            <Crown className="h-5 w-5 mx-auto text-slate-300 mb-1" />
            <div className="font-display text-slate-300 text-sm">Silver</div>
            <div className="text-[10px] font-mono text-muted-foreground">JCSE 36–42</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/40">
            <Crown className="h-5 w-5 mx-auto text-yellow-400 mb-1" />
            <div className="font-display text-yellow-300 text-sm">Gold</div>
            <div className="text-[10px] font-mono text-muted-foreground">JCSE 43–47</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/40">
            <Crown className="h-5 w-5 mx-auto text-fuchsia-400 mb-1" />
            <div className="font-display text-fuchsia-300 text-sm">Platinum</div>
            <div className="text-[10px] font-mono text-muted-foreground">JCSE 48–50</div>
          </div>
        </div>
      </div>

      {/* Phase J.1 — Create Your Own Scenario (CLASS C, flag-gated) */}
      {FEATURES.customScenarios && (
      <div className="glass-card rounded-xl border-2 border-fuchsia-500/40 p-5" data-testid="custom-scenario-panel">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="h-5 w-5 text-fuchsia-400" />
              <h2 className="text-base font-display font-bold text-fuchsia-300 tracking-wide">Forge Your Own Scenario</h2>
              <Badge variant="outline" className="font-mono text-[10px] border-fuchsia-400/50 text-fuchsia-300 bg-fuchsia-500/10">NEW</Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Skip the canon — generate a scenario rooted in <span className="text-fuchsia-300">your industry</span>, <span className="text-fuchsia-300">your role</span>, and a real problem you face. Powered by Claude, scored by the same KCSE rubric.
            </p>
          </div>
          {!showBuilder && (
            <Button
              onClick={() => { setShowBuilder(true); setBuilderError(null); }}
              disabled={!user}
              className="bg-gradient-to-r from-fuchsia-600 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 text-white"
              data-testid="button-open-builder"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Create Custom Scenario
            </Button>
          )}
        </div>

        {showBuilder && (
          <div className="mt-5 space-y-4 border-t border-fuchsia-500/20 pt-5" data-testid="custom-scenario-builder">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  <Briefcase className="inline h-3 w-3 mr-1" /> Industry / Sector
                </label>
                <select
                  value={builderIndustry}
                  onChange={(e) => setBuilderIndustry(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm font-mono focus:border-fuchsia-500/60 focus:outline-none"
                  data-testid="select-builder-industry"
                >
                  {CCGE_INDUSTRY_PRESETS.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                {builderIndustry === "Other" && (
                  <input
                    type="text"
                    value={builderIndustryOther}
                    onChange={(e) => setBuilderIndustryOther(e.target.value)}
                    placeholder="Type your industry..."
                    maxLength={80}
                    className="w-full mt-2 px-3 py-2 rounded-md bg-background border border-border text-sm focus:border-fuchsia-500/60 focus:outline-none"
                    data-testid="input-builder-industry-other"
                  />
                )}
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                  Your Role
                </label>
                <input
                  type="text"
                  value={builderRole}
                  onChange={(e) => setBuilderRole(e.target.value)}
                  placeholder="e.g. Compliance Analyst, Cardiology Nurse, DevOps Lead"
                  maxLength={80}
                  className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:border-fuchsia-500/60 focus:outline-none"
                  data-testid="input-builder-role"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Problem to Solve with AI
              </label>
              <textarea
                value={builderProblem}
                onChange={(e) => setBuilderProblem(e.target.value)}
                placeholder="Describe a concrete task an AI should help with — e.g. 'Draft a SOC-2 audit response for a tenant requesting our data retention policy.'"
                rows={3}
                maxLength={600}
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm focus:border-fuchsia-500/60 focus:outline-none resize-none"
                data-testid="textarea-builder-problem"
              />
              <div className="text-right text-[10px] font-mono text-muted-foreground mt-1">
                {builderProblem.length}/600
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">
                Target Difficulty Tier
              </label>
              <div className="flex flex-wrap gap-2">
                {(["Bronze", "Silver", "Gold", "Platinum"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={builderTier === t ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBuilderTier(t)}
                    className={cn(
                      builderTier === t && `bg-gradient-to-br ${TIER_COLORS[t]} text-background`,
                    )}
                    data-testid={`button-builder-tier-${t.toLowerCase()}`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            {builderError && (
              <div className="text-sm text-destructive flex items-center gap-2" data-testid="text-builder-error">
                <AlertCircle className="h-4 w-4" /> {builderError}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={submitBuilder}
                disabled={builderBusy || !user}
                className="bg-gradient-to-r from-fuchsia-600 to-cyan-500 hover:from-fuchsia-500 hover:to-cyan-400 text-white flex-1 sm:flex-none"
                data-testid="button-submit-builder"
              >
                {builderBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Forging…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" /> Generate & Play
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => { setShowBuilder(false); setBuilderError(null); }}
                disabled={builderBusy}
                data-testid="button-cancel-builder"
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed pt-1 border-t border-fuchsia-500/10">
              Your custom scenarios are private to your account. Each generation calls Claude — budget-metered by your subscription plan.
            </p>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mr-2">Filter Tier:</span>
        {["All", "Bronze", "Silver", "Gold", "Platinum"].map((t) => (
          <Button
            key={t}
            variant={tierFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTierFilter(t)}
            data-testid={`button-filter-${t.toLowerCase()}`}
          >
            {t}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading scenarios...
        </div>
      ) : error ? (
        <div className="glass-card p-6 rounded-xl border border-destructive/40 text-destructive">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          {error}
        </div>
      ) : filteredScenarios.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center text-muted-foreground">
          No scenarios for this tier yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredScenarios.map((s) => (
            <FlippableCard
              key={s.id}
              testId={`scenario-${s.id}`}
              minHeight="280px"
              flipLabel={`Reveal scoring rules for ${s.title}`}
              unflipLabel={`Hide scoring rules for ${s.title}`}
              faceClassName={cn("glass-card rounded-xl border-2 hover:border-primary/40 transition-all", TIER_BORDER[s.tier])}
              backFaceClassName={cn("glass-card rounded-xl border-2", TIER_BORDER[s.tier])}
              front={
                <div className="p-5 h-full flex flex-col" data-testid={`scenario-card-${s.id}`}>
                  <div className="flex items-center justify-between mb-2 pr-9">
                    <div className="flex items-center gap-1.5">
                      <Badge className={cn("font-display", `bg-gradient-to-br ${TIER_COLORS[s.tier]} text-background`)}>
                        {s.tier}
                      </Badge>
                      {s.isCustom && (
                        <Badge variant="outline" className="font-mono text-[9px] border-fuchsia-400/50 text-fuchsia-300 bg-fuchsia-500/10" data-testid={`badge-custom-${s.id}`}>
                          <Wand2 className="h-2.5 w-2.5 mr-0.5" /> CUSTOM
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      Diff {s.difficulty}/5 · {s.tokenBudget}t budget
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-lg text-foreground" data-testid={`scenario-title-${s.id}`}>{s.title}</h3>
                  {s.industry && (
                    <div className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300/80 mt-0.5 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> {s.industry}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground my-3 flex-1 leading-relaxed">{s.prompt}</p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {s.targetPillars.map((p) => (
                      <Badge key={p} variant="outline" className={cn("font-mono text-[10px]", PILLAR_COLORS[p])}>
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <Button onClick={() => startSession(s.id)} disabled={!user} data-testid={`button-start-${s.id}`}>
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    Start Session
                  </Button>
                </div>
              }
              back={
                <div className="p-5 h-full flex flex-col gap-3 pr-9" data-testid={`scenario-card-${s.id}-back`}>
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-primary">
                      Scoring rules
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm text-foreground leading-tight">{s.title}</h3>
                  <div className="text-[11px] font-mono text-muted-foreground leading-relaxed">
                    {TIER_REWARD[s.tier] ?? "Earn certification by passing the KCSE threshold."}
                  </div>
                  <div className="space-y-1.5 flex-1 overflow-y-auto">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                      Target pillars
                    </div>
                    {s.targetPillars.map((p) => (
                      <div key={p} className="flex items-start gap-2 text-xs">
                        <Badge variant="outline" className={cn("font-mono text-[9px] flex-shrink-0", PILLAR_COLORS[p])}>
                          {p}
                        </Badge>
                        <span className="text-white/70 leading-snug">
                          {PILLAR_RATIONALE[p] ?? "Required pillar for this scenario."}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-white/10">
                    <span className="text-muted-foreground">
                      Difficulty {s.difficulty}/5 · {s.tokenBudget}t budget
                    </span>
                    <Button
                      size="sm"
                      onClick={() => startSession(s.id)}
                      disabled={!user}
                      data-testid={`button-start-back-${s.id}`}
                      className="h-7 text-[10px]"
                    >
                      Start
                    </Button>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      {!user && (
        <div className="glass-card p-4 rounded-lg border border-amber-500/40 text-sm text-amber-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Please log in to play. Demo: <code className="font-mono bg-amber-500/10 px-2 py-0.5 rounded">analyst@enterprise.com</code> / <code className="font-mono bg-amber-500/10 px-2 py-0.5 rounded">arkplatform</code>
        </div>
      )}
    </div>
  );
}

function ShareWinCard({ shareUrl, pngUrl, tier }: { shareUrl: string; pngUrl: string; tier: string }) {
  const [copied, setCopied] = useState(false);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — fall back to selecting the URL
      window.prompt("Copy your badge link:", shareUrl);
    }
  };

  const handleNativeShare = async () => {
    try {
      await (navigator as any).share({
        title: `I earned ${tier} on ARK CCGE`,
        text: `Just earned ${tier} tier on ARK Platform's Context Craft game.`,
        url: shareUrl,
      });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      className="glass-card border-2 border-primary/40 p-6 rounded-xl"
      data-testid="share-win-card"
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center shrink-0">
            <Share2 className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-display font-bold text-foreground">
              Share your {tier} win
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Anyone with the link sees a verified badge with Open Graph unfurl on socials.
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-open-badge"
          >
            <Button variant="outline" size="sm" className="font-mono text-xs">
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              Open page
            </Button>
          </a>
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs"
            onClick={handleCopy}
            data-testid="button-copy-share-link"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
                Copy link
              </>
            )}
          </Button>
          <a
            href={pngUrl}
            download={`ark-badge-${tier.toLowerCase()}.png`}
            data-testid="link-download-badge"
          >
            <Button variant="outline" size="sm" className="font-mono text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download PNG
            </Button>
          </a>
          {canNativeShare && (
            <Button
              size="sm"
              className="font-mono text-xs bg-gradient-to-br from-primary to-secondary text-background"
              onClick={handleNativeShare}
              data-testid="button-native-share"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Share
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 px-3 py-2 rounded-md bg-background/40 border border-border/50 font-mono text-xs text-muted-foreground truncate">
        {shareUrl}
      </div>
    </div>
  );
}
