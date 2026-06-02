import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Upload,
  Users,
  Link2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Activity,
  Layers,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";

type FieldDef = { key: string; label: string };

type Connector = {
  key: string;
  label: string;
  acceptsFile: boolean;
  isApi: boolean;
  requiredSecrets: string[];
  configured: boolean;
};

type StaffRow = {
  id: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  team: string | null;
  manager: string | null;
  location: string | null;
  compensationBand: string | null;
  hireDate: string | null;
  performanceRating: string | null;
  tenureBand: string;
  assessmentStatus: "unlinked" | "invited" | "pending" | "complete";
  arkUserId: string | null;
  ark: { arkScore: number; jstIndex: number; ccmi: number; vulnerabilityPct: number } | null;
};

type BreakdownRow = {
  key: string;
  count: number;
  linkedCount: number;
  assessedCount: number;
  avgArk: number;
  avgJst: number;
  avgVulnerability: number;
};

type Intelligence = {
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
  byTenureBand: BreakdownRow[];
  byCompensationBand: BreakdownRow[];
  byManager: BreakdownRow[];
  byLocation: BreakdownRow[];
};

type PreviewResult = {
  adapter: string;
  filename: string;
  columnMapping: Record<string, string>;
  unmappedColumns: string[];
  totalRows: number;
  validRows: number;
  errorCount: number;
  sample: Record<string, string>[];
  errors: Array<{ row: number; message: string }>;
  fields: FieldDef[];
};

const STATUS_STYLES: Record<StaffRow["assessmentStatus"], string> = {
  complete: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  invited: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
  unlinked: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

const STATUS_LABEL: Record<StaffRow["assessmentStatus"], string> = {
  complete: "Assessed",
  pending: "Linked · Pending",
  invited: "Invited",
  unlinked: "Unlinked",
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="glass-card rounded-xl p-4" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-[Orbitron] text-2xl text-primary">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function BreakdownTable({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: BreakdownRow[];
}) {
  const maxArk = Math.max(1, ...rows.map((r) => r.avgArk));
  return (
    <div className="glass-card rounded-xl p-4" data-testid={`breakdown-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-[Rajdhani] text-lg font-semibold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="text-sm" data-testid={`breakdown-row-${r.key}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.key}</span>
                <span className="text-muted-foreground">
                  {r.count} staff · {r.assessedCount} assessed
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${(r.avgArk / maxArk) * 100}%` }}
                  />
                </div>
                <span className="w-28 text-right text-xs text-muted-foreground">
                  ARK {r.avgArk} · JST {r.avgJst} · Vuln {r.avgVulnerability}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkforcePage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<any>(null);

  const connectorsQ = useQuery<{ connectors: Connector[]; fields: FieldDef[] }>({
    queryKey: ["/api/workforce/connectors"],
    queryFn: () => api.getWorkforceConnectors(),
  });
  const staffQ = useQuery<{ institution: string; staff: StaffRow[] }>({
    queryKey: ["/api/workforce/staff"],
    queryFn: () => api.getWorkforceStaff(),
  });
  const intelQ = useQuery<Intelligence>({
    queryKey: ["/api/workforce/intelligence"],
    queryFn: () => api.getWorkforceIntelligence(),
  });

  const fields = preview?.fields ?? connectorsQ.data?.fields ?? [];

  const previewMut = useMutation({
    mutationFn: (f: File) => api.previewWorkforceImport(f),
    onSuccess: (res: PreviewResult) => {
      setPreview(res);
      setMapping(res.columnMapping ?? {});
      setImportResult(null);
    },
  });

  const importMut = useMutation({
    mutationFn: ({ f, m }: { f: File; m: Record<string, string> }) =>
      api.runWorkforceImport(f, { columnMapping: m }),
    onSuccess: (res) => {
      setImportResult(res);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["/api/workforce/staff"] });
      qc.invalidateQueries({ queryKey: ["/api/workforce/intelligence"] });
    },
  });

  const linkMut = useMutation({
    mutationFn: (id: string) => api.linkWorkforceStaff(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workforce/staff"] });
      qc.invalidateQueries({ queryKey: ["/api/workforce/intelligence"] });
    },
  });

  const inviteMut = useMutation({
    mutationFn: (id: string) => api.inviteWorkforceStaff(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/workforce/staff"] });
      qc.invalidateQueries({ queryKey: ["/api/workforce/intelligence"] });
    },
  });

  const syncMut = useMutation({
    mutationFn: (adapter: string) => api.syncWorkforceConnector(adapter),
    onSuccess: (res: any) => {
      setImportResult(res);
      qc.invalidateQueries({ queryKey: ["/api/workforce/staff"] });
      qc.invalidateQueries({ queryKey: ["/api/workforce/intelligence"] });
    },
  });

  const apiConnectors = (connectorsQ.data?.connectors ?? []).filter((c) => c.isApi);

  function handleFile(f: File | null) {
    setFile(f);
    setImportResult(null);
    setPreview(null);
    if (f) previewMut.mutate(f);
  }

  // sourceHeader → fieldKey mapping rendered as editable dropdowns.
  const mappingEntries = useMemo(() => {
    if (!preview) return [];
    const headers = [
      ...Object.keys(preview.columnMapping ?? {}),
      ...preview.unmappedColumns,
    ];
    return Array.from(new Set(headers));
  }, [preview]);

  const intel = intelQ.data;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6" data-testid="page-workforce">
      <header className="flex items-center gap-3">
        <Building2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="neon-text font-[Orbitron] text-2xl">Workforce Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            {staffQ.data?.institution
              ? `Institution roster — ${staffQ.data.institution}`
              : "Import your staff roster and join HR data with ARK scores."}
          </p>
        </div>
      </header>

      {/* ── Import panel ─────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="font-[Rajdhani] text-xl font-semibold">Import HR Roster</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            data-testid="input-roster-file"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="neon-border flex items-center gap-2 rounded-lg px-4 py-2 text-sm hover:bg-primary/10"
            data-testid="button-choose-file"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {file ? file.name : "Choose CSV file"}
          </button>
          {previewMut.isPending && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Sources: {connectorsQ.data?.connectors?.map((c) => c.label).join(", ") || "CSV"}
          </span>
        </div>

        {/* ── Live HR-system connectors (API sync) ─────────── */}
        {apiConnectors.length > 0 && (
          <div className="mt-5 border-t border-border/40 pt-4" data-testid="panel-live-connectors">
            <div className="mb-1 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-[Rajdhani] text-lg font-semibold">Live HR Connectors</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Sync your roster directly from a connected HR system. Credentials are
              configured server-side — nothing is uploaded here.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {apiConnectors.map((c) => (
                <div
                  key={c.key}
                  className="neon-border flex flex-col gap-2 rounded-lg p-3"
                  data-testid={`card-connector-${c.key}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-[Rajdhani] font-semibold">{c.label}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        c.configured
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-500/40 bg-slate-500/10 text-slate-300"
                      }`}
                      data-testid={`status-connector-${c.key}`}
                    >
                      {c.configured ? "Connected" : "Not configured"}
                    </span>
                  </div>
                  {!c.configured && c.requiredSecrets.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Needs: {c.requiredSecrets.join(", ")}
                    </p>
                  )}
                  <button
                    disabled={!c.configured || syncMut.isPending}
                    onClick={() => syncMut.mutate(c.key)}
                    className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    data-testid={`button-sync-${c.key}`}
                  >
                    {syncMut.isPending && syncMut.variables === c.key ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5" />
                    )}
                    Sync now
                  </button>
                </div>
              ))}
            </div>
            {syncMut.isError && (
              <p className="mt-3 text-sm text-destructive" data-testid="text-sync-error">
                {(syncMut.error as Error).message}
              </p>
            )}
          </div>
        )}

        {previewMut.isError && (
          <p className="mt-3 text-sm text-destructive" data-testid="text-preview-error">
            {(previewMut.error as Error).message}
          </p>
        )}

        {/* Column mapping correction + preview */}
        {preview && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 space-y-4"
            data-testid="panel-preview"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total Rows" value={preview.totalRows} />
              <StatCard label="Valid Rows" value={preview.validRows} />
              <StatCard label="Errors" value={preview.errorCount} />
              <StatCard label="Unmapped Cols" value={preview.unmappedColumns.length} />
            </div>

            <div>
              <h3 className="mb-2 font-[Rajdhani] text-lg font-semibold">Column Mapping</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Auto-detected from your headers. Adjust any mapping before importing.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {mappingEntries.map((header) => (
                  <div key={header} className="flex items-center gap-2 text-sm">
                    <span className="w-1/2 truncate font-mono text-muted-foreground" title={header}>
                      {header}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <select
                      value={mapping[header] ?? ""}
                      onChange={(e) =>
                        setMapping((m) => {
                          const next = { ...m };
                          if (e.target.value) next[header] = e.target.value;
                          else delete next[header];
                          return next;
                        })
                      }
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1"
                      data-testid={`select-map-${header}`}
                    >
                      <option value="">— ignore —</option>
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {preview.sample.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="mb-2 font-[Rajdhani] text-lg font-semibold">Preview (first 10)</h3>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      {fields
                        .filter((f) => Object.values(mapping).includes(f.key))
                        .map((f) => (
                          <th key={f.key} className="px-2 py-1">
                            {f.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i} className="border-t border-border/40">
                        {fields
                          .filter((f) => Object.values(mapping).includes(f.key))
                          .map((f) => (
                            <td key={f.key} className="px-2 py-1">
                              {(row as any)[f.key] ?? ""}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <div className="mb-1 flex items-center gap-2 text-sm text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> {preview.errorCount} row error(s)
                </div>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                  {preview.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              disabled={importMut.isPending || preview.validRows === 0 || !file}
              onClick={() => file && importMut.mutate({ f: file, m: mapping })}
              className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              data-testid="button-run-import"
            >
              {importMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Import {preview.validRows} staff
            </button>
            {importMut.isError && (
              <p className="text-sm text-destructive" data-testid="text-import-error">
                {(importMut.error as Error).message}
              </p>
            )}
          </motion.div>
        )}

        {importResult && (
          <div
            className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm"
            data-testid="panel-import-result"
          >
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Import complete
            </div>
            <p className="mt-1 text-muted-foreground">
              {importResult.summary.inserted} added · {importResult.summary.updated} updated ·{" "}
              {importResult.summary.linked} linked to ARK · {importResult.summary.errorRows} errors
            </p>
          </div>
        )}
      </section>

      {/* ── Intelligence summary ─────────────────────────── */}
      {intel && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Staff" value={intel.totals.staff} />
            <StatCard label="Linked" value={intel.totals.linked} />
            <StatCard label="Assessed" value={intel.totals.assessed} />
            <StatCard label="Avg ARK" value={intel.totals.avgArk} />
            <StatCard label="Avg JST" value={intel.totals.avgJst} />
            <StatCard label="Avg Vuln" value={`${intel.totals.avgVulnerability}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownTable title="By Department" icon={Layers} rows={intel.byDepartment} />
            <BreakdownTable title="By Tenure Band" icon={Activity} rows={intel.byTenureBand} />
            <BreakdownTable title="By Compensation Band" icon={TrendingUp} rows={intel.byCompensationBand} />
            <BreakdownTable title="By Manager" icon={Users} rows={intel.byManager} />
            <BreakdownTable title="By Location" icon={Building2} rows={intel.byLocation} />
          </div>
        </section>
      )}

      {/* ── Staff roster ─────────────────────────────────── */}
      <section className="glass-card rounded-2xl p-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-[Rajdhani] text-xl font-semibold">
            Staff Roster {staffQ.data?.staff ? `(${staffQ.data.staff.length})` : ""}
          </h2>
        </div>
        {staffQ.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : !staffQ.data?.staff?.length ? (
          <p className="text-sm text-muted-foreground">
            No staff imported yet. Upload a CSV roster above to begin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Title</th>
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Tenure</th>
                  <th className="px-2 py-2">Comp</th>
                  <th className="px-2 py-2">ARK</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {staffQ.data.staff.map((s) => (
                  <tr key={s.id} className="border-t border-border/40" data-testid={`row-staff-${s.id}`}>
                    <td className="px-2 py-2">
                      <div className="font-medium">{s.fullName}</div>
                      <div className="text-xs text-muted-foreground">{s.email ?? "—"}</div>
                    </td>
                    <td className="px-2 py-2">{s.jobTitle ?? "—"}</td>
                    <td className="px-2 py-2">{s.department ?? "—"}</td>
                    <td className="px-2 py-2">{s.tenureBand}</td>
                    <td className="px-2 py-2">{s.compensationBand ?? "—"}</td>
                    <td className="px-2 py-2">{s.ark ? s.ark.arkScore : "—"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[s.assessmentStatus]}`}
                        data-testid={`status-staff-${s.id}`}
                      >
                        {STATUS_LABEL[s.assessmentStatus]}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {(s.assessmentStatus === "unlinked" || s.assessmentStatus === "invited") &&
                        s.email && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => inviteMut.mutate(s.id)}
                              disabled={inviteMut.isPending}
                              className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                              data-testid={`button-invite-${s.id}`}
                              title="Invite this staff member to create their ARK profile"
                            >
                              <Send className="h-3 w-3" />
                              {s.assessmentStatus === "invited" ? "Re-invite" : "Invite"}
                            </button>
                            <button
                              onClick={() => linkMut.mutate(s.id)}
                              disabled={linkMut.isPending}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-primary/10 disabled:opacity-50"
                              data-testid={`button-link-${s.id}`}
                              title="Link to an existing ARK account with this email"
                            >
                              <Link2 className="h-3 w-3" /> Link
                            </button>
                          </div>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
