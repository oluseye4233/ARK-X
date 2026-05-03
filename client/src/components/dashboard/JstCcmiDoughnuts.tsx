import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Gauge } from "lucide-react";

// PDD ARK-MVP-005 Breakdown row — JST vs CCMI doughnut pair so the user can
// see at a glance which composite is dragging the ARK Score (max 300 each).
export function JstCcmiDoughnuts({ jst, ccmi }: { jst: number; ccmi: number }) {
  const items: Array<{
    label: string;
    value: number;
    color: string;
    testId: string;
  }> = [
    { label: "JST", value: jst, color: "#FFDD00", testId: "doughnut-jst" },
    { label: "CCMI", value: ccmi, color: "#AA44FF", testId: "doughnut-ccmi" },
  ];
  return (
    <div className="glass-card p-5 rounded-xl border border-white/10" data-testid="card-jst-ccmi-doughnuts">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-sm text-primary uppercase tracking-widest">
          Composite Breakdown
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => {
          const data = [
            { name: it.label, value: it.value },
            { name: "remaining", value: Math.max(0, 300 - it.value) },
          ];
          return (
            <div key={it.label} className="flex flex-col items-center" data-testid={it.testId}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={42}
                    outerRadius={62}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={it.color} />
                    <Cell fill="rgba(255,255,255,0.06)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="-mt-[88px] mb-[60px] text-center pointer-events-none">
                <p className="text-xl font-display font-bold text-white tabular-nums">{it.value}</p>
                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                  /300
                </p>
              </div>
              <p
                className="font-mono text-[10px] uppercase tracking-widest mt-1"
                style={{ color: it.color }}
              >
                {it.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
