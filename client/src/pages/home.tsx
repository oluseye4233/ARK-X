import { Link } from "wouter";
import { ArrowRight, ShieldAlert, Target, Zap, Crown, GraduationCap, User, Building2, Check, Upload, BarChart3, Compass, PlayCircle, Sparkles, FileText, Download, LogIn, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SUBSCRIPTION_PLANS } from "@shared/schema";
import { FEATURES } from "@shared/featureFlags";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { F1000QrCard } from "@/components/f1000/F1000QrCard";
import { PlanWalkthroughs } from "@/components/tour/PlanWalkthroughs";
import masterclassVideo from "@assets/ark_onecraft_masterclass.mp4";
import masterclassPoster from "@assets/ark_onecraft_masterclass_poster.jpg";
import guideCover from "@assets/ark_onecraft_subscription_guide_cover.jpg";
import guidePdf from "@assets/ARK_Onecraft_Subscription_Guide_1780266946261.pdf";

function ScarcityBadge() {
  const { data } = useQuery<{ claimed: number; limit: number; remaining: number }>({
    queryKey: ["/api/f1000/stats"],
    queryFn: () => api.getF1000Stats(),
    refetchOnWindowFocus: false,
  });
  const remaining = data?.remaining ?? 1000;
  const limit = data?.limit ?? 1000;
  const soldOut = remaining <= 0;

  return (
    <div className="inline-flex items-center gap-2 border border-destructive bg-destructive/10 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider text-destructive" data-testid="badge-home-spots">
      <Sparkles className="h-3.5 w-3.5" />
      {soldOut ? (
        <span data-testid="text-home-spots-remaining">All {limit} F1000 seats claimed — still free to try</span>
      ) : (
        <>F1000 free with this QR · <span className="font-bold text-foreground" data-testid="text-home-spots-remaining">{remaining}</span>/{limit} left</>
      )}
    </div>
  );
}

const steps = [
  { step: "01", icon: Upload, title: "Upload your CV", body: "PDF, DOCX or paste text — takes 10 seconds." },
  { step: "02", icon: BarChart3, title: "Get your JST score", body: "Your career capital assessed with ARK's dated, curated scoring model." },
  { step: "03", icon: Compass, title: "See your next move", body: "Pivot paths and skills ranked by ROI." },
];

export default function Home() {
  const { user, isLoading } = useAuth();

  return (
    <main className="ark-home min-h-[100dvh] overflow-hidden">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Atanda</p>
          <div className="font-display text-sm font-black uppercase tracking-[0.2em] text-foreground">ARK <span className="text-primary">Onecraft</span></div>
        </div>
        {!isLoading && !user && (
          <div className="flex items-center gap-2 sm:gap-3" data-testid="landing-auth-buttons">
            <Link href="/login" data-testid="button-landing-login" className="inline-flex h-10 items-center gap-2 border border-foreground/35 px-3 text-xs font-mono font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-foreground hover:text-background sm:px-5">
              <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Log In</span><span className="sm:hidden">In</span>
            </Link>
            <Link href="/signup" data-testid="button-landing-signup" className="inline-flex h-10 items-center gap-2 bg-primary px-3 text-xs font-mono font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:-translate-y-0.5 sm:px-5">
              <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Sign Up</span><span className="sm:hidden">Up</span>
            </Link>
          </div>
        )}
      </header>
      <div className="ark-brand-spectrum mx-auto max-w-7xl" aria-hidden="true" />

      <section className="relative border-y border-foreground/15 bg-background">
        <div className="absolute right-0 top-0 hidden h-full w-[33%] bg-destructive lg:block" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-28">
            <div data-testid="banner-manifesto" className="ark-home-reveal mb-8 inline-block border-l-4 border-primary bg-primary/10 px-4 py-3">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Apply Context Craft to your career and <span className="text-primary">thrive.</span></p>
            </div>
            <div className="ark-home-reveal flex flex-wrap items-center gap-3">
              <p className="text-xs font-mono uppercase tracking-[0.18em] text-secondary">Career intelligence for changing work</p>
              <span className="border border-secondary/50 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-secondary">System Initialization Complete</span>
            </div>
            <h1 className="ark-home-reveal-delay mt-5 font-display text-4xl font-black uppercase leading-[.93] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Know your <span className="text-primary">worth.</span><br />
              Know your <span className="text-destructive">risk.</span><br />
              Know your <span className="text-secondary">next move.</span>
            </h1>
            <p className="ark-home-reveal-delay mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Upload your CV and, in under 60 seconds, get a dated estimate of your career signals, where AI may put you at risk, and practical next moves.
            </p>
            <div className="ark-home-reveal-delay mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/upload" data-testid="button-start-intake" className="inline-flex h-13 items-center justify-center bg-primary px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:-translate-y-0.5">
                <Upload className="mr-2 h-5 w-5" /> Upload your CV
              </Link>
              <Link href="/demo-tour" data-testid="button-view-demo-tour" className="inline-flex h-13 items-center justify-center border border-destructive px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground">
                <PlayCircle className="mr-2 h-5 w-5" /> See the Demo Tour
              </Link>
              <Link href="/login" data-testid="button-view-demo" className="inline-flex items-center justify-center px-2 py-2 text-xs font-mono font-bold uppercase tracking-wider text-secondary transition-colors hover:text-foreground">
                <LogIn className="mr-2 h-5 w-5" /> Login
              </Link>
            </div>
          </div>
          <aside className="relative flex flex-col justify-end bg-destructive p-6 text-destructive-foreground sm:p-8 lg:bg-transparent lg:p-0 lg:pb-16">
            <div className="border border-destructive-foreground/30 bg-background p-5 text-foreground lg:-ml-8">
              <div className="mb-4 h-2 w-16 bg-primary" />
              <p className="font-display text-2xl font-black uppercase leading-none">Clarity is a career advantage.</p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">One traceable view of your career signals, exposure, and practical options.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-12">
        <div className="grid gap-px bg-foreground/15 md:grid-cols-3">
          {steps.map(({ step, icon: Icon, title, body }) => (
            <article key={step} className="group bg-background p-6 transition-colors hover:bg-muted/60" data-testid={`landing-step-${Number(step)}`}>
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs font-bold tracking-widest text-primary">{step}</span>
                <Icon className="h-5 w-5 text-secondary" />
              </div>
              <h2 className="mt-10 font-display text-xl font-bold uppercase text-foreground">{title}</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-12">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.16em]">The first 1,000</p>
            <h2 className="mt-2 font-display text-3xl font-black uppercase sm:text-4xl">Start with the signal.</h2>
          </div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <ScarcityBadge />
            {FEATURES.f1000Promo && (
              <div className="flex items-center gap-3" data-testid="home-f1000-qr">
                <F1000QrCard url={typeof window !== "undefined" ? `${window.location.origin}/f1000` : "/f1000"} size={80} caption="Scan to join the First 1000" />
                <Link href="/f1000" data-testid="link-home-f1000" className="border border-primary-foreground bg-primary-foreground px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider text-primary transition-transform hover:-translate-y-0.5">Claim your seat</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12">
        <div className="mb-8 flex items-end justify-between gap-5 border-b border-foreground/15 pb-5">
          <div><p className="font-mono text-xs uppercase tracking-[.16em] text-primary">The readout</p><h2 className="mt-2 font-display text-3xl font-black uppercase text-foreground">Three angles. One decision.</h2></div>
        </div>
        <div className="grid gap-5 md:grid-cols-[1.1fr_.9fr_1fr]">
          {[
            { icon: Zap, title: "JST Index Valuation", body: "Computes a tri-dimensional career capital score using ARK's curated scoring model, reviewed 6 September 2026. It is not a live labour-market feed.", tone: "bg-primary text-primary-foreground" },
            { icon: ShieldAlert, title: "AI Vulnerability", body: "5-level vulnerability classification with task-level automation risk scoring.", tone: "bg-destructive text-destructive-foreground" },
            { icon: Target, title: "12-Vector Mobility", body: "Maps career mobility across 12 orthogonal dimensions to generate optimal pivot pathways.", tone: "bg-secondary text-secondary-foreground" },
          ].map(({ icon: Icon, title, body, tone }) => (
            <article key={title} className={`${tone} min-h-64 p-7`}>
              <Icon className="h-8 w-8" /><h3 className="mt-14 font-display text-2xl font-black uppercase leading-none">{title}</h3><p className="mt-4 text-sm leading-relaxed opacity-90">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-foreground/15 bg-muted/45 px-5 py-16 sm:px-8 lg:px-12" data-testid="section-masterclass">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8"><p className="font-mono text-xs uppercase tracking-[.16em] text-secondary">A closer look</p><h2 className="mt-2 font-display text-3xl font-black uppercase text-foreground">Watch. Then decide.</h2></div>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="overflow-hidden border border-foreground/20 bg-background lg:col-span-3" data-testid="card-masterclass-video">
              <video controls preload="metadata" poster={masterclassPoster} className="aspect-video w-full bg-background" data-testid="video-masterclass"><source src={masterclassVideo} type="video/mp4" />Your browser does not support the video tag.</video>
            </div>
            <article className="flex flex-col border border-foreground/20 bg-background p-5 lg:col-span-2" data-testid="card-whitepaper">
              <div className="relative overflow-hidden border border-foreground/15"><img src={guideCover} alt="ARK Onecraft — Subscriber Plans Guide cover" className="w-full object-cover" data-testid="img-whitepaper-cover" /><span className="absolute left-3 top-3 inline-flex items-center gap-1 bg-primary px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-primary-foreground"><FileText className="h-3 w-3" /> Whitepaper · 19 pages</span></div>
              <h3 className="mt-5 font-display text-xl font-bold uppercase text-foreground">Navigating the AI Era</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">The ARK Onecraft subscriber plans guide — how each tier maps to your career-intelligence journey, and how to get the most from your subscription.</p>
              <a href={guidePdf} target="_blank" rel="noopener noreferrer" download data-testid="link-download-whitepaper" className="mt-5 inline-flex h-11 items-center justify-center gap-2 bg-primary px-5 text-xs font-mono font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:-translate-y-0.5"><Download className="h-4 w-4" /> Read the Guide</a>
            </article>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12"><PlanWalkthroughs /></div>

      <section className="border-t border-foreground/15 bg-background px-5 py-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono text-xs uppercase tracking-[.16em] text-primary">Choose your scope</p><h2 className="mt-2 font-display text-3xl font-black uppercase text-foreground">Access tiers</h2></div><p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Individual & School Plans Available</p></div>
          <div className="grid gap-px bg-foreground/15 md:grid-cols-2 lg:grid-cols-4">
            {([{ key: "INDIVIDUAL_FREE", icon: User, accent: "#1B6FB5" }, { key: "INDIVIDUAL_PRO", icon: Crown, accent: "#F2C230" }, { key: "SCHOOL_STUDENT", icon: GraduationCap, accent: "#2BB673" }, { key: "ENTERPRISE", icon: Building2, accent: "#8E44AD" }] as const).map(({ key, icon: Icon, accent }) => {
              const plan = SUBSCRIPTION_PLANS[key];
              const isPopular = key === "INDIVIDUAL_PRO";
              return <article key={key} className="relative flex min-h-80 flex-col border-t-4 bg-background p-6" style={{ borderTopColor: accent }} data-testid={`card-home-plan-${key.toLowerCase()}`}>
                {isPopular && <span className="absolute right-0 top-0 bg-primary px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-primary-foreground">Popular</span>}
                <Icon className="h-6 w-6" style={{ color: plan.color }} /><h3 className="mt-6 font-display text-base font-bold uppercase text-foreground">{plan.label}</h3>
                <div className="mt-3 font-display text-3xl font-black text-foreground">{plan.price === 0 ? (key === "ENTERPRISE" ? "Custom" : "Free") : <>${plan.price}<span className="font-mono text-xs font-normal text-muted-foreground">/{plan.period}</span></>}</div>
                <div className="mt-6 flex-1 space-y-2">{plan.features.slice(0, 4).map((feature) => <div key={feature} className="flex gap-2 text-xs leading-snug text-muted-foreground"><Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: plan.color }} />{feature}</div>)}{plan.features.length > 4 && <p className="font-mono text-xs text-muted-foreground">+{plan.features.length - 4} more</p>}</div>
              </article>;
            })}
          </div>
          <div className="mt-8 text-center"><Link href="/subscription" data-testid="link-view-plans" className="inline-flex items-center gap-2 border-b-2 border-primary pb-1 font-mono text-sm font-bold uppercase tracking-wider text-primary transition-colors hover:text-foreground">View All Plans & Features <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>
    </main>
  );
}