import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Download, Upload, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES } from "@shared/featureFlags";

const atandaMark = new URL("../../../../attached_assets/2_1789324456918.png", import.meta.url).href;

export type JourneyFeatures = Pick<typeof FEATURES, "contextCraftPage" | "trainingProviders" | "arkResume" | "executiveReport" | "bookCompanion">;

export type Stage = {
  id: string;
  label: string;
  href: string;
  routes: string[];
  now: string;
  next?: string;
  nextLabel?: string;
  feature: { label: string; href: string };
};

export function buildJourneyStages(features: JourneyFeatures = FEATURES): Stage[] {
  return [
  { id: "L0", label: "Start", href: "/", routes: ["/", "/login", "/signup"], now: "Orient yourself and enter the ATANDA learning journey.", next: "/upload", nextLabel: "Begin intake", feature: { label: "Open MERLIN guide", href: "/merlin" } },
  { id: "L1", label: "Intake", href: "/upload", routes: ["/upload"], now: "Add the documents and evidence that power your profile.", next: "/assessment", nextLabel: "Continue to assessment", feature: { label: "Review your profile", href: "/profile" } },
  { id: "L2", label: "Assessment", href: "/assessment", routes: ["/assessment"], now: "Turn your evidence into Jobs, Skills and Talent intelligence.", next: "/dashboard", nextLabel: "Open intelligence", feature: { label: "View scoring cockpit", href: "/dashboard" } },
  { id: "L3", label: "Intelligence", href: "/dashboard", routes: ["/dashboard"], now: "Read your current signals and choose the most useful action.", next: "/pathways", nextLabel: "See pathways", feature: { label: "Open ARK history", href: "/ark/history" } },
  { id: "L4", label: "Pathways", href: "/pathways", routes: features.trainingProviders ? ["/pathways", "/training"] : ["/pathways"], now: "Convert your findings into a practical mobility and learning plan.", next: features.contextCraftPage ? "/context-craft" : "/play", nextLabel: "Build context", feature: { label: features.trainingProviders ? "Explore training" : "Practice skills", href: features.trainingProviders ? "/training" : "/play" } },
  { id: "L5", label: "Context", href: features.contextCraftPage ? "/context-craft" : features.bookCompanion ? "/book" : "/play", routes: [...(features.contextCraftPage ? ["/context-craft"] : []), ...(features.bookCompanion ? ["/book"] : []), "/play"], now: "Practice context craft and build verified capability.", next: features.arkResume ? "/ark-resume" : "/profile", nextLabel: "Prepare your proof", feature: { label: features.bookCompanion ? "Open book companion" : "Start skill game", href: features.bookCompanion ? "/book" : "/play" } },
  { id: "L6", label: "Proof", href: features.arkResume ? "/ark-resume" : "/profile", routes: [...(features.arkResume ? ["/ark-resume"] : []), "/confirm"], now: "Package evidence and request independent confirmation.", next: features.executiveReport ? "/report" : "/profile", nextLabel: "Prepare your output", feature: { label: "Manage your identity", href: "/profile" } },
  { id: "L7", label: "Report", href: features.executiveReport ? "/report" : "/profile", routes: [...(features.executiveReport ? ["/report"] : []), "/r"], now: "Review, download and securely share your career intelligence.", next: "/profile", nextLabel: "Open profile", feature: { label: "Review source history", href: "/ark/history" } },
  { id: "L8", label: "Identity", href: "/profile", routes: ["/profile", "/ark/history", "/u"], now: "Maintain your identity, privacy controls and evidence history.", next: "/marketplace", nextLabel: "Explore marketplace", feature: { label: "Open ARK history", href: "/ark/history" } },
  { id: "L9", label: "Exchange", href: "/marketplace", routes: ["/marketplace", "/matchmaking", "/matchmaking/:id", "/matchmaking/:id/candidates"], now: "Publish, discover and exchange verified capability.", next: "/merlin", nextLabel: "Return to MERLIN", feature: { label: "Open Bonsai progress", href: "/marketplace/bonsai" } },
  { id: "L9.5", label: "MERLIN", href: "/merlin", routes: ["/merlin"], now: "Review the completed learning loop and choose your next best action.", next: "/dashboard", nextLabel: "Back to intelligence", feature: { label: "Review ARK history", href: "/ark/history" } },
  ];
}

export function stageFor(location: string, stages: Stage[] = buildJourneyStages()) {
  return stages.findIndex((stage) =>
    stage.routes.some((route) => {
      const dynamicBase = route.split("/:")[0];
      const base = dynamicBase || route;
      return route.includes("/:") ? location === base || location.startsWith(`${base}/`) : route === "/" ? location === "/" : location === route || location.startsWith(`${route}/`);
    })
  );
}

export function JourneyShell({ children, features = FEATURES }: { children: React.ReactNode; features?: JourneyFeatures }) {
  const [location] = useLocation();
  const stages = buildJourneyStages(features);
  const index = stageFor(location, stages);
  const stage = index >= 0 ? stages[index] : null;
  if (!stage) return <>{children}</>;

  const previous = index > 0 ? stages[index - 1] : null;
  const isHome = stage.id === "L0";
  const downloadHref = features.executiveReport ? "/report" : features.arkResume ? "/ark-resume" : "/profile";

  return (
    <div className="journey-shell">
      <nav className="journey-progress" aria-label={`ATOMIC UI journey progress: ${stage.id} ${stage.label}`}>
        <div className="journey-progress-fill" style={{ width: `${((index + 1) / stages.length) * 100}%` }} />
        <div className="journey-stops">
          {stages.map((item, stopIndex) => (
            <Link key={item.id} href={item.href} className={cn("journey-stop", stopIndex <= index && "is-complete", stopIndex === index && "is-current")} title={`${item.id} · ${item.label}`} aria-current={stopIndex === index ? "step" : undefined}>
              <span>{item.id}</span>
            </Link>
          ))}
        </div>
      </nav>

      {!isHome && (
        <header className="journey-header">
          <div className="journey-breadcrumb">
            <img src={atandaMark} alt="" className="h-6 w-14 object-contain object-left" aria-hidden="true" />
            <span className="journey-kicker">ATOMIC UI / cockpit</span>
            <span className="journey-divider">/</span>
            <strong>{stage.id} · {stage.label}</strong>
          </div>
          <div className="journey-actions">
            <Link href="/upload" className="journey-tool" aria-label="Upload document">
              <Upload size={15} /> <span>Upload document</span>
            </Link>
            <Link href={downloadHref} className="journey-tool" aria-label="Download document">
              <Download size={15} /> <span>Download document</span>
            </Link>
          </div>
        </header>
      )}

      <div className="journey-context" aria-label="Current ATOMIC UI stage">
        <div className="journey-context-light" aria-hidden="true" />
        <div className="journey-context-step">
          <span className="journey-context-label">Where you came from</span>
          <strong>{previous ? `${previous.id} · ${previous.label}` : "Your starting point"}</strong>
        </div>
        <div className="journey-context-step is-current">
          <span className="journey-context-label">What you are doing now</span>
          <strong>{stage.id} · {stage.label}</strong>
          <p>{stage.now}</p>
        </div>
        <div className="journey-context-step">
          <span className="journey-context-label">Where you are going next</span>
          <strong>{stage.nextLabel}</strong>
        </div>
      </div>

      <div className="journey-content">{children}</div>

      {!isHome && (
        <footer className="journey-footer">
          {previous ? <Link href={previous.href} className="journey-nav journey-back"><ArrowLeft size={15} /> Back to {previous.label}</Link> : <span />}
          {stage.next && <Link href={stage.next} className="journey-nav journey-next">{stage.nextLabel} <ArrowRight size={15} /></Link>}
          <Link href={stage.feature.href} className="journey-help"><CircleHelp size={14} /> {stage.feature.label}</Link>
        </footer>
      )}
    </div>
  );
}