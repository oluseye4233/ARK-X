import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, Target, ShieldAlert, Activity, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

interface WorkforceBreakdownRow {
  key: string;
  count: number;
  linkedCount: number;
  assessedCount: number;
  avgArk: number;
  avgJst: number;
  avgVulnerability: number;
}

interface EnterpriseIntelligence {
  institution: string;
  totals: {
    staff: number;
    linked: number;
    assessed: number;
    avgArk: number;
    avgJst: number;
    avgVulnerability: number;
  };
  byDepartment: WorkforceBreakdownRow[];
  vulnerabilityDistribution: { name: string; value: number }[];
  jstTrend: { month: string; avgJst: number }[];
}

const BAND_FILL: Record<string, string> = {
  Critical: "hsl(var(--destructive))",
  "At Risk": "#f97316",
  Transitional: "#eab308",
  Resilient: "hsl(var(--primary))",
  Flourishing: "hsl(var(--secondary))",
};

function getRiskColor(risk: number) {
  if (risk >= 80) return "bg-destructive/20 border-destructive";
  if (risk >= 60) return "bg-orange-500/20 border-orange-500";
  if (risk >= 40) return "bg-yellow-500/20 border-yellow-500";
  if (risk >= 25) return "bg-primary/20 border-primary";
  return "bg-secondary/20 border-secondary";
}

export default function EnterprisePage() {
  const [intel, setIntel] = useState<EnterpriseIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getEnterpriseIntelligence()
      .then((data: EnterpriseIntelligence) => setIntel(data))
      .catch((e: any) => setError(e?.message || "Unable to load workforce intelligence."))
      .finally(() => setLoading(false));
  }, []);

  const distribution = useMemo(
    () => (intel?.vulnerabilityDistribution ?? []).filter(d => d.value > 0).map(d => ({ ...d, fill: BAND_FILL[d.name] ?? "hsl(var(--muted-foreground))" })),
    [intel],
  );

  const trend = useMemo(
    () => (intel?.jstTrend ?? []).map(p => ({ month: p.month, avgJST: p.avgJst })),
    [intel],
  );

  const highRiskCount = useMemo(
    () => (intel?.byDepartment ?? []).filter(d => Math.round(d.avgVulnerability) >= 80).length,
    [intel],
  );

  const assessedTotal = useMemo(
    () => (intel?.vulnerabilityDistribution ?? []).reduce((s, d) => s + d.value, 0),
    [intel],
  );

  const highRiskPct = useMemo(() => {
    if (!assessedTotal) return 0;
    const highRisk = (intel?.vulnerabilityDistribution ?? [])
      .filter(d => d.name === "Critical" || d.name === "At Risk")
      .reduce((s, d) => s + d.value, 0);
    return Math.round((highRisk / assessedTotal) * 100);
  }, [intel, assessedTotal]);

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Workforce Data...</p>
      </div>
    );
  }

  if (error || !intel) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="w-12 h-12 text-destructive mb-4" />
        <p className="font-display text-lg text-white uppercase tracking-wider mb-2" data-testid="text-enterprise-error">
          Workforce Intelligence Unavailable
        </p>
        <p className="font-mono text-sm text-muted-foreground max-w-md">
          {error || "No institution data is linked to your account."}
        </p>
      </div>
    );
  }

  const { totals } = intel;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Workforce Intelligence
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1" data-testid="text-institution-name">
            {intel.institution} — macro-level organizational risk and readiness analytics.
          </p>
        </div>
        <div className="px-4 py-2 bg-primary/10 border border-primary/30 rounded font-mono text-xs text-primary uppercase shadow-[0_0_15px_rgba(var(--primary),0.2)]">
          Live Data Feed Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-white/20 transition-colors">
          <div className="p-3 bg-white/5 rounded-full"><Users className="text-white w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Total Monitored</p>
            <p className="text-2xl font-display font-bold text-white" data-testid="stat-total-staff">{totals.staff}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-primary/50 transition-colors group">
          <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors"><Target className="text-primary w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Avg JST Index</p>
            <p className="text-2xl font-display font-bold text-primary neon-text" data-testid="stat-avg-jst">{totals.avgJst}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-secondary/50 transition-colors group">
          <div className="p-3 bg-secondary/10 rounded-full group-hover:bg-secondary/20 transition-colors"><Activity className="text-secondary w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Assessed</p>
            <p className="text-2xl font-display font-bold text-secondary" data-testid="stat-assessed">{totals.assessed}<span className="text-sm text-muted-foreground">/{totals.staff}</span></p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 border-orange-500/30 hover:border-orange-500/70 transition-colors group">
          <div className="p-3 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors"><ShieldAlert className="text-orange-500 w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Critical Risk Units</p>
            <p className="text-2xl font-display font-bold text-orange-500" data-testid="stat-critical-units">{highRiskCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-2">
            Global Vulnerability Distribution
          </h3>
          <p className="text-xs font-mono text-muted-foreground mb-6">AI Replacement Risk Strata ({assessedTotal} assessed)</p>

          <div className="h-[250px] w-full relative">
            {distribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribution} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name" stroke="none" isAnimationActive={true}>
                      {distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <span className="font-display font-bold text-3xl text-white block leading-none" data-testid="text-high-risk-pct">{highRiskPct}%</span>
                    <span className="text-[10px] font-mono text-destructive uppercase tracking-wider">High Risk</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground font-mono text-sm border border-dashed border-white/10 rounded-lg">
                No completed assessments yet.
              </div>
            )}
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-2">
            Organization JST Trajectory
          </h3>
          <p className="text-xs font-mono text-muted-foreground mb-6">Monthly average JST across linked staff</p>

          <div className="h-[250px] w-full">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border) / 0.5)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'hsla(var(--foreground) / 0.5)', fontSize: 10, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 300]} tick={{ fill: 'hsla(var(--foreground) / 0.5)', fontSize: 10, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} labelStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk', fontSize: '12px' }} itemStyle={{ fontFamily: 'Space Grotesk', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="avgJST" name="Avg JST" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground font-mono text-sm border border-dashed border-white/10 rounded-lg">
                Not enough score history to plot a trend yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest">
              Department Automation Exposure
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-1">Vulnerability broken down by functional unit</p>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {intel.byDepartment.map((dept, i) => {
              const risk = Math.round(dept.avgVulnerability);
              return (
                <motion.div key={dept.key} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: i * 0.05 }} className={`p-4 rounded-lg border flex items-center justify-between hover:scale-[1.01] transition-transform group ${getRiskColor(risk)}`} data-testid={`row-department-${i}`}>
                  <div className="flex-1">
                    <span className="font-sans font-medium text-white">{dept.key}</span>
                    <div className="flex items-center gap-3 mt-1 opacity-70">
                      <span className="text-[10px] font-mono uppercase tracking-widest">{dept.count} HC</span>
                      <span className="w-1 h-1 rounded-full bg-current" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">{dept.assessedCount} assessed</span>
                      <span className="w-1 h-1 rounded-full bg-current" />
                      <span className="text-[10px] font-mono uppercase tracking-widest">JST {dept.avgJst}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-1/3 justify-end">
                    <div className="w-full max-w-[150px] h-2 bg-black/40 rounded-full overflow-hidden hidden sm:block">
                      <motion.div className="h-full bg-current opacity-80" initial={{ width: "0%" }} animate={{ width: `${risk}%` }} transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }} />
                    </div>
                    <div className="text-right min-w-[60px]">
                      <span className="font-mono text-lg text-white block leading-none" data-testid={`text-risk-${i}`}>{risk}%</span>
                      <span className="text-[9px] uppercase tracking-widest opacity-70">Risk</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {intel.byDepartment.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center text-muted-foreground font-mono text-sm border border-dashed border-white/10 rounded-lg">
                No department data available for this institution.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
