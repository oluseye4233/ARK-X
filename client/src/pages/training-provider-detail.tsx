import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  GraduationCap,
  Loader2,
  Sparkles,
  ArrowLeft,
  Award,
  ExternalLink,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { api } from "@/lib/api";
import UpgradeGate from "@/components/UpgradeGate";
import { TRAINING_CATEGORY_LABELS } from "@shared/schema";

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
}

interface CourseDto {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: string;
  skills: string[] | null;
  level: string | null;
  durationLabel: string | null;
  priceLabel: string | null;
  certification: string | null;
  url: string | null;
}

const DELIVERY_LABELS: Record<string, string> = {
  online: "Online",
  in_person: "In Person",
  hybrid: "Hybrid",
};

function categoryLabel(cat: string): string {
  return (TRAINING_CATEGORY_LABELS as Record<string, string>)[cat] || cat;
}

export default function TrainingProviderDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const { canAccessTraining } = useSubscription();
  const [provider, setProvider] = useState<ProviderDto | null>(null);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !canAccessTraining || !slug) return;
    let active = true;
    setLoading(true);
    api
      .getTrainingProvider(slug)
      .then((d) => {
        if (!active) return;
        setProvider(d.provider);
        setCourses(d.courses || []);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, canAccessTraining, slug]);

  async function enroll(courseId?: string) {
    if (!provider) return;
    try {
      const { url } = await api.trackTrainingClick(provider.id, courseId);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* best-effort */
    }
  }

  if (!canAccessTraining) {
    return (
      <UpgradeGate featureName="Suggested Training Providers" requiredPlan="Explorer (free)" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !provider) {
    return (
      <div className="max-w-3xl mx-auto min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <p className="font-mono text-sm text-muted-foreground uppercase" data-testid="text-provider-error">
          {error || "Provider not found."}
        </p>
        <Link
          href="/training"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to directory
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <Link
        href="/training"
        data-testid="link-back-directory"
        className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Directory
      </Link>

      {/* Provider header */}
      <div className="glass-card rounded-xl p-6 border border-primary/20">
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-black text-white uppercase tracking-wider" data-testid="text-provider-name">
                {provider.name}
              </h1>
              {provider.sponsored && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  <Sparkles className="h-3 w-3" /> Featured
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-2">{provider.description}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {provider.deliveryModes.map((m) => (
                <span key={m} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-muted-foreground">
                  {DELIVERY_LABELS[m] || m}
                </span>
              ))}
              {provider.regions.map((r) => (
                <span key={r} className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary/10 text-secondary/90">
                  {r}
                </span>
              ))}
            </div>

            {provider.accreditations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <ShieldCheck className="h-4 w-4 text-secondary" />
                {provider.accreditations.map((a) => (
                  <span key={a} className="text-[11px] font-mono px-2 py-0.5 rounded bg-secondary/10 text-secondary/90">
                    {a}
                  </span>
                ))}
              </div>
            )}

            {provider.website && (
              <button
                type="button"
                onClick={() => enroll()}
                data-testid="button-visit-website"
                className="inline-flex items-center gap-2 mt-4 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
              >
                <Globe className="h-3.5 w-3.5" /> Visit website
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Courses */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-lg text-white uppercase tracking-widest">
          Courses & Certifications
        </h2>
        {courses.length === 0 ? (
          <div className="glass-card rounded-xl p-6 border border-white/10 text-center">
            <p className="text-sm text-muted-foreground font-mono">This provider has no published courses yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {courses.map((c) => (
              <div
                key={c.id}
                className="glass-card rounded-xl p-5 border border-white/10 flex flex-col gap-3"
                data-testid={`card-course-${c.id}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {categoryLabel(c.category)}
                  </span>
                  {c.level && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-muted-foreground">
                      {c.level}
                    </span>
                  )}
                </div>
                <h3 className="font-display font-bold text-white text-base">{c.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{c.description}</p>

                {c.skills && c.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.skills.slice(0, 6).map((s) => (
                      <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded bg-secondary/10 text-secondary/90">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground mt-auto">
                  {c.durationLabel && <span className="px-2 py-0.5 rounded bg-white/5">{c.durationLabel}</span>}
                  {c.priceLabel && <span className="px-2 py-0.5 rounded bg-white/5">{c.priceLabel}</span>}
                </div>

                {c.certification && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-300/90">
                    <Award className="h-3.5 w-3.5" /> {c.certification}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => enroll(c.id)}
                  data-testid={`button-enroll-${c.id}`}
                  className="w-full mt-1 py-2.5 rounded-lg font-mono text-xs uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors inline-flex items-center justify-center gap-2"
                >
                  View course <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
