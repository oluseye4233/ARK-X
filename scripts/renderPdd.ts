import { mdToPdf } from "md-to-pdf";
import { promises as fs } from "fs";
import { resolve } from "path";

const SRC = "exports/ARK_PDD_v3_Comprehensive.md";
const OUT = "exports/ARK_PDD_v3_Comprehensive.pdf";

const CSS = `
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @top-left  { content: "ARK Platform · PDD v3"; font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #64748b; }
  @top-right { content: "ATANDA Studio"; font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #0891b2; font-weight: 600; }
  @bottom-center { content: counter(page) " / " counter(pages); font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #64748b; }
}
@page :first { margin: 0; @top-left { content: ""; } @top-right { content: ""; } @bottom-center { content: ""; } }

body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; line-height: 1.55; font-size: 10.5pt; }

.cover { page: cover; page-break-after: always; height: 297mm; width: 210mm; padding: 0; margin: 0;
  background: linear-gradient(155deg, #06121a 0%, #0b1f2b 45%, #06262e 100%); color: #e2e8f0;
  position: relative; overflow: hidden; }
.cover::before { content: ""; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 25% 18%, rgba(34,211,238,0.22), transparent 55%),
              radial-gradient(ellipse at 80% 85%, rgba(16,185,129,0.18), transparent 55%); }
.cover .cover-inner { position: relative; padding: 30mm 22mm; height: 100%; display: flex; flex-direction: column; }
.cover .tag { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 9pt;
  text-transform: uppercase; letter-spacing: 0.32em; color: #22d3ee; }
.cover h1 { font-family: 'Inter', sans-serif; font-weight: 900; font-size: 42pt; letter-spacing: -0.01em;
  line-height: 1.02; margin: 14mm 0 8mm; color: #f8fafc;
  background: linear-gradient(120deg, #ffffff 0%, #94a3b8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.cover .subtitle { font-size: 15pt; color: #cbd5e1; max-width: 150mm; }
.cover .manifesto { margin-top: 24mm; padding: 6mm 7mm; border-left: 3px solid #22d3ee;
  background: rgba(34,211,238,0.08); font-size: 11pt; color: #f1f5f9; line-height: 1.5; }
.cover .manifesto strong { color: #22d3ee; }
.cover .meta { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end;
  font-family: 'JetBrains Mono', monospace; font-size: 9pt; color: #94a3b8; letter-spacing: 0.18em; text-transform: uppercase; }
.cover .meta .atanda { text-align: right; }
.cover .meta .atanda { display: flex; flex-direction: column; align-items: flex-end; gap: 3mm; }
.cover .meta .atanda strong { display: block; font-size: 14pt; color: #f8fafc; letter-spacing: 0.28em; }
.cover .meta .atanda span { color: #10b981; }
.cover img.atanda-logo { width: 46mm; height: auto; object-fit: contain; filter: drop-shadow(0 0 18px rgba(34,211,238,0.35)); }

.pdd-figure { margin: 5mm 0 6mm; padding: 0; page-break-inside: avoid; }
.pdd-figure svg { display: block; width: 100%; height: auto; max-height: 90mm; border-radius: 2mm; }
.pdd-figure figcaption { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; color: #64748b;
  margin-top: 2mm; padding-left: 2mm; border-left: 2px solid #0891b2; letter-spacing: 0.02em; }

h1, h2, h3, h4 { font-family: 'Inter', sans-serif; color: #0f172a; font-weight: 700; line-height: 1.2; }
h1 { font-size: 22pt; border-bottom: 3px solid #0891b2; padding-bottom: 4mm; margin-top: 14mm;
  page-break-before: always; color: #0e7490; }
h1:first-of-type { page-break-before: avoid; }
h2 { font-size: 14.5pt; margin-top: 8mm; color: #0e7490; }
h3 { font-size: 11.5pt; margin-top: 6mm; color: #0f172a; }
h4 { font-size: 10pt; margin-top: 4mm; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; }
p { margin: 2mm 0 3mm; }
ul, ol { margin: 2mm 0 4mm 5mm; padding-left: 4mm; }
li { margin: 1mm 0; }
strong { color: #0e7490; }
em { color: #334155; }
code { font-family: 'JetBrains Mono', monospace; font-size: 9pt; background: #f1f5f9;
  padding: 0.5mm 1.5mm; border-radius: 1mm; color: #be185d; }
pre { background: #0f172a; color: #e2e8f0; padding: 4mm 5mm; border-radius: 2mm; font-size: 8.8pt;
  line-height: 1.4; overflow-x: auto; }
pre code { background: transparent; color: #e2e8f0; padding: 0; }
blockquote { border-left: 3px solid #0891b2; padding: 1mm 4mm; background: #ecfeff; color: #155e75;
  font-style: italic; margin: 3mm 0; }
table { width: 100%; border-collapse: collapse; margin: 4mm 0; font-size: 9pt; }
th, td { border: 1px solid #cbd5e1; padding: 1.8mm 2.5mm; text-align: left; vertical-align: top; }
th { background: #0e7490; color: white; font-weight: 700; font-size: 8.8pt;
  text-transform: uppercase; letter-spacing: 0.04em; }
tr:nth-child(even) td { background: #f8fafc; }

hr { border: 0; border-top: 1px dashed #94a3b8; margin: 6mm 0; }

.callout { border: 1px solid #0891b2; background: #ecfeff; padding: 3mm 4mm; border-radius: 2mm; margin: 3mm 0; }
.callout strong { color: #0e7490; }

.toc { page-break-after: always; }
.toc h1 { page-break-before: avoid; }
.toc ul { list-style: none; padding-left: 0; }
.toc li { padding: 1.2mm 0; border-bottom: 1px dotted #cbd5e1; font-size: 10pt; }
.toc li.depth-2 { padding-left: 5mm; color: #475569; font-size: 9.5pt; }
.toc li.depth-3 { padding-left: 10mm; color: #64748b; font-size: 9pt; }
`;

async function main() {
  const md = await fs.readFile(SRC, "utf-8");
  const result = await mdToPdf(
    { content: md },
    {
      dest: OUT,
      css: CSS,
      pdf_options: {
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" }, // CSS @page handles margins
        preferCSSPageSize: true,
      },
      launch_options: {
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    },
  );
  if (!result) throw new Error("md-to-pdf returned no result");
  const stat = await fs.stat(resolve(OUT));
  console.log(`OK -> ${OUT} (${(stat.size / 1024).toFixed(1)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
