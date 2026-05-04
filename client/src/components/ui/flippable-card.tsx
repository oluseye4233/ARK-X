import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlippableCardProps {
  /** Front face content. Caller owns its interactivity (button/link/div). */
  front: ReactNode;
  /** Back face content. Rendered when the card is flipped. */
  back: ReactNode;
  /** Tailwind/utility classes for the OUTER perspective wrapper (sizing, grid placement). */
  className?: string;
  /**
   * Tailwind/utility classes for the FRONT face wrapper. Used to style the
   * border/background/rounded-corners of the card itself (e.g. `glass-card rounded-xl`).
   * Both faces share this so they look identical when at rest.
   */
  faceClassName?: string;
  /** Override the back-face wrapper styling (defaults to faceClassName). */
  backFaceClassName?: string;
  /** Min height. Both faces use absolute positioning, so a min-height is required. */
  minHeight?: string;
  /** ARIA label for the front-face flip toggle. */
  flipLabel?: string;
  /** ARIA label for the back-face unflip toggle. */
  unflipLabel?: string;
  /** Test id stem; rendered as data-testid="ccard-{testId}" on the wrapper. */
  testId?: string;
  /** Disable the flip toggle entirely (e.g. when there's nothing to reveal). */
  disabled?: boolean;
}

/**
 * Reusable 3D-flip card primitive. Renders two stacked faces inside a
 * perspective container; an eye-icon button in the top-right corner toggles
 * between them. The caller provides the front and back content along with
 * any interactivity (links, action buttons, etc.) — this component only
 * owns the flip plumbing.
 *
 * The eye toggle is rendered as a SIBLING of the face content (not nested
 * inside any caller-provided button/link), so it never produces a nested-
 * interactive accessibility violation.
 *
 * Tailwind utilities used: `perspective-1200`, `preserve-3d`,
 * `backface-hidden`, `rotate-y-180` (defined in client/src/index.css).
 */
export function FlippableCard({
  front,
  back,
  className,
  faceClassName,
  backFaceClassName,
  minHeight = "240px",
  flipLabel = "Reveal details",
  unflipLabel = "Hide details",
  testId,
  disabled = false,
}: FlippableCardProps) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);

  return (
    <div
      className={cn("perspective-1200 relative", className)}
      style={{ minHeight }}
      data-testid={testId ? `ccard-${testId}` : undefined}
      data-flipped={flipped ? "true" : "false"}
    >
      <div
        className={cn(
          "relative w-full h-full preserve-3d transition-transform duration-500 ease-out",
          flipped && "rotate-y-180",
        )}
        style={{ minHeight }}
      >
        {/* Front face — inert + aria-hidden when flipped, so the back-face
            controls below can't be tabbed/clicked while invisible. */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden overflow-hidden",
            faceClassName,
          )}
          // React 19 accepts `inert` as a boolean prop; it removes all
          // descendants from the keyboard tab order and the a11y tree.
          inert={flipped}
          aria-hidden={flipped}
        >
          {front}
          {!disabled && (
            <button
              type="button"
              onClick={toggle}
              aria-label={flipLabel}
              data-testid={testId ? `button-flip-${testId}` : undefined}
              className={cn(
                "absolute top-3 right-3 z-10 rounded p-1 border border-current/30 bg-black/30 text-current",
                "hover:bg-black/50 hover:border-current/60 transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              )}
            >
              <Eye className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Back face — inert + aria-hidden when NOT flipped. */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden rotate-y-180 overflow-hidden",
            backFaceClassName ?? faceClassName,
          )}
          inert={!flipped}
          aria-hidden={!flipped}
        >
          {back}
          <button
            type="button"
            onClick={toggle}
            aria-label={unflipLabel}
            data-testid={testId ? `button-unflip-${testId}` : undefined}
            className={cn(
              "absolute top-3 right-3 z-10 rounded p-1 border border-primary/40 bg-primary/10 text-primary",
              "hover:bg-primary/20 hover:border-primary/70 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            )}
          >
            <EyeOff className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
