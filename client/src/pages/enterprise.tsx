import { useState, useMemo } from "react";
import { MOCK_ENTERPRISE_DATA } from "@/lib/mockData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, TrendingDown, Target, ShieldAlert, Filter } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type FilterState = "All" | "Junior" | "Mid-Level" | "Senior";

export default function EnterprisePage() {
  const [seniorityFilter, setSeniorityFilter] = useState<FilterState>("All");

  const filteredHeatmap = useMemo(() => {
    if (seniorityFilter === "All") return MOCK_ENTERPRISE_DATA.departmentHeatmap;
    return MOCK_ENTERPRISE_DATA.departmentHeatmap.filter(d => d.seniority === seniorityFilter);
  }, [seniorityFilter]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Workforce Intelligence
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Macro-level organizational risk and readiness analytics.
          </p>
        </div>
        <div className="px-4 py-2 bg-primary/10 border border-primary/30 rounded font-mono text-xs text-primary uppercase shadow-[0_0_15px_rgba(var(--primary),0.2)]">
          Live Data Feed Active
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-white/20 transition-colors">
          <div className="p-3 bg-white/5 rounded-full"><Users className="text-white w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Total Monitored</p>
            <p className="text-2xl font-display font-bold text-white">{MOCK_ENTERPRISE_DATA.overview.totalEmployees}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-primary/50 transition-colors cursor-pointer group">
          <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors"><Target className="text-primary w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Avg JST Index</p>
            <p className="text-2xl font-display font-bold text-primary neon-text">{MOCK_ENTERPRISE_DATA.overview.averageJST}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-destructive/50 transition-colors cursor-pointer group">
          <div className="p-3 bg-destructive/10 rounded-full group-hover:bg-destructive/20 transition-colors"><TrendingDown className="text-destructive w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Proj. Attrition</p>
            <p className="text-2xl font-display font-bold text-destructive">{MOCK_ENTERPRISE_DATA.overview.projectedAttrition}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 border-orange-500/30 hover:border-orange-500/70 transition-colors cursor-pointer group">
          <div className="p-3 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors"><ShieldAlert className="text-orange-500 w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Critical Risk Units</p>
            <p className="text-2xl font-display font-bold text-orange-500">2</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Vulnerability Distribution */}
        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-2">
            Global Vulnerability Distribution
          </h3>
          <p className="text-xs font-mono text-muted-foreground mb-6">AI Replacement Risk Strata</p>
          
          <div className="h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={MOCK_ENTERPRISE_DATA.vulnerabilityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={true}
                >
                  {MOCK_ENTERPRISE_DATA.vulnerabilityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <span className="font-display font-bold text-3xl text-white block leading-none">45%</span>
                <span className="text-[10px] font-mono text-destructive uppercase tracking-wider">High Risk</span>
              </div>
            </div>
          </div>
        </div>

        {/* JST Growth Trend */}
        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-2">
            Organization JST Trajectory
          </h3>
          <p className="text-xs font-mono text-muted-foreground mb-6">6-Month Upskilling Impact</p>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_ENTERPRISE_DATA.jstTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border) / 0.5)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsla(var(--foreground) / 0.5)', fontSize: 10, fontFamily: 'Space Grotesk' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  domain={[170, 210]}
                  tick={{ fill: 'hsla(var(--foreground) / 0.5)', fontSize: 10, fontFamily: 'Space Grotesk' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk', fontSize: '12px' }}
                  itemStyle={{ fontFamily: 'Space Grotesk', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="avgJST" name="Actual JST" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="targetJST" name="Target" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Heatmap with Filters */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest">
              Department Automation Exposure
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-1">Vulnerability broken down by functional unit</p>
          </div>
          
          {/* Filtering Controls */}
          <div className="flex items-center gap-2 bg-background border border-white/10 rounded-lg p-1">
            <Filter className="w-4 h-4 text-muted-foreground ml-2" />
            {(["All", "Junior", "Mid-Level", "Senior"] as FilterState[]).map(level => (
              <button
                key={level}
                onClick={() => setSeniorityFilter(level)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
                  seniorityFilter === level 
                    ? "bg-white/10 text-white" 
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredHeatmap.map((dept, i) => (
              <motion.div 
                key={dept.id} 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`p-4 rounded-lg border flex items-center justify-between hover:scale-[1.01] transition-transform cursor-pointer group ${dept.color}`}
              >
                <div className="flex-1">
                  <span className="font-sans font-medium text-white group-hover:text-white transition-colors">{dept.dept}</span>
                  <div className="flex items-center gap-3 mt-1 opacity-70">
                    <span className="text-[10px] font-mono uppercase tracking-widest">{dept.seniority}</span>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">{dept.headcount} HC</span>
                    <span className="w-1 h-1 rounded-full bg-current" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">{dept.location}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-1/3 justify-end">
                  <div className="w-full max-w-[150px] h-2 bg-black/40 rounded-full overflow-hidden hidden sm:block">
                    <motion.div 
                      className="h-full bg-current opacity-80" 
                      initial={{ width: "0%" }}
                      animate={{ width: `${dept.risk}%` }}
                      transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                    />
                  </div>
                  <div className="text-right min-w-[60px]">
                    <span className="font-mono text-lg text-white block leading-none">{dept.risk}%</span>
                    <span className="text-[9px] uppercase tracking-widest opacity-70">Risk</span>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {filteredHeatmap.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="py-8 text-center text-muted-foreground font-mono text-sm border border-dashed border-white/10 rounded-lg"
              >
                No departments matching this filter criteria.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}