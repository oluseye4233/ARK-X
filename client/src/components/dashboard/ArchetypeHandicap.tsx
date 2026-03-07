import { motion } from "framer-motion";
import { Layers, Network, Wand2 } from "lucide-react";

interface ArchetypeHandicapProps {
  architect: number;
  orchestrator: number;
  conductor: number;
  profile: string;
}

const ARCHETYPE_CONFIG = {
  Architect: {
    icon: Layers,
    color: "text-cyan-400",
    bg: "bg-cyan-400",
    border: "border-cyan-400/30",
    glow: "shadow-[0_0_15px_rgba(34,211,238,0.15)]",
    barBg: "from-cyan-500 to-cyan-300",
    traits: ["Strategic Thinking", "System Design", "Pattern Recognition", "Vision"],
  },
  Orchestrator: {
    icon: Network,
    color: "text-emerald-400",
    bg: "bg-emerald-400",
    border: "border-emerald-400/30",
    glow: "shadow-[0_0_15px_rgba(52,211,153,0.15)]",
    barBg: "from-emerald-500 to-emerald-300",
    traits: ["Multi-System Integration", "Workflow Design", "Resource Optimization", "Stakeholder Mgmt"],
  },
  Conductor: {
    icon: Wand2,
    color: "text-violet-400",
    bg: "bg-violet-400",
    border: "border-violet-400/30",
    glow: "shadow-[0_0_15px_rgba(167,139,250,0.15)]",
    barBg: "from-violet-500 to-violet-300",
    traits: ["Quality Frameworks", "Coherence Assessment", "UX Optimization", "Continuous Improvement"],
  },
};

export function ArchetypeHandicap({ architect, orchestrator, conductor, profile }: ArchetypeHandicapProps) {
  const archetypes = [
    { name: "Architect", value: architect, ...ARCHETYPE_CONFIG.Architect },
    { name: "Orchestrator", value: orchestrator, ...ARCHETYPE_CONFIG.Orchestrator },
    { name: "Conductor", value: conductor, ...ARCHETYPE_CONFIG.Conductor },
  ].sort((a, b) => b.value - a.value);

  const primary = archetypes[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card p-6 rounded-xl"
      data-testid="archetype-handicap"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
            JST Archetype Handicap
          </h3>
          <p className="font-display text-xl font-bold text-white uppercase tracking-wider">
            Transformation Pathway Analysis
          </p>
        </div>

        <div className={`glass px-4 py-2 flex items-center gap-3 rounded-lg ${primary.border} ${primary.glow}`}>
          <primary.icon className={`w-5 h-5 ${primary.color}`} />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Dominant Type</p>
            <p className={`font-display font-bold uppercase tracking-wider ${primary.color}`}>
              {primary.value}% {primary.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {archetypes.map((arch, i) => {
          const Icon = arch.icon;
          const isPrimary = i === 0;

          return (
            <motion.div
              key={arch.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              className={`relative p-4 rounded-lg border ${
                isPrimary
                  ? `${arch.border} ${arch.glow} bg-white/[0.03]`
                  : "border-white/10 bg-white/[0.01]"
              }`}
              data-testid={`archetype-card-${arch.name.toLowerCase()}`}
            >
              {isPrimary && (
                <div className={`absolute -top-2 right-3 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${arch.bg} text-black rounded-sm font-bold`}>
                  Primary
                </div>
              )}

              <div className="flex items-center gap-3 mb-3">
                <Icon className={`w-5 h-5 ${arch.color}`} />
                <span className={`font-display font-bold uppercase tracking-wider text-sm ${arch.color}`}>
                  {arch.name}
                </span>
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-end mb-1.5">
                  <span className={`font-display text-3xl font-bold ${arch.color}`}>
                    {arch.value}%
                  </span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full bg-gradient-to-r ${arch.barBg}`}
                    initial={{ width: "0%" }}
                    animate={{ width: `${arch.value}%` }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.15, ease: "easeOut" }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {arch.traits.map((trait) => (
                  <span
                    key={trait}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2 h-2 rounded-full ${primary.bg} animate-pulse`} />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Composite Handicap Vector
          </p>
        </div>
        <div className="w-full h-4 rounded-full overflow-hidden flex">
          {archetypes.map((arch) => (
            <motion.div
              key={arch.name}
              className={`h-full bg-gradient-to-r ${arch.barBg} relative group`}
              initial={{ width: "0%" }}
              animate={{ width: `${arch.value}%` }}
              transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
              title={`${arch.name}: ${arch.value}%`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {archetypes.map((arch) => (
            <span key={arch.name} className={`text-[10px] font-mono ${arch.color}`}>
              {arch.name} {arch.value}%
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}