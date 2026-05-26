import { promises as fs } from "fs";
import { join } from "path";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const { PDFParse } = _require("pdf-parse") as {
  PDFParse: new (opts: { data: Uint8Array }) => { getText: () => Promise<{ text: string }> };
};
const mammoth = _require("mammoth");

interface Source {
  file: string;
  slug: string;
  era: string;
  label: string;
}

const SOURCES: Source[] = [
  { file: "attached_assets/ark_pdd_integrated_1772508982725.PDF",                    slug: "integrated-v1",        era: "Feb 2026", label: "ARK Integrated PDD" },
  { file: "attached_assets/ARK.PDD_1772916330513.docx",                              slug: "forge-v1",             era: "Mar 2026", label: "ARK Forge PDD" },
  { file: "attached_assets/JNOMICSDECK_ALPHA_ATLAS_PDD_1772917266346.docx",          slug: "jnomicsdeck-alpha",    era: "Mar 2026", label: "JnomicsDeck Alpha ATLAS PDD" },
  { file: "attached_assets/ARK_ONECRAFT_PDD_2_1777754861165.docx",                   slug: "onecraft-v2",          era: "May 2026", label: "ARK Onecraft PDD v2" },
  { file: "attached_assets/🏛_ARK_ONECRAFT_PDD_MVP_1777780267429.docx",              slug: "onecraft-mvp",         era: "May 2026", label: "ARK Onecraft PDD MVP" },
  { file: "attached_assets/ATANDA_COMMAND_CENTRE_MVP_ATLAS_PDD_1779068028604.md",    slug: "atanda-command-centre",era: "May 2026", label: "ATANDA Command Centre MVP ATLAS PDD" },
  { file: "attached_assets/MATRIX_MARKETPLACE_ATLAS_PDD_1_1779720958175.pdf",        slug: "matrix-marketplace",   era: "May 2026", label: "Matrix Marketplace ATLAS PDD" },
  { file: "exports/ATLAS_PDD_ARK_Platform_Investor.pdf",                             slug: "investor-atlas",       era: "May 2026", label: "ATLAS PDD ARK Platform — Investor" },
];

const OUT_DIR = ".local/pdd-corpus";

function topHeadings(text: string, max = 25): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headings: string[] = [];
  for (const l of lines) {
    if (headings.length >= max) break;
    if (/^#{1,3}\s+/.test(l)) headings.push(l.replace(/^#+\s+/, ""));
    else if (/^[A-Z0-9][A-Z0-9 :·•\-—'’&()\/]{8,}$/.test(l) && l.length < 100) headings.push(l);
  }
  return Array.from(new Set(headings));
}

function keyThemes(text: string): string[] {
  const themeWords = [
    "ARK", "JST", "CCMI", "HIVE", "SPHINX", "CCGE", "Matrix", "Forge", "Bonsai",
    "Onecraft", "Junglenomics", "ATANDA", "FORGE", "GUIN", "LHCS", "agent", "cohort",
    "marketplace", "vulnerability", "transferability", "archetype", "prompt", "DNA",
  ];
  const lc = text.toLowerCase();
  const hits: Array<[string, number]> = [];
  for (const w of themeWords) {
    const count = (lc.match(new RegExp(`\\b${w.toLowerCase()}\\b`, "g")) || []).length;
    if (count > 0) hits.push([w, count]);
  }
  hits.sort((a, b) => b[1] - a[1]);
  return hits.slice(0, 12).map(([w, n]) => `${w}(${n})`);
}

async function extract(src: Source): Promise<{ text: string; bytes: number }> {
  const buf = await fs.readFile(src.file);
  const lower = src.file.toLowerCase();
  let text = "";
  if (lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    text = (await parser.getText()).text;
  } else if (lower.endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    text = buf.toString("utf-8");
  } else {
    text = buf.toString("utf-8");
  }
  return { text, bytes: buf.length };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const manifest: any[] = [];
  for (const src of SOURCES) {
    try {
      const { text, bytes } = await extract(src);
      const cleaned = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
      await fs.writeFile(join(OUT_DIR, `${src.slug}.txt`), cleaned, "utf-8");
      manifest.push({
        slug: src.slug,
        label: src.label,
        era: src.era,
        sourceFile: src.file,
        bytes,
        chars: cleaned.length,
        words: cleaned.split(/\s+/).filter(Boolean).length,
        topHeadings: topHeadings(cleaned, 20),
        keyThemes: keyThemes(cleaned),
      });
      console.log(`OK  ${src.slug}: ${cleaned.length} chars`);
    } catch (e: any) {
      console.error(`FAIL ${src.slug}: ${e?.message ?? e}`);
      manifest.push({ slug: src.slug, label: src.label, era: src.era, sourceFile: src.file, error: String(e?.message ?? e) });
    }
  }
  await fs.writeFile(join(OUT_DIR, "MANIFEST.json"), JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifest.length} entries to ${OUT_DIR}/MANIFEST.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
