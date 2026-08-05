/* Living Resume Designer export engine (JNGL-PDD-ARKH-LRD-2026-001).

   buildLivingResumeHtml — single self-contained offline HTML file (LRD-401):
   inline CSS, base64 images, zero runtime API calls. The one disclosed
   exception (PDD §1 Step 5b) is the YouTube video card: only a locally
   embedded thumbnail loads automatically; the real embed (and its one
   outbound network call) loads only if the viewer clicks play, and that's
   labeled on the card itself. Collapsible project detail text uses plain
   <details>/<summary> so no JS framework is needed.

   exportLivingResumePdf — extends the existing ARK Resume jsPDF text-export
   pattern (see arkResumeExport.ts) with clickable link annotations (LRD-405).

   buildExportCertificate — a small JSON completeness-heuristic companion
   artifact (LRD-402), explicitly labeled a heuristic, not an external audit. */

import { ATANDA } from "./arkReportTheme";
import { THEMES, type LivingResumeDraft, type LivingResumePrefill } from "@/components/living-resume-designer/types";

export function livingResumeFileStamp(name?: string | null) {
  const n = (name || "Living_Resume").replace(/[^a-z0-9]+/gi, "_");
  return `${n}_${new Date().toISOString().slice(0, 10)}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildLivingResumeHtml(draft: LivingResumeDraft, prefill: LivingResumePrefill | null): string {
  const theme = THEMES[draft.theme];
  const id = draft.identity;
  const contactBits = [id.email, id.phone].filter(Boolean).map(escapeHtml).join(" &middot; ");
  const links = [
    id.linkedin && { label: "LinkedIn", href: id.linkedin },
    id.github && { label: "GitHub", href: id.github },
    id.portfolio && { label: "Portfolio", href: id.portfolio },
  ].filter(Boolean) as { label: string; href: string }[];

  const linksHtml = links
    .map((l) => `<a href="${escapeHtml(l.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`)
    .join(" &middot; ");

  const tagsHtml = draft.tags
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");

  const projectsHtml = draft.projects
    .map(
      (p) => `
      <article class="card">
        <header>
          <h3>${escapeHtml(p.name || "Untitled project")}</h3>
          <span class="status">${escapeHtml(p.status)}</span>
        </header>
        ${p.role ? `<p class="role">${escapeHtml(p.role)}</p>` : ""}
        ${p.summary ? `<p class="summary">${escapeHtml(p.summary)}</p>` : ""}
        ${p.detail ? `<details><summary>Details</summary><p>${escapeHtml(p.detail)}</p></details>` : ""}
        ${p.link ? `<a class="project-link" href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer">View project &rarr;</a>` : ""}
      </article>`,
    )
    .join("");

  const spcListings = draft.showSpcPanel ? prefill?.spcListings ?? [] : [];
  const spcHtml = spcListings.length
    ? `<section class="panel">
        <h2>SPC Portfolio</h2>
        <div class="grid">
          ${spcListings
            .map(
              (l) => `<div class="card">
                <h3>${escapeHtml(l.title)}</h3>
                <p class="role">${escapeHtml(l.pillar)}</p>
                <p class="summary">${l.hiveScore != null ? `HIVE ${l.hiveScore}` : ""}${
                  l.kcseScore != null ? ` &middot; JCSE ${l.kcseScore}` : ""
                } &middot; ${l.salesCount} sold</p>
              </div>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const appsHtml = draft.aiApps.length
    ? `<section class="panel">
        <h2>AI-Native Applications</h2>
        <div class="grid">
          ${draft.aiApps
            .map(
              (a) => `<div class="card">
                <h3>${escapeHtml(a.name || "Untitled app")}</h3>
                ${a.stack ? `<p class="role">${escapeHtml(a.stack)}</p>` : ""}
                ${a.pitch ? `<p class="summary">${escapeHtml(a.pitch)}</p>` : ""}
                ${a.url ? `<a class="project-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">Visit &rarr;</a>` : ""}
                ${
                  a.testDemoSrcdoc
                    ? `<details><summary>Test My Work</summary><iframe class="demo-frame" sandbox="" srcdoc="${escapeHtml(a.testDemoSrcdoc)}"></iframe></details>`
                    : ""
                }
              </div>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const arkScoreHtml =
    draft.showArkScoreBadge && prefill?.arkScore
      ? `<div class="badge">
          <span class="badge-score">${prefill.arkScore.total}<small>/600</small></span>
          <span class="badge-label">ARK Score &middot; JST ${prefill.arkScore.jstIndex}${
            prefill.arkScore.ccmiTier ? ` &middot; ${escapeHtml(prefill.arkScore.ccmiTier)}` : ""
          }</span>
        </div>`
      : "";

  const videoHtml = draft.video
    ? `<section class="panel">
        <h2>Video Introduction</h2>
        <p class="disclosure">External video &mdash; hosted on YouTube. Loads only when you click play.</p>
        <div class="yt-facade" data-video-id="${escapeHtml(draft.video.videoId)}">
          ${
            draft.video.thumbnailDataUrl
              ? `<img src="${draft.video.thumbnailDataUrl}" alt="Video thumbnail" />`
              : `<div class="yt-fallback">Video Introduction</div>`
          }
          <span class="yt-play">&#9658;</span>
        </div>
      </section>`
    : "";

  const headshotHtml = draft.headshotDataUrl
    ? `<img class="headshot" src="${draft.headshotDataUrl}" alt="${escapeHtml(draft.headshotAlt || "Headshot")}" />`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(id.name || "Living Resume")}</title>
<style>
  :root {
    --accent: ${theme.accent};
    --bg: ${theme.bg};
    --panel: ${theme.panel};
    --ink: ${theme.ink};
    --sub: ${theme.sub};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
  }
  main { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
  header.hero { display: flex; gap: 20px; align-items: center; margin-bottom: 24px; }
  .headshot { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent); }
  h1 { margin: 0; font-size: 28px; }
  .role-line { color: var(--sub); margin: 4px 0; }
  .contact { color: var(--sub); font-size: 13px; margin: 4px 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .bio { margin: 16px 0; color: var(--ink); }
  .chip { display: inline-block; background: var(--panel); border: 1px solid var(--accent); color: var(--accent);
    border-radius: 999px; padding: 2px 10px; font-size: 11px; margin: 0 6px 6px 0; }
  section.panel { margin-top: 32px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sub); border-bottom: 1px solid var(--panel); padding-bottom: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
  .card { background: var(--panel); border-radius: 10px; padding: 14px 16px; }
  .card header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .card h3 { margin: 0; font-size: 15px; }
  .status { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sub); }
  .role { color: var(--sub); font-size: 12px; margin: 4px 0; }
  .summary { font-size: 13px; margin: 6px 0; }
  .project-link { display: inline-block; margin-top: 6px; font-size: 12px; }
  details { margin-top: 6px; font-size: 13px; color: var(--sub); }
  summary { cursor: pointer; color: var(--accent); font-size: 12px; }
  .demo-frame { width: 100%; height: 160px; border: 1px solid var(--accent); border-radius: 6px; margin-top: 8px; background: #fff; }
  .badge { display: inline-flex; align-items: center; gap: 10px; background: var(--panel); border-radius: 10px; padding: 10px 16px; margin-top: 16px; }
  .badge-score { font-size: 28px; font-weight: 700; color: var(--accent); }
  .badge-score small { font-size: 12px; color: var(--sub); }
  .badge-label { font-size: 11px; color: var(--sub); text-transform: uppercase; letter-spacing: 0.05em; }
  .disclosure { font-size: 11px; color: var(--sub); font-style: italic; }
  .yt-facade { position: relative; max-width: 400px; border-radius: 8px; overflow: hidden; cursor: pointer; background: #000; }
  .yt-facade img { width: 100%; display: block; opacity: 0.85; }
  .yt-fallback { width: 100%; padding-top: 56.25%; position: relative; background: var(--panel); }
  .yt-play { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 40px; color: #fff; }
  .yt-facade iframe { width: 100%; aspect-ratio: 16/9; border: 0; }
  footer { margin-top: 48px; font-size: 11px; color: var(--sub); text-align: center; }
</style>
</head>
<body>
<main>
  <header class="hero">
    ${headshotHtml}
    <div>
      <h1>${escapeHtml(id.name || "Living Resume")}</h1>
      <p class="role-line">${[escapeHtml(id.role), escapeHtml(id.employer)].filter(Boolean).join(" @ ")}</p>
      <p class="contact">${contactBits}</p>
      <p class="contact">${linksHtml}</p>
    </div>
  </header>

  ${id.bio ? `<p class="bio">${escapeHtml(id.bio)}</p>` : ""}
  ${tagsHtml ? `<div>${tagsHtml}</div>` : ""}
  ${arkScoreHtml}

  ${
    draft.projects.length
      ? `<section class="panel"><h2>Projects</h2><div class="grid">${projectsHtml}</div></section>`
      : ""
  }
  ${spcHtml}
  ${appsHtml}
  ${videoHtml}

  <footer>Generated with the Living Resume Designer &middot; ARK X</footer>
</main>
<script>
  document.querySelectorAll(".yt-facade").forEach(function (el) {
    el.addEventListener("click", function () {
      var id = el.getAttribute("data-video-id");
      el.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    });
  });
</script>
</body>
</html>`;
}

export function downloadLivingResumeHtml(draft: LivingResumeDraft, prefill: LivingResumePrefill | null) {
  const html = buildLivingResumeHtml(draft, prefill);
  downloadBlob(html, "text/html", `${livingResumeFileStamp(draft.identity.name)}.html`);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

// LRD-405: extends the ARK Resume jsPDF text-export pattern with clickable
// link annotations for every external URL. Collapsible detail text is forced
// open (a static PDF has no click-to-expand). An app card without its own
// hosted URL falls back to the subscriber's declared primary site, since a
// static PDF cannot execute an embedded "Test My Work" demo.
export async function exportLivingResumePdf(draft: LivingResumeDraft, prefill: LivingResumePrefill | null) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const M = 16;
  const contentW = pageW - M * 2;
  let y = M;

  const ink = hexToRgb(ATANDA.ink);
  const sub = hexToRgb(ATANDA.sub);
  const blue = hexToRgb(ATANDA.blue);
  const line = hexToRgb(ATANDA.line);

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
  // A clickable link annotation over the last line of text written.
  const linkLast = (url: string, x: number, textY: number, w: number, size: number) => {
    pdf.link(x, textY - size * 0.35, w, size * 0.5, { url });
  };

  const id = draft.identity;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  setColor(ink);
  pdf.text(id.name || "Living Resume", M, y + 6);
  y += 11;

  const roleLine = [id.role, id.employer].filter(Boolean).join(" @ ");
  if (roleLine) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    setColor(sub);
    pdf.text(roleLine, M, y);
    y += 6;
  }

  const contact = [id.email, id.phone].filter(Boolean).join("  •  ");
  if (contact) {
    pdf.setFontSize(9);
    setColor(ink);
    pdf.text(contact, M, y);
    y += 4.5;
  }

  const links: { label: string; url: string }[] = [
    id.linkedin && { label: id.linkedin, url: id.linkedin },
    id.github && { label: id.github, url: id.github },
    id.portfolio && { label: id.portfolio, url: id.portfolio },
  ].filter(Boolean) as { label: string; url: string }[];
  if (links.length) {
    pdf.setFontSize(9);
    setColor(blue);
    let x = M;
    for (const l of links) {
      const text = `${l.label}  `;
      pdf.text(text, x, y);
      const w = pdf.getTextWidth(text);
      linkLast(l.url, x, y, w, 9);
      x += w + 4;
    }
    y += 4.5;
  }

  if (draft.showArkScoreBadge && prefill?.arkScore) {
    y += 1;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    setColor(ink);
    pdf.text(`ARK Score: ${prefill.arkScore.total}/600  ·  JST ${prefill.arkScore.jstIndex}`, M, y);
    y += 2;
    pdf.setDrawColor(line[0], line[1], line[2]);
    pdf.setLineWidth(0.5);
    pdf.line(M, y, M + contentW, y);
    y += 2;
  }

  if (id.bio) {
    if (sectionHeading("Summary")) wrapped(id.bio, M, contentW, 9.5);
  }

  if (draft.projects.length) {
    sectionHeading("Projects");
    for (const p of draft.projects) {
      if (!hasRoom(10)) break;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      setColor(ink);
      pdf.text(p.name || "Untitled project", M, y);
      y += 4.5;
      if (p.role) wrapped(p.role, M, contentW, 8, "normal", sub);
      if (p.summary) wrapped(p.summary, M, contentW, 9);
      if (p.detail) wrapped(p.detail, M + 2, contentW - 2, 8.5, "normal", sub);
      const linkUrl = p.link || id.portfolio || "";
      if (linkUrl) {
        const before = y;
        wrapped(linkUrl, M, contentW, 8, "normal", blue);
        linkLast(linkUrl, M, before + 4, pdf.getTextWidth(linkUrl), 8);
      }
      y += 2;
    }
  }

  if (draft.aiApps.length) {
    sectionHeading("AI-Native Applications");
    for (const a of draft.aiApps) {
      if (!hasRoom(10)) break;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      setColor(ink);
      pdf.text(a.name || "Untitled app", M, y);
      y += 4.5;
      if (a.stack) wrapped(a.stack, M, contentW, 8, "normal", sub);
      if (a.pitch) wrapped(a.pitch, M, contentW, 9);
      const linkUrl = a.url || id.portfolio || "";
      if (linkUrl) {
        const before = y;
        wrapped(linkUrl, M, contentW, 8, "normal", blue);
        linkLast(linkUrl, M, before + 4, pdf.getTextWidth(linkUrl), 8);
      }
      y += 2;
    }
  }

  if (draft.showSpcPanel && (prefill?.spcListings.length ?? 0) > 0) {
    sectionHeading("SPC Portfolio");
    for (const l of prefill!.spcListings) {
      wrapped(`• ${l.title} — ${l.pillar}${l.hiveScore != null ? ` (HIVE ${l.hiveScore})` : ""}`, M, contentW, 9.5);
    }
  }

  if (draft.tags.length) {
    sectionHeading("Methodology");
    wrapped(draft.tags.join(", "), M, contentW, 9.5);
  }

  pdf.save(`${livingResumeFileStamp(id.name)}.pdf`);
}

// LRD-402: a small JSON completeness heuristic — explicitly labeled a
// heuristic, not an external audit.
export function buildExportCertificate(draft: LivingResumeDraft, prefill: LivingResumePrefill | null) {
  const sections = {
    identity: !!draft.identity.name && !!(draft.identity.email || draft.identity.phone),
    bio: !!draft.identity.bio,
    headshot: !!draft.headshotDataUrl,
    projects: draft.projects.length > 0,
    tags: draft.tags.length > 0,
    spcPortfolio: draft.showSpcPanel && (prefill?.spcListings.length ?? 0) > 0,
    aiAppShowcase: draft.aiApps.length > 0,
    arkScoreBadge: draft.showArkScoreBadge && !!prefill?.arkScore,
    videoIntro: !!draft.video,
  };
  const populated = Object.values(sections).filter(Boolean).length;
  const total = Object.keys(sections).length;

  return {
    production: "JNGL-PDD-ARKH-LRD-2026-001",
    generatedAt: new Date().toISOString(),
    sections,
    completeness: { heuristic: true, populated, total, pct: Math.round((populated / total) * 100) },
  };
}

export function downloadExportCertificate(draft: LivingResumeDraft, prefill: LivingResumePrefill | null) {
  const cert = buildExportCertificate(draft, prefill);
  downloadBlob(JSON.stringify(cert, null, 2), "application/json", `${livingResumeFileStamp(draft.identity.name)}_certificate.json`);
}
