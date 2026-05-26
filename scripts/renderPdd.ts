import { mdToPdf } from "md-to-pdf";
import { promises as fs } from "fs";
import { resolve } from "path";
import { PDD_BASE_CSS } from "./pddStyles";

const SRC = process.argv[2] ?? "exports/ARK_PDD_v3_Comprehensive.md";
const OUT = process.argv[3] ?? SRC.replace(/\.md$/, ".pdf");

async function main() {
  const md = await fs.readFile(SRC, "utf-8");
  const result = await mdToPdf(
    { content: md },
    {
      dest: OUT,
      css: PDD_BASE_CSS,
      pdf_options: {
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
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
