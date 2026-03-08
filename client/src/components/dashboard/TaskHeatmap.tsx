import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RiskModifier {
  task: string;
  automatable: number;
}

interface TaskHeatmapProps {
  riskModifiers: RiskModifier[];
}

function getColorZone(value: number) {
  if (value <= 20) return { label: "Minimal", bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-500/30", glow: "rgba(16,185,129,0.2)" };
  if (value <= 40) return { label: "Low", bg: "bg-blue-500", text: "text-blue-400", border: "border-blue-500/30", glow: "rgba(59,130,246,0.2)" };
  if (value <= 60) return { label: "Medium", bg: "bg-yellow-500", text: "text-yellow-400", border: "border-yellow-500/30", glow: "rgba(234,179,8,0.2)" };
  if (value <= 80) return { label: "High", bg: "bg-orange-500", text: "text-orange-400", border: "border-orange-500/30", glow: "rgba(249,115,22,0.2)" };
  return { label: "Critical", bg: "bg-red-500", text: "text-red-400", border: "border-red-500/30", glow: "rgba(239,68,68,0.2)" };
}

function estimateTimeAllocation(index: number, total: number): number {
  const base = Math.round(100 / total);
  const variance = Math.round((index % 3 - 1) * 5);
  return Math.max(5, Math.min(40, base + variance));
}

export function TaskHeatmap({ riskModifiers }: TaskHeatmapProps) {
  const tasks = riskModifiers.length > 0 ? riskModifiers : [];

  if (tasks.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl" data-testid="task-heatmap">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">
          Task Automation Heatmap
        </h3>
        <p className="text-muted-foreground font-mono text-sm">No task data available.</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl" data-testid="task-heatmap">
      <div className="flex justify-between items-start mb-6">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">
          Task Automation Heatmap
        </h3>
        <div className="flex items-center gap-1">
          {[
            { color: "bg-emerald-500", label: "0-20%" },
            { color: "bg-blue-500", label: "20-40%" },
            { color: "bg-yellow-500", label: "40-60%" },
            { color: "bg-orange-500", label: "60-80%" },
            { color: "bg-red-500", label: "80-100%" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center">
              <div className={cn("w-5 h-3 rounded-sm", item.color)} />
              <span className="text-[8px] font-mono text-muted-foreground mt-0.5">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tasks.map((task, index) => {
          const zone = getColorZone(task.automatable);
          const timeAlloc = estimateTimeAllocation(index, tasks.length);

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className={cn(
                "relative rounded-lg border p-3 cursor-default group transition-all hover:scale-105",
                zone.border,
                "bg-white/[0.02]"
              )}
              style={{ boxShadow: `inset 0 0 20px ${zone.glow}` }}
              data-testid={`heatmap-cell-${index}`}
            >
              <div className={cn("absolute top-0 left-0 h-1 rounded-t-lg", zone.bg)} style={{ width: `${task.automatable}%` }} />

              <p className="text-xs font-mono text-white/90 leading-tight mb-2 line-clamp-2" title={task.task}>
                {task.task}
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <span className={cn("text-lg font-display font-bold", zone.text)}>
                    {task.automatable}%
                  </span>
                  <p className={cn("text-[9px] font-mono uppercase tracking-wider", zone.text)}>
                    {zone.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono text-muted-foreground uppercase">Time</p>
                  <p className="text-xs font-mono text-white/70">{timeAlloc}%</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
