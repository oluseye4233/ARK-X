import { useState } from "react";
import { Award, Coins, Eye, EyeOff, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface FrontFaceContentProps {
  card: CcgeCardData;
  variant: "hand" | "played" | "static";
  index?: number;
  typeClass: string;
}

function FrontFaceContent({ card, variant, index, typeClass }: FrontFaceContentProps) {
  return (
    <>
      <div className="flex justify-between items-start pr-9">
        <div className="flex items-center gap-2">
          <div className="text-3xl leading-none" aria-hidden>
            {card.emoji}
          </div>
          {variant === "played" && typeof index === "number" && (
            <span className="text-xs font-mono opacity-70 px-1.5 py-0.5 rounded bg-black/20">
              #{index}
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("text-[9px] font-mono uppercase", typeClass)}
        >
          {card.type}
        </Badge>
      </div>

      <div>
        <div className="font-display font-bold text-sm leading-tight">
          {card.name}
        </div>
        <div className="text-[10px] font-mono uppercase opacity-70 mt-0.5">
          {card.pillar}
        </div>
      </div>

      <div className="text-xs leading-snug opacity-90 flex-1">
        {card.description}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-current/20">
        <span className="flex items-center gap-1">
          <Award className="h-3 w-3" /> KCSE {card.baseKcse}
        </span>
        <span className="flex items-center gap-1">
          <Coins className="h-3 w-3" /> {card.tokenCost}t
        </span>
      </div>

      {variant === "played" && (
        <div className="text-[10px] opacity-70">Click to remove</div>
      )}
    </>
  );
}

export interface CcgeCardData {
  id: string;
  name: string;
  pillar: string;
  type: string;
  baseKcse: number;
  tokenCost: number;
  emoji: string;
  description: string;
  body: string;
}

const PILLAR_COLORS: Record<string, string> = {
  System: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  Role: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
  Instruction: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Example: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  Constraint: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  Format: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  Data: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  SuperPrompt:
    "bg-gradient-to-br from-yellow-400/20 to-fuchsia-500/20 text-yellow-200 border-yellow-400/50",
};

const TYPE_BADGE: Record<string, string> = {
  Standard: "bg-slate-500/15 text-slate-300 border-slate-500/40",
  Premium: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  Ultra: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
  SuperPrompt: "bg-yellow-400/20 text-yellow-200 border-yellow-400/50",
};

// Map the engine's 8 pillars onto the four KCSE context types from the
// Context Craft KCSE Rankings v4 whitepaper (Series 03 · ATANDA Library).
// Each ATANDA "context type" maps to one or more in-game pillars.
const KCSE_CONTEXT_TYPE: Record<string, string> = {
  System: "Role",
  Role: "Role",
  Instruction: "Task",
  Example: "Knowledge",
  Data: "Knowledge",
  Constraint: "Evaluation",
  Format: "Evaluation",
  SuperPrompt: "Composite",
};

const KCSE_CONTEXT_BLURB: Record<string, string> = {
  Role: "Defines who the AI is — anchors persona and authority.",
  Task: "Defines what the AI must do — clarifies the goal and steps.",
  Knowledge: "Defines what the AI knows — supplies grounding context.",
  Evaluation: "Defines how quality is measured — gates the output.",
  Composite: "Bundles all four KCSE context types into one play.",
};

interface CcgeCardProps {
  card: CcgeCardData;
  /**
   * Variant changes the front-face footer affordances:
   *  - `hand`    → "Click card body to play, eye-icon to flip"
   *  - `played`  → shows order index + "click to remove" hint
   *  - `static`  → no interactions; flip-only (e.g. inventory previews)
   */
  variant?: "hand" | "played" | "static";
  /** Index in the played stack (1-based label). Only used for variant=played. */
  index?: number;
  /** Disabled hand cards (already played, or hand at 5) render dimmed/inert. */
  disabled?: boolean;
  /** Hand variant: invoked when the user clicks the play surface. */
  onPlay?: () => void;
  /** Played variant: invoked when the user clicks to remove. */
  onRemove?: () => void;
}

export function CcgeCard({
  card,
  variant = "hand",
  index,
  disabled = false,
  onPlay,
  onRemove,
}: CcgeCardProps) {
  const [flipped, setFlipped] = useState(false);

  const pillarClass = PILLAR_COLORS[card.pillar] ?? PILLAR_COLORS.System;
  const typeClass = TYPE_BADGE[card.type] ?? TYPE_BADGE.Standard;
  const contextType = KCSE_CONTEXT_TYPE[card.pillar] ?? "Role";
  const contextBlurb =
    KCSE_CONTEXT_BLURB[contextType] ?? KCSE_CONTEXT_BLURB.Role;

  const toggleFlip = () => setFlipped((f) => !f);

  const handleAction = () => {
    if (disabled) return;
    if (variant === "hand") onPlay?.();
    else if (variant === "played") onRemove?.();
  };

  // Played-stack cards are smaller (compact); hand cards are full size.
  const sizeClass =
    variant === "played" ? "min-h-[180px]" : "min-h-[260px]";

  const isInteractive = variant !== "static";
  const actionLabel =
    variant === "hand"
      ? `Play ${card.name}`
      : variant === "played"
        ? `Remove ${card.name} from played stack`
        : card.name;

  return (
    <div
      className={cn(
        "perspective-1200 group relative",
        sizeClass,
      )}
      data-testid={`ccge-card-${card.id}`}
      data-flipped={flipped ? "true" : "false"}
    >
      <div
        className={cn(
          "relative w-full h-full preserve-3d transition-transform duration-500 ease-out",
          flipped && "rotate-y-180",
        )}
        style={{ minHeight: "inherit" }}
      >
        {/* ───── FRONT FACE ─────
            Two SIBLING interactive elements (no nesting):
            - a full-bleed action button (play/remove) renders the visual card
            - the eye-toggle button is absolutely positioned above it
            Disabled state only blocks the action button; the eye toggle
            remains enabled so users can always inspect the underlying prompt. */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden rounded-lg border overflow-hidden",
            pillarClass,
            disabled && "opacity-50",
          )}
        >
          {isInteractive ? (
            <button
              type="button"
              onClick={handleAction}
              disabled={disabled}
              aria-label={actionLabel}
              data-testid={`card-${variant}-${card.id}`}
              className={cn(
                "absolute inset-0 w-full h-full text-left p-4 flex flex-col gap-2 transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
                !disabled && "cursor-pointer hover:scale-[1.03] hover:shadow-lg",
                disabled && "cursor-not-allowed",
              )}
            >
              <FrontFaceContent
                card={card}
                variant={variant}
                index={index}
                typeClass={typeClass}
              />
            </button>
          ) : (
            <div className="absolute inset-0 w-full h-full p-4 flex flex-col gap-2">
              <FrontFaceContent
                card={card}
                variant={variant}
                index={index}
                typeClass={typeClass}
              />
            </div>
          )}

          {/* Eye toggle — sibling, absolutely positioned above the action
              button. Always enabled so users can inspect locked cards. */}
          <button
            type="button"
            onClick={toggleFlip}
            aria-label={`Reveal prompt for ${card.name}`}
            data-testid={`button-flip-${card.id}`}
            className={cn(
              "absolute top-3 right-3 z-10 rounded p-1 border border-current/30 bg-black/20 hover:bg-black/40 hover:border-current/60 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            )}
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>

        {/* ───── BACK FACE — actual prompt body ───── */}
        <div
          className={cn(
            "absolute inset-0 backface-hidden rotate-y-180 rounded-lg border p-4 flex flex-col gap-2 text-left",
            "bg-background/95 border-primary/40 shadow-[0_0_20px_rgba(34,211,238,0.15)]",
          )}
          data-testid={`card-${variant}-${card.id}-back`}
        >
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[9px] font-mono uppercase tracking-widest text-primary/80">
                  Prompt body
                </div>
                <div className="font-display font-bold text-sm text-foreground truncate">
                  {card.name}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleFlip}
              aria-label={`Hide prompt for ${card.name}`}
              data-testid={`button-unflip-${card.id}`}
              className="rounded p-1 border border-primary/30 text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors flex-shrink-0"
            >
              <EyeOff className="h-3 w-3" />
            </button>
          </div>

          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <span className="text-primary/70">{contextType}</span>
            <span className="opacity-50">·</span>
            <span className="opacity-70">{contextBlurb}</span>
          </div>

          <pre className="flex-1 text-[11px] leading-relaxed text-foreground/90 font-mono whitespace-pre-wrap overflow-y-auto p-2.5 rounded bg-black/30 border border-primary/10 scrollbar-thin">
{card.body}
          </pre>

          <div className="flex items-center justify-between text-[9px] font-mono pt-1 border-t border-primary/10 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5 text-primary/70" />
              KCSE base {card.baseKcse} · {card.tokenCost}t
            </span>
            {variant === "hand" && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFlipped(false);
                  onPlay?.();
                }}
                data-testid={`button-play-from-back-${card.id}`}
                className="px-2 py-1 rounded bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25 transition-colors uppercase tracking-wider"
              >
                Play card
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
