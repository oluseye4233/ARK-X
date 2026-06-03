import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Loader2, ShieldCheck, ShieldX, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { ATANDA, BRAND_BAR } from "@/lib/arkReportTheme";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779729580194.png";

/* Public, no-login claim confirmation view (route /confirm/:token). An external
   party (a former manager, a registrar) opens the link from their email to
   approve or reject ONE résumé claim a candidate has cited. Rendered OUTSIDE the
   app chrome — the recipient has no ARK account. */

const TYPE_LABEL: Record<string, string> = {
  EMPLOYMENT: "Employment",
  CERTIFICATION: "Certification",
  SKILL: "Verified skill",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: ATANDA.sub,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${ATANDA.line}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  color: ATANDA.ink,
  background: "#fff",
  outline: "none",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef1f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ height: 6, background: BRAND_BAR }} />
        <div style={{ padding: "28px 32px 32px" }}>{children}</div>
      </div>
    </div>
  );
}

export default function ConfirmInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [responderName, setResponderName] = useState("");
  const [responderOrg, setResponderOrg] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [result, setResult] = useState<"CONFIRMED" | "REJECTED" | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getConfirmationInvite(token)
      .then((d) => {
        setData(d);
        setResponderOrg(d.recipientOrg ?? "");
        setResponderName(d.recipientName ?? "");
      })
      .catch((e) => setError(e.message || "This confirmation link is not valid."))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (decision: "approve" | "reject") => {
    if (!token) return;
    setSubmitting(decision);
    setError(null);
    try {
      const res = await api.respondConfirmationInvite(token, {
        decision,
        responderName: responderName.trim() || undefined,
        responderOrg: responderOrg.trim() || undefined,
        responseNote: responseNote.trim() || undefined,
      });
      setResult(res.status === "CONFIRMED" ? "CONFIRMED" : "REJECTED");
    } catch (e: any) {
      setError(e.message || "Could not submit your response.");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0" }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: ATANDA.blue }} />
          <p style={{ marginTop: 12, fontSize: 13, color: ATANDA.sub }}>Loading confirmation request…</p>
        </div>
      </Shell>
    );
  }

  if (error && !data) {
    return (
      <Shell>
        <img src={atandaLogo} alt="ATANDA" style={{ height: 28, objectFit: "contain", marginBottom: 16 }} />
        <h1 style={{ fontSize: 20, fontWeight: 800, color: ATANDA.ink, marginBottom: 8 }} data-testid="confirm-invite-error">
          This confirmation link isn’t available
        </h1>
        <p style={{ fontSize: 14, color: ATANDA.sub, lineHeight: 1.5 }}>{error}</p>
      </Shell>
    );
  }

  // Already answered (here or earlier), or this page just submitted a decision.
  const finalStatus = result ?? (data.status === "APPROVED" ? "CONFIRMED" : data.status === "REJECTED" ? "REJECTED" : null);
  const isExpired = data.status === "EXPIRED";
  const isClosed = !!finalStatus || isExpired;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <img src={atandaLogo} alt="ATANDA" style={{ height: 26, objectFit: "contain" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: ATANDA.sub, letterSpacing: 1, textTransform: "uppercase" }}>
          ARK · Résumé confirmation
        </span>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 800, color: ATANDA.ink, lineHeight: 1.3, marginBottom: 6 }} data-testid="text-confirm-heading">
        {data.candidateName} asked you to confirm a claim
      </h1>
      <p style={{ fontSize: 13.5, color: ATANDA.sub, lineHeight: 1.5, marginBottom: 18 }}>
        Please review the {TYPE_LABEL[data.type]?.toLowerCase() ?? "résumé"} claim below and approve it if it’s accurate, or
        decline if it isn’t. No account is needed.
      </p>

      <div
        style={{ border: `1px solid ${ATANDA.line}`, borderRadius: 10, padding: "14px 16px", marginBottom: 18, background: ATANDA.panel }}
        data-testid="block-claim"
      >
        <div style={labelStyle}>{TYPE_LABEL[data.type] ?? "Claim"}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: ATANDA.ink }} data-testid="text-claim-label">
          {data.targetLabel}
        </div>
        {data.note && (
          <div style={{ marginTop: 10, fontSize: 13, color: ATANDA.ink, fontStyle: "italic" }} data-testid="text-candidate-note">
            “{data.note}”
          </div>
        )}
      </div>

      {isClosed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderRadius: 10,
            background:
              finalStatus === "CONFIRMED" ? "#e7f7ee" : finalStatus === "REJECTED" ? "#fdeaea" : "#f3f0e6",
            color: finalStatus === "CONFIRMED" ? ATANDA.green : finalStatus === "REJECTED" ? ATANDA.red : ATANDA.sub,
          }}
          data-testid="block-outcome"
        >
          {finalStatus === "CONFIRMED" ? (
            <ShieldCheck className="w-5 h-5" />
          ) : finalStatus === "REJECTED" ? (
            <ShieldX className="w-5 h-5" />
          ) : (
            <Clock className="w-5 h-5" />
          )}
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {finalStatus === "CONFIRMED"
              ? "Thank you — you confirmed this claim."
              : finalStatus === "REJECTED"
                ? "Thank you — you declined this claim."
                : "This confirmation request has expired."}
          </span>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Your name</div>
            <input
              value={responderName}
              onChange={(e) => setResponderName(e.target.value)}
              placeholder="e.g. Jane Doe"
              style={inputStyle}
              data-testid="input-responder-name"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Your organisation</div>
            <input
              value={responderOrg}
              onChange={(e) => setResponderOrg(e.target.value)}
              placeholder="e.g. Acme Corp"
              style={inputStyle}
              data-testid="input-responder-org"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Note (optional)</div>
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder="Add any context for this confirmation…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              data-testid="input-response-note"
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: ATANDA.red, marginBottom: 12 }} data-testid="text-respond-error">
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => submit("approve")}
              disabled={!!submitting}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: ATANDA.green,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
              data-testid="button-approve"
            >
              {submitting === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Confirm
            </button>
            <button
              onClick={() => submit("reject")}
              disabled={!!submitting}
              style={{
                flex: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#fff",
                color: ATANDA.red,
                border: `1px solid ${ATANDA.red}`,
                borderRadius: 8,
                padding: "11px 16px",
                fontSize: 14,
                fontWeight: 700,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
              data-testid="button-reject"
            >
              {submitting === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
              Decline
            </button>
          </div>
        </>
      )}

      <p style={{ fontSize: 10.5, color: ATANDA.sub, marginTop: 18, lineHeight: 1.5, textAlign: "center" }}>
        Sent to you by an ARK candidate. ARK never shares your email or response with third parties.
      </p>
    </Shell>
  );
}
