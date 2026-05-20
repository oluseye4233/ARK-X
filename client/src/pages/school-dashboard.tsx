import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GraduationCap, Users, BarChart3, Target, Plus, Download, Trash2, Calendar, AlertCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

type Cohort = { id: string; name: string; institution: string; description: string | null; createdAt: string };
type Member = {
  id: string; userId: string; status: string; invitedEmail: string | null; joinedAt: string;
  user: { id: string; name: string; username: string; arkScore: number; jstIndex: number; ccmi: number; contextCraftCertLevel: string | null } | null;
};
type Assignment = { id: string; scenarioId: string; dueAt: string | null; note: string | null; createdAt: string };
type CohortDetail = { cohort: Cohort; members: Member[]; assignments: Assignment[] };
type Scenario = { id: string; tier: string; title: string };
type Grade = {
  studentId: string; studentName: string; studentEmail: string;
  scenarioId: string; scenarioTitle: string;
  bestJcse: number | null; bestTier: string | null; attempts: number;
  dueAt: string | null; lastAttemptAt: string | null; onTime: boolean | null;
};
type Comparison = { cohortId: string; cohortName: string; studentCount: number; avgJst: number; avgCcmi: number; avgArk: number };

function isInstructorRole(role: string | null | undefined) {
  return role === "instructor" || role === "admin";
}

export default function SchoolDashboard() {
  const { user } = useAuth();
  const isInstructor = isInstructorRole(user?.role);

  if (!user) {
    return <div className="max-w-6xl mx-auto p-8 text-muted-foreground font-mono">Loading…</div>;
  }

  return isInstructor ? <InstructorView /> : <StudentView />;
}

// ─────────────────────────── INSTRUCTOR ───────────────────────────
function InstructorView() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const cohortsQ = useQuery<Cohort[]>({ queryKey: ["/api/cohorts"], queryFn: api.getCohorts });
  const comparisonQ = useQuery<Comparison[]>({ queryKey: ["/api/cohorts/comparison"], queryFn: api.getCohortComparison });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cohorts = cohortsQ.data ?? [];
  const selected = selectedId ?? cohorts[0]?.id ?? null;

  const createMut = useMutation({
    mutationFn: (d: { name: string; institution: string; description?: string }) => api.createCohort(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cohorts"] }),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newInst, setNewInst] = useState(user?.institution ?? "");
  const [newDesc, setNewDesc] = useState("");

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-school-dashboard-title">
          Instructor Command Deck
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          {user?.institution || "Your Institution"} // COHORT INTELLIGENCE
        </p>
      </div>

      {/* Cohort selector */}
      <div className="glass-card p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-sm text-primary uppercase tracking-widest">Your Cohorts</h3>
          <button
            data-testid="button-create-cohort"
            onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/30 transition"
          >
            <Plus className="h-3 w-3" /> New Cohort
          </button>
        </div>

        {showCreate && (
          <div className="mb-4 p-4 rounded-lg bg-white/5 space-y-3" data-testid="form-create-cohort">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Cohort name" className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm" data-testid="input-cohort-name" />
            <input value={newInst} onChange={e => setNewInst(e.target.value)} placeholder="Institution" className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm" data-testid="input-cohort-institution" />
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm" data-testid="input-cohort-description" />
            <div className="flex gap-2">
              <button
                disabled={createMut.isPending || newName.length < 2 || newInst.length < 1}
                onClick={async () => {
                  await createMut.mutateAsync({ name: newName, institution: newInst, description: newDesc || undefined });
                  setNewName(""); setNewDesc(""); setShowCreate(false);
                }}
                className="px-4 py-2 rounded bg-primary text-background text-sm font-mono uppercase tracking-wider disabled:opacity-50"
                data-testid="button-submit-cohort"
              >
                {createMut.isPending ? "Creating…" : "Create"}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded bg-white/10 text-sm font-mono">Cancel</button>
            </div>
            {createMut.isError && <div className="text-xs text-destructive font-mono">{(createMut.error as Error).message}</div>}
          </div>
        )}

        {cohorts.length === 0 ? (
          <div className="text-sm text-muted-foreground font-mono py-4" data-testid="text-no-cohorts">
            No cohorts yet — create one to start tracking students.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cohorts.map(c => (
              <button
                key={c.id}
                data-testid={`button-select-cohort-${c.id}`}
                onClick={() => setSelectedId(c.id)}
                className={`px-3 py-2 rounded-lg text-xs font-mono border ${
                  selected === c.id ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison chart */}
      {(comparisonQ.data?.length ?? 0) > 0 && (
        <div className="glass-card p-6 rounded-xl" data-testid="chart-cohort-comparison">
          <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-4">Cohort Comparison</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={comparisonQ.data}>
              <XAxis dataKey="cohortName" tick={{ fill: "#888", fontSize: 11, fontFamily: "monospace" }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} domain={[0, 600]} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1f35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "monospace", fontSize: 12 }} />
              <Bar dataKey="avgJst" name="Avg JST" fill="#00B4D8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgCcmi" name="Avg CCMI" fill="#44AA44" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgArk" name="Avg ARK" fill="#AA44FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Selected cohort detail */}
      {selected && <CohortManager cohortId={selected} />}
    </div>
  );
}

function CohortManager({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const detailQ = useQuery<CohortDetail>({ queryKey: ["/api/cohorts", cohortId], queryFn: () => api.getCohort(cohortId) });
  const gradesQ = useQuery<Grade[]>({ queryKey: ["/api/cohorts", cohortId, "grades"], queryFn: () => api.getCohortGrades(cohortId) });
  const scenariosQ = useQuery<Scenario[]>({ queryKey: ["/api/ccge/scenarios"], queryFn: () => api.getCcgeScenarios() });
  const [tab, setTab] = useState<"roster" | "assignments" | "import" | "grades">("roster");

  if (detailQ.isLoading) return <div className="glass-card p-6 rounded-xl font-mono text-sm text-muted-foreground">Loading cohort…</div>;
  if (!detailQ.data) return <div className="glass-card p-6 rounded-xl font-mono text-sm text-destructive">Cohort not found.</div>;
  const d = detailQ.data;
  const active = d.members.filter(m => m.status === "active");
  const invited = d.members.filter(m => m.status === "invited");
  const avg = (key: "jstIndex" | "ccmi" | "arkScore") => {
    const xs = active.map(m => m.user?.[key] ?? 0);
    return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Students", value: active.length, icon: Users, color: "#00B4D8" },
          { label: "Avg JST", value: avg("jstIndex"), icon: BarChart3, color: "#44AA44" },
          { label: "Avg CCMI", value: avg("ccmi"), icon: Target, color: "#AA44FF" },
          { label: "Avg ARK", value: avg("arkScore"), icon: GraduationCap, color: "#FFDD00" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-5 rounded-xl"
            data-testid={`stat-cohort-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-3xl font-display font-black text-white">{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex border-b border-white/10">
          {([
            ["roster", "Roster"],
            ["assignments", "Assignments"],
            ["import", "Import (CSV)"],
            ["grades", "Grades"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              data-testid={`tab-${k}`}
              onClick={() => setTab(k)}
              className={`px-5 py-3 text-xs font-mono uppercase tracking-widest border-b-2 ${
                tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "roster" && (
            <div className="space-y-2" data-testid="panel-roster">
              {active.length === 0 && invited.length === 0 ? (
                <div className="text-sm text-muted-foreground font-mono">No members yet. Use the Import tab to add students by email.</div>
              ) : (
                <>
                  {active.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded bg-white/5" data-testid={`row-member-${m.userId}`}>
                      <div className="flex-1">
                        <div className="text-sm text-white font-mono">{m.user?.name ?? m.invitedEmail ?? m.userId}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.user?.username ?? ""}</div>
                      </div>
                      <div className="text-xs font-mono text-cyan-400 w-16 text-right">JST {m.user?.jstIndex ?? 0}</div>
                      <div className="text-xs font-mono text-emerald-400 w-20 text-right">CCMI {m.user?.ccmi ?? 0}</div>
                      <div className="text-xs font-mono text-purple-400 w-20 text-right">ARK {m.user?.arkScore ?? 0}</div>
                      <button
                        data-testid={`button-remove-member-${m.userId}`}
                        onClick={async () => {
                          await api.removeCohortMember(cohortId, m.userId);
                          qc.invalidateQueries({ queryKey: ["/api/cohorts", cohortId] });
                          qc.invalidateQueries({ queryKey: ["/api/cohorts", cohortId, "grades"] });
                        }}
                        className="p-1.5 rounded hover:bg-destructive/20 text-destructive"
                        title="Remove from cohort"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {invited.length > 0 && (
                    <>
                      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-4 mb-1">Invited (not registered)</div>
                      {invited.map(m => (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded bg-white/5 opacity-70" data-testid={`row-invited-${m.id}`}>
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-sm font-mono text-white">{m.invitedEmail}</span>
                          <span className="text-xs font-mono text-amber-400 ml-auto">Pending registration</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "assignments" && (
            <AssignmentsPanel cohortId={cohortId} assignments={d.assignments} scenarios={scenariosQ.data ?? []} />
          )}

          {tab === "import" && <ImportPanel cohortId={cohortId} />}

          {tab === "grades" && (
            <GradesPanel cohortId={cohortId} grades={gradesQ.data ?? []} loading={gradesQ.isLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

function AssignmentsPanel({ cohortId, assignments, scenarios }: { cohortId: string; assignments: Assignment[]; scenarios: Scenario[] }) {
  const qc = useQueryClient();
  const [scenarioId, setScenarioId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const scenarioById = useMemo(() => new Map(scenarios.map(s => [s.id, s] as const)), [scenarios]);
  const mut = useMutation({
    mutationFn: () => api.createCohortAssignment(cohortId, {
      scenarioId,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      note: note || undefined,
    }),
    onSuccess: () => {
      setScenarioId(""); setDueAt(""); setNote("");
      qc.invalidateQueries({ queryKey: ["/api/cohorts", cohortId] });
      qc.invalidateQueries({ queryKey: ["/api/cohorts", cohortId, "grades"] });
    },
  });
  return (
    <div className="space-y-4" data-testid="panel-assignments">
      <div className="p-4 rounded bg-white/5 space-y-3">
        <div className="font-mono text-xs uppercase tracking-widest text-primary">New Assignment</div>
        <select value={scenarioId} onChange={e => setScenarioId(e.target.value)} className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm" data-testid="select-scenario">
          <option value="">Pick a scenario…</option>
          {scenarios.map(s => (
            <option key={s.id} value={s.id}>[{s.tier}] {s.title}</option>
          ))}
        </select>
        <input type="datetime-local" value={dueAt} onChange={e => setDueAt(e.target.value)} className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm" data-testid="input-due-at" />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm" data-testid="input-assignment-note" />
        <button
          disabled={!scenarioId || mut.isPending}
          onClick={() => mut.mutate()}
          className="px-4 py-2 rounded bg-primary text-background text-sm font-mono uppercase tracking-wider disabled:opacity-50"
          data-testid="button-create-assignment"
        >
          {mut.isPending ? "Creating…" : "Assign"}
        </button>
        {mut.isError && <div className="text-xs text-destructive font-mono">{(mut.error as Error).message}</div>}
      </div>
      {assignments.length === 0 ? (
        <div className="text-sm text-muted-foreground font-mono">No assignments yet.</div>
      ) : (
        assignments.map(a => {
          const sc = scenarioById.get(a.scenarioId);
          const overdue = a.dueAt && new Date(a.dueAt).getTime() < Date.now();
          return (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded bg-white/5" data-testid={`row-assignment-${a.id}`}>
              <Calendar className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="text-sm text-white font-mono">{sc ? `[${sc.tier}] ${sc.title}` : a.scenarioId}</div>
                {a.note && <div className="text-xs text-muted-foreground font-mono">{a.note}</div>}
              </div>
              <div className={`text-xs font-mono ${overdue ? "text-amber-400" : "text-emerald-400"}`}>
                {a.dueAt ? new Date(a.dueAt).toLocaleDateString() : "No due date"}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function ImportPanel({ cohortId }: { cohortId: string }) {
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const emails = useMemo(() => {
    return Array.from(new Set(
      raw.split(/[\s,;\n\r]+/).map(s => s.trim().toLowerCase()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
    ));
  }, [raw]);
  const mut = useMutation({
    mutationFn: () => api.addCohortMembers(cohortId, emails),
    onSuccess: (r: any) => {
      setResult(`Added ${r.added}, reactivated ${r.reactivated}, skipped ${r.skipped}.`);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["/api/cohorts", cohortId] });
      qc.invalidateQueries({ queryKey: ["/api/cohorts", cohortId, "grades"] });
    },
  });
  return (
    <div className="space-y-3" data-testid="panel-import">
      <div className="font-mono text-xs uppercase tracking-widest text-primary">Bulk Import (CSV / paste / one-per-line)</div>
      <textarea
        value={raw}
        onChange={e => setRaw(e.target.value)}
        rows={8}
        placeholder="lila@school.edu, marco@school.edu&#10;or paste a CSV column"
        className="w-full bg-background/60 border border-white/10 rounded px-3 py-2 text-sm font-mono"
        data-testid="textarea-import-emails"
      />
      <div className="flex items-center gap-3">
        <button
          disabled={emails.length === 0 || mut.isPending}
          onClick={() => mut.mutate()}
          className="px-4 py-2 rounded bg-primary text-background text-sm font-mono uppercase tracking-wider disabled:opacity-50"
          data-testid="button-import-emails"
        >
          {mut.isPending ? "Importing…" : `Import ${emails.length} email${emails.length === 1 ? "" : "s"}`}
        </button>
        {emails.length > 0 && (
          <span className="text-xs text-muted-foreground font-mono" data-testid="text-import-preview">
            {emails.slice(0, 3).join(", ")}{emails.length > 3 ? `, +${emails.length - 3} more` : ""}
          </span>
        )}
      </div>
      {result && <div className="text-xs font-mono text-emerald-400" data-testid="text-import-result">{result}</div>}
      {mut.isError && <div className="text-xs text-destructive font-mono">{(mut.error as Error).message}</div>}
    </div>
  );
}

function GradesPanel({ cohortId, grades, loading }: { cohortId: string; grades: Grade[]; loading: boolean }) {
  if (loading) return <div className="text-sm text-muted-foreground font-mono">Loading grades…</div>;
  return (
    <div className="space-y-3" data-testid="panel-grades">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-widest text-primary">Grade Book</div>
        <a
          href={api.cohortGradesCsvUrl(cohortId)}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary/20 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/30"
          data-testid="link-download-csv"
        >
          <Download className="h-3 w-3" /> Download CSV
        </a>
      </div>
      {grades.length === 0 ? (
        <div className="text-sm text-muted-foreground font-mono">No grades yet — add assignments and students will populate this view as they play.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground uppercase tracking-widest">
                <th className="text-left py-2">Student</th>
                <th className="text-left py-2">Scenario</th>
                <th className="text-right py-2">Best JCSE</th>
                <th className="text-right py-2">Tier</th>
                <th className="text-right py-2">Attempts</th>
                <th className="text-right py-2">Due</th>
                <th className="text-right py-2">On-time</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, i) => (
                <tr key={`${g.studentId}-${g.scenarioId}-${i}`} className="border-t border-white/5" data-testid={`row-grade-${g.studentId}-${g.scenarioId}`}>
                  <td className="py-2 text-white">{g.studentName}</td>
                  <td className="py-2 text-white">{g.scenarioTitle}</td>
                  <td className="py-2 text-right text-cyan-400">{g.bestJcse !== null ? g.bestJcse.toFixed(1) : "—"}</td>
                  <td className="py-2 text-right text-emerald-400">{g.bestTier ?? "—"}</td>
                  <td className="py-2 text-right">{g.attempts}</td>
                  <td className="py-2 text-right text-muted-foreground">{g.dueAt ? new Date(g.dueAt).toLocaleDateString() : "—"}</td>
                  <td className={`py-2 text-right ${g.onTime === null ? "text-muted-foreground" : g.onTime ? "text-emerald-400" : "text-destructive"}`}>
                    {g.onTime === null ? "—" : g.onTime ? "✓" : "✗"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── STUDENT ───────────────────────────
function StudentView() {
  const { user } = useAuth();
  const cohortsQ = useQuery<Cohort[]>({ queryKey: ["/api/me/cohorts"], queryFn: api.getMyCohorts });
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-school-dashboard-title">
          Your Cohorts
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          {user?.institution || "Your Institution"} // STUDENT VIEW
        </p>
      </div>
      {cohortsQ.isLoading && <div className="text-sm text-muted-foreground font-mono">Loading…</div>}
      {(cohortsQ.data?.length ?? 0) === 0 && !cohortsQ.isLoading && (
        <div className="glass-card p-6 rounded-xl text-sm text-muted-foreground font-mono" data-testid="text-no-student-cohorts">
          You're not enrolled in any cohorts yet. Ask your instructor to add you with the email
          <span className="text-primary"> {user?.username}</span>.
        </div>
      )}
      {(cohortsQ.data ?? []).map(c => (
        <div key={c.id} className="glass-card p-6 rounded-xl space-y-2" data-testid={`card-student-cohort-${c.id}`}>
          <div className="text-lg font-display font-bold text-white">{c.name}</div>
          <div className="text-xs font-mono text-muted-foreground">{c.institution}</div>
          {c.description && <div className="text-sm font-mono text-white/80">{c.description}</div>}
        </div>
      ))}
    </div>
  );
}
