import { useEffect, useRef, useState, type ReactNode } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/utils";

export interface DrmBoundaryProps {
  /** Protected content. */
  children: ReactNode;
  /** Logical identifier for the asset (e.g. "jnomics:card-001"). */
  contentId: string;
  /** Asset class — used for telemetry buckets. */
  contentType: "jnomics-card" | "ark-identity" | "spc-listing" | "pivot" | "scenario" | "other";
  /** Hide the visible "DRM Protected" badge. Telemetry + blocks remain. */
  hideBadge?: boolean;
  /** Hide the diagonal user-id watermark overlay. Use for tiny chips/cards. */
  hideWatermark?: boolean;
  /** Outer wrapper classes (positioning, sizing). */
  className?: string;
  /** data-testid for the wrapper. */
  testId?: string;
}

// Best-effort browser DRM. The web platform cannot truly stop a determined
// screenshotter, but we can frustrate the casual copy/paste path:
//   • disable text selection (CSS user-select:none + ::selection transparent)
//   • block copy / cut / paste / dragstart / contextmenu DOM events
//   • block Ctrl/Cmd+C, +X, +S, +P, +A keyboard shortcuts on this subtree
//   • render an obfuscating user-id watermark over the content
//   • blur the protected content while the tab is hidden (defeats easy
//     screen-recording snapshots taken from another window)
//   • fire-and-forget telemetry to /api/drm/event so we can audit attempts
//
// Anything that needs to be selectable (inputs, links the user must follow)
// should opt OUT by setting `data-drm-allow-select="true"` on the element.
async function reportDrmEvent(payload: {
  contentId: string;
  contentType: string;
  action: string;
}): Promise<void> {
  try {
    // sendBeacon survives page unload / context menus better than fetch.
    const body = new Blob(
      [JSON.stringify({ ...payload, ts: Date.now() })],
      { type: "application/json" },
    );
    if (navigator.sendBeacon?.("/api/drm/event", body)) return;
    void fetch("/api/drm/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ts: Date.now() }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow — DRM telemetry is best-effort */
  }
}

export function DrmBoundary({
  children,
  contentId,
  contentType,
  hideBadge = false,
  hideWatermark = false,
  className,
  testId,
}: DrmBoundaryProps) {
  const { user } = useAuth();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tabHidden, setTabHidden] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [violationFlash, setViolationFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const note = (action: string) => {
    setViolationCount((n) => n + 1);
    setViolationFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setViolationFlash(false), 1400);
    void reportDrmEvent({ contentId, contentType, action });
  };

  // Block copy/cut/paste/dragstart/contextmenu inside this subtree.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const allowedTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      return !!target.closest('[data-drm-allow-select="true"]');
    };

    const block = (action: string) => (e: Event) => {
      if (allowedTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      note(action);
    };

    const onCopy = block("copy");
    const onCut = block("cut");
    const onPaste = block("paste");
    const onDrag = block("dragstart");
    const onContext = block("contextmenu");

    const onSelectStart = (e: Event) => {
      if (allowedTarget(e.target)) return;
      e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (allowedTarget(e.target)) return;
      const meta = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      // Block clipboard / save / print / select-all combos. Leave scrolling
      // and tab/escape alone so keyboard nav still works inside the card.
      if (meta && ["c", "x", "a", "s", "p"].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        note(`hotkey:${meta ? "mod+" : ""}${k}`);
        return;
      }
      if (e.key === "PrintScreen") {
        // Browsers can't actually intercept PrintScreen reliably, but logging
        // the keypress lets us flag suspicious sessions.
        note("printscreen");
      }
    };

    el.addEventListener("copy", onCopy);
    el.addEventListener("cut", onCut);
    el.addEventListener("paste", onPaste);
    el.addEventListener("dragstart", onDrag);
    el.addEventListener("contextmenu", onContext);
    el.addEventListener("selectstart", onSelectStart);
    el.addEventListener("keydown", onKey, true);

    return () => {
      el.removeEventListener("copy", onCopy);
      el.removeEventListener("cut", onCut);
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("dragstart", onDrag);
      el.removeEventListener("contextmenu", onContext);
      el.removeEventListener("selectstart", onSelectStart);
      el.removeEventListener("keydown", onKey, true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, contentType]);

  // Blur the protected region whenever the tab is backgrounded. Defeats the
  // common "alt-tab + screenshot of the prior window" path.
  useEffect(() => {
    const onVis = () => setTabHidden(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Watermark text — short user identifier so a screenshot is traceable to
  // the leaking account. Falls back to "ARK" for unauthenticated views.
  const watermark = user
    ? `ARK · ${(user.username || user.id).slice(0, 24)} · ${contentId}`
    : `ARK · PROTECTED · ${contentId}`;

  return (
    <div
      ref={wrapperRef}
      data-testid={testId ?? `drm-${contentType}-${contentId}`}
      data-drm-protected="true"
      data-drm-violations={violationCount}
      className={cn(
        "drm-protected relative isolate select-none",
        // Tailwind cannot toggle ::selection — see global rule in index.css.
        className,
      )}
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}

      {/* Diagonal repeating watermark overlay. pointer-events:none so it
          never interferes with the underlying interactive UI (links, flip
          toggles). Low opacity makes it unobtrusive but visible in any
          screenshot. */}
      {!hideWatermark && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-[5] opacity-[0.07] mix-blend-overlay"
          style={{
            backgroundImage: `repeating-linear-gradient(-30deg, transparent 0 60px, rgba(255,255,255,0.4) 60px 61px)`,
          }}
        >
          <div
            className="absolute inset-0 flex flex-wrap content-around justify-around gap-y-8 px-2 py-2 font-mono text-[10px] uppercase tracking-widest text-white/80"
            style={{ transform: "rotate(-22deg) scale(1.4)", transformOrigin: "center" }}
          >
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="whitespace-nowrap">
                {watermark}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Visible badge — communicates "this content is protected" to the
          user. Keeps the platform honest about the DRM contract. */}
      {!hideBadge && (
        <div
          className={cn(
            "pointer-events-none absolute bottom-2 left-2 z-[6] flex items-center gap-1 rounded border px-1.5 py-0.5 transition-colors",
            violationFlash
              ? "border-rose-400/70 bg-rose-500/20 text-rose-200"
              : "border-white/10 bg-black/40 text-white/50",
          )}
          data-testid={`badge-drm-${contentType}-${contentId}`}
          aria-label={violationFlash ? "DRM block triggered" : "Content is DRM protected"}
        >
          {violationFlash ? (
            <ShieldAlert className="h-3 w-3" />
          ) : (
            <ShieldCheck className="h-3 w-3" />
          )}
          <span className="font-mono text-[9px] uppercase tracking-widest">
            {violationFlash ? "Blocked" : "DRM"}
          </span>
        </div>
      )}

      {/* Tab-hidden blur overlay. Sits above the content so a quick alt-tab
          screenshot captures only the obfuscation message. */}
      {tabHidden && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[7] flex items-center justify-center rounded-[inherit] bg-black/85 backdrop-blur-md"
          data-testid="overlay-drm-tab-hidden"
        >
          <div className="text-center">
            <ShieldCheck className="h-6 w-6 mx-auto text-white/40" />
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/40">
              Protected · Return Tab
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
