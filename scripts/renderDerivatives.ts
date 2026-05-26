import { mdToPdf } from "md-to-pdf";
import { promises as fs } from "fs";
import { resolve } from "path";
import { PDD_BASE_CSS, ONE_PAGER_CSS_OVERRIDES, EXECUTIVE_BRIEF_CSS_OVERRIDES } from "./pddStyles";

const SRC = "exports/ARK_PDD_v3_Comprehensive.md";
const ONE_PAGER_OUT = "exports/ARK_PDD_v3_OnePager.pdf";
const BRIEF_OUT = "exports/ARK_PDD_v3_ExecutiveBrief.pdf";

const LAUNCH = {
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
};
const PDF_OPTS = {
  format: "A4" as const,
  printBackground: true,
  margin: { top: "0", bottom: "0", left: "0", right: "0" },
  preferCSSPageSize: true,
};

/**
 * Extract the body of a markdown section identified by its heading text.
 * The body runs from the line after the heading up to (but not including)
 * the next heading whose level is <= the anchor's level.
 * Throws if the anchor heading cannot be found — that guarantees we fail
 * loudly when the source markdown drifts, rather than silently slicing
 * the wrong content.
 */
function getSection(md: string, headingText: string): string {
  const lines = md.split("\n");
  const headingRe = /^(#{1,6})\s+(.*?)\s*$/;
  let anchorIdx = -1;
  let anchorLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m && m[2].trim() === headingText.trim()) {
      anchorIdx = i;
      anchorLevel = m[1].length;
      break;
    }
  }
  if (anchorIdx === -1) {
    throw new Error(`getSection: heading not found in source markdown: "${headingText}"`);
  }
  let endIdx = lines.length;
  for (let i = anchorIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m && m[1].length <= anchorLevel) { endIdx = i; break; }
  }
  return lines.slice(anchorIdx + 1, endIdx).join("\n").trim();
}

/** Extract the first markdown blockquote (consecutive lines starting with "> "). */
function getFirstBlockquote(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inQuote = false;
  for (const line of lines) {
    if (line.startsWith(">")) { out.push(line.replace(/^>\s?/, "")); inQuote = true; }
    else if (inQuote) { break; }
  }
  if (out.length === 0) throw new Error("getFirstBlockquote: no blockquote found in source");
  return out.join(" ").trim();
}

/** Extract the manifesto bullets — the numbered list of "four engines" that
 *  literally describes the product loop in chapter 1. */
function getProductLoopList(md: string): string[] {
  const ch1 = getSection(md, "1. Executive Summary");
  const items: string[] = [];
  const re = /^\d+\.\s+(.*?)(?=\n\d+\.\s|\n\n|$)/gms;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ch1)) !== null) {
    items.push(m[1].replace(/\n+/g, " ").trim());
  }
  if (items.length < 4) throw new Error("getProductLoopList: expected >=4 numbered engines in chapter 1");
  return items;
}

function shortLabelOf(item: string): { label: string; gloss: string } {
  // Item shape: "**A career intelligence engine** — the JST … description"
  const m = item.match(/^\*\*(.+?)\*\*\s*[—-]\s*(.*)$/);
  if (!m) return { label: item.slice(0, 32), gloss: "" };
  return { label: m[1].trim(), gloss: m[2].trim() };
}

async function renderOnePager(src: string) {
  const manifesto = getFirstBlockquote(src);
  const scoreGlossary = getSection(src, "4. Canonical Score Glossary");
  const audiences = getSection(src, "2.2 Three audiences, one product");
  const engines = getProductLoopList(src);
  const engineCards = engines.map((e, i) => {
    const { label, gloss } = shortLabelOf(e);
    return `<div class="step"><span class="n">0${i + 1}</span><span class="label">${label}</span>${gloss.slice(0, 90)}${gloss.length > 90 ? "…" : ""}</div>`;
  }).join("\n");

  const content = `
<div class="op-header">
  <div>
    <div class="brand">ATANDA Studio · ATLAS Promptware Series</div>
    <h1 class="op-title">ARK Platform — The Cognitive Engineering OS</h1>
  </div>
  <div class="op-tag">PDD v3.0<br/>One-Pager · May 2026</div>
</div>

<div class="op-manifesto">
${manifesto}
<span class="source">Manifesto · PDD v3 §1 Executive Summary</span>
</div>

<div class="op-loop">
<h3>Product Loop — Four Engines, One Score</h3>
<div class="steps steps-${engines.length}">
${engineCards}
</div>
<div class="arrow">▸ every action feeds a single canonical score: ARK = JST + CCMI, capped at 600 ▸</div>
</div>

<h2>Three audiences, one product</h2>

${audiences}

## Canonical Score Glossary

${scoreGlossary}

<div class="op-footer">
<span>PDD-ARK-PLATFORM-V3-2026 · Junglenomics FORGE alignment</span>
<span class="atanda">ATANDA Studio</span>
</div>
`;

  await mdToPdf(
    { content },
    {
      dest: ONE_PAGER_OUT,
      css: PDD_BASE_CSS + ONE_PAGER_CSS_OVERRIDES,
      pdf_options: PDF_OPTS,
      launch_options: LAUNCH,
    },
  );
  const stat = await fs.stat(resolve(ONE_PAGER_OUT));
  console.log(`OK -> ${ONE_PAGER_OUT} (${(stat.size / 1024).toFixed(1)} KB)`);
}

async function renderExecutiveBrief(src: string) {
  // Verify anchors exist; getSection throws if any drift.
  const chapters = [
    "1. Executive Summary",
    "2. Vision & Product Positioning",
    "3. Personas & User Benefits",
  ];
  const chapterBlocks = chapters.map((h) => `# ${h}\n\n${getSection(src, h)}`);
  const matrix = getSection(src, "11.1 Cross-PDD matrix");

  const cover = `
<div class="cover">
<div class="cover-inner">

<div class="tag">Executive Brief · PDD v3.0 · May 2026</div>

<h1>ARK Platform<br/>The Cognitive Engineering OS</h1>

<div class="subtitle">A five-page executive brief extracted from the v3 Product Definition Document — manifesto, executive summary, positioning, personas, and the cross-PDD comparative matrix.</div>

<div class="manifesto">
<strong>We don't build AI agents.</strong> We engineer the DNA that governs them — powered by your cognition, owned by you.
</div>

<div class="meta">
<div>
ATLAS Promptware Series<br/>
PDD-ARK-PLATFORM-V3-2026 · Executive Brief<br/>
ATANDA Studio · Junglenomics FORGE alignment
</div>
<div class="atanda">
<strong>ATANDA</strong>
<span>Studio</span>
</div>
</div>

</div>
</div>
`;

  const content = `${cover}

${chapterBlocks.join("\n\n")}

# 4. Comparative Matrix — v3 vs the Prior PDD Corpus

${matrix}
`;

  await mdToPdf(
    { content },
    {
      dest: BRIEF_OUT,
      css: PDD_BASE_CSS + EXECUTIVE_BRIEF_CSS_OVERRIDES,
      pdf_options: PDF_OPTS,
      launch_options: LAUNCH,
    },
  );
  const stat = await fs.stat(resolve(BRIEF_OUT));
  console.log(`OK -> ${BRIEF_OUT} (${(stat.size / 1024).toFixed(1)} KB)`);
}

async function main() {
  const src = await fs.readFile(SRC, "utf-8");
  await renderOnePager(src);
  await renderExecutiveBrief(src);
}

main().catch((e) => { console.error(e); process.exit(1); });
