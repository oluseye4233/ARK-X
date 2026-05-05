import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Link as LinkIcon, Loader2, Layers, Award, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { FlippableCard } from "@/components/ui/flippable-card";

// Map CODEC categories to a short narrative shown on the back face. Keeps
// the dashboard card grounded in the JUNGLENOMICS CODEC taxonomy without
// requiring the back-end to ship extra metadata.
const CATEGORY_BLURB: Record<string, string> = {
  Animal: "Cognate Tribe primitive — defines the enterprise mindset DNA.",
  Relational: "Corporate Values primitive — anchors belief, vision and culture.",
  People: "Business Ecosystem primitive — defines tribe, allies and customers.",
  Give: "Business Systems primitive — what the enterprise produces and how.",
  Get: "Marketplace primitive — how value returns from the market.",
  Innovation: "Multiplier primitive — activates when paired with two or more identical cards.",
};

interface SkillMappings {
  onet: string[];
  sfia: string[];
  wef: string[];
}

interface JnomicsCard {
  id: string;
  name: string;
  tier: string;          // CODEC category (Animal / Relational / People / ...)
  type: string;          // Persona label
  emoji: string;
  description: string;
  basePts: number;
  // Enriched server-side from shared/codec-primitives.ts
  persona?: string;
  category?: string;
  multiplier?: string;
  insight?: string;
  mappings?: SkillMappings;
}

interface JnomicsCardListProps {
  matchedCardIds: string[];
}

export function JnomicsCardList({ matchedCardIds }: JnomicsCardListProps) {
  const [cards, setCards] = useState<JnomicsCard[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const fetchCards = async () => {
      setIsSyncing(true);
      try {
        const data = await api.getJnomicsCardsByIds(matchedCardIds);
        setCards(data);
      } catch {
        setCards([]);
      } finally {
        setIsSyncing(false);
      }
    };

    if (matchedCardIds.length > 0) {
      fetchCards();
    } else {
      setIsSyncing(false);
    }
  }, [matchedCardIds]);

  return (
    <div className="glass-card p-6 rounded-xl border-secondary/20" data-testid="jnomics-card-list">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="font-display font-bold text-lg text-secondary uppercase tracking-widest flex items-center gap-2">
            <Database className="w-5 h-5" />
            Junglenomics CODEC Primitives
          </h3>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Skills mapped to global standards · O*NET · SFIA v8 · WEF Future of Jobs
          </p>
        </div>

        <div className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono uppercase tracking-widest",
          isSyncing
            ? "border-amber-500/50 bg-amber-500/10 text-amber-500"
            : "border-secondary/50 bg-secondary/10 text-secondary"
        )}>
          {isSyncing ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</>
          ) : (
            <><LinkIcon className="w-3 h-3" /> {cards.length} matched</>
          )}
        </div>
      </div>

      {isSyncing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-lg border border-white/5 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
            >
              <FlippableCard
                testId={`jnomics-${card.id}`}
                minHeight="220px"
                flipLabel={`Reveal skill standard mapping for ${card.name}`}
                unflipLabel={`Hide skill standard mapping for ${card.name}`}
                faceClassName="p-4 rounded-lg border border-secondary/30 bg-background/50 hover:bg-white/5 transition-all hover:border-secondary/70 group"
                backFaceClassName="p-4 rounded-lg border border-secondary/50 bg-secondary/5"
                drm={{ contentId: card.id, contentType: "jnomics-card" }}
                front={
                  <div className="flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-start mb-2 pr-9">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl" role="img" aria-label={card.type}>{card.emoji}</span>
                        <div>
                          <h4 className="font-display font-bold text-white text-sm group-hover:text-secondary transition-colors" data-testid={`text-primitive-name-${card.id}`}>{card.name}</h4>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
                            {card.tier} · CODEC
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-display font-bold text-secondary">{card.basePts}</span>
                        <span className="text-[10px] font-mono text-muted-foreground block -mt-1">BASE PTS</span>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono uppercase text-secondary/80 tracking-widest">
                      {card.persona ?? card.type}
                    </div>
                    <div className="mt-1 text-xs font-sans text-white/80 border-t border-white/10 pt-2 flex-1">
                      {card.description}
                    </div>
                    {card.multiplier && (
                      <div className="text-[10px] font-mono text-secondary/70 pt-1 border-t border-white/5">
                        Multiplier · {card.multiplier}
                      </div>
                    )}
                  </div>
                }
                back={
                  <div className="flex flex-col gap-2 h-full pr-9 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-3.5 w-3.5 text-secondary" />
                      <div className="text-[10px] font-mono uppercase tracking-widest text-secondary">
                        Global Skill Standard Mapping
                      </div>
                    </div>
                    <div className="font-display font-bold text-white text-sm leading-tight">{card.name}</div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
                      {card.tier} · {card.persona ?? card.type}
                    </div>

                    {card.mappings ? (
                      <div className="flex flex-col gap-1.5 mt-1 text-[11px] font-sans flex-1 min-h-0 overflow-y-auto">
                        <MappingRow label="O*NET" tone="text-blue-300" items={card.mappings.onet} testId={`mapping-onet-${card.id}`} />
                        <MappingRow label="SFIA" tone="text-emerald-300" items={card.mappings.sfia} testId={`mapping-sfia-${card.id}`} />
                        <MappingRow label="WEF" tone="text-amber-300" items={card.mappings.wef} testId={`mapping-wef-${card.id}`} />
                      </div>
                    ) : (
                      <p className="text-xs font-sans text-white/80 leading-relaxed flex-1">
                        {CATEGORY_BLURB[card.tier] ?? "CODEC primitive."}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-secondary/20">
                      <span className="flex items-center gap-1 text-secondary">
                        <Award className="h-3 w-3" /> {card.basePts} pts
                      </span>
                      <span className="text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {card.id.replace(/^codec-/, "").slice(0, 14)}
                      </span>
                    </div>
                  </div>
                }
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function MappingRow({ label, tone, items, testId }: { label: string; tone: string; items: string[]; testId: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex items-start gap-2" data-testid={testId}>
      <span className={cn("font-mono text-[10px] uppercase tracking-widest pt-0.5 shrink-0 w-12", tone)}>{label}</span>
      <span className="text-white/85 leading-snug">{items.join(" · ")}</span>
    </div>
  );
}
