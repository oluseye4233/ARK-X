import { useEffect, useState, useRef, forwardRef } from "react";
import { Loader2, FileText, FileImage, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useSubscription } from "@/lib/useSubscription";
import UpgradeGate from "@/components/UpgradeGate";
import { reportFileStamp, exportReportImage, exportReportPdf } from "@/lib/arkReportExport";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779729580194.png";

/* ATANDA brand palette (explicit hex for export fidelity) */
const ATANDA = {
  ink: "#0B1B33",
  sub: "#5B6B82",
  line: "#E4E8EF",
  panel: "#F6F8FB",
  blue: "#1B6FB5",
  yellow: "#F2C230",
  red: "#E2231A",
  teal: "#00A3C4",
  green: "#2BB673",
  purple: "#8E44AD",
  orange: "#FF6B4A",
};
const BRAND_BAR = `linear-gradient(90deg, ${ATANDA.yellow} 0%, ${ATANDA.orange} 20%, ${ATANDA.red} 40%, ${ATANDA.teal} 60%, ${ATANDA.green} 80%, ${ATANDA.purple} 100%)`;

const VULN_LEVELS: Record<number, { name: string; label: string; color: string }> = {
  0: { name: "Critical", label: "Critical Exposure", color: ATANDA.red },
  1: { name: "At Risk", label: "Significant Exposure", color: ATANDA.orange },
  2: { name: "Transitional", label: "Mixed Exposure", color: ATANDA.yellow },
  3: { name: "Resilient", label: "Low Exposure", color: ATANDA.teal },
  4: { name: "Flourishing", label: "AI-Augmented Growth", color: ATANDA.green },
};

const TYPOLOGY: Record<string, string> = { A: "Architect", O: "Orchestrator", C: "Conductor" };
const LIGHT_HEX: Record<string, string> = { green: ATANDA.green, amber: ATANDA.yellow, red: ATANDA.red };

/* Hand-drawn SVG radar — reliable in html2canvas (no recharts/foreignObject) */
function RadarMini({ vectors }: { vectors: Array<{ subject: string; score: number }> }) {
  const size = 230;
  const c = size / 2;
  const R = 78;
  const n = vectors.length || 1;
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const pt = (i: number, r: number) => [c + Math.cos(angle(i)) * r, c + Math.sin(angle(i)) * r];
  const poly = vectors.map((v, i) => pt(i, (Math.max(0, Math.min(100, v.score)) / 100) * R).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", margin: "0 auto" }}>
      {rings.map((rr, i) => (
        <circle key={i} cx={c} cy={c} r={R * rr} fill="none" stroke={ATANDA.line} strokeWidth={1} />
      ))}
      {vectors.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke={ATANDA.line} strokeWidth={1} />;
      })}
      <polygon points={poly} fill="rgba(27,111,181,0.22)" stroke={ATANDA.blue} strokeWidth={2} />
      {vectors.map((v, i) => {
        const [x, y] = pt(i, R + 11);
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize={7.5}
            fill={ATANDA.sub}
            textAnchor={Math.abs(x - c) < 6 ? "middle" : x > c ? "start" : "end"}
            dominantBaseline="middle"
            style={{ fontFamily: "monospace" }}
          >
            {String(v.subject).slice(0, 12)}
          </text>
        );
      })}
    </svg>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: 8, background: ATANDA.line, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

function MetricCard({
  title,
  meaning,
  children,
  testId,
}: {
  title: string;
  meaning: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{ border: `1px solid ${ATANDA.line}`, borderRadius: 12, padding: 16, background: "#fff" }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ATANDA.blue }}>
        {title}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
      <div style={{ fontSize: 10.5, color: ATANDA.sub, marginTop: 10, lineHeight: 1.35 }}>{meaning}</div>
    </div>
  );
}

interface ArkReportSheetProps {
  name?: string | null;
  role?: string | null;
  identity: any;
  lhcs: any;
  assessment: any;
}

/* The branded, export-ready one-page report artifact. Pure presentation so it
   can be rendered both from live data (ReportPage) and verified in isolation. */
export const ArkReportSheet = forwardRef<HTMLDivElement, ArkReportSheetProps>(function ArkReportSheet(
  { name, role, identity, lhcs, assessment },
  ref,
) {
  const a = assessment || {};
  const arkScore = identity?.arkScore ?? null;
  const jst = identity?.jstIndex ?? a.jstTotal ?? 0;
  const ccmi = identity?.ccmi ?? 0;
  const pillars = identity?.pillars ?? null;
  const typology = identity?.typology ? TYPOLOGY[identity.typology] : a.readinessProfile || "—";
  const vmst = identity?.vmstLevel ?? null;
  const arkId = identity?.arkIdString || (a.id ? a.id.slice(0, 8).toUpperCase() : "—");
  const readiness = lhcs?.readinessPct ?? null;
  const vuln = typeof a.vulnerabilityLevel === "number" ? a.vulnerabilityLevel : 2;
  const vInfo = VULN_LEVELS[vuln] || VULN_LEVELS[2];
  const vectors: Array<{ subject: string; score: number }> = Array.isArray(a.transferabilityVectors)
    ? a.transferabilityVectors
    : [];
  const arch = [
    { label: "Architect", v: a.archetypeArchitect ?? 0, color: ATANDA.blue },
    { label: "Orchestrator", v: a.archetypeOrchestrator ?? 0, color: ATANDA.purple },
    { label: "Conductor", v: a.archetypeConductor ?? 0, color: ATANDA.teal },
  ];
  const pillarRows = pillars
    ? ([1, 2, 3, 4, 5, 6, 7] as const).map((i) => ({ k: `P${i}`, v: pillars[`P${i}`] ?? 0 }))
    : [];

  return (
    <div
      ref={ref}
      data-testid="ark-report-sheet"
      style={{
        background: "#ffffff",
        color: ATANDA.ink,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <div style={{ height: 6, background: BRAND_BAR }} />

      <div style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={atandaLogo} alt="ATANDA" crossOrigin="anonymous" style={{ width: 54, height: 54, objectFit: "contain" }} data-testid="img-report-logo" />
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, color: ATANDA.ink, lineHeight: 1 }}>
                ARK REPORT
              </div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: ATANDA.sub, marginTop: 4 }}>
                Career Intelligence · Powered by ATANDA
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, fontFamily: "monospace", color: ATANDA.sub, lineHeight: 1.7 }}>
            <div>{new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</div>
            <div>ARK-ID: {arkId}</div>
          </div>
        </div>

        {/* Subject */}
        <div style={{ marginTop: 18, paddingBottom: 14, borderBottom: `1px solid ${ATANDA.line}` }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: ATANDA.ink, lineHeight: 1.05 }} data-testid="text-report-name">
            {name || "—"}
          </div>
          <div style={{ fontSize: 12, color: ATANDA.sub, marginTop: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
            {role || "Professional"} · Profile: {typology}
            {vmst ? ` · Mitigation ${vmst}` : ""}
          </div>
        </div>

        {/* Hero ARK score */}
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 22,
            background: ATANDA.panel,
            border: `1px solid ${ATANDA.line}`,
            borderRadius: 12,
            padding: 18,
          }}
          data-testid="card-report-ark"
        >
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ATANDA.blue }}>
              ARK Score
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: ATANDA.ink, lineHeight: 1 }} data-testid="text-report-ark-score">
              {arkScore ?? jst}
              <span style={{ fontSize: 18, color: ATANDA.sub, fontWeight: 600 }}> / {arkScore !== null ? 600 : 300}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Bar value={arkScore ?? jst} max={arkScore !== null ? 600 : 300} color={ATANDA.blue} />
            <div style={{ fontSize: 11, color: ATANDA.sub, marginTop: 8, lineHeight: 1.4 }}>
              Your total career-capital score — what the market values plus how well you direct AI. Higher means more future-proof.
            </div>
          </div>
        </div>

        {/* Metric grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          {/* JST */}
          <MetricCard title="JST Index" meaning="What the market will pay for your jobs, skills and talent today." testId="card-report-jst">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: ATANDA.ink }}>{jst}</span>
              <span style={{ fontSize: 12, color: ATANDA.sub }}>/ 300</span>
            </div>
            {[
              { l: "Jobs", v: a.jstJobs ?? 0, c: ATANDA.blue },
              { l: "Skills", v: a.jstSkills ?? 0, c: ATANDA.teal },
              { l: "Talent", v: a.jstTalent ?? 0, c: ATANDA.green },
            ].map((r) => (
              <div key={r.l} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", color: ATANDA.sub, marginBottom: 2 }}>
                  <span>{r.l.toUpperCase()}</span>
                  <span style={{ color: ATANDA.ink, fontWeight: 700 }}>{r.v}</span>
                </div>
                <Bar value={r.v} max={100} color={r.c} />
              </div>
            ))}
          </MetricCard>

          {/* CCMI */}
          <MetricCard title="CCMI · Prompt-Craft Mastery" meaning="How well you direct AI through context. Tier reflects your mastery band." testId="card-report-ccmi">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: ATANDA.ink }}>{ccmi}</span>
              <span style={{ fontSize: 12, color: ATANDA.sub }}>/ 300{pillars?.tier ? ` · ${pillars.tier}` : ""}</span>
            </div>
            {pillarRows.length > 0 ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60 }}>
                {pillarRows.map((p) => (
                  <div key={p.k} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ height: 46, display: "flex", alignItems: "flex-end" }}>
                      <div style={{ width: "100%", height: `${Math.max(4, Math.min(100, p.v))}%`, background: ATANDA.purple, borderRadius: "3px 3px 0 0" }} />
                    </div>
                    <div style={{ fontSize: 8, fontFamily: "monospace", color: ATANDA.sub, marginTop: 3 }}>{p.k}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: ATANDA.sub }}>Play the CCGE Arena to populate your 7 mastery pillars.</div>
            )}
          </MetricCard>

          {/* LHCS */}
          <MetricCard title="LHCS Readiness" meaning="Live readiness signal from your real platform activity." testId="card-report-lhcs">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: ATANDA.ink }}>{readiness ?? "—"}</span>
              {readiness !== null && <span style={{ fontSize: 12, color: ATANDA.sub }}>% ready</span>}
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              {[
                { l: "CPR", light: lhcs?.cprLight, v: lhcs?.cprScore },
                { l: "MPS", light: lhcs?.mpsLight, v: lhcs?.mpsScore },
                { l: "LCIS", light: lhcs?.lcisLight, v: lhcs?.lcisScore },
              ].map((s) => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: LIGHT_HEX[s.light as string] || ATANDA.line, display: "inline-block" }} />
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: ATANDA.sub }}>
                    {s.l} <b style={{ color: ATANDA.ink }}>{s.v ?? "—"}</b>
                  </span>
                </div>
              ))}
            </div>
          </MetricCard>

          {/* Vulnerability */}
          <MetricCard title="AI Vulnerability" meaning="How exposed your current work is to automation within 24 months." testId="card-report-vuln">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: vInfo.color }}>L{vuln}</span>
              <span style={{ fontSize: 12, color: ATANDA.sub }}>{vInfo.name}</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 3,
                    background: i <= vuln ? (VULN_LEVELS[i]?.color || ATANDA.line) : ATANDA.line,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: ATANDA.sub, marginTop: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              {vInfo.label}
            </div>
          </MetricCard>
        </div>

        {/* Archetype + Transferability */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 12, marginTop: 12 }}>
          <MetricCard title="Archetype Handicap" meaning="Your dominant way of working with AI. Bars show the weighted mix." testId="card-report-archetype">
            <div style={{ marginTop: 2 }}>
              {arch.map((r) => (
                <div key={r.label} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: ATANDA.ink, fontWeight: 600 }}>{r.label}</span>
                    <span style={{ color: ATANDA.sub, fontFamily: "monospace" }}>{Math.round(r.v)}%</span>
                  </div>
                  <Bar value={r.v} max={100} color={r.color} />
                </div>
              ))}
            </div>
          </MetricCard>

          <MetricCard title="12-Vector Transferability" meaning="How easily your skills move across 12 career directions." testId="card-report-transfer">
            {vectors.length > 0 ? (
              <RadarMini vectors={vectors} />
            ) : (
              <div style={{ fontSize: 11, color: ATANDA.sub, padding: "24px 0", textAlign: "center" }}>
                Transferability radar populates after your first CV upload.
              </div>
            )}
          </MetricCard>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${ATANDA.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={atandaLogo} alt="ATANDA" crossOrigin="anonymous" style={{ width: 22, height: 22, objectFit: "contain" }} />
            <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Powered by ATANDA · ARK Synthesized Intelligence
            </span>
          </div>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1 }}>
            Confidential · {arkId}
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: BRAND_BAR }} />
    </div>
  );
});

export default function ReportPage() {
  const { user } = useAuth();
  const { canAccessReport } = useSubscription();
  const [assessment, setAssessment] = useState<any>(null);
  const [identity, setIdentity] = useState<any>(null);
  const [lhcs, setLhcs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<null | "pdf" | "png" | "jpeg">(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getLatestAssessment(user.id).catch(() => null),
      api.getArkIdentity().catch(() => null),
      api.getArkLhcs().catch(() => null),
    ])
      .then(([a, id, l]) => {
        setAssessment(a);
        setIdentity(id);
        setLhcs(l || id?.lhcs || null);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleExportImage = async (type: "png" | "jpeg") => {
    if (!reportRef.current) return;
    setExporting(type);
    try {
      await exportReportImage(reportRef.current, type, reportFileStamp(user?.name));
    } catch (err) {
      console.error("Image export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting("pdf");
    try {
      await exportReportPdf(reportRef.current, reportFileStamp(user?.name));
    } catch (err) {
      console.error("PDF export failed:", err);
      window.print();
    } finally {
      setExporting(null);
    }
  };

  if (!canAccessReport) {
    return (
      <UpgradeGate featureName="ARK Report" requiredPlan="Individual Pro" hasAccess={false}>
        <div />
      </UpgradeGate>
    );
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Compiling ARK Report...</p>
      </div>
    );
  }

  if (!assessment && !identity) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">No assessment data found. Upload a CV first.</p>
      </div>
    );
  }

  const Btn = ({
    onClick,
    icon: Icon,
    label,
    busy,
    testId,
  }: {
    onClick: () => void;
    icon: any;
    label: string;
    busy: boolean;
    testId: string;
  }) => (
    <Button
      onClick={onClick}
      disabled={exporting !== null}
      data-testid={testId}
      className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary hover:text-primary-foreground font-mono uppercase tracking-widest text-xs"
    >
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />}
      {busy ? "Working..." : label}
    </Button>
  );

  return (
    <div className="w-full max-w-[860px] mx-auto space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-wrap gap-3 justify-between items-center pb-6 border-b border-white/10 print:hidden">
        <div>
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider">ARK Report</h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            One-page executive summary · branded · export-ready.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={handleExportPDF} icon={FileText} label="PDF" busy={exporting === "pdf"} testId="button-export-pdf" />
          <Btn onClick={() => handleExportImage("png")} icon={FileImage} label="PNG" busy={exporting === "png"} testId="button-export-png" />
          <Btn onClick={() => handleExportImage("jpeg")} icon={FileType2} label="JPEG" busy={exporting === "jpeg"} testId="button-export-jpeg" />
        </div>
      </div>

      <ArkReportSheet
        ref={reportRef}
        name={user?.name}
        role={user?.role}
        identity={identity}
        lhcs={lhcs}
        assessment={assessment}
      />
    </div>
  );
}
