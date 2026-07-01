import { useState, useMemo, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, Target, ShieldAlert, Activity, Loader2, ChevronRight, SlidersHorizontal, X, UserPlus, TrendingUp, Check } from "lucide-react";
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

interface StaffDrilldownRow {
  id: string;
  fullName: string;
  jobTitle: string | null;
  assessmentStatus: "complete" | "pending" | "invited" | "unlinked";
  jstIndex: number | null;
  arkScore: number | null;
  vulnerabilityPct: number | null;
  nudgedAt: string | null;
}

interface WorkforceFilterOption {
  dimension: string;
  label: string;
  values: string[];
}

interface WorkforceFilter {
  dimension: string;
  value: string;
}

const AT_RISK_THRESHOLD = 60;

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
  filterOptions: WorkforceFilterOption[];
  activeFilters: WorkforceFilter[];
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkforceFilter[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptStaff, setDeptStaff] = useState<Record<string, StaffDrilldownRow[]>>({});
  const [staffLoading, setStaffLoading] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<Record<string, string>>({});
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Record<string, { text: string; error: boolean }>>({});

  const patchStaffRow = useCallback((dept: string, staffId: string, patch: Partial<StaffDrilldownRow>) => {
    setDeptStaff((s) => {
      const rows = s[dept];
      if (!rows) return s;
      return { ...s, [dept]: rows.map((r) => (r.id === staffId ? { ...r, ...patch } : r)) };
    });
  }, []);

  const handleInvite = useCallback((dept: string, staff: StaffDrilldownRow) => {
    setActionPending(staff.id);
    setActionMessage((m) => { const n = { ...m }; delete n[staff.id]; return n; });
    api.inviteStaffMember(staff.id)
      .then((res: { staff: { assessmentStatus: StaffDrilldownRow["assessmentStatus"] }; message: string }) => {
        patchStaffRow(dept, staff.id, { assessmentStatus: res.staff.assessmentStatus });
        setActionMessage((m) => ({ ...m, [staff.id]: { text: res.message, error: false } }));
      })
      .catch((e: any) => setActionMessage((m) => ({ ...m, [staff.id]: { text: e?.message || "Unable to invite.", error: true } })))
      .finally(() => setActionPending((cur) => (cur === staff.id ? null : cur)));
  }, [patchStaffRow]);

  const handleNudge = useCallback((dept: string, staff: StaffDrilldownRow) => {
    setActionPending(staff.id);
    setActionMessage((m) => { const n = { ...m }; delete n[staff.id]; return n; });
    api.nudgeStaffMember(staff.id)
      .then((res: { staff: { nudgedAt: string | null }; message: string }) => {
        patchStaffRow(dept, staff.id, { nudgedAt: res.staff.nudgedAt ?? new Date().toISOString() });
        setActionMessage((m) => ({ ...m, [staff.id]: { text: res.message, error: false } }));
      })
      .catch((e: any) => setActionMessage((m) => ({ ...m, [staff.id]: { text: e?.message || "Unable to nudge.", error: true } })))
      .finally(() => setActionPending((cur) => (cur === staff.id ? null : cur)));
  }, [patchStaffRow]);

  const setDimensionValue = useCallback((dimension: string, value: string) => {
    setFilters((prev) => {
      const rest = prev.filter((f) => f.dimension !== dimension);
      return value ? [...rest, { dimension, value }] : rest;
    });
  }, []);

  const toggleDept = useCallback((dept: string) => {
    setExpandedDept((prev) => {
      if (prev === dept) return null;
      if (!deptStaff[dept]) {
        setStaffLoading(dept);
        api.getDepartmentStaff(dept)
          .then((rows: StaffDrilldownRow[]) => setDeptStaff((s) => ({ ...s, [dept]: rows })))
          .catch((e: any) => setStaffError((s) => ({ ...s, [dept]: e?.message || "Unable to load staff." })))
          .finally(() => setStaffLoading((cur) => (cur === dept ? null : cur)));
      }
      return dept;
    });
  }, [deptStaff]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    api.getEnterpriseIntelligence(filters)
      .then((data: EnterpriseIntelligence) => { if (!cancelled) setIntel(data); })
      .catch((e: any) => { if (!cancelled) setError(e?.message || "Unable to load workforce intelligence."); })
      .finally(() => { if (!cancelled) { setLoading(false); setRefreshing(false); } });
    return () => { cancelled = true; };
  }, [filters]);

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

      {intel.filterOptions.length > 0 && (
        <div className="glass-card p-4 rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-xs font-mono uppercase tracking-widest">Filter Workforce</span>
          </div>

          {intel.filterOptions.map((o) => {
            const current = filters.find((f) => f.dimension === o.dimension)?.value ?? "";
            return (
              <label key={o.dimension} className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  {o.label}
                </span>
                <select
                  value={current}
                  onChange={(e) => setDimensionValue(o.dimension, e.target.value)}
                  className="bg-black/40 border border-white/15 rounded px-3 py-1.5 font-mono text-sm text-white focus:border-primary focus:outline-none"
                  data-testid={`select-filter-${o.dimension}`}
                >
                  <option value="">All</option>
                  {o.values.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            );
          })}

          {filters.length > 0 && (
            <button
              onClick={() => setFilters([])}
              className="flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-white transition-colors"
              data-testid="button-clear-filter"
            >
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          )}

          {refreshing && <Loader2 className="w-4 h-4 text-primary animate-spin sm:ml-auto" />}

          {intel.activeFilters.length > 0 && (
            <span
              className="sm:ml-auto text-[11px] font-mono uppercase tracking-widest text-primary"
              data-testid="text-active-filter"
            >
              Showing {totals.staff} across {intel.activeFilters.length} filter{intel.activeFilters.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

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
            <p className="text-xs font-mono text-muted-foreground mt-1">Vulnerability broken down by functional unit — click a unit to drill into its staff</p>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {intel.byDepartment.map((dept, i) => {
              const risk = Math.round(dept.avgVulnerability);
              const isOpen = expandedDept === dept.key;
              return (
                <motion.div key={dept.key} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3, delay: i * 0.05 }} className={`rounded-lg border overflow-hidden ${getRiskColor(risk)}`}>
                  <button
                    type="button"
                    onClick={() => toggleDept(dept.key)}
                    aria-expanded={isOpen}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors group"
                    data-testid={`row-department-${i}`}
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} data-testid={`icon-expand-${i}`} />
                      <div>
                        <span className="font-sans font-medium text-white">{dept.key}</span>
                        <div className="flex items-center gap-3 mt-1 opacity-70">
                          <span className="text-[10px] font-mono uppercase tracking-widest">{dept.count} HC</span>
                          <span className="w-1 h-1 rounded-full bg-current" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">{dept.assessedCount} assessed</span>
                          <span className="w-1 h-1 rounded-full bg-current" />
                          <span className="text-[10px] font-mono uppercase tracking-widest">JST {dept.avgJst}</span>
                        </div>
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
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden border-t border-white/10 bg-black/20">
                        <div className="p-4" data-testid={`panel-department-staff-${i}`}>
                          {staffLoading === dept.key ? (
                            <div className="flex items-center justify-center py-6 text-muted-foreground font-mono text-xs">
                              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading staff...
                            </div>
                          ) : staffError[dept.key] ? (
                            <div className="py-6 text-center text-destructive font-mono text-xs" data-testid={`text-staff-error-${i}`}>{staffError[dept.key]}</div>
                          ) : (deptStaff[dept.key]?.length ?? 0) === 0 ? (
                            <div className="py-6 text-center text-muted-foreground font-mono text-xs">No staff records in this unit.</div>
                          ) : (
                            <div className="space-y-2">
                              {deptStaff[dept.key].map((p) => {
                                const assessed = p.assessmentStatus === "complete";
                                const atRisk = assessed && (p.vulnerabilityPct ?? 0) >= AT_RISK_THRESHOLD;
                                const busy = actionPending === p.id;
                                const msg = actionMessage[p.id];
                                const canInvite = p.assessmentStatus === "unlinked";
                                const canNudge = atRisk;
                                const nudged = !!p.nudgedAt;
                                return (
                                  <div key={p.id} className="p-3 rounded-md bg-white/5 border border-white/5" data-testid={`row-staff-${p.id}`}>
                                    <div className="flex items-center justify-between gap-4">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-sans text-sm text-white truncate" data-testid={`text-staff-name-${p.id}`}>{p.fullName}</p>
                                        {p.jobTitle && <p className="text-[11px] font-mono text-muted-foreground truncate">{p.jobTitle}</p>}
                                      </div>
                                      <div className="flex items-center gap-4 shrink-0">
                                        {assessed ? (
                                          <>
                                            <div className="text-right">
                                              <span className="font-mono text-sm text-primary block leading-none" data-testid={`text-staff-jst-${p.id}`}>{p.jstIndex}</span>
                                              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">JST</span>
                                            </div>
                                            <div className="text-right min-w-[52px]">
                                              <span className="font-mono text-sm text-white block leading-none" data-testid={`text-staff-vuln-${p.id}`}>{Math.round(p.vulnerabilityPct ?? 0)}%</span>
                                              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Risk</span>
                                            </div>
                                          </>
                                        ) : (
                                          <span className="px-2 py-1 rounded font-mono text-[10px] uppercase tracking-widest bg-white/10 text-muted-foreground border border-white/10" data-testid={`badge-staff-status-${p.id}`}>
                                            {p.assessmentStatus === "pending" ? "Awaiting assessment" : p.assessmentStatus === "invited" ? "Invited" : "Not linked"}
                                          </span>
                                        )}
                                        {canInvite && (
                                          <button
                                            type="button"
                                            onClick={() => handleInvite(dept.key, p)}
                                            disabled={busy}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest bg-primary/15 text-primary border border-primary/40 hover:bg-primary/25 transition-colors disabled:opacity-50"
                                            data-testid={`button-invite-staff-${p.id}`}
                                          >
                                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                                            Invite
                                          </button>
                                        )}
                                        {canNudge && (
                                          nudged ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest bg-secondary/15 text-secondary border border-secondary/40" data-testid={`badge-nudged-${p.id}`}>
                                              <Check className="w-3 h-3" /> Nudged
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleNudge(dept.key, p)}
                                              disabled={busy}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[10px] uppercase tracking-widest bg-orange-500/15 text-orange-400 border border-orange-500/40 hover:bg-orange-500/25 transition-colors disabled:opacity-50"
                                              data-testid={`button-nudge-staff-${p.id}`}
                                            >
                                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                                              Nudge to upskill
                                            </button>
                                          )
                                        )}
                                      </div>
                                    </div>
                                    {msg && (
                                      <p className={`mt-2 font-mono text-[10px] ${msg.error ? "text-destructive" : "text-secondary"}`} data-testid={`text-action-message-${p.id}`}>
                                        {msg.text}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
