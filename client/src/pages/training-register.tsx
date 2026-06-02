import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  GraduationCap,
  Loader2,
  ArrowLeft,
  PlusCircle,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useSubscription } from "@/lib/useSubscription";
import { api } from "@/lib/api";
import UpgradeGate from "@/components/UpgradeGate";
import {
  TRAINING_CATEGORIES,
  TRAINING_CATEGORY_LABELS,
  TRAINING_DELIVERY_MODES,
} from "@shared/schema";

interface OwnedCourse {
  id: string;
  title: string;
  category: string;
  level: string | null;
  priceLabel: string | null;
}

interface OwnedProvider {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  sponsored: boolean;
  regions: string[] | null;
  deliveryModes: string[] | null;
  courses: OwnedCourse[];
}

const DELIVERY_LABELS: Record<string, string> = {
  online: "Online",
  in_person: "In Person",
  hybrid: "Hybrid",
};

const STATUS_META: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "Pending review", cls: "text-amber-300 bg-amber-400/10 border-amber-400/30", Icon: Clock },
  approved: { label: "Approved", cls: "text-secondary bg-secondary/10 border-secondary/30", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "text-destructive bg-destructive/10 border-destructive/30", Icon: XCircle },
};

const REGION_OPTIONS = ["NA", "EMEA", "APAC", "LATAM", "Global"];

export default function TrainingRegisterPage() {
  const { user } = useAuth();
  const { canAccessTraining } = useSubscription();
  const [mine, setMine] = useState<OwnedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // New provider form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [deliveryModes, setDeliveryModes] = useState<string[]>([]);

  // Add-course state keyed by providerId
  const [courseFor, setCourseFor] = useState<string | null>(null);
  const [cTitle, setCTitle] = useState("");
  const [cDescription, setCDescription] = useState("");
  const [cCategory, setCCategory] = useState<string>(TRAINING_CATEGORIES[0]);
  const [cSkills, setCSkills] = useState("");
  const [cLevel, setCLevel] = useState("");
  const [cDuration, setCDuration] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cCert, setCCert] = useState("");
  const [cUrl, setCUrl] = useState("");

  function loadMine() {
    setLoading(true);
    api
      .getMyTrainingProviders()
      .then((d) => setMine(d || []))
      .catch(() => setMine([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user || !canAccessTraining) return;
    loadMine();
  }, [user, canAccessTraining]);

  function toggle(list: string[], val: string, set: (v: string[]) => void) {
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  async function submitProvider(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!name.trim()) {
      setErr("Organization name is required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.registerTrainingProvider({
        name: name.trim(),
        description: description.trim(),
        website: website.trim() || undefined,
        regions,
        deliveryModes,
      });
      setMsg("Submitted! Your organization is pending review before it appears in the directory.");
      setName("");
      setDescription("");
      setWebsite("");
      setRegions([]);
      setDeliveryModes([]);
      loadMine();
    } catch (e: any) {
      setErr(e.message || "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCourse(providerId: string) {
    setErr(null);
    if (!cTitle.trim()) {
      setErr("Course title is required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.addTrainingCourse(providerId, {
        title: cTitle.trim(),
        description: cDescription.trim(),
        category: cCategory,
        skills: cSkills.split(",").map((s) => s.trim()).filter(Boolean),
        level: cLevel.trim() || undefined,
        durationLabel: cDuration.trim() || undefined,
        priceLabel: cPrice.trim() || undefined,
        certification: cCert.trim() || undefined,
        url: cUrl.trim() || undefined,
      });
      setCourseFor(null);
      setCTitle("");
      setCDescription("");
      setCCategory(TRAINING_CATEGORIES[0]);
      setCSkills("");
      setCLevel("");
      setCDuration("");
      setCPrice("");
      setCCert("");
      setCUrl("");
      loadMine();
    } catch (e: any) {
      setErr(e.message || "Failed to add course.");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCourse(courseId: string) {
    if (!confirm("Remove this course?")) return;
    try {
      await api.deleteTrainingCourse(courseId);
      loadMine();
    } catch (e: any) {
      setErr(e.message || "Failed to remove course.");
    }
  }

  if (!canAccessTraining) {
    return (
      <UpgradeGate featureName="Training Provider Portal" requiredPlan="Explorer (free)" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  const inputCls =
    "w-full px-3 py-2.5 rounded-lg bg-background/60 border border-white/10 text-sm font-mono text-white placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link
        href="/training"
        data-testid="link-back-training"
        className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Training Providers
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-secondary" />
          <h1 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-widest">
            Provider Portal
          </h1>
        </div>
        <p className="text-muted-foreground font-mono text-sm mt-2 max-w-2xl">
          List your training organization and courses. New submissions are reviewed before appearing in the directory.
        </p>
      </div>

      {msg && (
        <div className="glass-card rounded-lg p-4 border border-secondary/30 text-sm text-secondary font-mono" data-testid="text-register-success">
          {msg}
        </div>
      )}
      {err && (
        <div className="glass-card rounded-lg p-4 border border-destructive/30 text-sm text-destructive font-mono" data-testid="text-register-error">
          {err}
        </div>
      )}

      {/* Register new provider */}
      <form onSubmit={submitProvider} className="glass-card rounded-xl p-6 border border-primary/20 space-y-4" data-testid="form-register-provider">
        <h2 className="font-display font-bold text-lg text-primary uppercase tracking-widest flex items-center gap-2">
          <PlusCircle className="h-5 w-5" /> Register an organization
        </h2>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Organization name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} data-testid="input-provider-name" placeholder="e.g. ForgeWorks AI Academy" />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} data-testid="input-provider-description" placeholder="What do you teach and who is it for?" />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} data-testid="input-provider-website" placeholder="https://..." />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Regions served</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggle(regions, r, setRegions)}
                data-testid={`toggle-region-${r}`}
                className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                  regions.includes(r)
                    ? "bg-secondary/15 text-secondary border-secondary/40"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/20"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Delivery modes</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {TRAINING_DELIVERY_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggle(deliveryModes, m, setDeliveryModes)}
                data-testid={`toggle-delivery-${m}`}
                className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                  deliveryModes.includes(m)
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:border-white/20"
                }`}
              >
                {DELIVERY_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          data-testid="button-submit-provider"
          className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-wider px-5 py-2.5 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Submit for review
        </button>
      </form>

      {/* My providers */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-lg text-white uppercase tracking-widest flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" /> My organizations
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        ) : mine.length === 0 ? (
          <div className="glass-card rounded-xl p-6 border border-white/10 text-center">
            <p className="text-sm text-muted-foreground font-mono">You haven't registered any organizations yet.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {mine.map((p) => {
              const meta = STATUS_META[p.status] || STATUS_META.pending;
              const StatusIcon = meta.Icon;
              return (
                <div key={p.id} className="glass-card rounded-xl p-5 border border-white/10 space-y-4" data-testid={`card-my-provider-${p.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-white text-base truncate">{p.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest px-2 py-1 rounded border flex-shrink-0 ${meta.cls}`}>
                      <StatusIcon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>

                  {/* Courses */}
                  <div className="space-y-2">
                    {p.courses.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-mono">No courses yet.</p>
                    ) : (
                      p.courses.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-lg px-3 py-2" data-testid={`row-course-${c.id}`}>
                          <div className="min-w-0">
                            <span className="text-sm text-white truncate block">{c.title}</span>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                              {(TRAINING_CATEGORY_LABELS as Record<string, string>)[c.category] || c.category}
                              {c.level ? ` · ${c.level}` : ""}
                              {c.priceLabel ? ` · ${c.priceLabel}` : ""}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCourse(c.id)}
                            data-testid={`button-remove-course-${c.id}`}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                            aria-label="Remove course"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add course */}
                  {courseFor === p.id ? (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} className={inputCls} placeholder="Course title *" data-testid="input-course-title" />
                      <textarea value={cDescription} onChange={(e) => setCDescription(e.target.value)} rows={2} className={inputCls} placeholder="Course description" data-testid="input-course-description" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select value={cCategory} onChange={(e) => setCCategory(e.target.value)} className={inputCls} data-testid="select-course-category">
                          {TRAINING_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {TRAINING_CATEGORY_LABELS[cat]}
                            </option>
                          ))}
                        </select>
                        <input value={cLevel} onChange={(e) => setCLevel(e.target.value)} className={inputCls} placeholder="Level (e.g. Intermediate)" data-testid="input-course-level" />
                        <input value={cDuration} onChange={(e) => setCDuration(e.target.value)} className={inputCls} placeholder="Duration (e.g. 6 weeks)" data-testid="input-course-duration" />
                        <input value={cPrice} onChange={(e) => setCPrice(e.target.value)} className={inputCls} placeholder="Price (e.g. $1,200)" data-testid="input-course-price" />
                      </div>
                      <input value={cSkills} onChange={(e) => setCSkills(e.target.value)} className={inputCls} placeholder="Skills (comma-separated)" data-testid="input-course-skills" />
                      <input value={cCert} onChange={(e) => setCCert(e.target.value)} className={inputCls} placeholder="Certification awarded" data-testid="input-course-cert" />
                      <input value={cUrl} onChange={(e) => setCUrl(e.target.value)} className={inputCls} placeholder="Course URL (https://...)" data-testid="input-course-url" />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => submitCourse(p.id)}
                          disabled={submitting}
                          data-testid="button-save-course"
                          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors disabled:opacity-50"
                        >
                          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
                          Save course
                        </button>
                        <button
                          type="button"
                          onClick={() => setCourseFor(null)}
                          className="font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg bg-white/5 text-muted-foreground border border-white/10 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setErr(null);
                        setCourseFor(p.id);
                      }}
                      data-testid={`button-add-course-${p.id}`}
                      className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-secondary hover:text-secondary/80 transition-colors"
                    >
                      <PlusCircle className="h-3.5 w-3.5" /> Add course
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
