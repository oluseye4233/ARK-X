import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface JSTRadarProps {
  jobsScore: number;
  skillsScore: number;
  talentScore: number;
}

const INDUSTRY_AVERAGES = {
  Jobs: 55,
  Skills: 50,
  Talent: 48,
};

export function JSTRadar({ jobsScore, skillsScore, talentScore }: JSTRadarProps) {
  const data = [
    { axis: "Jobs", user: jobsScore, benchmark: INDUSTRY_AVERAGES.Jobs, fullMark: 100 },
    { axis: "Skills", user: skillsScore, benchmark: INDUSTRY_AVERAGES.Skills, fullMark: 100 },
    { axis: "Talent", user: talentScore, benchmark: INDUSTRY_AVERAGES.Talent, fullMark: 100 },
  ];

  return (
    <div className="glass-card p-6 rounded-xl relative overflow-hidden" data-testid="jst-radar-container">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none" />

      <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">
        JST Three-Layer Radar
      </h3>

      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "monospace" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              axisLine={false}
            />
            <Radar
              name="Industry Avg"
              dataKey="benchmark"
              stroke="rgba(255,255,255,0.35)"
              fill="rgba(255,255,255,0.05)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
            <Radar
              name="Your Score"
              dataKey="user"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.85)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize: 12,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
            />
            <Legend
              wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {data.map((d) => {
          const diff = d.user - d.benchmark;
          return (
            <div key={d.axis} className="p-2 rounded hover:bg-white/5 transition-colors" data-testid={`radar-axis-${d.axis.toLowerCase()}`}>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{d.axis}</p>
              <p className="font-display font-bold text-white text-lg">{d.user}</p>
              <p className={`text-[10px] font-mono ${diff >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                {diff >= 0 ? "+" : ""}{diff} vs avg
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
