import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine } from "recharts";
import { Users, Target, ShieldAlert, Activity, Loader2, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

interface BreakdownRow {
  key: string;
  count: number;
  linkedCount: number;
  assessedCount: number;
  avgArk: number;
  avgJst: number;
  avgVulnerability: number;
}

interface WorkforceIntelligence {
  institution: string;
  totals: {
    staff: number;
    linked: number;
    assessed: number;
    avgArk: number;
    avgJst: number;
    avgVulnerability: number;
  };
  byDepartment: BreakdownRow[];
}

const STRATA = [
  { name: "Critical", min: 80, fill: "hsl(var(--destructive))" },
  { name: "At Risk", min: 60, fill: "#f97316" },
  { name: "Transitional", min: 40, fill: "#eab308" },
  { name: "Resilient", min: 25, fill: "hsl(var(--primary))" },
  { name: "Flourishing", min: 0, fill: "hsl(var(--secondary))" },
];

function bandFor(risk: number) {
  return STRATA.find((s) => risk >= s.min) ?? STRATA[STRATA.length - 1];
}

function getRiskColor(risk: number) {
  if (risk >= 80) return "bg-destructive/20 border-destructive";
  if (risk >= 60) return "bg-orange-500/20 border-orange-500";
  if (risk >= 40) return "bg-yellow-500/20 border-yellow-500";
  if (risk >= 25) return "bg-primary/20 border-primary";
  return "bg-secondary/20 border-secondary";
}

export default function EnterprisePage() {
  const [intel, setIntel] = useState<WorkforceIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getEnterpriseIntelligence()
      .then((data: WorkforceIntelligence) => setIntel(data))
      .catch((err: Error) => setError(err.message || "Unable to load workforce intelligence."))
      .finally(() => setLoading(false));
  }, []);

  const departments = intel?.byDepartment ?? [];

  const sortedDepartments = useMemo(
    () => [...departments].sort((a, b) => b.avgVulnerability - a.avgVulnerability),
    [departments],
  );

  // Headcount grouped by their department's vulnerability band — derived
  // entirely from the shared aggregation, no fabricated distribution.
  const strataDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of departments) {
      const band = bandFor(d.avgVulnerability);
      totals.set(band.name, (totals.get(band.name) ?? 0) + d.count);
    }
    return STRATA
      .map((s) => ({ name: s.name, value: totals.get(s.name) ?? 0, fill: s.fill }))
      .filter((s) => s.value > 0);
  }, [departments]);

  const totalHeadcount = intel?.totals.staff ?? 0;
  const highRiskHeadcount = strataDistribution
    .filter((s) => s.name === "Critical" || s.name === "At Risk")
    .reduce((sum, s) => sum + s.value, 0);
  const highRiskPct = totalHeadcount ? Math.round((highRiskHeadcount / totalHeadcount) * 100) : 0;
  const criticalUnits = departments.filter((d) => d.avgVulnerability >= 60).length;

  const jstByDept = useMemo(
    () => sortedDepartments.map((d) => ({ name: d.key, avgJST: d.avgJst })),
    [sortedDepartments],
  );

  if (loading) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Loading Workforce Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center px-6" data-testid="state-enterprise-restricted">
        <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">Workforce Intelligence</h2>
        <p className="font-mono text-sm text-muted-foreground max-w-md">{error}</p>
        <p className="font-mono text-xs text-muted-foreground/70 mt-3">
          This dashboard is available to ENTERPRISE institution administrators.
        </p>
      </div>
    );
  }

  if (!intel || totalHeadcount === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center px-6" data-testid="state-enterprise-empty">
        <Users className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-2">No Workforce Data Yet</h2>
        <p className="font-mono text-sm text-muted-foreground max-w-md">
          Import or connect your staff roster to populate organizational risk and readiness analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-white uppercase tracking-wider">
            Workforce Intelligence
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1" data-testid="text-institution">
            {intel.institution} · Macro-level organizational risk and readiness analytics.
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
            <p className="text-2xl font-display font-bold text-white" data-testid="stat-headcount">{totalHeadcount}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-primary/50 transition-colors group">
          <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors"><Target className="text-primary w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Avg JST Index</p>
            <p className="text-2xl font-display font-bold text-primary neon-text" data-testid="stat-avg-jst">{intel.totals.avgJst}</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 hover:border-destructive/50 transition-colors group">
          <div className="p-3 bg-destructive/10 rounded-full group-hover:bg-destructive/20 transition-colors"><Activity className="text-destructive w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Avg Vulnerability</p>
            <p className="text-2xl font-display font-bold text-destructive" data-testid="stat-avg-vulnerability">{intel.totals.avgVulnerability}%</p>
          </div>
        </div>
        <div className="glass-card p-4 rounded-lg flex items-center gap-4 border-orange-500/30 hover:border-orange-500/70 transition-colors group">
          <div className="p-3 bg-orange-500/10 rounded-full group-hover:bg-orange-500/20 transition-colors"><ShieldAlert className="text-orange-500 w-6 h-6" /></div>
          <div>
            <p className="text-xs font-mono text-muted-foreground uppercase">Critical Risk Units</p>
            <p className="text-2xl font-display font-bold text-orange-500" data-testid="stat-critical-units">{criticalUnits}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-2">
            Global Vulnerability Distribution
          </h3>
          <p className="text-xs font-mono text-muted-foreground mb-6">Headcount by AI replacement-risk strata</p>

          <div className="h-[250px] w-full relative">
            {strataDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                No assessed staff yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={strataDistribution} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none" isAnimationActive={true}>
                      {strataDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <span className="font-display font-bold text-3xl text-white block leading-none" data-testid="stat-high-risk-pct">{highRiskPct}%</span>
                    <span className="text-[10px] font-mono text-destructive uppercase tracking-wider">High Risk</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl flex flex-col">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-widest mb-2">
            JST Index by Department
          </h3>
          <p className="text-xs font-mono text-muted-foreground mb-6">Dashed line = organization average ({intel.totals.avgJst})</p>

          <div className="h-[250px] w-full">
            {jstByDept.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                No departments to display.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jstByDept} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border) / 0.5)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'hsla(var(--foreground) / 0.5)', fontSize: 10, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis domain={[0, 300]} tick={{ fill: 'hsla(var(--foreground) / 0.5)', fontSize: 10, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }} labelStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'Space Grotesk', fontSize: '12px' }} itemStyle={{ fontFamily: 'Space Grotesk', fontSize: '12px' }} cursor={{ fill: 'hsla(var(--foreground) / 0.05)' }} />
                  <ReferenceLine y={intel.totals.avgJst} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" />
                  <Bar dataKey="avgJST" name="Avg JST" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
            {sortedDepartments.map((dept, i) => (
              <motion.div key={dept.key} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: i * 0.05 }} className={`p-4 rounded-lg border flex items-center justify-between hover:scale-[1.01] transition-transform group ${getRiskColor(dept.avgVulnerability)}`} data-testid={`row-department-${dept.key}`}>
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
                    <motion.div className="h-full bg-current opacity-80" initial={{ width: "0%" }} animate={{ width: `${dept.avgVulnerability}%` }} transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }} />
                  </div>
                  <div className="text-right min-w-[60px]">
                    <span className="font-mono text-lg text-white block leading-none">{dept.avgVulnerability}%</span>
                    <span className="text-[9px] uppercase tracking-widest opacity-70">Risk</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {sortedDepartments.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center text-muted-foreground font-mono text-sm border border-dashed border-white/10 rounded-lg">
                No departments in the roster yet.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
