import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { JNOMICS_DECK } from "@/lib/mockData";
import { Database, Link as LinkIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface JnomicsCardListProps {
  matchedCardIds: string[];
}

export function JnomicsCardList({ matchedCardIds }: JnomicsCardListProps) {
  const [cards, setCards] = useState<typeof JNOMICS_DECK>([]);
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    // Simulate API fetch to Jnomicsdeck ALPHA database
    const fetchCards = async () => {
      setIsSyncing(true);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate network latency
      
      const userCards = JNOMICS_DECK.filter((card) => 
        matchedCardIds.includes(card.id)
      );
      
      setCards(userCards);
      setIsSyncing(false);
    };

    fetchCards();
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
              className="p-4 rounded-lg border border-secondary/30 bg-background/50 hover:bg-white/5 transition-all hover:border-secondary/70 group"
            >
              <div className="flex justify-between items-start mb-2">
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
              
              <div className="mt-3 text-xs font-sans text-muted-foreground border-t border-white/10 pt-2">
                <span className="text-white/70 font-medium">{card.type}:</span> {card.description}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}