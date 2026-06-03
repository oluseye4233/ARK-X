import { useEffect, useRef, useState } from "react";
import { Loader2, FileText, FileImage, FileType2, Upload, Lock, X, ShieldCheck, Clock, ShieldX, HelpCircle, Mail, Send, Copy, Check, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { Link } from "wouter";
import { ATANDA, BRAND_BAR, Bar } from "@/lib/arkReportTheme";
import {
  resumeFileStamp,
  exportResumePdf,
  exportResumeImage,
  type ResumeExportData,
} from "@/lib/arkResumeExport";
import { certMatches } from "@shared/claimMatch";
import atandaLogo from "@assets/WEB_LEARNING_SYSTEMS_(1920_x_1280_px)_(2)_1779729580194.png";

const TIER_HEX: Record<string, string> = {
  Platinum: ATANDA.purple,
  Gold: ATANDA.yellow,
  Silver: ATANDA.teal,
  Bronze: ATANDA.orange,
};

const STATUS_META: Record<string, { label: string; color: string; Icon: typeof ShieldCheck }> = {
  CONFIRMED: { label: "Confirmed", color: ATANDA.green, Icon: ShieldCheck },
  PENDING: { label: "Pending", color: ATANDA.yellow, Icon: Clock },
  REJECTED: { label: "Rejected", color: ATANDA.red, Icon: ShieldX },
  UNVERIFIED: { label: "Unverified", color: ATANDA.sub, Icon: HelpCircle },
};

function StatusBadge({
  status,
  org,
  logoUrl,
}: {
  status: string;
  org?: string | null;
  logoUrl?: string | null;
}) {
  const m = STATUS_META[status] ?? STATUS_META.UNVERIFIED;
  const Icon = m.Icon;
  return (
    <span
      data-testid={`badge-confirmation-${status.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        color: m.color,
        border: `1px solid ${m.color}`,
        borderRadius: 999,
        padding: "1px 8px",
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: 11, height: 11 }} />
      {m.label}
      {org ? (
        <>
          {" · "}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ width: 12, height: 12, borderRadius: 2, objectFit: "contain" }}
            />
          ) : null}
          {org}
        </>
      ) : (
        ""
      )}
    </span>
  );
}

// Verification tier chip. Verified cards show their tier; matched-but-unverified
// cards render an explicit "Yet to verify" pill so the living layer is complete.
function TierChip({ tier }: { tier: string | null }) {
  if (!tier) {
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: ATANDA.sub,
          background: ATANDA.panel,
          border: `1px dashed ${ATANDA.line}`,
          borderRadius: 4,
          padding: "1px 6px",
          whiteSpace: "nowrap",
        }}
      >
        Yet to verify
      </span>
    );
  }
  const color = TIER_HEX[tier] ?? ATANDA.sub;
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        color: "#fff",
        background: color,
        borderRadius: 4,
        padding: "1px 6px",
      }}
    >
      {tier}
    </span>
  );
}

// Concise O*NET / WEF / SFIA standards labels for a mapped Primitive Card. Takes
// the first label from each framework so the living layer is explicitly tied to
// recognized skill standards (a core ARK RESUME requirement).
function standardsLabels(mappings: any, max = 3): string[] {
  if (!mappings) return [];
  const out: string[] = [];
  if (mappings.onet?.[0]) out.push(`O*NET: ${mappings.onet[0]}`);
  if (mappings.wef?.[0]) out.push(`WEF: ${mappings.wef[0]}`);
  if (mappings.sfia?.[0]) out.push(`SFIA: ${mappings.sfia[0]}`);
  return out.slice(0, max);
}

export default function ArkResumePage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "pdf" | "png" | "jpeg">(null);
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Task #60 — external confirmation invites the candidate sends by email.
  const [invites, setInvites] = useState<any[]>([]);
  const [inviteClaim, setInviteClaim] = useState<null | {
    type: "EMPLOYMENT" | "CERTIFICATION" | "SKILL";
    targetRef: string;
    targetLabel: string;
  }>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteOrg, setInviteOrg] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteEmailWarning, setInviteEmailWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Task #65 — pending-invite lifecycle (revoke / resend) state.
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [resentLinks, setResentLinks] = useState<Record<string, string>>({});
  const [copiedResentId, setCopiedResentId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api
      .getArkResume()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadInvites = () => {
    api
      .listConfirmationInvites()
      .then((rows: any[]) => setInvites(rows))
      .catch(() => setInvites([]));
  };

  useEffect(() => {
    if (!user) return;
    load();
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openInvite = (claim: {
    type: "EMPLOYMENT" | "CERTIFICATION" | "SKILL";
    targetRef: string;
    targetLabel: string;
  }) => {
    setInviteClaim(claim);
    setInviteEmail("");
    setInviteName("");
    setInviteOrg("");
    setInviteMessage("");
    setInviteError(null);
    setInviteLink(null);
    setInviteEmailSent(false);
    setInviteEmailWarning(null);
    setCopied(false);
  };

  const submitInvite = async () => {
    if (!inviteClaim) return;
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      const res = await api.createConfirmationInvite({
        type: inviteClaim.type,
        targetRef: inviteClaim.targetRef,
        targetLabel: inviteClaim.targetLabel,
        recipientEmail: inviteEmail.trim(),
        recipientName: inviteName.trim() || undefined,
        recipientOrg: inviteOrg.trim() || undefined,
        note: inviteMessage.trim() || undefined,
      });
      setInviteLink(res.link || `${window.location.origin}${res.path}`);
      setInviteEmailSent(!!res.emailSent);
      setInviteEmailWarning(res.emailSent ? null : res.emailError || null);
      loadInvites();
    } catch (e: any) {
      setInviteError(e.message || "Could not create the invite.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const revokeInvite = async (id: string) => {
    setInviteActionId(id);
    try {
      await api.revokeConfirmationInvite(id);
      loadInvites();
    } catch {
      /* surfaced via reload; row stays as-is on failure */
    } finally {
      setInviteActionId(null);
    }
  };

  const resendInvite = async (id: string) => {
    setInviteActionId(id);
    try {
      const res = await api.resendConfirmationInvite(id);
      setResentLinks((prev) => ({ ...prev, [id]: `${window.location.origin}${res.path}` }));
      loadInvites();
    } catch {
      /* surfaced via reload; row stays as-is on failure */
    } finally {
      setInviteActionId(null);
    }
  };

  const copyResentLink = async (id: string) => {
    const link = resentLinks[id];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedResentId(id);
      setTimeout(() => setCopiedResentId((cur) => (cur === id ? null : cur)), 2000);
    } catch {
      /* clipboard unavailable — the link is still selectable in the field */
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the link is still selectable in the field */
    }
  };

  const toExportData = (): ResumeExportData => ({
    name: data.user.name,
    currentRole: data.identity.currentRole,
    currentEmployer: data.identity.currentEmployer,
    contactEmail: data.identity.contactEmail,
    contactPhone: data.identity.contactPhone,
    location: data.identity.location,
    linkLinkedin: data.identity.linkLinkedin,
    linkGithub: data.identity.linkGithub,
    linkPortfolio: data.identity.linkPortfolio,
    arkScore: data.user.arkScore,
    jst: data.jst,
    ats: { score: data.ats.score, band: data.ats.band },
    verifiedDeck: data.verifiedDeck.map((c: any) => ({ name: c.name, tier: c.tier, category: c.category, standards: standardsLabels(c.mappings) })),
    workHistory: data.workHistory.map((w: any) => ({
      company: w.company,
      role: w.role,
      startDate: w.startDate,
      endDate: w.endDate,
      location: w.location,
      highlights: w.highlights,
      mappedCards: w.mappedCards.map((c: any) => ({ name: c.name, tier: c.tier, standards: standardsLabels(c.mappings) })),
      confirmation: w.confirmation ? { status: w.confirmation.status, confirmerOrg: w.confirmation.confirmerOrg } : null,
    })),
    education: data.education,
    certifications: data.certifications,
  });

  const handleExportPdf = async () => {
    setExporting("pdf");
    try {
      await exportResumePdf(toExportData(), resumeFileStamp(data.user.name));
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExporting(null);
    }
  };

  const handleExportImage = async (type: "png" | "jpeg") => {
    const el = sheetRef.current;
    if (!el) return;
    setExporting(type);
    try {
      await exportResumeImage(el, type, resumeFileStamp(data.user.name));
    } catch (e) {
      console.error("Image export failed:", e);
    } finally {
      setExporting(null);
    }
  };

  const handleHeadshotFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      setError("Headshot must be under 500KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setUploadingHeadshot(true);
      try {
        await api.setArkResumeHeadshot(dataUrl);
        load();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploadingHeadshot(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveHeadshot = async () => {
    setUploadingHeadshot(true);
    try {
      await api.deleteArkResumeHeadshot();
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingHeadshot(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="font-mono text-sm text-muted-foreground uppercase">Compiling ARK Resume...</p>
      </div>
    );
  }

  // Ineligible (403) or any load error → precise locked state. The thrown
  // message IS the eligibility reason for a 403.
  if (error || !data) {
    return (
      <div className="w-full max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center px-6" data-testid="ark-resume-locked">
        <Lock className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-2xl font-display font-bold text-white mb-2">ARK RESUME is locked</h2>
        <p className="font-mono text-sm text-muted-foreground mb-6 max-w-lg">
          {error || "Unable to load your ARK Resume."}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/subscription" className="inline-flex items-center justify-center bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest h-10 px-4 rounded-md" data-testid="link-upgrade">
            Upgrade Plan
          </Link>
          <Link href="/dashboard" className="inline-flex items-center justify-center border border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs uppercase tracking-widest h-10 px-4 rounded-md" data-testid="link-verify-cards">
            Verify a Primitive Card
          </Link>
        </div>
      </div>
    );
  }

  const headshot = data.user.headshotDataUrl as string | null;

  // SKILL confirmations match on the stable CODEC card id, so they index by an
  // exact lowercased key. CERTIFICATION confirmations match tolerantly (the SAME
  // comparison the server uses) so a badge issued against a reasonable variant of
  // a certification label still renders instead of silently orphaning. Missing →
  // rendered as "Unverified".
  const allConfs = (data.confirmations ?? []) as any[];
  const skillByKey = new Map<string, any>();
  const certConfs: any[] = [];
  for (const c of allConfs) {
    if (c.type === "SKILL") skillByKey.set(String(c.targetRef).toLowerCase(), c);
    else if (c.type === "CERTIFICATION") certConfs.push(c);
  }
  const skillConf = (cardId: string) => skillByKey.get(cardId.toLowerCase()) ?? null;
  const certConf = (label: string) =>
    certConfs.find((c) => certMatches(label, String(c.targetRef))) ?? null;
  // Per-claim confirmation status lookup for the Request Confirmations panel,
  // keyed exactly as that panel queries it: `${type}:${targetRef.toLowerCase()}`
  // — so a claim can show whether a request already resolved (the candidate's own
  // view; badge rendering uses the tolerant maps above).
  const confByKey = new Map<string, any>();
  for (const c of allConfs) {
    confByKey.set(`${c.type}:${String(c.targetRef).toLowerCase()}`, c);
  }

  return (
    <>
    <div className="w-full max-w-5xl mx-auto pb-16">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">ARK RESUME</h1>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            ATS-optimized · verified-skill resume
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleHeadshotFile} data-testid="input-headshot" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingHeadshot} data-testid="button-upload-headshot">
            {uploadingHeadshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            {headshot ? "Replace Photo" : "Add Photo"}
          </Button>
          {headshot && (
            <Button variant="outline" size="sm" onClick={handleRemoveHeadshot} disabled={uploadingHeadshot} data-testid="button-remove-headshot">
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" onClick={handleExportPdf} disabled={!!exporting} data-testid="button-export-pdf">
            {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />}
            PDF (text)
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportImage("png")} disabled={!!exporting} data-testid="button-export-png">
            {exporting === "png" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileImage className="w-4 h-4 mr-1" />}
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportImage("jpeg")} disabled={!!exporting} data-testid="button-export-jpeg">
            {exporting === "jpeg" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileType2 className="w-4 h-4 mr-1" />}
            JPEG
          </Button>
        </div>
      </div>

      {/* The export-ready sheet (ATANDA light theme for print/share fidelity) */}
      <div
        ref={sheetRef}
        data-testid="ark-resume-sheet"
        style={{
          background: "#fff",
          color: ATANDA.ink,
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: 0,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ height: 6, background: BRAND_BAR }} />
        <div style={{ padding: "28px 36px 36px" }}>
          {/* Header: identity (left) + JST block (TOP-RIGHT, prominent) */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {headshot && (
                <img
                  src={headshot}
                  alt={data.user.name}
                  style={{ width: 76, height: 76, borderRadius: 8, objectFit: "cover", border: `1px solid ${ATANDA.line}` }}
                />
              )}
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.05 }} data-testid="text-resume-name">
                  {data.user.name}
                </div>
                {(data.identity.currentRole || data.identity.currentEmployer) && (
                  <div style={{ fontSize: 14, color: ATANDA.sub, marginTop: 4 }}>
                    {[data.identity.currentRole, data.identity.currentEmployer].filter(Boolean).join(" @ ")}
                  </div>
                )}
                <div style={{ fontSize: 11, color: ATANDA.ink, marginTop: 8, lineHeight: 1.5 }}>
                  {[data.identity.contactEmail, data.identity.contactPhone, data.identity.location].filter(Boolean).join("  •  ")}
                </div>
                <div style={{ fontSize: 11, color: ATANDA.blue, marginTop: 2, lineHeight: 1.5 }}>
                  {[data.identity.linkLinkedin, data.identity.linkGithub, data.identity.linkPortfolio].filter(Boolean).join("  •  ")}
                </div>
              </div>
            </div>

            {/* JST — the headline metric, deliberately top-right */}
            <div
              style={{ background: ATANDA.blue, color: "#fff", borderRadius: 10, padding: "12px 16px", textAlign: "center", minWidth: 130 }}
              data-testid="block-jst-top-right"
            >
              <div style={{ fontSize: 9, letterSpacing: 2, opacity: 0.85 }}>JST INDEX</div>
              <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{data.jst.total}</div>
              <div style={{ fontSize: 9, opacity: 0.85, marginTop: 2 }}>/ 300</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, marginTop: 8, fontSize: 9 }}>
                <span>J {data.jst.jobs}</span>
                <span>S {data.jst.skills}</span>
                <span>T {data.jst.talent}</span>
              </div>
            </div>
          </div>

          {/* ATS + ARK strip */}
          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220, border: `1px solid ${ATANDA.line}`, borderRadius: 8, padding: "10px 14px" }} data-testid="block-ats-score">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ATANDA.sub, letterSpacing: 1 }}>ATS READINESS</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: ATANDA.blue }}>
                  {data.ats.score}<span style={{ fontSize: 12, color: ATANDA.sub }}>/100</span>
                </span>
              </div>
              <div style={{ marginTop: 6 }}>
                <Bar value={data.ats.score} max={100} color={ATANDA.blue} />
              </div>
              <div style={{ fontSize: 10, color: ATANDA.sub, marginTop: 4 }}>{data.ats.band}</div>
            </div>
            <div style={{ width: 150, border: `1px solid ${ATANDA.line}`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: ATANDA.sub, letterSpacing: 1 }}>ARK SCORE</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: ATANDA.ink }}>{data.user.arkScore}<span style={{ fontSize: 11, color: ATANDA.sub }}>/600</span></div>
              {data.user.arkIdString && (
                <div style={{ fontSize: 8.5, color: ATANDA.sub, marginTop: 2, wordBreak: "break-all" }}>{data.user.arkIdString}</div>
              )}
            </div>
          </div>

          {/* ATS breakdown */}
          {data.ats.items?.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px 24px" }} data-testid="block-ats-breakdown">
              {data.ats.items.map((it: any) => (
                <div key={it.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: ATANDA.sub }}>
                  <span>{it.label}</span>
                  <span style={{ fontWeight: 700, color: ATANDA.ink }}>{it.points}/{it.max}</span>
                </div>
              ))}
            </div>
          )}

          {/* Verified Skills & Roles — global deck */}
          {data.verifiedDeck.length > 0 && (
            <Section title="Verified Skills & Roles">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} data-testid="block-verified-deck">
                {data.verifiedDeck.map((c: any) => (
                  <div
                    key={c.cardId}
                    style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${ATANDA.line}`, borderRadius: 8, padding: "6px 10px" }}
                    data-testid={`card-verified-${c.cardId}`}
                  >
                    <span style={{ fontSize: 16 }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 9, color: ATANDA.sub }}>{c.category}</div>
                      {standardsLabels(c.mappings).length > 0 && (
                        <div style={{ fontSize: 8.5, color: ATANDA.sub, marginTop: 1 }} data-testid={`text-standards-${c.cardId}`}>
                          {standardsLabels(c.mappings).join(" · ")}
                        </div>
                      )}
                    </div>
                    <TierChip tier={c.tier} />
                    {(() => { const sc = skillConf(c.cardId); return sc ? <StatusBadge status={sc.status} org={sc.confirmerOrg} logoUrl={sc.confirmerLogoUrl} /> : null; })()}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Experience — with per-company AI-mapped cards + confirmation */}
          {data.workHistory.length > 0 && (
            <Section title="Experience">
              {data.workHistory.map((w: any, i: number) => (
                <div key={i} style={{ marginBottom: 14 }} data-testid={`block-work-${i}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {[w.role, w.company].filter(Boolean).join(" — ") || w.company}
                    </div>
                    <div style={{ fontSize: 10, color: ATANDA.sub, whiteSpace: "nowrap" }}>
                      {[w.startDate, w.endDate].filter(Boolean).join(" – ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    {w.location && <span style={{ fontSize: 10, color: ATANDA.sub }}>{w.location}</span>}
                    {w.company && (
                      <StatusBadge
                        status={w.confirmation?.status ?? "UNVERIFIED"}
                        org={w.confirmation?.confirmerOrg}
                        logoUrl={w.confirmation?.confirmerLogoUrl}
                      />
                    )}
                  </div>
                  {(w.highlights ?? []).length > 0 && (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                      {w.highlights.map((h: string, hi: number) => (
                        <li key={hi} style={{ fontSize: 11, lineHeight: 1.5, color: ATANDA.ink }}>{h}</li>
                      ))}
                    </ul>
                  )}
                  {w.mappedCards.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }} data-testid={`block-work-cards-${i}`}>
                      {w.mappedCards.map((c: any) => (
                        <span
                          key={c.cardId}
                          title={standardsLabels(c.mappings, 6).join(" · ")}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color: ATANDA.blue, background: ATANDA.panel, border: `1px solid ${ATANDA.line}`, borderRadius: 999, padding: "1px 8px" }}
                        >
                          {c.emoji} {c.name}
                          {standardsLabels(c.mappings, 1)[0] && (
                            <span style={{ fontSize: 8.5, fontWeight: 500, color: ATANDA.sub }}>
                              {standardsLabels(c.mappings, 1)[0]}
                            </span>
                          )}
                          <TierChip tier={c.tier} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}

          {/* Education */}
          {data.education.length > 0 && (
            <Section title="Education">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.education.map((e: string, i: number) => (
                  <li key={i} style={{ fontSize: 11.5, lineHeight: 1.6 }}>{e}</li>
                ))}
              </ul>
            </Section>
          )}

          {/* Certifications */}
          {data.certifications.length > 0 && (
            <Section title="Certifications">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.certifications.map((c: string, i: number) => {
                  const cc = certConf(c);
                  return (
                    <li key={i} style={{ fontSize: 11.5, lineHeight: 1.6 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {c}
                        <StatusBadge status={cc?.status ?? "UNVERIFIED"} org={cc?.confirmerOrg} logoUrl={cc?.confirmerLogoUrl} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, paddingTop: 12, borderTop: `1px solid ${ATANDA.line}` }}>
            <img src={atandaLogo} alt="ATANDA" style={{ height: 22, objectFit: "contain" }} />
            <span style={{ fontSize: 9, color: ATANDA.sub }}>
              Generated by ARK · Verified skills mapped to O*NET / WEF / SFIA standards
            </span>
          </div>
        </div>
      </div>

      {/* ── Confirmation requests (Task #60) — OUTSIDE the export sheet ─────
          Candidate-driven trust layer: invite an external party by email to
          confirm a specific claim. Kept off the printable sheet so exports stay
          clean. */}
      <ConfirmationRequests
        data={data}
        invites={invites}
        confByKey={confByKey}
        onRequest={openInvite}
        onRevoke={revokeInvite}
        onResend={resendInvite}
        actioningId={inviteActionId}
        resentLinks={resentLinks}
        copiedResentId={copiedResentId}
        onCopyResent={copyResentLink}
      />
    </div>

    {inviteClaim && (
      <InviteModal
        claim={inviteClaim}
        email={inviteEmail}
        setEmail={setInviteEmail}
        name={inviteName}
        setName={setInviteName}
        org={inviteOrg}
        setOrg={setInviteOrg}
        message={inviteMessage}
        setMessage={setInviteMessage}
        submitting={inviteSubmitting}
        errorMsg={inviteError}
        link={inviteLink}
        emailSent={inviteEmailSent}
        emailWarning={inviteEmailWarning}
        copied={copied}
        onCopy={copyLink}
        onSubmit={submitInvite}
        onClose={() => setInviteClaim(null)}
      />
    )}
    </>
  );
}

const CONF_STATUS_META: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Confirmed", color: ATANDA.green },
  PENDING: { label: "Pending", color: ATANDA.yellow },
  REJECTED: { label: "Rejected", color: ATANDA.red },
  UNVERIFIED: { label: "Unverified", color: ATANDA.sub },
};

const INVITE_STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Awaiting response", color: ATANDA.yellow },
  APPROVED: { label: "Approved", color: ATANDA.green },
  REJECTED: { label: "Declined", color: ATANDA.red },
  EXPIRED: { label: "Expired", color: ATANDA.sub },
};

function ConfirmationRequests({
  data,
  invites,
  confByKey,
  onRequest,
  onRevoke,
  onResend,
  actioningId,
  resentLinks,
  copiedResentId,
  onCopyResent,
}: {
  data: any;
  invites: any[];
  confByKey: Map<string, any>;
  onRequest: (claim: { type: "EMPLOYMENT" | "CERTIFICATION" | "SKILL"; targetRef: string; targetLabel: string }) => void;
  onRevoke: (id: string) => void;
  onResend: (id: string) => void;
  actioningId: string | null;
  resentLinks: Record<string, string>;
  copiedResentId: string | null;
  onCopyResent: (id: string) => void;
}) {
  type ClaimRow = { type: "EMPLOYMENT" | "CERTIFICATION" | "SKILL"; targetRef: string; targetLabel: string; group: string };
  const claims: ClaimRow[] = [];
  for (const w of data.workHistory ?? []) {
    if (!w.company) continue;
    claims.push({
      type: "EMPLOYMENT",
      targetRef: w.company,
      targetLabel: [w.role, w.company].filter(Boolean).join(" — ") || w.company,
      group: "Employment",
    });
  }
  for (const c of data.certifications ?? []) {
    claims.push({ type: "CERTIFICATION", targetRef: c, targetLabel: c, group: "Certifications" });
  }
  for (const c of data.verifiedDeck ?? []) {
    claims.push({ type: "SKILL", targetRef: c.cardId, targetLabel: c.name, group: "Verified Skills" });
  }

  const statusOf = (claim: ClaimRow): string => {
    const conf = confByKey.get(`${claim.type}:${String(claim.targetRef).toLowerCase()}`);
    return conf?.status ?? "UNVERIFIED";
  };

  return (
    <div className="mt-8 glass-card rounded-lg p-5" data-testid="block-confirmation-requests">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-4 h-4 text-primary" />
        <h2 className="text-lg font-display font-bold text-white">Request Confirmations</h2>
      </div>
      <p className="font-mono text-xs text-muted-foreground mb-4">
        Invite a former manager, registrar, or institution to verify a claim by email. They confirm with a no-login link — no ARK account needed.
      </p>

      {claims.length === 0 ? (
        <p className="text-sm text-muted-foreground">No claims available to confirm yet.</p>
      ) : (
        <div className="space-y-2">
          {claims.map((claim, i) => {
            const status = statusOf(claim);
            const m = CONF_STATUS_META[status] ?? CONF_STATUS_META.UNVERIFIED;
            return (
              <div
                key={`${claim.type}-${claim.targetRef}-${i}`}
                className="flex items-center justify-between gap-3 border border-border rounded-md px-3 py-2"
                data-testid={`row-claim-${claim.type.toLowerCase()}-${i}`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground">{claim.group}</div>
                  <div className="text-sm text-white truncate">{claim.targetLabel}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold" style={{ color: m.color }} data-testid={`text-claim-status-${i}`}>
                    {m.label}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRequest({ type: claim.type, targetRef: claim.targetRef, targetLabel: claim.targetLabel })}
                    data-testid={`button-request-confirmation-${i}`}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Request
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {invites.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-white mb-2">Sent Requests</h3>
          <div className="space-y-2.5">
            {invites.map((inv) => {
              const m = INVITE_STATUS_META[inv.status] ?? INVITE_STATUS_META.PENDING;
              const busy = actioningId === inv.id;
              const canRevoke = inv.status === "PENDING";
              const canResend = inv.status === "PENDING" || inv.status === "EXPIRED";
              const resentLink = resentLinks[inv.id];
              return (
                <div
                  key={inv.id}
                  className="text-xs border-b border-border/50 pb-2"
                  data-testid={`row-invite-${inv.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-white truncate">{inv.targetLabel ?? inv.targetRef}</span>
                      <span className="text-muted-foreground"> → {inv.recipientEmail}</span>
                    </div>
                    <span className="font-bold shrink-0" style={{ color: m.color }} data-testid={`text-invite-status-${inv.id}`}>
                      {m.label}
                    </span>
                  </div>
                  {(canRevoke || canResend) && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {canResend && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={busy}
                          onClick={() => onResend(inv.id)}
                          data-testid={`button-resend-invite-${inv.id}`}
                        >
                          <RotateCw className="w-3 h-3 mr-1" />
                          {inv.status === "EXPIRED" ? "Resend link" : "New link"}
                        </Button>
                      )}
                      {canRevoke && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          disabled={busy}
                          onClick={() => onRevoke(inv.id)}
                          data-testid={`button-revoke-invite-${inv.id}`}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  )}
                  {resentLink && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <input
                        readOnly
                        value={resentLink}
                        className="flex-1 min-w-0 bg-background/60 border border-border rounded px-2 py-1 font-mono text-[11px] text-muted-foreground"
                        data-testid={`input-resent-link-${inv.id}`}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs shrink-0"
                        onClick={() => onCopyResent(inv.id)}
                        data-testid={`button-copy-resent-${inv.id}`}
                      >
                        {copiedResentId === inv.id ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InviteModal({
  claim,
  email,
  setEmail,
  name,
  setName,
  org,
  setOrg,
  message,
  setMessage,
  submitting,
  errorMsg,
  link,
  emailSent,
  emailWarning,
  copied,
  onCopy,
  onSubmit,
  onClose,
}: {
  claim: { type: string; targetRef: string; targetLabel: string };
  email: string;
  setEmail: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  org: string;
  setOrg: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  submitting: boolean;
  errorMsg: string | null;
  link: string | null;
  emailSent: boolean;
  emailWarning: string | null;
  copied: boolean;
  onCopy: () => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      data-testid="modal-invite"
    >
      <div
        className="w-full max-w-md glass-card rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-display font-bold text-white">Request confirmation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{claim.targetLabel}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white" data-testid="button-close-invite">
            <X className="w-5 h-5" />
          </button>
        </div>

        {link ? (
          <div data-testid="block-invite-success">
            {emailSent ? (
              <p className="text-sm text-white mb-3" data-testid="text-invite-emailed">
                Invite emailed to your confirmer. The no-login link expires in 14 days — keep a copy below if you'd like to resend it.
              </p>
            ) : (
              <p className="text-sm text-amber-400 mb-3" data-testid="text-invite-email-warning">
                {emailWarning || "Invite created, but the email could not be sent. Copy the no-login link below and send it to your confirmer — it expires in 14 days."}
              </p>
            )}
            <div className="flex items-center gap-2 mb-4">
              <input
                readOnly
                value={link}
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-xs text-white font-mono"
                data-testid="input-invite-link"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button variant="outline" size="sm" onClick={onCopy} data-testid="button-copy-link">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={onClose} data-testid="button-invite-done">Done</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground">Recipient email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@company.com"
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-white"
                  data-testid="input-recipient-email"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono uppercase text-muted-foreground">Their name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Optional"
                    className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-white"
                    data-testid="input-recipient-name"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase text-muted-foreground">Their org</label>
                  <input
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="Optional"
                    className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-white"
                    data-testid="input-recipient-org"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Optional note to the recipient"
                  rows={2}
                  className="w-full mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-white resize-y"
                  data-testid="input-invite-message"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-destructive mt-3" data-testid="text-invite-error">{errorMsg}</p>
            )}

            <Button
              className="w-full mt-4"
              onClick={onSubmit}
              disabled={submitting || !email.trim()}
              data-testid="button-send-invite"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Send invite
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: ATANDA.blue, letterSpacing: 1.5, textTransform: "uppercase", borderBottom: `2px solid ${ATANDA.line}`, paddingBottom: 4, marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
