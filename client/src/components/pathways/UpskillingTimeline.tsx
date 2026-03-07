import { motion } from "framer-motion";
import { Target, Zap, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpskillingItem {
  id: string;
  phase: "30-Day" | "90-Day" | "12-Month";
  title: string;
  description: string;
  type: "new-skilling" | "up-skilling" | "ready-skilling";
  hours: number;
}

interface UpskillingTimelineProps {
  items: UpskillingItem[];
}

export function UpskillingTimeline({ items }: UpskillingTimelineProps) {
  const getTypeConfig = (type: string) => {
    switch(type) {
      case "new-skilling": return { icon: Target, color: "text-secondary", border: "border-secondary", bg: "bg-secondary/10" };
      case "up-skilling": return { icon: Zap, color: "text-primary", border: "border-primary", bg: "bg-primary/10" };
      case "ready-skilling": return { icon: Cpu, color: "text-destructive", border: "border-destructive", bg: "bg-destructive/10" };
      default: return { icon: Target, color: "text-white", border: "border-white", bg: "bg-white/10" };
    }
  };

  return (
    <div className="glass-card p-6 rounded-xl w-full" data-testid="upskilling-timeline">
      <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-6">
        Dynamic Upskilling Navigator
      </h3>

      <div className="relative pl-6 space-y-8 border-l border-white/10 ml-4">
        {items.map((item, index) => {
          const config = getTypeConfig(item.type);
          const Icon = config.icon;

          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.2 }}
              className="relative"
            >
              {/* Timeline dot */}
              <div className={cn(
                "absolute -left-[33px] w-4 h-4 rounded-full border-2 bg-background z-10",
                config.border
              )}>
                <div className={cn("absolute inset-0 rounded-full animate-ping opacity-20", config.bg)} />
              </div>

              <div className={cn(
                "p-5 rounded-lg border transition-all hover:bg-white/5",
                "border-white/5 hover:border-white/20"
              )}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-1 rounded">
                      {item.phase}
                    </span>
                    <div className={cn("flex items-center gap-1 text-xs font-mono uppercase", config.color)}>
                      <Icon className="w-3 h-3" />
                      {item.type.replace('-', ' ')}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.hours} Hrs
                  </span>
                </div>
                
                <h4 className="font-display font-semibold text-white text-lg mb-2">{item.title}</h4>
                <p className="text-sm font-sans text-muted-foreground">{item.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}