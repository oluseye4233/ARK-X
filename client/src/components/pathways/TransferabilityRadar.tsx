import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from "recharts";

interface TransferabilityRadarProps {
  data: Array<{
    subject: string;
    A: number;
    fullMark: number;
  }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass p-3 border border-primary/20 rounded font-mono text-xs shadow-xl">
        <p className="text-white mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-primary neon-text text-lg">
          {payload[0].value} <span className="text-[10px] text-muted-foreground">/ 100</span>
        </p>
      </div>
    );
  }
  return null;
};

export function TransferabilityRadar({ data }: TransferabilityRadarProps) {
  return (
    <div className="glass-card p-6 rounded-xl w-full h-[500px] flex flex-col" data-testid="transferability-radar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest">
          12-Vector Transferability
        </h3>
        <span className="text-xs font-mono text-muted-foreground px-2 py-1 bg-white/5 rounded border border-white/10">
          Orthogonal Dimension Mapping
        </span>
      </div>
      
      <div className="flex-1 relative w-full h-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="hsla(var(--border) / 0.5)" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: 'hsla(var(--foreground) / 0.7)', fontSize: 10, fontFamily: 'Space Grotesk' }} 
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={{ fill: 'transparent' }} 
              axisLine={false} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Mobility Score"
              dataKey="A"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              isAnimationActive={true}
              animationBegin={200}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}