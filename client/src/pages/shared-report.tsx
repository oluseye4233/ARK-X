import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Loader2, Download } from "lucide-react";
import { api } from "@/lib/api";
import { ArkReportSheet } from "@/pages/report";
import { ArkAdviserSheet } from "@/pages/adviser-report";
import { ATANDA } from "@/lib/arkReportTheme";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779729580194.png";

/* Public, no-login ARK Report view (route /r/:token). Renders the same branded
   ARK Report + Career Adviser sheets the owner sees, resolved live from the
   share token. The visible sheets double as the print surface (see the
   @media print rules in index.css) so "Download PDF" yields a true vector PDF
   carrying both documents. Rendered OUTSIDE the app chrome. */
export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .getSharedReport(token)
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#eef1f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: ATANDA.blue }} />
        <p style={{ marginTop: 14, fontFamily: "monospace", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: ATANDA.sub }}>
          Loading ARK Report…
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#eef1f5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <img src={atandaLogo} alt="ATANDA" style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 16 }} />
        <h1 style={{ fontSize: 22, fontWeight: 800, color: ATANDA.ink, marginBottom: 8 }} data-testid="shared-report-not-found">
          This report link is no longer available
        </h1>
        <p style={{ fontSize: 14, color: ATANDA.sub, maxWidth: 420, lineHeight: 1.5 }}>
          The link may have been revoked by its owner, or it may be incorrect. Ask them to share a fresh link.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#eef1f5" }}>
      {/* Top bar — screen only (hidden in the printed PDF). */}
      <div
        className="print:hidden"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          padding: "12px 18px",
          background: "#fff",
          borderBottom: `1px solid ${ATANDA.line}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={atandaLogo} alt="ATANDA" style={{ width: 34, height: 34, objectFit: "contain" }} />
          <span style={{ fontFamily: "monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: ATANDA.ink, fontWeight: 700 }}>
            ARK Report
          </span>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          data-testid="button-shared-download"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: ATANDA.blue,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 16px",
            fontFamily: "monospace",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 1.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Download className="w-4 h-4" /> Download PDF
        </button>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 64px" }}>
        {/* Visible sheets = the print surface (both ARK Report + Career Adviser). */}
        <div className="ark-print-surface" style={{ display: "grid", gap: 24 }}>
          <div className="ark-print-page" style={{ overflowX: "auto" }}>
            <ArkReportSheet name={data.name} role={data.role} identity={data.identity} lhcs={data.lhcs} assessment={data.assessment} />
          </div>
          <div className="ark-print-page" style={{ overflowX: "auto" }}>
            <ArkAdviserSheet name={data.name} role={data.role} identity={data.identity} lhcs={data.lhcs} assessment={data.assessment} />
          </div>
        </div>

        <p
          className="print:hidden"
          style={{ marginTop: 28, textAlign: "center", fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: ATANDA.sub }}
        >
          Generated by ATANDA · ARK Platform
        </p>
      </div>
    </div>
  );
}
