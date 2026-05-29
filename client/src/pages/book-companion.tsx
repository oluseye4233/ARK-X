import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  BookOpen,
  Lock,
  CheckCircle2,
  ArrowUpRight,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import {
  JOURNEY_NODES,
  JOURNEY_STAGES,
  BOOK_TITLE,
  BOOK_TOTAL_NODES,
  type JourneyStageId,
} from "@shared/bookCompanion";

type JourneyNodeView = {
  id: string;
  order: number;
  stage: string;
  chapterLabel: string;
  title: string;
  pillar: string | null;
  badge: string;
  ccLevel: string | null;
  tierArt: string;
  slug: string;
  deepLink: string;
  quest: string[];
  earned: boolean;
  earnedAt: string | null;
  earnedVia: string | null;
};

type LedgerSnap = {
  jstIndex: number;
  ccmi: number;
  arkScore: number;
  badgesEarned: number;
  spcPublished: number;
} | null;

type LedgerView = {
  baseline: LedgerSnap;
  final: LedgerSnap;
  current: {
    jstIndex: number;
    ccmi: number;
    arkScore: number;
    badgesEarned: number;
    spcPublished: number;
  };
  delta: { jstIndex: number; ccmi: number; arkScore: number } | null;
};

const TIER_RING: Record<string, string> = {
  Bronze: "border-amber-600/60 shadow-[0_0_24px_rgba(201,123,58,0.35)]",
  Silver: "border-slate-300/50 shadow-[0_0_24px_rgba(184,198,214,0.3)]",
  Gold: "border-yellow-400/60 shadow-[0_0_28px_rgba(246,196,83,0.4)]",
  Platinum: "border-cyan-300/70 shadow-[0_0_32px_rgba(157,239,255,0.45)]",
};

// Static node list (used logged-out). Mirrors the canonical shared model so the
// page renders the full journey before any per-user status is fetched.
const STATIC_NODES: JourneyNodeView[] = JOURNEY_NODES.map((n) => ({
  id: n.id,
  order: n.order,
  stage: n.stage,
  chapterLabel: n.chapterLabel,
  title: n.title,
  pillar: n.pillar,
  badge: n.badge,
  ccLevel: n.ccLevel,
  tierArt: n.tierArt,
  slug: n.slug,
  deepLink: n.deepLink,
  quest: [...n.quest],
  earned: false,
  earnedAt: null,
  earnedVia: null,
}));

function DeltaPill({ value }: { value: number }) {
  const up = value > 0;
  const down = value < 0;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  const color = up ? "text-secondary" : down ? "text-destructive" : "text-muted-foreground";
  const sign = up ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-sm ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {sign}
      {value}
    </span>
  );
}

function ChapterCard({ node, highlight }: { node: JourneyNodeView; highlight: boolean }) {
  const badgeUrl = `/badge/book/${node.id}.png`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-xl border p-5 flex flex-col gap-4 ${
        node.earned ? TIER_RING[node.tierArt] ?? "border-primary/40" : "border-white/10"
      } ${highlight ? "ring-2 ring-primary/70" : ""}`}
      data-testid={`card-chapter-${node.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <img
            src={badgeUrl}
            alt={`${node.badge} badge`}
            loading="lazy"
            className={`w-20 h-20 rounded-lg object-cover border ${
              node.earned ? "border-white/20" : "border-white/10 grayscale opacity-40"
            }`}
            data-testid={`img-badge-${node.id}`}
          />
          <div className="absolute -bottom-2 -right-2">
            {node.earned ? (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-black">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            ) : (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/70 border border-white/20 text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              {node.chapterLabel}
            </span>
            {node.ccLevel && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
                {node.ccLevel.replace("_", "-")}
              </span>
            )}
            {node.pillar && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-secondary/80">
                {node.pillar}
              </span>
            )}
          </div>
          <h4 className="font-display font-bold text-white text-lg leading-tight mt-1" data-testid={`text-title-${node.id}`}>
            {node.title}
          </h4>
          <p className="text-primary font-mono text-xs mt-1">{node.badge}</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {node.quest.map((q, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-primary/60 font-mono">{i + 1}.</span>
            <span>{q}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {node.earned ? `Earned via ${node.earnedVia ?? "flywheel"}` : `Tier: ${node.tierArt}`}
        </span>
        <Link
          href={`${node.deepLink}${node.deepLink.includes("?") ? "&" : "?"}book=${node.id}`}
          className="inline-flex items-center gap-1.5 border border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-widest h-9 px-3 rounded-md"
          data-testid={`link-quest-${node.id}`}
        >
          {node.earned ? "Revisit" : "Start"} <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}

export default function BookCompanionPage() {
  const { user, isAuthenticated } = useAuth();
  const [nodes, setNodes] = useState<JourneyNodeView[]>(STATIC_NODES);
  const [earnedCount, setEarnedCount] = useState(0);
  const [ledger, setLedger] = useState<LedgerView | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const highlightId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("book");
  }, []);

  const loadJourney = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const [j, l] = await Promise.all([api.getBookJourney(), api.getBookLedger()]);
      setNodes(j.nodes);
      setEarnedCount(j.earnedCount);
      setLedger(l);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJourney();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const captureFinal = async () => {
    setCapturing(true);
    setError(null);
    try {
      const { ledger: l } = await api.captureBookSnapshot("final");
      setLedger(l);
      await loadJourney();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCapturing(false);
    }
  };

  const nodesByStage = useMemo(() => {
    const map = new Map<JourneyStageId, JourneyNodeView[]>();
    for (const s of JOURNEY_STAGES) map.set(s.id, []);
    for (const n of [...nodes].sort((a, b) => a.order - b.order)) {
      const arr = map.get(n.stage as JourneyStageId);
      if (arr) arr.push(n);
    }
    return map;
  }, [nodes]);

  const progressPct = Math.round((earnedCount / BOOK_TOTAL_NODES) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider">
              Book Companion
            </h2>
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {BOOK_TITLE} · {BOOK_TOTAL_NODES} chapters → real ARK surfaces
          </p>
        </div>
        {isAuthenticated && (
          <div className="text-right">
            <div className="font-display text-3xl font-black text-primary neon-text leading-none" data-testid="text-progress-count">
              {earnedCount}/{BOOK_TOTAL_NODES}
            </div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
              Badges Earned
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card border border-destructive/40 rounded-lg p-4 text-destructive font-mono text-sm" data-testid="text-book-error">
          {error}
        </div>
      )}

      {/* Logged-out banner */}
      {!isAuthenticated && (
        <div className="glass-card border border-primary/40 rounded-xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4" data-testid="banner-login">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="text-white font-display font-bold">Scan a chapter QR or log in to track your journey.</p>
              <p className="text-muted-foreground text-sm mt-1">
                Every chapter maps to a real challenge in the platform. Badges are earned by doing the work — never self-marked.
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center bg-primary text-black font-mono text-xs uppercase tracking-widest h-10 px-5 rounded-md"
            data-testid="link-login"
          >
            Log In
          </Link>
        </div>
      )}

      {/* Progress bar */}
      {isAuthenticated && (
        <div className="glass-card border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Journey Progress</span>
            <span className="font-mono text-sm text-primary">{progressPct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-secondary to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>
      )}

      {/* Digital Ledger */}
      {isAuthenticated && ledger && (
        <div className="glass-card border border-primary/40 rounded-xl p-6" data-testid="panel-ledger">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-primary" />
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest">Digital Ledger</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { key: "jstIndex", label: "JST Index" },
              { key: "ccmi", label: "CCMI" },
              { key: "arkScore", label: "ARK Score" },
            ] as const).map((row) => (
              <div key={row.key} className="border border-white/10 rounded-lg p-4" data-testid={`ledger-${row.key}`}>
                <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{row.label}</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-display text-2xl font-black text-primary">{ledger.current[row.key]}</span>
                  {ledger.delta && <DeltaPill value={ledger.delta[row.key]} />}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-2">
                  Baseline: {ledger.baseline ? ledger.baseline[row.key] : "—"} · Final: {ledger.final ? ledger.final[row.key] : "—"}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-5">
            <p className="text-sm text-muted-foreground">
              {ledger.baseline
                ? "Your baseline was captured at your first assessment. Close the loop by capturing your final snapshot."
                : "Run your résumé assessment first to capture an immutable baseline."}
            </p>
            <button
              onClick={captureFinal}
              disabled={capturing || !ledger.baseline}
              className="inline-flex items-center justify-center gap-2 border border-secondary/50 text-secondary hover:bg-secondary/10 disabled:opacity-40 disabled:cursor-not-allowed font-mono text-xs uppercase tracking-widest h-10 px-4 rounded-md"
              data-testid="button-capture-final"
            >
              {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Capture Final Snapshot
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground font-mono text-sm">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading your journey…
        </div>
      )}

      {/* Stages */}
      {JOURNEY_STAGES.map((stage) => {
        const stageNodes = nodesByStage.get(stage.id) ?? [];
        if (stageNodes.length === 0) return null;
        return (
          <section key={stage.id} className="space-y-4" data-testid={`stage-${stage.id}`}>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h3 className="font-display font-bold text-xl text-white uppercase tracking-widest">{stage.label}</h3>
              <p className="text-muted-foreground text-sm">{stage.blurb}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {stageNodes.map((n) => (
                <ChapterCard key={n.id} node={n} highlight={highlightId === n.id} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
