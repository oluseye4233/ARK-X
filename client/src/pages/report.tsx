import { useEffect, useState, useRef, forwardRef } from "react";
import { Loader2, FileText, FileImage, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useSubscription } from "@/lib/useSubscription";
import UpgradeGate from "@/components/UpgradeGate";
import { reportFileStamp, adviserFileStamp, exportReportImage, exportReportPdf } from "@/lib/arkReportExport";
import { isEmptyProfile } from "@shared/assessmentMerge";
import { Link } from "wouter";
import { ATANDA, BRAND_BAR, Bar } from "@/lib/arkReportTheme";
import { ArkAdviserSheet } from "@/pages/adviser-report";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779729580194.png";

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
function RadarMini({ vectors, size = 230 }: { vectors: Array<{ subject: string; score: number }>; size?: number }) {
  const c = size / 2;
  const R = size * 0.34;
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
        const [x, y] = pt(i, R + size * 0.055);
        return (
          <text
            key={i}
            x={x}
            y={y}
            fontSize={Math.max(7.5, size * 0.034)}
            fill={ATANDA.sub}
            textAnchor={Math.abs(x - c) < 6 ? "middle" : x > c ? "start" : "end"}
            dominantBaseline="middle"
            style={{ fontFamily: "monospace" }}
          >
            {String(v.subject).slice(0, 16)}
          </text>
        );
      })}
    </svg>
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

/* Labelled biographical field for the resume-killer profile block. */
function BioField({ label, value, testId }: { label: string; value?: string | null; testId?: string }) {
  return (
    <div data-testid={testId}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: ATANDA.blue, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: ATANDA.ink, lineHeight: 1.3 }}>{value || "—"}</div>
    </div>
  );
}

/* Chip list for professional / academic qualifications. */
function QualBlock({ label, items, testId }: { label: string; items: string[]; testId?: string }) {
  return (
    <div data-testid={testId}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: ATANDA.blue, marginBottom: 6 }}>
        {label}
      </div>
      {items.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((q, i) => (
            <span
              key={i}
              style={{ fontSize: 11, color: ATANDA.ink, background: "#fff", border: `1px solid ${ATANDA.line}`, borderRadius: 8, padding: "4px 9px", lineHeight: 1.25 }}
            >
              {q}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: ATANDA.sub }}>Not detected on file</div>
      )}
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

  // Cumulative-profile attribution: which intake sources fed this report and
  // how complete the picture is. Mirrors the dashboard strip.
  const SOURCE_LABELS: Record<string, string> = {
    resume: "Resume",
    self: "Self-Assessment",
    linkedin: "LinkedIn",
    quiz: "Archetype Quiz",
  };
  const sourcesUsed: string[] = Array.isArray(a.sourcesUsed) ? a.sourcesUsed : [];
  const completeness: number | null =
    typeof a.completeness === "number" ? a.completeness : null;

  // ── "Resume killer" bio (scraped from resume/LinkedIn; falls back to account) ──
  const displayName = a.candidateName || name || "—";
  const jobRole = a.currentRole || role || "Professional";
  const employer = a.currentEmployer || null;
  const proQuals: string[] = Array.isArray(a.professionalQuals) ? a.professionalQuals : [];
  const acadQuals: string[] = Array.isArray(a.academicQuals) ? a.academicQuals : [];
  // Single generation instant shared by both pages (date + time stamp).
  const generatedAt = new Date();
  const stampDate = generatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const stampTime = generatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const PAGE_W = 794;
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const pageStyle: React.CSSProperties = {
    width: PAGE_W,
    minHeight: 1123,
    background: "#ffffff",
    color: ATANDA.ink,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    overflow: "hidden",
  };

  return (
    <div ref={ref} data-testid="ark-report-sheet" style={{ width: PAGE_W, margin: "0 auto", fontFamily: FONT, color: ATANDA.ink }}>
      {/* ─────────────  PAGE 1 — Profile & Core Scores  ───────────── */}
      <div data-testid="report-page-1" style={pageStyle}>
        <div style={{ height: 6, background: BRAND_BAR }} />

        <div style={{ padding: 28, flex: 1, display: "flex", flexDirection: "column" }}>
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
            <div data-testid="text-report-timestamp">{stampDate}</div>
            <div>{stampTime}</div>
            <div>ARK-ID: {arkId}</div>
          </div>
        </div>

        {/* Subject */}
        <div style={{ marginTop: 18, paddingBottom: 14, borderBottom: `1px solid ${ATANDA.line}` }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: ATANDA.ink, lineHeight: 1.05 }} data-testid="text-report-name">
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: ATANDA.sub, marginTop: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }} data-testid="text-report-role">
            {jobRole}{employer ? ` · ${employer}` : ""} · Profile: {typology}
            {vmst ? ` · Mitigation ${vmst}` : ""}
          </div>
          {sourcesUsed.length > 0 && (
            <div
              style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
              data-testid="report-sources-used"
            >
              <span style={{ fontSize: 9.5, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, color: ATANDA.sub }}>
                Built from
              </span>
              {sourcesUsed.map((s) => (
                <span
                  key={s}
                  data-testid={`report-badge-source-${s}`}
                  style={{
                    fontSize: 9.5,
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    color: ATANDA.blue,
                    border: `1px solid ${ATANDA.line}`,
                    borderRadius: 999,
                    padding: "2px 8px",
                  }}
                >
                  {SOURCE_LABELS[s] ?? s}
                </span>
              ))}
              {completeness != null && (
                <span style={{ fontSize: 9.5, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 0.5, color: ATANDA.sub }}>
                  · {completeness}% complete
                </span>
              )}
            </div>
          )}
        </div>

        {/* Professional profile — resume-killer bio block */}
        <div
          data-testid="card-report-bio"
          style={{
            marginTop: 14,
            border: `1px solid ${ATANDA.line}`,
            borderRadius: 12,
            background: ATANDA.panel,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <BioField label="Current Place of Work" value={employer} testId="text-report-employer" />
          <BioField label="Job Role" value={jobRole} testId="text-report-jobrole" />
          <QualBlock label="Professional Qualifications" items={proQuals} testId="report-pro-quals" />
          <QualBlock label="Academic Qualifications" items={acadQuals} testId="report-academic-quals" />
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

        {/* spacer pushes the page-1 footer to the sheet floor */}
        <div style={{ flex: 1, minHeight: 8 }} />

        {/* Page 1 footer */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${ATANDA.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={atandaLogo} alt="ATANDA" crossOrigin="anonymous" style={{ width: 22, height: 22, objectFit: "contain" }} />
            <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Powered by ATANDA · ARK Synthesized Intelligence
            </span>
          </div>
          <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1 }}>
            Page 1 of 2 · {stampDate} {stampTime}
          </span>
        </div>
        </div>
        <div style={{ height: 6, background: BRAND_BAR }} />
      </div>

      {/* ─────────────  PAGE 2 — Career Mobility & Operating Mix  ───────────── */}
      <div data-testid="report-page-2" style={pageStyle}>
        <div style={{ height: 6, background: BRAND_BAR }} />

        <div style={{ padding: 28, flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Page 2 header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 14, borderBottom: `1px solid ${ATANDA.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={atandaLogo} alt="ATANDA" crossOrigin="anonymous" style={{ width: 44, height: 44, objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, color: ATANDA.ink, lineHeight: 1 }}>
                  CAREER MOBILITY
                </div>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: ATANDA.sub, marginTop: 4 }}>
                  ARK Report · Page 2
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10, fontFamily: "monospace", color: ATANDA.sub, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 700, color: ATANDA.ink, fontFamily: FONT }}>{displayName}</div>
              <div>ARK-ID: {arkId}</div>
            </div>
          </div>

          {/* 12-Vector radar (large) */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ATANDA.blue }}>
              12-Vector Transferability Radar
            </div>
            <div style={{ fontSize: 10.5, color: ATANDA.sub, marginTop: 4 }}>
              How easily your skills move across 12 career directions. A wider shape means broader mobility.
            </div>
            <div style={{ marginTop: 8, border: `1px solid ${ATANDA.line}`, borderRadius: 12, padding: 12, background: "#fff", display: "flex", justifyContent: "center" }}>
              {vectors.length > 0 ? (
                <RadarMini vectors={vectors} size={360} />
              ) : (
                <div style={{ fontSize: 12, color: ATANDA.sub, padding: "60px 0", textAlign: "center" }}>
                  Transferability radar populates after your first CV upload.
                </div>
              )}
            </div>
          </div>

          {/* Vector transferability detail */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ATANDA.blue, marginBottom: 8 }}>
              Vector Transferability · Detail
            </div>
            {vectors.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 22, rowGap: 8 }} data-testid="report-vector-list">
                {vectors.map((v, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3 }}>
                      <span style={{ color: ATANDA.ink, fontWeight: 600 }}>{v.subject}</span>
                      <span style={{ color: ATANDA.sub, fontFamily: "monospace" }}>{Math.round(v.score)}</span>
                    </div>
                    <Bar value={v.score} max={100} color={ATANDA.teal} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: ATANDA.sub }}>No transferability vectors on file yet.</div>
            )}
          </div>

          {/* Archetype handicap */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: ATANDA.blue }}>
              Archetype Handicap
            </div>
            <div style={{ fontSize: 10.5, color: ATANDA.sub, marginTop: 4, marginBottom: 10 }}>
              Your dominant way of working with AI. Bars show the weighted mix across the three operating archetypes.
            </div>
            <div data-testid="card-report-archetype">
              {arch.map((r) => (
                <div key={r.label} style={{ marginBottom: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: ATANDA.ink, fontWeight: 600 }}>{r.label}</span>
                    <span style={{ color: ATANDA.sub, fontFamily: "monospace" }}>{Math.round(r.v)}%</span>
                  </div>
                  <Bar value={r.v} max={100} color={r.color} />
                </div>
              ))}
            </div>
          </div>

          {/* spacer pushes the page-2 footer to the sheet floor */}
          <div style={{ flex: 1, minHeight: 8 }} />

          {/* Page 2 footer */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${ATANDA.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1.5 }}>
              Powered by ATANDA · ARK Synthesized Intelligence
            </span>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1 }}>
              Page 2 of 2 · Confidential · {arkId}
            </span>
          </div>
        </div>
        <div style={{ height: 6, background: BRAND_BAR }} />
      </div>
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
  const adviserRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"report" | "adviser">("report");
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

  // Both documents share the same fetched data, so each view exports the sheet
  // that is currently on screen with its own filename stamp.
  const activeEl = () => (view === "adviser" ? adviserRef.current : reportRef.current);
  const activeBase = () =>
    view === "adviser" ? adviserFileStamp(user?.name) : reportFileStamp(user?.name);

  const handleExportImage = async (type: "png" | "jpeg") => {
    const el = activeEl();
    if (!el) return;
    setExporting(type);
    try {
      await exportReportImage(el, type, activeBase());
    } catch (err) {
      console.error("Image export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    const el = activeEl();
    if (!el) return;
    setExporting("pdf");
    try {
      await exportReportPdf(el, activeBase());
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

  // Empty-profile state: the user removed every contributed source, so the
  // persisted assessment is an honest zeroed "no profile" row. Render an
  // explicit empty state instead of a branded report full of floor-baseline
  // zeros — there's nothing to export until a source is re-added.
  if (assessment && isEmptyProfile(assessment.sourcesUsed, assessment.completeness)) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center" data-testid="report-no-sources">
        <h2 className="text-2xl font-display font-bold text-white mb-2">No sources to report on</h2>
        <p className="text-sm text-muted-foreground font-sans max-w-md mb-6 leading-relaxed">
          You've removed every source that fed your ARK profile, so there's nothing to summarise yet. Add a résumé, self-assessment or LinkedIn profile and your ARK Report will rebuild automatically.
        </p>
        <Link
          href="/upload"
          data-testid="button-report-add-source"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-wider px-6 py-3 text-sm font-medium rounded-md transition-all hover:scale-[1.02]"
        >
          Add a source
        </Link>
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
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider">
            {view === "adviser" ? "Career Adviser Report" : "ARK Report"}
          </h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {view === "adviser"
              ? "Plain-English guide to every metric · stays in sync with your ARK Report."
              : "One-page executive summary · branded · export-ready."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={handleExportPDF} icon={FileText} label="PDF" busy={exporting === "pdf"} testId="button-export-pdf" />
          <Btn onClick={() => handleExportImage("png")} icon={FileImage} label="PNG" busy={exporting === "png"} testId="button-export-png" />
          <Btn onClick={() => handleExportImage("jpeg")} icon={FileType2} label="JPEG" busy={exporting === "jpeg"} testId="button-export-jpeg" />
        </div>
      </div>

      {/* Document switcher — the Career Adviser Report accompanies the ARK Report */}
      <div className="flex gap-2 print:hidden" data-testid="report-view-toggle">
        <button
          type="button"
          onClick={() => setView("report")}
          disabled={exporting !== null}
          data-testid="button-view-report"
          className={`flex-1 sm:flex-none px-5 py-2.5 rounded-md font-mono uppercase tracking-widest text-xs transition-all border ${
            view === "report"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent text-muted-foreground border-white/15 hover:border-primary/50 hover:text-white"
          }`}
        >
          ARK Report
        </button>
        <button
          type="button"
          onClick={() => setView("adviser")}
          disabled={exporting !== null}
          data-testid="button-view-adviser"
          className={`flex-1 sm:flex-none px-5 py-2.5 rounded-md font-mono uppercase tracking-widest text-xs transition-all border ${
            view === "adviser"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent text-muted-foreground border-white/15 hover:border-primary/50 hover:text-white"
          }`}
        >
          Career Adviser
        </button>
      </div>

      {view === "report" ? (
        <ArkReportSheet
          ref={reportRef}
          name={user?.name}
          role={user?.role}
          identity={identity}
          lhcs={lhcs}
          assessment={assessment}
        />
      ) : (
        <ArkAdviserSheet
          ref={adviserRef}
          name={user?.name}
          role={user?.role}
          identity={identity}
          lhcs={lhcs}
          assessment={assessment}
        />
      )}
    </div>
  );
}
