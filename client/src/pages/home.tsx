import { Link } from "wouter";
import { ArrowRight, ShieldAlert, Target, Zap, Crown, GraduationCap, User, Building2, Check, Upload, BarChart3, Compass } from "lucide-react";
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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          System Initialization Complete
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 tracking-tight">
          KNOW YOUR <span className="text-primary neon-text">WORTH.</span><br />
          KNOW YOUR <span className="text-destructive">RISK.</span><br />
          KNOW YOUR <span className="text-secondary">NEXT MOVE.</span>
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

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link href="/upload" data-testid="button-start-assessment" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider rounded-none neon-border h-14 px-8 transition-all hover:scale-[1.02] text-sm font-medium">
            Initialize Analysis <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <Link href="/login" data-testid="button-view-demo" className="inline-flex items-center justify-center font-mono uppercase tracking-wider rounded-none border border-primary/50 text-primary hover:bg-primary/10 h-14 px-8 transition-all hover:scale-[1.02] text-sm font-medium">
            Enterprise Login
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