// ATANDA Command Centre — external link surface.
// Redefined from the former Bonsai Onboarding page: this is now a gateway that
// links subscribers to the ATANDA Command Centre (a separate, API-linked project
// with its own dashboard features). The target project is not yet hosted, so the
// launch action is a PLACEHOLDER until the deployment URL is wired in.
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  Radar,
  LayoutDashboard,
  Plug,
  RefreshCw,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import commandCentreBg from "@assets/1_1780428420784.mp4";

// When the ATANDA Command Centre project is hosted, set this to its URL (or wire
// it to an API-provided endpoint). Empty string = not yet connected → placeholder.
const ATANDA_COMMAND_CENTRE_URL = "";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Unified Dashboard",
    body: "Your full ATANDA control surface — metrics, pipelines, and live ARK telemetry in one place.",
  },
  {
    icon: Plug,
    title: "API-Linked",
    body: "Subscriber identity and assessment data flow through securely over the ATANDA API bridge.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Sync",
    body: "Changes in ARK reflect in the Command Centre and back — no manual import, no drift.",
  },
];

export function CommandCentrePage() {
  const { user } = useAuth();
  const isConnected = ATANDA_COMMAND_CENTRE_URL.trim().length > 0;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          Log in to access the ATANDA Command Centre.
        </p>
        <Link
          href="/login"
          className="text-primary hover:underline font-mono text-xs uppercase mt-4 inline-block"
          data-testid="link-command-centre-login"
        >
          Go to login →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" data-testid="page-command-centre">
      <Link
        href="/marketplace"
        className="font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-primary inline-flex items-center gap-2"
        data-testid="link-back-from-command-centre"
      >
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      {/* Hero with looping video background */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
        data-testid="command-centre-hero"
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={commandCentreBg}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          data-testid="video-command-centre-bg"
        />
        {/* Legibility overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        <div className="absolute inset-0 bg-background/30" />

        <div className="relative z-10 flex flex-col items-start justify-end gap-5 p-8 md:p-12 min-h-[60vh]">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary"
            data-testid="badge-external-link"
          >
            <Radar className="h-3.5 w-3.5" /> External Link · ATANDA Network
          </span>

          <h1
            className="font-display text-4xl md:text-6xl font-bold uppercase tracking-widest text-white neon-text leading-[1.05]"
            data-testid="text-command-centre-title"
          >
            ATANDA<br />Command Centre
          </h1>

          <p className="max-w-2xl font-mono text-sm md:text-base text-white/85 leading-relaxed">
            Your gateway to the ATANDA Command Centre — a dedicated control hub that links your
            subscriber profile across the ATANDA network via API, surfacing the full dashboard suite
            beyond the ARK platform.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isConnected ? (
              <a
                href={ATANDA_COMMAND_CENTRE_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="button-launch-command-centre"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-mono text-xs uppercase tracking-wider text-background font-bold hover:bg-primary/90 transition-all shadow-[0_0_24px_rgba(34,211,238,0.45)]"
              >
                Launch Command Centre <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                data-testid="button-launch-command-centre"
                className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3 font-mono text-xs uppercase tracking-wider text-primary/70 cursor-not-allowed"
              >
                <Loader2 className="h-4 w-4 animate-spin" /> Launching soon
              </button>
            )}

            <span
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-300"
              data-testid="status-command-centre"
            >
              {isConnected ? "Connected" : "Placeholder · Awaiting Deployment"}
            </span>
          </div>

          {!isConnected && (
            <p
              className="font-mono text-[11px] text-white/60 max-w-xl"
              data-testid="text-command-centre-note"
            >
              The ATANDA Command Centre project is not yet hosted. This link will activate
              automatically once the project is deployed and its API endpoint is connected.
            </p>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="glass-card rounded-xl border border-white/10 p-5 space-y-3"
            data-testid={`card-command-centre-feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <f.icon className="h-6 w-6 text-secondary" />
            <h3 className="font-display text-base uppercase tracking-wider text-white">
              {f.title}
            </h3>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>

      {/* Trust strip */}
      <div className="glass-card rounded-xl border border-white/10 p-4 flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-secondary shrink-0" />
        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
          You will be linked to the ATANDA Command Centre over a secure API bridge. Your ARK
          credentials are never exposed to the browser — identity is exchanged server-side.
        </p>
      </div>
    </div>
  );
}

export default CommandCentrePage;
