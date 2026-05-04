import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Link as LinkIcon, Loader2, Layers, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { FlippableCard } from "@/components/ui/flippable-card";

// Map Junglenomics tiers to a short FORGE-Library narrative shown on the
// back face. Keeps the dashboard card grounded in the JNOMICSDECK ALPHA
// taxonomy without requiring the back-end to ship extra metadata.
const TIER_BLURB: Record<string, string> = {
  Foundation: "Entry-level pattern. Anchors the FORGE Library baseline.",
  Capable: "Mid-band skillset. Drives day-to-day FORGE workflows.",
  Strong: "High-leverage skillset. Multiplies adjacent capabilities.",
  Exceptional: "Rare, force-multiplying capability tracked at portfolio level.",
  Legendary: "Apex pattern. Reserved for the top of the FORGE registry.",
};

interface JnomicsCard {
  id: string;
  name: string;
  tier: string;
  type: string;
  emoji: string;
  description: string;
  basePts: number;
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
            Junglenomics Card Mapping
          </h3>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Skillsets mapped to FORGE Library via JNOMICSDECK ALPHA API
          </p>
        </div>

        <div className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono uppercase tracking-widest",
          isSyncing 
            ? "border-amber-500/50 bg-amber-500/10 text-amber-500" 
            : "border-secondary/50 bg-secondary/10 text-secondary"
        )}>
          {isSyncing ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Syncing API...</>
          ) : (
            <><LinkIcon className="w-3 h-3" /> Connected</>
          )}
        </div>
      </div>

      {isSyncing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-lg border border-white/5 bg-white/5 animate-pulse" />
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
                minHeight="170px"
                flipLabel={`Reveal FORGE mapping for ${card.name}`}
                unflipLabel={`Hide FORGE mapping for ${card.name}`}
                faceClassName="p-4 rounded-lg border border-secondary/30 bg-background/50 hover:bg-white/5 transition-all hover:border-secondary/70 group"
                backFaceClassName="p-4 rounded-lg border border-secondary/50 bg-secondary/5"
                front={
                  <div className="flex flex-col gap-2 h-full">
                    <div className="flex justify-between items-start mb-2 pr-9">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl" role="img" aria-label={card.type}>{card.emoji}</span>
                        <div>
                          <h4 className="font-display font-bold text-white text-sm group-hover:text-secondary transition-colors">{card.name}</h4>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">{card.tier}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-display font-bold text-secondary">{card.basePts}</span>
                        <span className="text-[10px] font-mono text-muted-foreground block -mt-1">BASE PTS</span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-sans text-muted-foreground border-t border-white/10 pt-2">
                      <span className="text-white/70 font-medium">{card.type}:</span> {card.description}
                    </div>
                  </div>
                }
                back={
                  <div className="flex flex-col gap-2 h-full pr-9">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-secondary" />
                      <div className="text-[10px] font-mono uppercase tracking-widest text-secondary">
                        FORGE Library Mapping
                      </div>
                    </div>
                    <div className="font-display font-bold text-white text-sm leading-tight">{card.name}</div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
                      {card.tier} · {card.type}
                    </div>
                    <p className="text-xs font-sans text-white/80 leading-relaxed flex-1">
                      {TIER_BLURB[card.tier] ?? "Mapped to the FORGE Library via JNOMICSDECK ALPHA."}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-secondary/20">
                      <span className="flex items-center gap-1 text-secondary">
                        <Award className="h-3 w-3" /> Base {card.basePts} pts
                      </span>
                      <span className="text-muted-foreground uppercase tracking-widest">
                        ID · {card.id.slice(0, 10)}
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