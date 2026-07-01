import { mdToPdf } from "md-to-pdf";
import { promises as fs } from "fs";
import { resolve } from "path";
import { execFileSync } from "child_process";
import { PDD_BASE_CSS } from "./pddStyles";

/**
 * Resolve a working headless Chromium executable path.
 *
 * Puppeteer cannot auto-resolve a browser in this Nix environment, so we point
 * it at a real chromium binary. Prefer an explicit PUPPETEER_EXECUTABLE_PATH,
 * then fall back to `which chromium` (a recent stable build). Never glob the
 * nix store with `head -1` — that can select an ancient ungoogled build that
 * crashes Puppeteer.
 */
export function resolveChromium(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const bin of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      const path = execFileSync("which", [bin], { encoding: "utf-8" }).trim();
      if (path) return path;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

export async function renderPdd(src: string, out: string): Promise<number> {
  const md = await fs.readFile(src, "utf-8");
  const executablePath = resolveChromium();
  const result = await mdToPdf(
    { content: md },
    {
      dest: out,
      css: PDD_BASE_CSS,
      pdf_options: {
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        preferCSSPageSize: true,
      },
      launch_options: {
        ...(executablePath ? { executablePath } : {}),
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    },
  );
  if (!result) throw new Error("md-to-pdf returned no result");
  const stat = await fs.stat(resolve(out));
  return stat.size;
}

async function main() {
  const src = process.argv[2] ?? "exports/ARK_PDD_v3_Comprehensive.md";
  const out = process.argv[3] ?? src.replace(/\.md$/, ".pdf");
  const size = await renderPdd(src, out);
  console.log(`OK -> ${out} (${(size / 1024).toFixed(1)} KB)`);
}

// Only run when invoked directly, not when imported by the batch renderer.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
