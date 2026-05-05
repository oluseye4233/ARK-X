import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import {
  ALL_CARD_PILLARS,
  CONTEXT_CRAFT_LEVELS,
  CERT_LEVEL_RANK,
  SPC_MIN_CERT_TO_PUBLISH,
  SPC_PRICE_MIN,
  SPC_PRICE_MAX,
  SPC_CREATOR_SHARE_PCT,
  SPC_PLATFORM_SHARE_PCT,
  type ContextCraftLevel,
  type SpcListing,
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
} from "lucide-react";
import { FlippableCard } from "@/components/ui/flippable-card";
import { SpcTaxonomyPanel } from "@/components/marketplace/SpcTaxonomyPanel";

const PILLARS_FILTER = ["All", ...ALL_CARD_PILLARS] as const;

function PillarBadge({ pillar }: { pillar: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-primary/10 text-primary border border-primary/30">
      {pillar}
    </span>
  );
}

function ScoreBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono">{label}</span>
      <span className="font-mono text-sm font-bold" style={{ color }}>
        {value}
      </span>
    </div>
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
        <span className="font-mono text-lg font-bold text-amber-400" data-testid="text-credits-balance">
          {credits ? credits.balance : "—"}
        </span>
      </div>
    </div>
  );
}

function ListingsList() {
  const { user } = useAuth();
  const [pillar, setPillar] = useState<string>("All");
  const [listings, setListings] = useState<SpcListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setListings(null);
    setError(null);
    api
      .getSpcListings({ pillar })
      .then(setListings)
      .catch((e) => setError(e?.message || "Failed to load listings."));
  }, [pillar]);

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
            SMART PROMPT CARDS // CREATOR/PLATFORM SPLIT {SPC_CREATOR_SHARE_PCT}/{SPC_PLATFORM_SHARE_PCT}
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

      <div className="flex flex-wrap gap-2" data-testid="filter-pillar-row">
        {PILLARS_FILTER.map((p) => {
          const active = pillar === p;
          return (
            <button
              key={p}
              onClick={() => setPillar(p)}
              data-testid={`filter-pillar-${p.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-md font-mono text-xs uppercase tracking-wider transition-all border ${
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-white/5 text-muted-foreground border-white/10 hover:text-foreground"
              }`}
            >
              {p}
            </button>
          );
        })}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((l) => (
            <FlippableCard
              key={l.id}
              testId={`listing-${l.id}`}
              minHeight="240px"
              flipLabel={`Reveal scoring for ${l.title}`}
              unflipLabel={`Hide scoring for ${l.title}`}
              faceClassName="glass-card rounded-xl border border-transparent"
              backFaceClassName="glass-card rounded-xl border border-primary/30"
              drm={{ contentId: l.id, contentType: "spc-listing" }}
              front={
                <Link
                  href={`/marketplace/${l.id}`}
                  data-testid={`card-listing-${l.id}`}
                  className="flex flex-col gap-3 p-5 h-full hover:border-primary/30 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 pr-9">
                    <PillarBadge pillar={l.pillar} />
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30">
                      <Coins className="h-3.5 w-3.5 text-amber-400" />
                      <span className="font-mono text-sm font-bold text-amber-400" data-testid={`text-price-${l.id}`}>
                        {l.priceCredits}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-display font-bold text-base text-white leading-tight" data-testid={`text-title-${l.id}`}>
                    {l.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-desc-${l.id}`}>
                    {l.description}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-auto">
                    <div className="flex gap-3">
                      <ScoreBadge label="HIVE" value={Math.round(l.hiveScore)} color="#4488FF" />
                      <ScoreBadge label="KCSE" value={Math.round(l.kcseScore * 10) / 10} color="#44AA44" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span data-testid={`text-sales-${l.id}`}>{l.salesCount}</span>
                    </div>
                  </div>
                </Link>
              }
              back={
                <div
                  className="flex flex-col gap-3 p-5 h-full pr-9 overflow-y-auto"
                  data-testid={`card-listing-${l.id}-back`}
                >
                  <SpcTaxonomyPanel
                    data={{
                      pillar: l.pillar,
                      hiveScore: l.hiveScore,
                      kcseScore: l.kcseScore,
                      priceCredits: l.priceCredits,
                      salesCount: l.salesCount,
                      bodyLength: l.bodyLength,
                    }}
                    locked
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-white/10 mt-auto">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Coins className="h-3 w-3" /> {l.priceCredits} credits
                    </span>
                    <Link
                      href={`/marketplace/${l.id}`}
                      data-testid={`button-open-${l.id}`}
                      className="px-2 py-1 rounded bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25 transition-colors uppercase tracking-wider"
                    >
                      Open detail
                    </Link>
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListingDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [data, setData] = useState<{ listing: SpcListing; creator: { id: string; name: string; contextCraftCertLevel: string } | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [outcome, setOutcome] = useState<any>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);

  useEffect(() => {
    api.getSpcListing(id, user?.id).then(setData).catch((e) => setError(e?.message || "Failed to load."));
    if (user) api.getCredits(user.id).then(setCredits).catch(() => null);
  }, [id, user]);

  const isOwnListing = user?.id === data?.listing.creatorId;

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
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2" data-testid="link-back-marketplace">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div className="glass-card p-8 rounded-xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
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
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-400/10 border border-amber-400/30">
              <Coins className="h-5 w-5 text-amber-400" />
              <span className="font-mono text-2xl font-bold text-amber-400" data-testid="text-listing-price">
                {listing.priceCredits}
              </span>
            </div>
            <span className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">
              CREDITS
            </span>
          </div>
        </div>

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

        {listing.bodyLocked !== false ? (
          <SpcTaxonomyPanel
            data={{
              pillar: listing.pillar,
              hiveScore: listing.hiveScore,
              kcseScore: listing.kcseScore,
              priceCredits: listing.priceCredits,
              salesCount: listing.salesCount,
              bodyLength: listing.bodyLength,
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
              Balance: <span className="text-white">{outcome.buyerBalance}</span> credits remaining.
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
              ? `Need ${listing.priceCredits - credits.balance} more credits`
              : `Purchase for ${listing.priceCredits} credits`}
          </button>
        )}

        {user && isOwnListing && (
          <div className="p-4 rounded-lg border border-amber-400/20 bg-amber-400/5 font-mono text-xs text-amber-400 text-center" data-testid="text-own-listing">
            This is your listing — you can't buy it. Total earned: <span className="font-bold">{listing.totalEarned}</span> credits.
          </div>
        )}
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
        <p className="font-mono text-sm text-muted-foreground uppercase">Please log in to publish a Smart Prompt Card.</p>
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/marketplace" className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2" data-testid="link-back-from-publish">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-publish-title">
          Publish Smart Prompt Card
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          HIVE PRE-CHECK MUST PASS BEFORE LISTING GOES LIVE
        </p>
      </div>

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
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Prompt Body</label>
          <textarea
            data-testid="input-spc-body"
            value={form.body}
            onChange={(e) => { setForm({ ...form, body: e.target.value }); setPrecheck(null); }}
            placeholder="Full prompt — role, instructions, examples, constraints, format spec…"
            rows={12}
            className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-primary/50 leading-relaxed"
          />
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            {form.body.length} chars • min 80 / max 4000
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
                <div className="font-mono text-sm text-white">
                  HIVE: <span className="font-bold" data-testid="text-precheck-hive">{precheck.hiveScore}</span> / 100
                  <span className="text-muted-foreground ml-3">KCSE: <span className="text-white" data-testid="text-precheck-kcse">{precheck.kcseScore}</span></span>
                </div>
                <div className={`text-xs font-mono mt-0.5 ${precheck.passes ? "text-secondary" : "text-amber-400"}`}>
                  {precheck.passes ? "Pre-check passed — ready to publish." : "Pre-check failed — improve and re-run."}
                </div>
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
  const [matchPublish] = useRoute("/marketplace/publish");

  if (matchPublish) return <PublishPage />;
  if (matchDetail && paramsDetail) {
    if (paramsDetail.id === "publish") return <PublishPage />;
    return <ListingDetail id={paramsDetail.id} />;
  }
  return <ListingsList />;
}
