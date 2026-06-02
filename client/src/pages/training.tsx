import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  GraduationCap,
  Loader2,
  Sparkles,
  Star,
  ArrowUpRight,
  Search,
  Building2,
  PlusCircle,
  Award,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { api } from "@/lib/api";
import UpgradeGate from "@/components/UpgradeGate";
import {
  TRAINING_CATEGORY_LABELS,
  TRAINING_DELIVERY_MODES,
  type TrainingCategory,
} from "@shared/schema";

interface ProviderDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string | null;
  logoUrl: string | null;
  regions: string[];
  deliveryModes: string[];
  accreditations: string[];
  sponsored: boolean;
  courseCount?: number;
}

interface CourseDto {
  id: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  level: string | null;
  durationLabel: string | null;
  priceLabel: string | null;
  certification: string | null;
  url: string | null;
}

interface SuggestedResult {
  matchScore: number;
  sponsored: boolean;
  reasons: string[];
  course: CourseDto;
  provider: ProviderDto;
}

const DELIVERY_LABELS: Record<string, string> = {
  online: "Online",
  in_person: "In Person",
  hybrid: "Hybrid",
};

function categoryLabel(cat: string): string {
  return (TRAINING_CATEGORY_LABELS as Record<string, string>)[cat] || cat;
}

async function openAffiliate(providerId: string, courseId?: string) {
  try {
    const { url } = await api.trackTrainingClick(providerId, courseId);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    /* click tracking is best-effort; swallow */
  }
}

function MatchCard({ result }: { result: SuggestedResult }) {
  const { course, provider, matchScore, sponsored, reasons } = result;
  return (
    <div
      className="glass-card rounded-xl p-5 border border-primary/20 flex flex-col gap-3"
      data-testid={`card-suggested-${course.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {categoryLabel(course.category)}
            </span>
            {sponsored && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                <Sparkles className="h-3 w-3" /> Sponsored
              </span>
            )}
          </div>
          <h3 className="font-display font-bold text-white text-base mt-2 truncate" data-testid={`text-course-title-${course.id}`}>
            {course.title}
          </h3>
          <Link
            href={`/training/p/${provider.slug}`}
            className="text-xs font-mono text-secondary hover:text-secondary/80 inline-flex items-center gap-1"
            data-testid={`link-provider-${provider.slug}`}
          >
            <Building2 className="h-3 w-3" /> {provider.name}
          </Link>
        </div>
        <div className="flex flex-col items-center flex-shrink-0">
          <span className="text-2xl font-display font-black text-primary" data-testid={`text-match-${course.id}`}>
            {matchScore}
          </span>
          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">Match</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>

      {reasons.length > 0 && (
        <ul className="space-y-1">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-secondary/90">
              <Star className="h-3 w-3 mt-0.5 flex-shrink-0" /> {r}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground mt-auto pt-2">
        {course.level && <span className="px-2 py-0.5 rounded bg-white/5">{course.level}</span>}
        {course.durationLabel && <span className="px-2 py-0.5 rounded bg-white/5">{course.durationLabel}</span>}
        {course.priceLabel && <span className="px-2 py-0.5 rounded bg-white/5">{course.priceLabel}</span>}
      </div>

      {course.certification && (
        <div className="flex items-center gap-1.5 text-xs text-amber-300/90">
          <Award className="h-3.5 w-3.5" /> {course.certification}
        </div>
      )}

      <button
        type="button"
        onClick={() => openAffiliate(provider.id, course.id)}
        data-testid={`button-enroll-${course.id}`}
        className="w-full mt-1 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors inline-flex items-center justify-center gap-2"
      >
        View course <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderDto }) {
  return (
    <Link
      href={`/training/p/${provider.slug}`}
      data-testid={`card-provider-${provider.slug}`}
      className="group glass-card rounded-xl p-5 border border-white/10 hover:border-primary/40 transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-white text-sm truncate">{provider.name}</h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {provider.courseCount ?? 0} course{(provider.courseCount ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {provider.sponsored && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30 flex-shrink-0">
            <Sparkles className="h-3 w-3" /> Featured
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">{provider.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {provider.deliveryModes.map((m) => (
          <span key={m} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-muted-foreground">
            {DELIVERY_LABELS[m] || m}
          </span>
        ))}
        {provider.regions.map((r) => (
          <span key={r} className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/10 text-secondary/90">
            {r}
          </span>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-primary group-hover:text-primary/80">
        View provider <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

export default function TrainingPage() {
  const { user } = useAuth();
  const { canAccessTraining } = useSubscription();
  const [suggested, setSuggested] = useState<SuggestedResult[]>([]);
  const [suggestedMsg, setSuggestedMsg] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All");
  const [delivery, setDelivery] = useState("All");

  useEffect(() => {
    if (!user || !canAccessTraining) return;
    let active = true;
    api
      .getSuggestedTraining()
      .then((d) => {
        if (active) setSuggested(d.results || []);
      })
      .catch((e: Error) => {
        if (active) setSuggestedMsg(e.message);
      });
    return () => {
      active = false;
    };
  }, [user, canAccessTraining]);

  useEffect(() => {
    if (!user || !canAccessTraining) return;
    let active = true;
    setLoading(true);
    api
      .getTrainingProviders({ q: search, region, deliveryMode: delivery })
      .then((d) => {
        if (active) setProviders(d || []);
      })
      .catch(() => {
        if (active) setProviders([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, canAccessTraining, search, region, delivery]);

  if (!canAccessTraining) {
    return (
      <UpgradeGate featureName="Suggested Training Providers" requiredPlan="Explorer (free)" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  const regions = ["All", "NA", "EMEA", "APAC", "LATAM", "Global"];

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-primary" />
            <h1 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-widest">
              Training Providers
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-2 max-w-2xl">
            Certifications ranked against the JST engine's suggested upskilling path for your latest assessment.
          </p>
        </div>
        <Link
          href="/training/register"
          data-testid="link-register-provider"
          className="inline-flex items-center gap-2 self-start font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25 transition-colors"
        >
          <PlusCircle className="h-4 w-4" /> List your organization
        </Link>
      </div>

      {/* Suggested for you */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-lg text-primary uppercase tracking-widest flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Matched to your upskilling path
        </h2>
        {suggestedMsg ? (
          <div className="glass-card rounded-xl p-6 border border-white/10 text-center" data-testid="text-suggested-empty">
            <p className="text-sm text-muted-foreground font-mono">{suggestedMsg}</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono uppercase tracking-widest text-primary hover:text-primary/80"
            >
              Upload a resume <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : suggested.length === 0 ? (
          <div className="glass-card rounded-xl p-6 border border-white/10 text-center">
            <p className="text-sm text-muted-foreground font-mono">
              No matched courses yet — check the directory below or revisit after more providers join.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {suggested.map((r) => (
              <MatchCard key={r.course.id} result={r} />
            ))}
          </div>
        )}
      </section>

      {/* Directory */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-lg text-white uppercase tracking-widest flex items-center gap-2">
          <Building2 className="h-5 w-5 text-secondary" /> Provider directory
        </h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search providers or courses..."
              data-testid="input-search-providers"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-background/60 border border-white/10 text-sm font-mono text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
            />
          </div>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            data-testid="select-region"
            className="px-3 py-2.5 rounded-lg bg-background/60 border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-primary/40"
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r === "All" ? "All regions" : r}
              </option>
            ))}
          </select>
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            data-testid="select-delivery"
            className="px-3 py-2.5 rounded-lg bg-background/60 border border-white/10 text-sm font-mono text-white focus:outline-none focus:border-primary/40"
          >
            <option value="All">All delivery</option>
            {TRAINING_DELIVERY_MODES.map((m) => (
              <option key={m} value={m}>
                {DELIVERY_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : providers.length === 0 ? (
          <div className="glass-card rounded-xl p-6 border border-white/10 text-center">
            <p className="text-sm text-muted-foreground font-mono">No providers match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
