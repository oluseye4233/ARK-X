import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";
import { Layers } from "lucide-react";

export type CcmiPillarData = {
  P1: number; P2: number; P3: number; P4: number; P5: number; P6: number; P7: number;
  composite: number;
  tier: string;
  multiplier: number;
};

const PILLAR_LABELS: Record<string, string> = {
  P1: "System & Architecture",
  P2: "Role Clarity",
  P3: "Instruction Mastery",
  P4: "Example Curation",
  P5: "Constraint Discipline",
  P6: "Format Precision",
  P7: "Data Stewardship",
};

const STRONG_FILL = "#00B4D8";
const WEAKEST_FILL = "#FF4D6D";

export function CcmiPillars({ data }: { data: CcmiPillarData | null }) {
  if (!data) {
    return (
      <div className="glass-card p-5 rounded-xl" data-testid="card-ccmi-pillars">
        <p className="font-mono text-xs text-muted-foreground">
          No CCMI data yet — finish a CCGE session to populate pillars.
        </p>
      </div>
    );
  }
  const chartData = (["P1", "P2", "P3", "P4", "P5", "P6", "P7"] as const).map((k) => ({
    pillar: k,
    label: PILLAR_LABELS[k],
    score: data[k],
  }));
  // Highlight the weakest pillar — single source of truth for "what to fix next".
  const weakest = chartData.reduce((min, p) => (p.score < min.score ? p : min), chartData[0]);
  return (
    <div className="glass-card p-5 rounded-xl border border-primary/20" data-testid="card-ccmi-pillars">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-sm text-primary uppercase tracking-widest">
            CCMI · 7-Pillar Vector
          </h3>
        </div>
        <div className="font-mono text-[10px] text-right">
          <p className="text-secondary" data-testid="text-ccmi-composite">{data.composite}/300</p>
          <p className="text-muted-foreground uppercase tracking-widest">
            {data.tier} · {data.multiplier.toFixed(2)}×
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="pillar"
            tick={{ fill: "#888", fontSize: 11, fontFamily: "monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#888", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              backgroundColor: "#1a1f35",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontFamily: "monospace",
              fontSize: 12,
            }}
            formatter={(value: number, _name: string, ctx: { payload?: { label?: string } }) => [
              `${value}/100`,
              ctx.payload?.label ?? "",
            ]}
          />
          <Bar dataKey="score" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.pillar}
                fill={entry.pillar === weakest.pillar ? WEAKEST_FILL : STRONG_FILL}
                data-testid={`bar-pillar-${entry.pillar}`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] font-mono text-muted-foreground mt-2 text-right">
        Weakest pillar:{" "}
        <span className="text-rose-300" data-testid="text-weakest-pillar">
          {weakest.pillar} · {weakest.label} · {weakest.score}/100
        </span>
      </p>
    </div>
  );
}
