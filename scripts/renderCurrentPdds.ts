import { promises as fs } from "fs";
import { join } from "path";
import { renderPdd } from "./renderPdd";

const DIR = "exports";
const MATCH = /Current.*\.md$/;

async function findCurrentSources(): Promise<string[]> {
  const entries = await fs.readdir(DIR);
  return entries
    .filter((f) => MATCH.test(f))
    .map((f) => join(DIR, f))
    .sort();
}

async function mtime(path: string): Promise<number | null> {
  try {
    return (await fs.stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * --check: report (without rendering) any Current PDF that is missing or older
 * than its sibling markdown. Exits 1 if drift is found so CI can catch it.
 */
async function check(sources: string[]): Promise<void> {
  const stale: string[] = [];
  for (const src of sources) {
    const out = src.replace(/\.md$/, ".pdf");
    const mdTime = await mtime(src);
    const pdfTime = await mtime(out);
    if (pdfTime === null) {
      stale.push(`${out} — MISSING (never rendered)`);
    } else if (mdTime !== null && pdfTime < mdTime) {
      const ageMin = ((mdTime - pdfTime) / 60000).toFixed(1);
      stale.push(`${out} — STALE (${ageMin} min older than ${src})`);
    }
  }
  if (stale.length) {
    console.error("PDD drift detected:");
    for (const line of stale) console.error(`  ✗ ${line}`);
    console.error(`\nRun \`npm run pdd:render\` to regenerate.`);
    process.exit(1);
  }
  console.log(`OK — all ${sources.length} Current PDD(s) are up to date.`);
}

async function render(sources: string[]): Promise<void> {
  for (const src of sources) {
    const out = src.replace(/\.md$/, ".pdf");
    const size = await renderPdd(src, out);
    console.log(`OK -> ${out} (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log(`Rendered ${sources.length} Current PDD(s).`);
}

async function main() {
  const sources = await findCurrentSources();
  if (!sources.length) {
    console.error(`No Current PDD markdown found in ${DIR}/`);
    process.exit(1);
  }
  const checkMode = process.argv.includes("--check");
  if (checkMode) {
    await check(sources);
  } else {
    await render(sources);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
