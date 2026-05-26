export const PDD_BASE_CSS = `
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
.cover .meta .atanda { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3mm; }
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

export const EXECUTIVE_BRIEF_CSS_OVERRIDES = `
body { font-size: 9.8pt; line-height: 1.45; }
h1 { page-break-before: auto; margin-top: 8mm; font-size: 18pt; padding-bottom: 2.5mm; }
h1.brief-start { page-break-before: always; }
h2 { font-size: 12.5pt; margin-top: 5mm; }
h3 { font-size: 10.5pt; margin-top: 3.5mm; }
p { margin: 1.5mm 0 2.5mm; }
ul, ol { margin: 1.5mm 0 3mm 5mm; }
li { margin: 0.6mm 0; }
table { font-size: 8pt; }
th, td { padding: 1.2mm 1.8mm; }
th { font-size: 7.8pt; }
`;

export const ONE_PAGER_CSS_OVERRIDES = `
@page { size: A4; margin: 12mm 12mm 12mm 12mm;
  @top-left { content: ""; } @top-right { content: ""; } @bottom-center { content: ""; } }
body { font-size: 8pt; line-height: 1.32; }
h1, h2, h3, h4 { page-break-before: avoid !important; margin-top: 2mm; }
h1 { font-size: 13pt; border-bottom: 2px solid #0891b2; padding-bottom: 1.2mm; margin-top: 2.5mm; color: #0e7490; }
h2 { font-size: 9.5pt; margin-top: 2.5mm; color: #0e7490; text-transform: uppercase; letter-spacing: 0.04em; }
h3 { font-size: 9pt; margin-top: 1.5mm; }
p { margin: 0.8mm 0 1.2mm; }
ul, ol { margin: 0.8mm 0 1.5mm 4mm; padding-left: 3mm; }
li { margin: 0.3mm 0; }
table { margin: 1mm 0; font-size: 7.2pt; }
th, td { padding: 0.8mm 1.3mm; }
th { font-size: 7pt; }

.op-header { display: flex; justify-content: space-between; align-items: flex-end;
  border-bottom: 3px solid #0e7490; padding-bottom: 2.5mm; margin-bottom: 3mm; }
.op-header .brand { font-family: 'JetBrains Mono', monospace; font-size: 8pt;
  color: #0891b2; letter-spacing: 0.28em; text-transform: uppercase; }
.op-header h1.op-title { font-size: 20pt; margin: 1mm 0 0; padding: 0; border: 0;
  color: #06262e; font-weight: 900; letter-spacing: -0.01em; }
.op-header .op-tag { font-size: 8pt; color: #475569; text-align: right;
  font-family: 'JetBrains Mono', monospace; letter-spacing: 0.18em; text-transform: uppercase; }

.op-manifesto { background: linear-gradient(120deg, #06121a 0%, #0b1f2b 100%);
  color: #e2e8f0; padding: 4mm 5mm; border-left: 3px solid #22d3ee; border-radius: 2mm;
  font-size: 10.5pt; margin: 0 0 3.5mm; line-height: 1.4; }
.op-manifesto strong { color: #22d3ee; }
.op-manifesto .source { display: block; margin-top: 1.5mm; font-size: 7.5pt;
  color: #94a3b8; letter-spacing: 0.18em; text-transform: uppercase; font-family: 'JetBrains Mono', monospace; }

.op-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 3mm; }
.op-card { border: 1px solid #cbd5e1; border-radius: 2mm; padding: 2.5mm 3mm; background: #f8fafc; }
.op-card h3 { margin-top: 0; color: #0e7490; font-size: 9.5pt; }

.op-loop { background: #ecfeff; border: 1px solid #0891b2; border-radius: 2mm;
  padding: 3mm 4mm; margin: 0 0 3mm; }
.op-loop h3 { margin-top: 0; color: #0e7490; }
.op-loop .steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm;
  font-size: 7.8pt; text-align: center; margin-top: 2mm; }
.op-loop .step { background: white; border: 1px solid #0e7490; border-radius: 1.5mm; padding: 2mm 1.5mm; }
.op-loop .step .n { display: block; font-family: 'JetBrains Mono', monospace;
  font-size: 7pt; color: #0891b2; letter-spacing: 0.18em; }
.op-loop .step .label { display: block; font-weight: 700; color: #0f172a; margin-top: 0.8mm; font-size: 8pt; }
.op-loop .arrow { text-align: center; color: #0891b2; font-size: 8pt; margin-top: 1mm; }

.op-footer { display: flex; justify-content: space-between; align-items: center;
  border-top: 1px dashed #94a3b8; padding-top: 2mm; margin-top: 2mm;
  font-family: 'JetBrains Mono', monospace; font-size: 7.4pt;
  color: #64748b; letter-spacing: 0.16em; text-transform: uppercase; }
.op-footer .atanda { color: #0e7490; font-weight: 700; }
`;
