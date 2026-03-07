import { MOCK_ENTERPRISE_DATA } from "@/lib/mockData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Users, TrendingDown, Target, ShieldAlert } from "lucide-react";

export default function EnterprisePage() {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="border-b border-white/10 pb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Workforce Intelligence
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Macro-level organizational risk and readiness analytics.
          </p>
        </div>
        <div className="px-4 py-2 bg-primary/10 border border-primary/30 rounded font-mono text-xs text-primary uppercase">
          Live Data Feed Active
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-white/5 rounded-full"><Users className="text-white w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Total Monitored</p>
            <p className="text-2xl font-display font-bold text-white">{MOCK_ENTERPRISE_DATA.overview.totalEmployees}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-full"><Target className="text-primary w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Avg JST Index</p>
            <p className="text-2xl font-display font-bold text-primary neon-text">{MOCK_ENTERPRISE_DATA.overview.averageJST}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 bg-destructive/10 rounded-full"><TrendingDown className="text-destructive w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Proj. Attrition</p>
            <p className="text-2xl font-display font-bold text-destructive">{MOCK_ENTERPRISE_DATA.overview.projectedAttrition}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 border-orange-500/30">
          <div className="p-3 bg-orange-500/10 rounded-full"><ShieldAlert className="text-orange-500 w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Critical Risk Units</p>
            <p className="text-2xl font-display font-bold text-orange-500">2</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vulnerability Distribution */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-6">
            Global Vulnerability Distribution
          </h3>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={MOCK_ENTERPRISE_DATA.vulnerabilityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {MOCK_ENTERPRISE_DATA.vulnerabilityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="font-display text-2xl text-white">45%</span>
            </div>
          </div>
          <p className="text-center font-mono text-xs text-muted-foreground mt-4">
            45% of workforce situated in Critical/At Risk bands.
          </p>
        </div>

        {/* Department Heatmap */}
        <div className="glass-card p-6 rounded-xl">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-6">
            Department Automation Exposure
          </h3>
          <div className="space-y-4">
            {MOCK_ENTERPRISE_DATA.departmentHeatmap.map((dept, i) => (
              <div key={i} className={`p-4 rounded-lg border flex items-center justify-between ${dept.color}`}>
                <span className="font-sans font-medium text-white">{dept.dept}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full bg-current opacity-80" style={{ width: `${dept.risk}%` }} />
                  </div>
                  <span className="font-mono text-sm min-w-[3ch] text-right">{dept.risk}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}