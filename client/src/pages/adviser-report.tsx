import { forwardRef } from "react";
import { ATANDA, BRAND_BAR } from "@/lib/arkReportTheme";
import { buildAdviserReport, type AdviserSection } from "@/lib/arkAdviserNarrative";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779729580194.png";

interface ArkAdviserSheetProps {
  name?: string | null;
  role?: string | null;
  identity: any;
  lhcs: any;
  assessment: any;
}

/* A small numbered guidance card explaining a single metric in plain English. */
function GuideCard({ n, section }: { n: number; section: AdviserSection }) {
  return (
    <div
      data-testid={`adviser-section-${section.id}`}
      style={{
        border: `1px solid ${ATANDA.line}`,
        borderRadius: 12,
        background: "#fff",
        padding: 16,
        breakInside: "avoid",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: ATANDA.blue,
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {n}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: ATANDA.ink, lineHeight: 1.15 }}>
            {section.metric}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{ fontSize: 13, fontWeight: 800, color: ATANDA.blue, lineHeight: 1.1 }}
            data-testid={`adviser-value-${section.id}`}
          >
            {section.valueLabel}
          </div>
          {section.band && (
            <div style={{ fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1, color: ATANDA.sub, marginTop: 2 }}>
              {section.band}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
        <GuideRow label="What it is" body={section.whatItIs} color={ATANDA.sub} />
        <GuideRow label="What yours means" body={section.yourResult} color={ATANDA.ink} />
        <GuideRow label="Your next step" body={section.nextStep} color={ATANDA.green} accent />
      </div>
    </div>
  );
}

function GuideRow({ label, body, color, accent }: { label: string; body: string; color: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? "#F1FBF5" : ATANDA.panel,
        border: `1px solid ${accent ? "#CDEBD9" : ATANDA.line}`,
        borderRadius: 8,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: accent ? ATANDA.green : ATANDA.blue, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.45, color }}>{body}</div>
    </div>
  );
}

/* The branded, export-ready Career Adviser Guide artifact. It accompanies the
   ARK Report and explains every metric in plain English. Pure presentation,
   driven entirely by the same data as the ARK Report so the two stay in sync. */
export const ArkAdviserSheet = forwardRef<HTMLDivElement, ArkAdviserSheetProps>(function ArkAdviserSheet(
  { name, role, identity, lhcs, assessment },
  ref,
) {
  const a = assessment || {};
  const { headline, sections } = buildAdviserReport(identity, lhcs, assessment);
  const arkId = identity?.arkIdString || (a.id ? a.id.slice(0, 8).toUpperCase() : "—");
  const displayName = a.candidateName || name || "—";
  const jobRole = a.currentRole || role || "Professional";

  const generatedAt = new Date();
  const stampDate = generatedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const stampTime = generatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const PAGE_W = 794;
  const FONT = "'Space Grotesk', system-ui, sans-serif";

  return (
    <div ref={ref} data-testid="ark-adviser-sheet" style={{ width: PAGE_W, margin: "0 auto", fontFamily: FONT, color: ATANDA.ink }}>
      <div style={{ width: PAGE_W, background: "#ffffff", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ height: 6, background: BRAND_BAR }} />

        <div style={{ padding: 28 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={atandaLogo} alt="ATANDA" crossOrigin="anonymous" style={{ width: 54, height: 54, objectFit: "contain" }} data-testid="img-adviser-logo" />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 1.5, color: ATANDA.ink, lineHeight: 1 }}>
                  CAREER ADVISER REPORT
                </div>
                <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: ATANDA.sub, marginTop: 4 }}>
                  Your plain-English guide to the ARK Report · Powered by ATANDA
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10, fontFamily: "monospace", color: ATANDA.sub, lineHeight: 1.7 }}>
              <div data-testid="text-adviser-timestamp">{stampDate}</div>
              <div>{stampTime}</div>
              <div>ARK-ID: {arkId}</div>
            </div>
          </div>

          {/* Subject + intro */}
          <div style={{ marginTop: 16, paddingBottom: 14, borderBottom: `1px solid ${ATANDA.line}` }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ATANDA.ink, lineHeight: 1.1 }} data-testid="text-adviser-name">
              Guide for {displayName}
            </div>
            <div style={{ fontSize: 11, color: ATANDA.sub, marginTop: 4, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>
              {jobRole}
            </div>
          </div>

          <div
            data-testid="text-adviser-headline"
            style={{
              marginTop: 14,
              background: ATANDA.panel,
              border: `1px solid ${ATANDA.line}`,
              borderRadius: 12,
              padding: 16,
              fontSize: 12,
              lineHeight: 1.5,
              color: ATANDA.ink,
            }}
          >
            {headline}
          </div>

          {/* Guidance cards — one per metric */}
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr", gap: 12 }} data-testid="adviser-sections">
            {sections.map((s, i) => (
              <GuideCard key={s.id} n={i + 1} section={s} />
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: `1px solid ${ATANDA.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <img src={atandaLogo} alt="ATANDA" crossOrigin="anonymous" style={{ width: 22, height: 22, objectFit: "contain" }} />
              <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1.5 }}>
                Companion to the ARK Report · Updates automatically with your data
              </span>
            </div>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: ATANDA.sub, textTransform: "uppercase", letterSpacing: 1 }}>
              Confidential · {arkId}
            </span>
          </div>
        </div>

        <div style={{ height: 6, background: BRAND_BAR }} />
      </div>
    </div>
  );
});
