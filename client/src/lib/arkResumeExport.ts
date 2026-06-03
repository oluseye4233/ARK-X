/* ARK RESUME export helpers.
   IMPORTANT: the PDF is built with jsPDF TEXT APIs (NOT an html2canvas image)
   so the exported resume has selectable, ATS-parseable text — a hard
   requirement for a resume artifact. PNG/JPEG exports still capture the
   on-screen sheet via html2canvas for visual sharing. */

import { ATANDA } from "./arkReportTheme";

export interface ResumeExportCard {
  name: string;
  tier: string | null;
  category: string;
}
export interface ResumeExportWork {
  company: string;
  role?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  highlights?: string[];
  mappedCards: { name: string; tier: string | null }[];
  confirmation: { status: string; confirmerOrg?: string | null } | null;
}
export interface ResumeExportData {
  name: string;
  currentRole: string | null;
  currentEmployer: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  location: string | null;
  linkLinkedin: string | null;
  linkGithub: string | null;
  linkPortfolio: string | null;
  arkScore: number;
  jst: { total: number; jobs: number; skills: number; talent: number };
  ats: { score: number; band: string };
  verifiedDeck: ResumeExportCard[];
  workHistory: ResumeExportWork[];
  education: string[];
  certifications: string[];
}

export function resumeFileStamp(name?: string | null) {
  const n = (name || "ARK").replace(/[^a-z0-9]+/gi, "_");
  return `ARK_Resume_${n}_${new Date().toISOString().slice(0, 10)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

/* Build a clean, selectable-text resume PDF. Manual y-cursor layout with page
   breaks so the text stays machine-readable for ATS parsers. */
export async function exportResumePdf(data: ResumeExportData, fileBase: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const M = 16; // margin
  const contentW = pageW - M * 2;
  let y = M;

  const ink = hexToRgb(ATANDA.ink);
  const sub = hexToRgb(ATANDA.sub);
  const blue = hexToRgb(ATANDA.blue);
  const line = hexToRgb(ATANDA.line);

  // SINGLE-PAGE policy: the ATS resume must fit one A4 page. Rather than spill to
  // a second page (which fragments ATS parsing), we stop emitting once the page
  // is full. Callers check `hasRoom` before writing a section.
  let full = false;
  const hasRoom = (needed: number) => {
    if (full) return false;
    if (y + needed > pageH - M) {
      full = true;
      return false;
    }
    return true;
  };
  const setColor = (c: [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2]);
  const sectionHeading = (label: string) => {
    if (!hasRoom(14)) return false;
    y += 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    setColor(blue);
    pdf.text(label.toUpperCase(), M, y);
    y += 1.5;
    pdf.setDrawColor(line[0], line[1], line[2]);
    pdf.setLineWidth(0.4);
    pdf.line(M, y, M + contentW, y);
    y += 5;
    return true;
  };
  const wrapped = (text: string, x: number, maxW: number, size: number, style: "normal" | "bold" = "normal", color = ink) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    setColor(color);
    const lines = pdf.splitTextToSize(text, maxW) as string[];
    for (const ln of lines) {
      if (!hasRoom(size * 0.5)) return;
      pdf.text(ln, x, y);
      y += size * 0.5;
    }
  };

  // ── Header: name (left) + JST/ARK block (TOP-RIGHT, prominent) ──
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  setColor(ink);
  pdf.text(data.name || "ARK Candidate", M, y + 6);

  // JST top-right box (the headline metric, per requirement).
  const boxW = 46;
  const boxX = pageW - M - boxW;
  pdf.setFillColor(blue[0], blue[1], blue[2]);
  pdf.roundedRect(boxX, y - 2, boxW, 18, 2, 2, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("JST INDEX", boxX + boxW / 2, y + 2.5, { align: "center" });
  pdf.setFontSize(18);
  pdf.text(`${data.jst.total}`, boxX + boxW / 2, y + 9.5, { align: "center" });
  pdf.setFontSize(6.5);
  pdf.setFont("helvetica", "normal");
  pdf.text(`J ${data.jst.jobs}  S ${data.jst.skills}  T ${data.jst.talent}`, boxX + boxW / 2, y + 13.5, { align: "center" });
  y += 11;

  // Role line
  const roleLine = [data.currentRole, data.currentEmployer].filter(Boolean).join(" @ ");
  if (roleLine) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    setColor(sub);
    pdf.text(roleLine, M, y);
    y += 6;
  }

  // Contact + links
  const contact = [data.contactEmail, data.contactPhone, data.location].filter(Boolean).join("  •  ");
  if (contact) {
    pdf.setFontSize(9);
    setColor(ink);
    pdf.text(contact, M, y);
    y += 4.5;
  }
  const links = [data.linkLinkedin, data.linkGithub, data.linkPortfolio].filter(Boolean) as string[];
  if (links.length) {
    pdf.setFontSize(9);
    setColor(blue);
    pdf.text(links.join("  •  "), M, y);
    y += 4.5;
  }

  // ATS score chip
  y += 1;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  setColor(ink);
  pdf.text(`ATS Readiness: ${data.ats.score}/100 (${data.ats.band})  ·  ARK ${data.arkScore}/600`, M, y);
  y += 2;
  pdf.setDrawColor(line[0], line[1], line[2]);
  pdf.setLineWidth(0.5);
  pdf.line(M, y, M + contentW, y);
  y += 2;

  // Canonical ATS section order/labels: Summary · Work Experience · Education ·
  // Certifications · Skills. (Contact lives in the machine-readable header above.)

  // ── Summary ──
  const summaryLine = [data.currentRole, data.currentEmployer].filter(Boolean).join(" @ ");
  if (summaryLine) {
    if (sectionHeading("Summary")) {
      wrapped(
        `${summaryLine}. ATS readiness ${data.ats.score}/100 (${data.ats.band}); ARK ${data.arkScore}/600 with ${data.verifiedDeck.filter((c) => c.tier).length} independently verified skill primitive(s).`,
        M,
        contentW,
        9.5,
        "normal",
      );
    }
  }

  // ── Work Experience ──
  if (data.workHistory.length) {
    sectionHeading("Work Experience");
    for (const w of data.workHistory) {
      if (!hasRoom(10)) break;
      const head = [w.role, w.company].filter(Boolean).join(" — ");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      setColor(ink);
      pdf.text(head || w.company, M, y);
      const dates = [w.startDate, w.endDate].filter(Boolean).join(" – ");
      if (dates) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        setColor(sub);
        pdf.text(dates, M + contentW, y, { align: "right" });
      }
      y += 4.5;
      const status = w.confirmation?.status ?? "UNVERIFIED";
      const org = w.confirmation?.confirmerOrg ? ` by ${w.confirmation.confirmerOrg}` : "";
      wrapped(`Confirmation: ${status}${org}`, M, contentW, 8, "normal", sub);
      for (const h of w.highlights ?? []) {
        wrapped(`• ${h}`, M + 2, contentW - 2, 9, "normal", ink);
      }
      if (w.mappedCards.length) {
        const cards = w.mappedCards
          .map((c) => `${c.name} (${c.tier ? c.tier : "Yet to verify"})`)
          .join(", ");
        wrapped(`Verified skills here: ${cards}`, M + 2, contentW - 2, 8, "bold", blue);
      }
      y += 2;
    }
  }

  // ── Education ──
  if (data.education.length) {
    sectionHeading("Education");
    for (const e of data.education) wrapped(`• ${e}`, M, contentW, 9.5);
  }

  // ── Certifications ──
  if (data.certifications.length) {
    sectionHeading("Certifications");
    for (const c of data.certifications) wrapped(`• ${c}`, M, contentW, 9.5);
  }

  // ── Skills (verified-card living layer) ──
  if (data.verifiedDeck.length) {
    sectionHeading("Skills");
    for (const c of data.verifiedDeck) {
      const tier = c.tier ? ` — ${c.tier} Verified` : " — Yet to verify";
      wrapped(`• ${c.name}${tier}  (${c.category})`, M, contentW, 9.5, "normal");
    }
  }

  pdf.save(`${fileBase}.pdf`);
}

async function waitForImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    }),
  );
}

/* PNG/JPEG visual export of the on-screen sheet. */
export async function exportResumeImage(el: HTMLElement, type: "png" | "jpeg", fileBase: string) {
  const html2canvas = (await import("html2canvas")).default;
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* non-fatal */
  }
  try {
    await waitForImages(el);
  } catch {
    /* non-fatal */
  }
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const mime = type === "png" ? "image/png" : "image/jpeg";
  const data = canvas.toDataURL(mime, 0.95);
  const a = document.createElement("a");
  a.href = data;
  a.download = `${fileBase}.${type === "jpeg" ? "jpg" : "png"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
