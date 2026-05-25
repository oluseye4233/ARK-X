import { Link } from "wouter";
import { ArrowRight, ShieldAlert, Target, Zap, Crown, GraduationCap, User, Building2, Check, Upload, BarChart3, Compass, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS } from "@shared/schema";
import heroBgVideo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779676596124.mp4";

export default function Home() {
  return (
    <>
      {/* Hero background video — fixed full-bleed, muted/looping, with a dark
          tint overlay so foreground text stays legible against any frame. */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" data-testid="hero-bg-video-wrap" aria-hidden="true">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
          data-testid="hero-bg-video"
        >
          <source src={heroBgVideo} type="video/mp4" />
        </video>
        {/* Tint for legibility — light enough that motion stays visible,
            heavier toward the bottom where the pricing grid lives. */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/30 via-transparent to-background/30" />
      </div>

      <div className="relative max-w-5xl mx-auto flex flex-col justify-center min-h-[80vh] space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-6">
        {/* Declarative manifesto banner — top-of-page positioning statement. */}
        <div
          data-testid="banner-manifesto"
          className="relative rounded-lg border border-primary/40 bg-gradient-to-r from-primary/10 via-fuchsia-500/5 to-secondary/10 px-5 py-4 shadow-[0_0_30px_hsl(var(--primary)/0.15)]"
        >
          <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary via-fuchsia-400 to-secondary" />
          <p className="font-display font-bold text-sm sm:text-base md:text-lg tracking-wide leading-snug text-white uppercase">
            We don't build AI agents.{" "}
            <span className="text-primary neon-text">We engineer the DNA that governs them</span>
            {" "}— powered by your cognition,{" "}
            <span className="text-secondary">owned by you.</span>
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          System Initialization Complete
        </div>
        
        <h1 className="font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 tracking-tight leading-[1.05] space-y-1">
          <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl whitespace-nowrap">
            KNOW YOUR <span className="text-primary neon-text">WORTH.</span>{" "}
            KNOW YOUR <span className="text-destructive">RISK.</span>
          </span>
          <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl whitespace-nowrap">
            KNOW YOUR <span className="text-secondary">NEXT MOVE.</span>
          </span>
        </h1>
        
        <p className="text-xl text-muted-foreground font-sans max-w-2xl leading-relaxed">
          Upload your CV and, in under 60 seconds, see how marketable you are today, where AI puts you at risk, and the smartest next move you can make.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 max-w-3xl">
          {[
            { step: "1", icon: Upload, title: "Upload your CV", body: "PDF, DOCX or paste text — takes 10 seconds." },
            { step: "2", icon: BarChart3, title: "Get your JST score", body: "Your career capital, benchmarked vs the live market." },
            { step: "3", icon: Compass, title: "See your next move", body: "Pivot paths and skills ranked by ROI." },
          ].map(({ step, icon: Icon, title, body }) => (
            <div key={step} className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.02]" data-testid={`landing-step-${step}`}>
              <div className="flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-full bg-primary/15 text-primary font-display text-sm font-bold border border-primary/30">
                {step}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary/80" />
                  <h3 className="font-display font-bold text-sm text-white tracking-wide">{title}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Hero CTA — centered, throbbing, glowing. Enterprise login demoted
            to a secondary link below so user attention lands on Initialize. */}
        <div className="flex flex-col items-center gap-4 pt-6">
          <div className="relative group">
            {/* Outer pulse ring */}
            <span
              aria-hidden="true"
              className="absolute -inset-3 rounded-full bg-primary/30 blur-2xl animate-ping-slow pointer-events-none"
            />
            {/* Inner steady glow */}
            <span
              aria-hidden="true"
              className="absolute -inset-1 rounded-full bg-primary/40 blur-xl pointer-events-none"
            />
            <Link
              href="/upload"
              data-testid="button-start-assessment"
              className="relative inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider rounded-none neon-border h-16 px-12 transition-all hover:scale-[1.04] text-base font-bold shadow-[0_0_30px_hsl(var(--primary)/0.6)] animate-throb-glow"
            >
              Initialize Analysis <ArrowRight className="ml-3 h-6 w-6" />
            </Link>
          </div>

          {/* Secondary CTA — guided demo tour. Magenta/fuchsia glow so it
              reads as a distinct "preview first" option vs the cyan primary. */}
          <div className="relative group">
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-full bg-fuchsia-500/25 blur-xl animate-ping-slow pointer-events-none"
            />
            <Link
              href="/demo-tour"
              data-testid="button-view-demo-tour"
              className="relative inline-flex items-center justify-center bg-background/60 hover:bg-fuchsia-500/10 text-fuchsia-300 hover:text-fuchsia-200 font-mono uppercase tracking-wider rounded-none h-12 px-8 transition-all hover:scale-[1.03] text-sm font-semibold border-2 border-fuchsia-400/60 animate-throb-glow-magenta"
            >
              <PlayCircle className="mr-2 h-5 w-5" /> See the Demo Tour
            </Link>
          </div>

          <Link
            href="/login"
            data-testid="button-view-demo"
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            Or use enterprise login →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-white/10">
        <div className="glass-card p-6 rounded-lg space-y-4">
          <Zap className="h-8 w-8 text-primary" />
          <h3 className="font-display font-bold text-lg">JST Index Valuation</h3>
          <p className="text-sm text-muted-foreground font-sans">
            Computes a tri-dimensional career capital score calibrated against live labor market data.
          </p>
        </div>
        
        <div className="glass-card p-6 rounded-lg space-y-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <h3 className="font-display font-bold text-lg">AI Vulnerability</h3>
          <p className="text-sm text-muted-foreground font-sans">
            5-level vulnerability classification with task-level automation risk scoring.
          </p>
        </div>
        
        <div className="glass-card p-6 rounded-lg space-y-4">
          <Target className="h-8 w-8 text-secondary" />
          <h3 className="font-display font-bold text-lg">12-Vector Mobility</h3>
          <p className="text-sm text-muted-foreground font-sans">
            Maps career mobility across 12 orthogonal dimensions to generate optimal pivot pathways.
          </p>
        </div>
      </div>

      <div className="space-y-8 pt-12 border-t border-white/10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-display font-bold text-white tracking-tight">
            Access <span className="text-primary neon-text">Tiers</span>
          </h2>
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest">
            Individual & School Plans Available
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { key: "INDIVIDUAL_FREE", icon: User },
            { key: "INDIVIDUAL_PRO", icon: Crown },
            { key: "SCHOOL_STUDENT", icon: GraduationCap },
            { key: "ENTERPRISE", icon: Building2 },
          ] as const).map(({ key, icon: Icon }) => {
            const plan = SUBSCRIPTION_PLANS[key];
            const isPopular = key === "INDIVIDUAL_PRO";
            return (
              <div
                key={key}
                className={`glass-card p-5 rounded-lg flex flex-col relative ${isPopular ? "ring-1 ring-primary/40" : ""}`}
                data-testid={`card-home-plan-${key.toLowerCase()}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-mono uppercase tracking-widest px-3 py-1 rounded-full">
                    Popular
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5" style={{ color: plan.color }} />
                  <span className="font-display font-bold text-sm text-white uppercase">{plan.label}</span>
                </div>
                <div className="mb-3">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-display font-black text-white">
                      {key === "ENTERPRISE" ? "Custom" : "Free"}
                    </span>
                  ) : (
                    <span className="text-2xl font-display font-black text-white">
                      ${plan.price}<span className="text-sm text-muted-foreground font-mono">/{plan.period}</span>
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1 mb-4">
                  {plan.features.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3" style={{ color: plan.color }} />
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                  {plan.features.length > 4 && (
                    <span className="text-xs text-muted-foreground/50 font-mono">
                      +{plan.features.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Link
            href="/subscription"
            data-testid="link-view-plans"
            className="inline-flex items-center gap-2 text-primary font-mono text-sm uppercase tracking-wider hover:text-primary/80 transition-colors"
          >
            View All Plans & Features <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      </div>
    </>
  );
}