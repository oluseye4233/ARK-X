import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { after, before, test } from "node:test";
import path from "node:path";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { createServer, type ViteDevServer } from "vite";

const viewports = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

let browser: Browser;
let server: ViteDevServer;
let baseUrl: string;

function chromiumExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const command of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      const executable = execFileSync("which", [command], { encoding: "utf8" }).trim();
      if (executable) return executable;
    } catch {
      // Try the next supported browser command.
    }
  }
  throw new Error("No Chromium executable found; set PUPPETEER_EXECUTABLE_PATH");
}

before(async () => {
  server = await createServer({
    configFile: path.resolve("vite.config.ts"),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();

  const address = server.httpServer?.address();
  assert.ok(address && typeof address === "object", "Vite did not bind a test port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  browser = await puppeteer.launch({
    executablePath: chromiumExecutable(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
});

async function collectLayoutFailures(page: Page) {
  return page.evaluate(`(() => {
    const failures = [];
    const viewportWidth = document.documentElement.clientWidth;
    const selectors = [
      ".journey-progress",
      ".journey-stop",
      ".journey-header",
      ".journey-tool",
      ".journey-context",
      ".journey-context-step",
      ".journey-footer",
      ".journey-nav",
      ".journey-help",
    ];

    const label = (element) =>
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) ||
      element.className;

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const name = label(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
          failures.push(name + " is not visibly rendered");
        }
        if (rect.width <= 0 || rect.height <= 0) {
          failures.push(name + " has no rendered area");
        }
        if (rect.left < -0.5 || rect.right > viewportWidth + 0.5) {
          failures.push(name + " is horizontally clipped (" + rect.left.toFixed(1) + ".." + rect.right.toFixed(1) + " of " + viewportWidth + ")");
        }
      }
    }

    for (const selector of [".journey-tool", ".journey-nav", ".journey-help"]) {
      for (const element of document.querySelectorAll(selector)) {
        const rect = element.getBoundingClientRect();
        if (rect.height < 32 || rect.width < 32) {
          failures.push(label(element) + " has a target smaller than 32px (" + rect.width.toFixed(1) + "x" + rect.height.toFixed(1) + ")");
        }
      }
    }

    for (const parentSelector of [".journey-stops", ".journey-actions", ".journey-context", ".journey-footer"]) {
      const parent = document.querySelector(parentSelector);
      if (!parent) {
        failures.push(parentSelector + " is missing");
        continue;
      }
      const children = [...parent.children].filter((child) => {
        const rect = child.getBoundingClientRect();
        return getComputedStyle(child).display !== "none" && rect.width > 0 && rect.height > 0;
      });
      for (let leftIndex = 0; leftIndex < children.length; leftIndex++) {
        const left = children[leftIndex].getBoundingClientRect();
        for (let rightIndex = leftIndex + 1; rightIndex < children.length; rightIndex++) {
          const right = children[rightIndex].getBoundingClientRect();
          const overlapWidth = Math.min(left.right, right.right) - Math.max(left.left, right.left);
          const overlapHeight = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
          if (overlapWidth > 0.5 && overlapHeight > 0.5) {
            failures.push(label(children[leftIndex]) + " overlaps " + label(children[rightIndex]));
          }
        }
      }
    }

    if (document.documentElement.scrollWidth > viewportWidth + 1) {
      failures.push("page is " + document.documentElement.scrollWidth + "px wide in a " + viewportWidth + "px viewport");
    }
    return failures;
  })()`) as Promise<string[]>;
}

for (const viewport of viewports) {
  test(`journey cockpit stays within the ${viewport.name} viewport`, async () => {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle0" });
      await page.waitForSelector(".journey-shell");

      const failures = await collectLayoutFailures(page);
      if (failures.length > 0) {
        await mkdir("test-results/journey-layout", { recursive: true });
        await page.screenshot({
          path: `test-results/journey-layout/${viewport.name}-${viewport.width}.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(failures, [], failures.join("\n"));
    } finally {
      await page.close();
    }
  });
}