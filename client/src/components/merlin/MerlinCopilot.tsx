import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Compass, X } from "lucide-react";
import { useMerlin } from "@/lib/useMerlin";

export function MerlinCopilot() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { guidance, isAuthenticated, isLoading, isError } = useMerlin();
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  if (!isAuthenticated) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="button-open-merlin" aria-haspopup="dialog" aria-expanded={open}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 border border-primary/60 bg-background/95 px-4 py-3 text-primary shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
        <span className="relative flex h-8 w-8 items-center justify-center border border-primary/50 bg-primary/10"><Compass className="h-4 w-4" /><i className="absolute -right-1 -top-1 h-2 w-2 bg-secondary" /></span>
        <span className="font-mono text-xs font-bold uppercase tracking-[.18em]">Merlin</span>
      </button>
      {open && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={() => setOpen(false)}>
        <aside role="dialog" aria-modal="true" aria-labelledby="merlin-copilot-title" className="merlin-panel merlin-grid h-full w-full max-w-md overflow-y-auto border-l border-primary/30 bg-background p-5 sm:p-7" onMouseDown={event => event.stopPropagation()}>
          <div className="mb-8 flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.28em] text-secondary">Completion assurance guide</p><h2 id="merlin-copilot-title" className="mt-1 text-2xl font-bold text-foreground">MERLIN</h2></div><button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close MERLIN" className="p-2 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button></div>
          {isLoading && <div className="space-y-3" data-testid="merlin-loading"><div className="h-24 animate-pulse bg-muted" /><div className="h-36 animate-pulse bg-muted" /></div>}
          {isError && <p className="border border-destructive/40 p-4 text-sm text-destructive">MERLIN could not read your progress right now. Open the guide to try again.</p>}
          {guidance && <div className="merlin-rise space-y-5">
            <section className="border border-primary/30 bg-card/80 p-5"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Where you are</p><p className="mt-2 text-lg font-semibold">{guidance.position}</p><div className="mt-4 h-1.5 bg-muted"><div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${guidance.progress}%` }} /></div><p className="mt-2 font-mono text-xs text-primary">{guidance.earnedBadges}/{guidance.totalBadges} book badges · {guidance.progress}%</p></section>
            <section className="border-l-2 border-secondary bg-secondary/5 p-5"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-secondary">Where you could go</p><p className="mt-2 font-semibold">{guidance.destination}</p><p className="mt-1 text-sm text-muted-foreground">{guidance.certification}{guidance.bestTier ? ` · best CCGE outcome: ${guidance.bestTier}` : ""}</p></section>
            <section className="border border-primary/40 p-5"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">What to do next</p><h3 className="mt-2 text-xl font-bold">{guidance.nextAction.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guidance.nextAction.detail}</p><Link href={guidance.nextAction.href} onClick={() => setOpen(false)} className="mt-5 inline-flex items-center gap-2 bg-primary px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-primary-foreground">{guidance.nextAction.label}<ArrowUpRight className="h-4 w-4" /></Link></section>
            <Link href="/merlin" onClick={() => setOpen(false)} data-testid="link-merlin-guide" className="flex items-center justify-between border-t border-border pt-5 font-mono text-xs uppercase tracking-widest text-primary">Open full guide <ArrowUpRight className="h-4 w-4" /></Link>
          </div>}
        </aside>
      </div>}
    </>
  );
}