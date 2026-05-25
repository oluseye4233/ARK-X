import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useNotificationStream } from "@/lib/useArkStream";
import {
  ALL_CARD_PILLARS,
  CC_PILLARS,
  CONTEXT_CRAFT_LEVELS,
  CERT_LEVEL_RANK,
  CREDITS_TO_USD,
  SPC_MIN_CERT_TO_PUBLISH,
  SPC_PRICE_MIN,
  SPC_PRICE_MAX,
  SPC_CREATOR_SHARE_PCT,
  SPC_PLATFORM_SHARE_PCT,
  MARKETPLACE_CATEGORIES,
  GRADE_PRICING_MATRIX,
  formatPriceDual,
  formatPriceUsd,
  hiveToTierBadge,
  hiveToLetterGrade,
  pillarToCategory,
  suggestedPriceForHive,
  derivePerfBars,
  type ContextCraftLevel,
  type SpcListing,
  type SpcAiAnalysis,
  type UserCredits,
  type HivePrecheck,
} from "@shared/schema";
import {
  ShoppingBag,
  Coins,
  ArrowLeft,
  Plus,
  Lock,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  User,
  Search,
  Zap,
  Brain,
  Gauge,
  ShieldCheck,
  Crown,
  Star,
  Award,
  Tag,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SpcTaxonomyPanel } from "@/components/marketplace/SpcTaxonomyPanel";

const CATEGORY_FILTER = ["All", ...MARKETPLACE_CATEGORIES] as const;
// M3 — 6-dim taxonomy filters (matches `server/jnomicsSeed.ts`).
const DISC_FILTER    = ["All", "Discovery", "Build", "Optimize", "Scale", "Defend", "Govern"] as const;
const RARITY_FILTER  = ["All", "Common", "Uncommon", "Rare", "Epic", "Legendary"] as const;
const VERSION_FILTER = ["All", "v1", "v2", "v3"] as const;
const DETAIL_TABS = ["overview", "pillars", "tests", "pairs", "synthesis"] as const;
type DetailTab = typeof DETAIL_TABS[number];

const TIER_VISUALS = {
  ULTRA:    { label: "ULTRA",    color: "#AA44FF", icon: Crown,     bg: "bg-purple-500/10", border: "border-purple-400/40" },
  PREMIUM:  { label: "PREMIUM",  color: "#FFC857", icon: Star,      bg: "bg-amber-400/10",  border: "border-amber-400/40"  },
  STANDARD: { label: "STANDARD", color: "#9BB7C7", icon: Award,     bg: "bg-slate-300/10",  border: "border-slate-300/30"  },
} as const;

function TierBadge({ hive, size = "sm" }: { hive: number; size?: "sm" | "lg" }) {
  const tier = hiveToTierBadge(hive);
  if (!tier) return null;
  const v = TIER_VISUALS[tier];
  const Icon = v.icon;
  const pad = size === "lg" ? "px-3 py-1.5 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span
      data-testid={`badge-tier-${tier.toLowerCase()}`}
      className={`inline-flex items-center gap-1 rounded font-mono uppercase tracking-wider border ${v.bg} ${v.border} ${pad}`}
      style={{ color: v.color }}
    >
      <Icon className={size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3"} /> {v.label}
    </span>
  );
}

function GradeChip({ hive, size = "md" }: { hive: number; size?: "md" | "lg" }) {
  const { grade, color } = hiveToLetterGrade(hive);
  const dim = size === "lg" ? "h-14 w-14 text-3xl" : "h-10 w-10 text-xl";
  return (
    <div
      data-testid={`text-letter-grade-${grade.toLowerCase()}`}
      className={`flex items-center justify-center rounded-md font-display font-bold border ${dim}`}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}15` }}
    >
      {grade}
    </div>
  );
}

function CategoryChip({ pillar }: { pillar: string }) {
  const cat = pillarToCategory(pillar);
  if (!cat) return null;
  return (
    <span
      data-testid={`chip-category-${cat.toLowerCase()}`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-primary/5 text-primary/80 border border-primary/20"
    >
      <Tag className="h-2.5 w-2.5" /> {cat}
    </span>
  );
}

function PillarBadge({ pillar }: { pillar: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white/5 text-muted-foreground border border-white/10">
      {pillar}
    </span>
  );
}

function CreditsHeader({ user }: { user: { id: string; name: string } }) {
  const [credits, setCredits] = useState<UserCredits | null>(null);
  useEffect(() => {
    api.getCredits(user.id).then(setCredits).catch(() => null);
  }, [user.id]);
  return (
    <div className="glass-card p-3 rounded-xl flex items-center gap-3" data-testid="card-credits">
      <Coins className="h-5 w-5 text-amber-400" />
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">Credits</span>
        <span className="font-mono text-base font-bold text-amber-400" data-testid="text-credits-balance">
          {credits ? formatPriceDual(credits.balance) : "—"}
        </span>
      </div>
    </div>
  );
}

function MatrixListingCard({ listing }: { listing: SpcListing }) {
  const tier = hiveToTierBadge(listing.hiveScore);
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      data-testid={`card-listing-${listing.id}`}
      className={`group glass-card rounded-xl border transition-all hover:scale-[1.02] flex flex-col p-5 gap-3 ${
        tier === "ULTRA"
          ? "border-purple-400/30 hover:border-purple-400/60"
          : tier === "PREMIUM"
          ? "border-amber-400/30 hover:border-amber-400/60"
          : "border-white/10 hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <TierBadge hive={listing.hiveScore} />
          <CategoryChip pillar={listing.pillar} />
        </div>
        <GradeChip hive={listing.hiveScore} />
      </div>

      <h3
        className="font-display font-bold text-base text-white leading-tight line-clamp-2 group-hover:text-primary transition-colors"
        data-testid={`text-title-${listing.id}`}
      >
        {listing.title}
      </h3>
      <p
        className="text-sm text-muted-foreground line-clamp-2"
        data-testid={`text-desc-${listing.id}`}
      >
        {listing.description}
      </p>

      <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/5">
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <PillarBadge pillar={listing.pillar} />
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span data-testid={`text-sales-${listing.id}`}>{listing.salesCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-400/10 border border-amber-400/30">
          <Coins className="h-3.5 w-3.5 text-amber-400" />
          <span
            className="font-mono text-xs font-bold text-amber-400"
            data-testid={`text-price-${listing.id}`}
          >
            {formatPriceDual(listing.priceCredits)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function ListingsList() {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>("All");
  const [disc, setDisc] = useState<string>("All");
  const [rarity, setRarity] = useState<string>("All");
  const [version, setVersion] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listings, setListings] = useState<SpcListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounce free-text search so we don't hammer the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setListings(null);
    setError(null);
    api
      .getSpcListings({ category, search: debouncedSearch, disc, rarity, version })
      .then(setListings)
      .catch((e) => setError(e?.message || "Failed to load listings."));
  }, [category, debouncedSearch, disc, rarity, version]);

  const canPublish = useMemo(() => {
    const level = (user?.contextCraftCertLevel as ContextCraftLevel) || "NONE";
    return CERT_LEVEL_RANK[level] >= CERT_LEVEL_RANK[SPC_MIN_CERT_TO_PUBLISH];
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-marketplace-title">
              SPHINX Marketplace
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            SUPER PROMPT CARDS // CREATOR/PLATFORM SPLIT {SPC_CREATOR_SHARE_PCT}/{SPC_PLATFORM_SHARE_PCT}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user && <CreditsHeader user={{ id: user.id, name: user.name }} />}
          <Link href="/marketplace/publish">
            <button
              data-testid="button-publish-spc"
              className="flex items-center gap-2 px-4 py-3 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:scale-[1.02] bg-primary/10 text-primary border border-primary/30"
            >
              {canPublish ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Publish SPC
            </button>
          </Link>
        </div>
      </div>

      {/* Free-text search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          data-testid="input-search-listings"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or description…"
          className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-3 text-white font-mono text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Category chips (M19) */}
      <div className="flex flex-wrap gap-2" data-testid="filter-category-row">
        {CATEGORY_FILTER.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              data-testid={`filter-category-${c.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider transition-all border ${
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* M3 — 6-dim taxonomy filters (disc / rarity / version). Pillar + category live in their own rows above. */}
      <div className="space-y-2" data-testid="filter-six-dim-row">
        <FilterChipRow label="Discipline" testGroup="disc" options={DISC_FILTER as readonly string[]} value={disc} onChange={setDisc} />
        <FilterChipRow label="Rarity"     testGroup="rarity" options={RARITY_FILTER as readonly string[]} value={rarity} onChange={setRarity} />
        <FilterChipRow label="Version"    testGroup="version" options={VERSION_FILTER as readonly string[]} value={version} onChange={setVersion} />
      </div>

      {error && (
        <div className="glass-card p-4 rounded-xl border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive">
          {error}
        </div>
      )}

      {listings === null && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      )}

      {listings && listings.length === 0 && (
        <div className="glass-card p-8 rounded-xl text-center" data-testid="text-empty-listings">
          <p className="font-mono text-sm text-muted-foreground uppercase">No listings match this filter yet.</p>
        </div>
      )}

      {listings && listings.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          data-testid="grid-listings"
        >
          {listings.map((l) => (
            <MatrixListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detail-page sub-components ─────────────────────────────────────────

function PerfBar({
  label,
  value,
  icon: Icon,
  color,
  testId,
}: {
  label: string;
  value: number;
  icon: typeof Zap;
  color: string;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
          <Icon className="h-3 w-3" style={{ color }} /> {label}
        </span>
        <span className="font-mono text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function PerfBars({ listing }: { listing: SpcListing & { bodyLength?: number } }) {
  const bodyLength = listing.bodyLength ?? (listing as any).body?.length ?? 0;
  const bars = derivePerfBars({
    hiveScore: listing.hiveScore,
    kcseScore: listing.kcseScore,
    bodyLength,
  });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="grid-perf-bars">
      <PerfBar label="Speed" value={bars.speed} icon={Zap} color="#FFC857" testId="bar-perf-speed" />
      <PerfBar label="Efficiency" value={bars.efficiency} icon={Gauge} color="#44AAFF" testId="bar-perf-efficiency" />
      <PerfBar label="Innovation" value={bars.innovation} icon={Brain} color="#AA44FF" testId="bar-perf-innovation" />
      <PerfBar label="Reliability" value={bars.reliability} icon={ShieldCheck} color="#44AA77" testId="bar-perf-reliability" />
    </div>
  );
}

function AiAnalysisPanel({
  listing,
  isPro,
}: {
  listing: SpcListing;
  isPro: boolean;
}) {
  const [analysis, setAnalysis] = useState<SpcAiAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.runSpcAiAnalysis(listing.id);
      setAnalysis(result);
    } catch (e: any) {
      setError(e?.message || "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-primary/20 p-5 space-y-4" data-testid="panel-ai-analysis">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-base text-white tracking-wider uppercase flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Analysis
          </h3>
          <p className="font-mono text-[11px] text-muted-foreground mt-1">
            Claude-graded letter score + per-pillar improvements. Cached 24h per listing.
          </p>
        </div>
        {analysis && (
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${
              analysis.cached
                ? "bg-secondary/10 text-secondary border-secondary/30"
                : "bg-primary/10 text-primary border-primary/30"
            }`}
            data-testid="badge-analysis-source"
          >
            {analysis.cached ? "Cached" : "Fresh"}
          </span>
        )}
      </div>

      {!isPro && !analysis && (
        <div className="p-3 rounded-lg border border-amber-400/30 bg-amber-400/5 font-mono text-xs text-amber-400 flex items-start gap-2" data-testid="text-ai-pro-gate">
          <Lock className="h-4 w-4 mt-0.5" />
          <span>
            AI Analysis requires <span className="font-bold">Individual Pro</span>, School/Student,
            or Enterprise. <Link href="/subscription" data-testid="link-upgrade-from-ai-gate" className="underline hover:text-amber-300">View plans →</Link>
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 font-mono text-xs text-destructive flex items-center gap-2" data-testid="text-ai-error">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!analysis && (
        <button
          onClick={run}
          disabled={!isPro || busy}
          data-testid="button-run-ai-analysis"
          className="w-full px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? "Analyzing…" : "Run AI Analysis"}
        </button>
      )}

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <GradeChip hive={analysis.hiveScore} size="lg" />
            <div className="flex-1">
              <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Quality Grade</div>
              <div className="font-mono text-sm text-white">
                HIVE <span className="font-bold">{Math.round(analysis.hiveScore)}</span> · Letter
                {" "}<span style={{ color: analysis.letterGradeColor }} className="font-bold">{analysis.letterGrade}</span>
              </div>
            </div>
            <button
              onClick={run}
              disabled={busy}
              data-testid="button-rerun-ai-analysis"
              className="px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider bg-white/5 text-muted-foreground border border-white/10 hover:text-primary hover:border-primary/40 disabled:opacity-40 transition-all"
            >
              Re-run
            </button>
          </div>

          <div className="space-y-2" data-testid="list-pillar-suggestions">
            <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
              Per-Pillar Suggestions
            </div>
            {analysis.pillarSuggestions.map((s) => (
              <div
                key={s.pillar}
                className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-2"
                data-testid={`row-pillar-${s.pillar.toLowerCase()}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-white font-bold uppercase tracking-wider">{s.pillar}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.currentStrength}/100</span>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${s.currentStrength}%` }}
                  />
                </div>
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">{s.suggestion}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function TabStub({ id, label }: { id: string; label: string }) {
  return (
    <div className="glass-card p-10 rounded-xl border border-white/10 text-center" data-testid={`stub-${id}`}>
      <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
        {label} — Coming in next phase
      </p>
      <p className="font-mono text-[11px] text-muted-foreground/70 mt-2">
        This surface arrives with the synergy + synthesis rollout.
      </p>
    </div>
  );
}

function ListingDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [data, setData] = useState<{
    listing: SpcListing & { bodyLocked?: boolean; bodyLength?: number };
    creator: { id: string; name: string; contextCraftCertLevel: string } | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [outcome, setOutcome] = useState<any>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");

  // Hash-based deep links (e.g. /marketplace/abc#pillars).
  useEffect(() => {
    const sync = () => {
      const raw = window.location.hash.replace("#", "").toLowerCase();
      if (DETAIL_TABS.includes(raw as DetailTab)) setTab(raw as DetailTab);
      else setTab("overview");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [id]);

  const setTabAndHash = (next: string) => {
    const t = (DETAIL_TABS as readonly string[]).includes(next) ? (next as DetailTab) : "overview";
    setTab(t);
    if (t === "overview") {
      history.replaceState(null, "", window.location.pathname);
    } else {
      history.replaceState(null, "", `${window.location.pathname}#${t}`);
    }
  };

  useEffect(() => {
    api.getSpcListing(id, user?.id).then(setData).catch((e) => setError(e?.message || "Failed to load."));
    if (user) api.getCredits(user.id).then(setCredits).catch(() => null);
  }, [id, user]);

  const isOwnListing = user?.id === data?.listing.creatorId;
  const userPlan = (user as any)?.subscriptionPlan as string | undefined;
  const isPro = userPlan === "INDIVIDUAL_PRO" || userPlan === "SCHOOL_STUDENT" || userPlan === "ENTERPRISE";

  const handlePurchase = async () => {
    if (!user || !data) return;
    setPurchasing(true);
    setError(null);
    try {
      const result = await api.purchaseSpc(data.listing.id, user.id);
      setOutcome(result);
      setData((d) => (d ? { ...d, listing: result.listing } : d));
      const refreshed = await api.getCredits(user.id);
      setCredits(refreshed);
    } catch (e: any) {
      setError(e?.message || "Purchase failed.");
    } finally {
      setPurchasing(false);
    }
  };

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <Link href="/marketplace" className="font-mono text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>
        <div className="glass-card p-6 rounded-xl border border-destructive/30 mt-6 font-mono text-destructive">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  const { listing, creator } = data;
  const creatorCert = (creator?.contextCraftCertLevel as ContextCraftLevel) || "NONE";
  const certInfo = CONTEXT_CRAFT_LEVELS[creatorCert];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2" data-testid="link-back-marketplace">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      {/* Header card */}
      <div className="glass-card p-6 md:p-8 rounded-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge hive={listing.hiveScore} size="lg" />
              <CategoryChip pillar={listing.pillar} />
              <PillarBadge pillar={listing.pillar} />
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-white/5 text-muted-foreground border border-white/10">
                {listing.status}
              </span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white leading-tight" data-testid="text-listing-title">
              {listing.title}
            </h1>
            <p className="text-muted-foreground font-mono text-sm" data-testid="text-listing-description">
              {listing.description}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <GradeChip hive={listing.hiveScore} size="lg" />
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-400/10 border border-amber-400/30">
              <Coins className="h-5 w-5 text-amber-400" />
              <span className="font-mono text-lg font-bold text-amber-400" data-testid="text-listing-price">
                {formatPriceDual(listing.priceCredits)}
              </span>
            </div>
          </div>
        </div>

        {creator && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Creator</div>
              <div className="font-mono text-sm text-white" data-testid="text-creator-name">{creator.name}</div>
            </div>
            <span className="px-2 py-1 rounded text-[10px] font-mono uppercase" style={{ color: certInfo.color, backgroundColor: `${certInfo.color}15`, border: `1px solid ${certInfo.color}30` }}>
              {certInfo.label}
            </span>
          </div>
        )}
      </div>

      {/* 5-tab layout */}
      <Tabs value={tab} onValueChange={setTabAndHash} className="space-y-5">
        <TabsList
          className="w-full grid grid-cols-2 md:grid-cols-5 h-auto bg-black/40 border border-white/10 rounded-lg p-1 gap-1"
          data-testid="tabs-detail"
        >
          {DETAIL_TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              data-testid={`tab-${t}`}
              className="font-mono text-[11px] uppercase tracking-wider py-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4 rounded-lg border border-white/5">
              <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mb-1">HIVE Score</div>
              <div className="font-mono text-2xl font-bold text-blue-400" data-testid="text-hive-score">{Math.round(listing.hiveScore)}</div>
            </div>
            <div className="glass-card p-4 rounded-lg border border-white/5">
              <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mb-1">KCSE</div>
              <div className="font-mono text-2xl font-bold text-secondary" data-testid="text-kcse-score">{Math.round(listing.kcseScore * 10) / 10}</div>
            </div>
            <div className="glass-card p-4 rounded-lg border border-white/5">
              <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground mb-1">Sales</div>
              <div className="font-mono text-2xl font-bold text-white" data-testid="text-sales-count">{listing.salesCount}</div>
            </div>
          </div>

          {listing.bodyLocked !== false ? (
            <SpcTaxonomyPanel
              data={{
                pillar: listing.pillar,
                hiveScore: listing.hiveScore,
                kcseScore: listing.kcseScore,
                priceCredits: listing.priceCredits,
                salesCount: listing.salesCount,
                bodyLength: listing.bodyLength ?? 0,
                creatorCertLevel: creator?.contextCraftCertLevel,
              }}
              locked
            />
          ) : (
            <div>
              <h3 className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-3">
                Full Prompt — Unlocked
              </h3>
              <pre
                className="glass-card p-4 rounded-lg border border-secondary/30 text-xs text-white/90 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                data-testid="text-listing-body"
              >
                {listing.body}
              </pre>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive flex items-center gap-2" data-testid="text-purchase-error">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {outcome && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg border border-secondary/30 bg-secondary/5 space-y-2"
              data-testid="text-purchase-success"
            >
              <div className="flex items-center gap-2 text-secondary font-mono text-sm">
                <CheckCircle2 className="h-4 w-4" /> Purchase complete — full prompt unlocked.
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Balance: <span className="text-white">{formatPriceDual(outcome.buyerBalance)}</span> remaining.
                {outcome.isFirstSaleForCreator && (
                  <span className="text-secondary ml-2">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    First sale for {creator?.name} — JST Talent +{outcome.creatorTalentBoost}.
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {!user && (
            <div className="p-4 rounded-lg border border-white/10 bg-white/5 font-mono text-sm text-muted-foreground text-center">
              <Link href="/login" className="text-primary hover:underline">Log in</Link> to purchase this SPC.
            </div>
          )}

          {user && !isOwnListing && !outcome && (
            <button
              onClick={handlePurchase}
              disabled={purchasing || (credits ? credits.balance < listing.priceCredits : false)}
              data-testid="button-purchase-spc"
              className="w-full px-6 py-4 rounded-lg font-mono text-sm uppercase tracking-wider transition-all bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {purchasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              {purchasing
                ? "Processing…"
                : credits && credits.balance < listing.priceCredits
                ? `Need ${formatPriceDual(listing.priceCredits - credits.balance)} more`
                : `Purchase for ${formatPriceDual(listing.priceCredits)}`}
            </button>
          )}

          {user && isOwnListing && (
            <div className="p-4 rounded-lg border border-amber-400/20 bg-amber-400/5 font-mono text-xs text-amber-400 text-center" data-testid="text-own-listing">
              This is your listing — you can't buy it. Total earned: <span className="font-bold">{formatPriceDual(listing.totalEarned)}</span>.
            </div>
          )}
        </TabsContent>

        {/* Pillars */}
        <TabsContent value="pillars" className="space-y-5">
          <div className="glass-card rounded-xl border border-white/10 p-5 space-y-4" data-testid="panel-perf-bars">
            <div>
              <h3 className="font-display font-bold text-base text-white tracking-wider uppercase flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" /> Performance Metrics
              </h3>
              <p className="font-mono text-[11px] text-muted-foreground mt-1">
                Derived live from HIVE, KCSE, and prompt length. No data is stored.
              </p>
            </div>
            <PerfBars listing={listing} />
          </div>

          <div className="glass-card rounded-xl border border-white/10 p-5 space-y-3" data-testid="panel-pillar-focus">
            <h3 className="font-display font-bold text-base text-white tracking-wider uppercase flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Primary Pillar
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {CC_PILLARS.map((p) => (
                <span
                  key={p}
                  data-testid={`chip-pillar-${p.toLowerCase()}`}
                  className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider border ${
                    p === listing.pillar
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-white/5 text-muted-foreground border-white/10"
                  }`}
                >
                  {p}
                </span>
              ))}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              This card slots into the <span className="text-primary">{listing.pillar}</span> pillar of the
              Context-Craft framework. AI analysis below grades every pillar individually.
            </p>
          </div>

          <AiAnalysisPanel listing={listing} isPro={isPro} />
        </TabsContent>

        <TabsContent value="tests"><TabStub id="tests" label="Tests" /></TabsContent>
        <TabsContent value="pairs"><ComplementaryPairsTab listingId={listing.id} /></TabsContent>
        <TabsContent value="synthesis"><TabStub id="synthesis" label="Synthesis" /></TabsContent>
      </Tabs>
    </div>
  );
}

function PricingMatrixBanner() {
  return (
    <div className="glass-card rounded-xl border border-primary/20 p-5 space-y-3" data-testid="panel-pricing-matrix">
      <div>
        <h3 className="font-display font-bold text-sm text-primary tracking-wider uppercase flex items-center gap-2">
          <Coins className="h-4 w-4" /> Grade-Based Pricing Matrix
        </h3>
        <p className="font-mono text-[11px] text-muted-foreground mt-1">
          Suggested price bands by tier. Final price is up to you ({SPC_PRICE_MIN}–{SPC_PRICE_MAX} credits).
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {GRADE_PRICING_MATRIX.map((band) => (
          <div
            key={band.tier}
            className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-2"
            data-testid={`row-pricing-${band.tier.toLowerCase()}`}
          >
            <div className="flex items-center justify-between">
              <TierBadge hive={band.minHive} />
              <span className="font-mono text-[10px] text-muted-foreground">HIVE ≥ {band.minHive}</span>
            </div>
            <div className="font-mono text-sm text-white font-bold">
              {band.suggestedMin}–{band.suggestedMax} <span className="text-muted-foreground font-normal">cr</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {formatPriceUsd(band.suggestedMin)} – {formatPriceUsd(band.suggestedMax)}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground/80">{band.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublishPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    title: "",
    description: "",
    body: "",
    pillar: "System" as string,
    priceCredits: 25,
  });
  const [precheck, setPrecheck] = useState<HivePrecheck | null>(null);
  const [precheckBusy, setPrecheckBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const certLevel = (user?.contextCraftCertLevel as ContextCraftLevel) || "NONE";
  const allowed = CERT_LEVEL_RANK[certLevel] >= CERT_LEVEL_RANK[SPC_MIN_CERT_TO_PUBLISH];

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">Please log in to publish a Super Prompt Card.</p>
        <Link href="/login" className="text-primary hover:underline font-mono text-xs uppercase mt-4 inline-block">Go to login →</Link>
      </div>
    );
  }

  if (!allowed) {
    const required = CONTEXT_CRAFT_LEVELS[SPC_MIN_CERT_TO_PUBLISH];
    const current = CONTEXT_CRAFT_LEVELS[certLevel];
    return (
      <div className="max-w-2xl mx-auto py-16 space-y-6">
        <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </Link>
        <div className="glass-card p-8 rounded-xl border border-amber-400/30 bg-amber-400/5 text-center space-y-4" data-testid="text-cert-locked">
          <ShieldAlert className="h-12 w-12 text-amber-400 mx-auto" />
          <h2 className="text-2xl font-display font-bold text-amber-400 uppercase tracking-widest">Publishing Locked</h2>
          <p className="font-mono text-sm text-muted-foreground">
            SPHINX requires <span className="text-white">{required.label}</span> or higher to publish.
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Your current level: <span style={{ color: current.color }}>{current.label}</span>
          </p>
          <Link href="/play">
            <button data-testid="button-go-ccge" className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:bg-amber-400/15 transition-all">
              Win Gold in CCGE Arena →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const runPrecheck = async () => {
    setPrecheckBusy(true);
    setError(null);
    try {
      const result = await api.hivePrecheck({
        title: form.title,
        description: form.description,
        body: form.body,
        pillar: form.pillar,
      });
      setPrecheck(result);
    } catch (e: any) {
      setError(e?.message || "Pre-check failed.");
    } finally {
      setPrecheckBusy(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.publishSpcListing({
        title: form.title,
        description: form.description,
        body: form.body,
        pillar: form.pillar,
        priceCredits: form.priceCredits,
      });
      navigate(`/marketplace/${result.listing.id}`);
    } catch (e: any) {
      setError(e?.message || "Publish failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const suggestion = precheck ? suggestedPriceForHive(precheck.hiveScore) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2" data-testid="link-back-from-publish">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-publish-title">
          Publish Super Prompt Card
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          HIVE PRE-CHECK MUST PASS BEFORE LISTING GOES LIVE
        </p>
      </div>

      <PricingMatrixBanner />

      <div className="glass-card p-6 rounded-xl space-y-5">
        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Title</label>
          <input
            data-testid="input-spc-title"
            value={form.title}
            onChange={(e) => { setForm({ ...form, title: e.target.value }); setPrecheck(null); }}
            placeholder="e.g. Tier-1 Support Triage Architect"
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Description</label>
          <input
            data-testid="input-spc-description"
            value={form.description}
            onChange={(e) => { setForm({ ...form, description: e.target.value }); setPrecheck(null); }}
            placeholder="Short summary buyers will see in the listings grid."
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Pillar</label>
            <select
              data-testid="select-spc-pillar"
              value={form.pillar}
              onChange={(e) => { setForm({ ...form, pillar: e.target.value }); setPrecheck(null); }}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
            >
              {ALL_CARD_PILLARS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">
              Price (credits, {SPC_PRICE_MIN}–{SPC_PRICE_MAX})
            </label>
            <input
              data-testid="input-spc-price"
              type="number"
              min={SPC_PRICE_MIN}
              max={SPC_PRICE_MAX}
              value={form.priceCredits}
              onChange={(e) => setForm({ ...form, priceCredits: Math.max(SPC_PRICE_MIN, Math.min(SPC_PRICE_MAX, parseInt(e.target.value) || SPC_PRICE_MIN)) })}
              className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
            />
            <p className="text-[10px] font-mono text-muted-foreground mt-1" data-testid="text-publish-price-usd">
              {formatPriceDual(form.priceCredits)}
            </p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest">Prompt Body</label>
            <label
              data-testid="button-import-spc-file"
              className="text-[10px] uppercase font-mono tracking-widest text-primary/80 hover:text-primary cursor-pointer border border-primary/30 hover:border-primary/60 rounded px-2 py-1 transition-colors"
            >
              Import .md / .txt
              <input
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 200_000) {
                    setError(`File too large (${Math.round(file.size / 1024)}KB). Max 200KB.`);
                    e.target.value = "";
                    return;
                  }
                  try {
                    const text = await file.text();
                    setForm((f) => ({ ...f, body: text.slice(0, 50000) }));
                    setPrecheck(null);
                    setError(null);
                  } catch (err: any) {
                    setError(err?.message || "Failed to read file.");
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
          <textarea
            data-testid="input-spc-body"
            value={form.body}
            onChange={(e) => { setForm({ ...form, body: e.target.value }); setPrecheck(null); }}
            placeholder="Full prompt — role, instructions, examples, constraints, format spec… or import a .md/.txt file above."
            rows={12}
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary/50 leading-relaxed"
          />
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            {form.body.length.toLocaleString()} chars • min 80 / max 50,000
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={runPrecheck}
            disabled={precheckBusy || !form.title || !form.body}
            data-testid="button-run-precheck"
            className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/15 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {precheckBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Run HIVE Pre-Check
          </button>
          <button
            onClick={submit}
            disabled={submitting || !precheck?.passes}
            data-testid="button-publish-confirm"
            className="px-5 py-3 rounded-lg font-mono text-xs uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Publish Listing
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {precheck && (
          <div className={`p-4 rounded-lg border space-y-3 ${precheck.passes ? "border-secondary/30 bg-secondary/5" : "border-amber-400/30 bg-amber-400/5"}`} data-testid="text-precheck-result">
            <div className="flex items-center gap-3">
              {precheck.passes
                ? <CheckCircle2 className="h-5 w-5 text-secondary" />
                : <AlertTriangle className="h-5 w-5 text-amber-400" />}
              <div className="flex-1">
                <div className="font-mono text-sm text-white flex flex-wrap items-center gap-3">
                  HIVE: <span className="font-bold" data-testid="text-precheck-hive">{precheck.hiveScore}</span> / 100
                  <span className="text-muted-foreground">KCSE: <span className="text-white" data-testid="text-precheck-kcse">{precheck.kcseScore}</span></span>
                  <TierBadge hive={precheck.hiveScore} />
                  <GradeChip hive={precheck.hiveScore} />
                </div>
                <div className={`text-xs font-mono mt-1 ${precheck.passes ? "text-secondary" : "text-amber-400"}`}>
                  {precheck.passes ? "Pre-check passed — ready to publish." : "Pre-check failed — improve and re-run."}
                </div>
                {suggestion && (
                  <div className="text-[11px] font-mono text-muted-foreground mt-1" data-testid="text-pricing-suggestion">
                    Suggested price band:
                    {" "}<span className="text-white font-bold">{suggestion.suggestedMin}–{suggestion.suggestedMax} cr</span>
                    {" "}<span className="text-muted-foreground/80">— {suggestion.label}</span>
                  </div>
                )}
              </div>
            </div>
            <ul className="text-xs font-mono text-muted-foreground space-y-1">
              {precheck.reasons.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground/50">•</span> {r}
                </li>
              ))}
              {precheck.warnings.map((w, i) => (
                <li key={`w-${i}`} className="flex gap-2 text-amber-400/80">
                  <span>⚠</span> {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-[10px] font-mono text-muted-foreground border-t border-white/5 pt-3">
          Revenue split: {SPC_CREATOR_SHARE_PCT}% creator / {SPC_PLATFORM_SHARE_PCT}% platform. First sale grants +3 JST Talent.
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [matchDetail, paramsDetail] = useRoute<{ id: string }>("/marketplace/:id");
  const [matchPublish]    = useRoute("/marketplace/publish");
  const [matchSynergy]    = useRoute("/marketplace/synergy");
  const [matchRoundtable] = useRoute("/marketplace/roundtable");

  if (matchPublish)    return <PublishPage />;
  if (matchSynergy)    return <SynergyLabPage />;
  if (matchRoundtable) return <RoundtablePage />;
  if (matchDetail && paramsDetail) {
    // Defensive guard for static slugs still hitting the :id route.
    if (paramsDetail.id === "publish")    return <PublishPage />;
    if (paramsDetail.id === "synergy")    return <SynergyLabPage />;
    if (paramsDetail.id === "roundtable") return <RoundtablePage />;
    return <ListingDetail id={paramsDetail.id} />;
  }
  return <ListingsList />;
}

// ── M3 — Filter chip row (used by 6-dim filter UI) ────────────────────
function FilterChipRow({
  label, testGroup, options, value, onChange,
}: {
  label: string;
  testGroup: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center flex-wrap gap-2" data-testid={`filter-row-${testGroup}`}>
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 w-20">{label}</span>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            data-testid={`filter-${testGroup}-${opt.toLowerCase()}`}
            className={`px-2.5 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-all border ${
              active
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── M3 — Complementary Pairs tab content ──────────────────────────────
type ComplementaryRow = {
  rank: number;
  score: number;
  partner: SpcListing & { bodyLocked?: boolean; bodyLength?: number };
};
function ComplementaryPairsTab({ listingId }: { listingId: string }) {
  const [rows, setRows] = useState<ComplementaryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRows(null); setError(null);
    api.getComplementaryFor(listingId)
      .then((r: ComplementaryRow[]) => setRows(r || []))
      .catch((e) => setError(e?.message || "Failed to load complementary pairs."));
  }, [listingId]);
  if (error) {
    return (
      <div className="glass-card p-4 rounded-xl border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive" data-testid="text-pairs-error">
        {error}
      </div>
    );
  }
  if (rows === null) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 text-primary animate-spin" /></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl text-center" data-testid="text-empty-pairs">
        <p className="font-mono text-sm text-muted-foreground uppercase">No complementary partners yet — check back after the marketplace grows.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="list-complementary-pairs">
      <p className="font-mono text-[11px] text-muted-foreground">
        Top-{rows.length} partner cards by cross-tag synergy (0-100). Buy both to unlock multiplicative effects.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((p) => (
          <Link
            key={p.partner.id}
            href={`/marketplace/${p.partner.id}`}
            data-testid={`row-pair-${p.partner.id}`}
            className="block p-3 rounded-lg border border-white/10 bg-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                #{p.rank} • {p.partner.pillar}
              </span>
              <span className="font-mono text-xs font-bold text-primary" data-testid={`text-pair-score-${p.partner.id}`}>
                {p.score}% synergy
              </span>
            </div>
            <p className="font-mono text-sm text-white font-bold truncate">{p.partner.title}</p>
            <div className="flex items-center justify-between mt-2">
              <TierBadge hive={p.partner.hiveScore} />
              <span className="flex items-center gap-1 text-amber-400 font-mono text-xs font-bold">
                <Coins className="h-3 w-3" /> {formatPriceDual(p.partner.priceCredits)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── M3 — Synergy Lab (2-5 card combiner) ──────────────────────────────
type JngCardLite = { id: string; name: string; emoji?: string | null; disc?: string | null; rarity?: string | null; version?: string | null; category?: string | null };
type SynergyResult = {
  synergyScore: number;
  pairCount: number;
  breakdown: { a: string; b: string; score: number; rationale: string; source: "table" | "computed" }[];
};
function SynergyLabPage() {
  const [cards, setCards] = useState<JngCardLite[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<SynergyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.getJnomicsCards()
      .then((r: JngCardLite[]) => setCards(r || []))
      .catch((e) => setError(e?.message || "Failed to load cards."));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setResult(null);
  };

  const calculate = async () => {
    if (selected.length < 2) return;
    setBusy(true); setError(null);
    try {
      const r = await api.calculateSynergy(selected);
      setResult(r);
    } catch (e: any) {
      setError(e?.message || "Synergy calculation failed.");
    } finally {
      setBusy(false);
    }
  };

  const filteredCards = useMemo(() => {
    if (!cards) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      c.name.toLowerCase().includes(q)
      || (c.disc ?? "").toLowerCase().includes(q)
      || (c.rarity ?? "").toLowerCase().includes(q)
      || (c.category ?? "").toLowerCase().includes(q));
  }, [cards, filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-synergy-lab-title">
            Synergy Lab
          </h1>
          <p className="text-muted-foreground font-mono text-xs">
            Pick 2-5 Junglenomics cards to preview the composite synergy score. Informational only — no ARK impact.
          </p>
        </div>
      </div>

      <div className="glass-card p-4 rounded-xl border border-primary/20 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Selected ({selected.length}/5)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setSelected([]); setResult(null); }}
              disabled={selected.length === 0}
              data-testid="button-clear-selection"
              className="px-3 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider bg-white/5 text-muted-foreground border border-white/10 hover:text-foreground disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={calculate}
              disabled={selected.length < 2 || busy}
              data-testid="button-calculate-synergy"
              className="px-4 py-1.5 rounded font-mono text-[10px] uppercase tracking-wider bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 disabled:opacity-40 flex items-center gap-2"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Calculate
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 min-h-[36px]">
          {selected.map((id) => {
            const c = cards?.find((x) => x.id === id);
            if (!c) return null;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                data-testid={`chip-selected-${id}`}
                className="px-2.5 py-1 rounded bg-primary/15 text-primary border border-primary/40 font-mono text-[11px] flex items-center gap-1.5"
              >
                <span>{c.emoji ?? "•"}</span>{c.name}
                <span className="opacity-60">×</span>
              </button>
            );
          })}
          {selected.length === 0 && (
            <span className="font-mono text-[11px] text-muted-foreground/60 italic">Select cards from the list below.</span>
          )}
        </div>
      </div>

      {error && (
        <div className="glass-card p-3 rounded-lg border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="glass-card p-5 rounded-xl border border-primary/30 space-y-3" data-testid="panel-synergy-result">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Composite Synergy</div>
              <div className="font-display text-4xl font-bold text-primary" data-testid="text-synergy-score">
                {result.synergyScore}<span className="text-lg text-muted-foreground">/100</span>
              </div>
            </div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{result.pairCount} pair{result.pairCount === 1 ? "" : "s"} analyzed</span>
          </div>
          <ul className="space-y-1.5">
            {result.breakdown.map((b, i) => {
              const ca = cards?.find((c) => c.id === b.a);
              const cb = cards?.find((c) => c.id === b.b);
              return (
                <li key={i} className="flex items-center gap-2 text-[11px] font-mono" data-testid={`row-pair-${b.a}-${b.b}`}>
                  <span className="text-white">{ca?.name ?? b.a}</span>
                  <span className="text-muted-foreground">×</span>
                  <span className="text-white">{cb?.name ?? b.b}</span>
                  <span className="ml-auto text-primary font-bold">{b.score}</span>
                  <span className="text-muted-foreground/60 text-[10px] italic">{b.rationale}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          data-testid="input-synergy-card-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, discipline, rarity, category…"
          className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
        />
      </div>

      {cards === null ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5" data-testid="grid-synergy-cards">
          {filteredCards.map((c) => {
            const active = selected.includes(c.id);
            const disabled = !active && selected.length >= 5;
            return (
              <button
                key={c.id}
                onClick={() => !disabled && toggle(c.id)}
                disabled={disabled}
                data-testid={`card-pick-${c.id}`}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  active
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : disabled
                      ? "bg-white/5 border-white/5 text-muted-foreground/40 cursor-not-allowed"
                      : "bg-white/5 border-white/10 text-foreground hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <div className="text-lg mb-1">{c.emoji ?? "•"}</div>
                <div className="font-mono text-[11px] font-bold truncate">{c.name}</div>
                <div className="font-mono text-[9px] uppercase text-muted-foreground/70 mt-0.5 truncate">
                  {[c.disc, c.rarity, c.version].filter(Boolean).join(" · ")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── M3 — ARK Roundtable Top-12 leaderboard ─────────────────────────────
type RoundtableSeat = {
  seatNumber: number;
  score: number;
  hiveScore: number;
  salesCount: number;
  snapshotAt: string;
  rankDelta: number;
  seatSinceAt: string;
  timeHeldMs: number;
  listing: { id: string; title: string; pillar: string; priceCredits: number; hiveScore: number } | null;
  creator: { id: string; name: string } | null;
};

function formatHeldDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function RoundtablePage() {
  const [seats, setSeats] = useState<RoundtableSeat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.getRoundtable()
      .then((r: RoundtableSeat[]) => setSeats(r || []))
      .catch((e) => setError(e?.message || "Failed to load roundtable."));
  }, []);

  // Live rotation refresh — when any seat changes hands, re-fetch via the
  // shared SSE hub. The hook multiplexes the same EventSource the bell uses.
  useNotificationStream(true, undefined, () => {
    api.getRoundtable().then((r: RoundtableSeat[]) => setSeats(r)).catch(() => null);
  });

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="glass-card p-4 rounded-xl border border-destructive/30 bg-destructive/5 font-mono text-sm text-destructive">{error}</div>
      </div>
    );
  }
  if (seats === null) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 text-primary animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-7 w-7 text-amber-400" />
        <div>
          <h1 className="text-2xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-roundtable-title">
            ARK Roundtable — Top 12
          </h1>
          <p className="text-muted-foreground font-mono text-xs">
            Ranked by 60% HIVE score + 40% normalized sales. Live updates on every publish/purchase.
          </p>
        </div>
      </div>

      {seats.length === 0 ? (
        <div className="glass-card p-8 rounded-xl text-center" data-testid="text-empty-roundtable">
          <p className="font-mono text-sm text-muted-foreground uppercase">No active SPCs yet — be the first to claim a seat.</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="list-roundtable-seats">
          {seats.map((s) => (
            <Link
              key={s.seatNumber}
              href={s.listing ? `/marketplace/${s.listing.id}` : "/marketplace"}
              data-testid={`row-seat-${s.seatNumber}`}
              className="block p-3 rounded-lg border border-white/10 bg-white/5 hover:border-amber-400/40 hover:bg-amber-400/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-display font-bold text-lg border ${
                  s.seatNumber <= 3
                    ? "bg-amber-400/15 text-amber-400 border-amber-400/40"
                    : s.seatNumber <= 6
                      ? "bg-slate-300/10 text-slate-300 border-slate-300/30"
                      : "bg-white/5 text-muted-foreground border-white/10"
                }`}>
                  {s.seatNumber}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-white font-bold truncate" data-testid={`text-seat-title-${s.seatNumber}`}>
                    {s.listing?.title ?? "(deleted)"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">
                    by {s.creator?.name ?? "—"} • {s.listing?.pillar ?? ""}
                  </p>
                </div>
                <div className="hidden md:flex flex-col items-end gap-0.5 mr-3">
                  <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">Held</span>
                  <span className="font-mono text-sm text-white font-bold" data-testid={`text-seat-held-${s.seatNumber}`}>{formatHeldDuration(s.timeHeldMs)}</span>
                </div>
                <div className="hidden md:flex flex-col items-end gap-0.5 mr-3">
                  <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">Δ Rank</span>
                  <span
                    data-testid={`text-seat-rankdelta-${s.seatNumber}`}
                    className={`font-mono text-sm font-bold ${
                      s.rankDelta > 0 ? "text-emerald-400" : s.rankDelta < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {s.rankDelta > 0 ? `▲${s.rankDelta}` : s.rankDelta < 0 ? `▼${Math.abs(s.rankDelta)}` : "—"}
                  </span>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 mr-3">
                  <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">HIVE</span>
                  <span className="font-mono text-sm text-white font-bold">{s.hiveScore}</span>
                </div>
                <div className="hidden sm:flex flex-col items-end gap-0.5 mr-3">
                  <span className="font-mono text-[9px] uppercase text-muted-foreground tracking-widest">Sales</span>
                  <span className="font-mono text-sm text-white font-bold">{s.salesCount}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[9px] uppercase text-amber-400 tracking-widest">Score</span>
                  <span className="font-mono text-base text-amber-400 font-bold" data-testid={`text-seat-score-${s.seatNumber}`}>{s.score}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
