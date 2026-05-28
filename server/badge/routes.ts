import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { renderBadgePng, type BadgeData } from "./render";
import { JCSE_TIER_THRESHOLDS } from "@shared/schema";

// PNG render cache — badges are immutable per (sessionId), so we can cache
// aggressively. Bounded to ~50 entries (~17 MB at ~340 KB each) with simple
// FIFO eviction; that's plenty for any realistic share-link traffic pattern.
const PNG_CACHE_MAX = 50;
const PNG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
type CacheEntry = { buf: Buffer; expires: number };
const pngCache = new Map<string, CacheEntry>();
function cacheGet(id: string): Buffer | null {
  const hit = pngCache.get(id);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    pngCache.delete(id);
    return null;
  }
  return hit.buf;
}
function cacheSet(id: string, buf: Buffer) {
  if (pngCache.size >= PNG_CACHE_MAX) {
    const firstKey = pngCache.keys().next().value;
    if (firstKey) pngCache.delete(firstKey);
  }
  pngCache.set(id, { buf, expires: Date.now() + PNG_CACHE_TTL_MS });
}

// Per-IP throttle for the expensive PNG endpoint. Badge images are heavy
// (Satori + Resvg, ~200 ms uncached). The HTML share page is cheap and falls
// under the general rate limit.
const badgePngLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many badge renders, please slow down." },
});

function tierLabel(jcse: number): BadgeData["tier"] | null {
  if (jcse >= JCSE_TIER_THRESHOLDS.PLATINUM) return "Platinum";
  if (jcse >= JCSE_TIER_THRESHOLDS.GOLD) return "Gold";
  if (jcse >= JCSE_TIER_THRESHOLDS.SILVER) return "Silver";
  if (jcse >= JCSE_TIER_THRESHOLDS.BRONZE) return "Bronze";
  return null;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function publicOrigin(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function loadBadgeData(sessionId: string): Promise<BadgeData | { error: string; status: number }> {
  const session = await storage.getGameSession(sessionId);
  if (!session) return { error: "Session not found", status: 404 };
  if (session.status !== "finished" || session.kcseScore == null) {
    return { error: "Session has not been finished", status: 404 };
  }
  const tier = tierLabel(session.kcseScore);
  if (!tier) return { error: "Session did not earn a tier badge", status: 404 };

  const [user, scenario] = await Promise.all([
    storage.getUser(session.userId),
    storage.getCcgeScenario(session.scenarioId),
  ]);
  if (!user || !scenario) return { error: "Session metadata unavailable", status: 404 };

  const arkId = (user.arkIdString || "").replace(/[^A-Z0-9-]/gi, "");
  const arkIdSuffix = arkId ? arkId.slice(-8).toUpperCase() : "—";
  const earnedOn = (session.finishedAt ?? new Date()).toISOString().slice(0, 10);

  return {
    displayName: user.name,
    username: user.username,
    arkScore: user.arkScore ?? 0,
    jcseScore: session.kcseScore,
    tier,
    certLevel: (user as any).contextCraftCertLevel || "—",
    scenarioTitle: scenario.title,
    scenarioTier: scenario.tier,
    industry: scenario.industry,
    earnedOn,
    arkIdSuffix,
  };
}

export function registerBadgeRoutes(app: Express) {
  // PNG endpoint — public; UUID session IDs are unguessable, sharing the URL
  // is opt-in. Per-IP throttle + in-memory PNG cache protect the CPU-heavy
  // Satori+Resvg pipeline from re-render storms.
  app.get("/badge/:sessionId.png", badgePngLimiter, async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.sessionId);
      const cached = cacheGet(sessionId);
      if (cached) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
        res.setHeader("X-Robots-Tag", "noindex");
        res.setHeader("X-Badge-Cache", "HIT");
        return res.send(cached);
      }
      const data = await loadBadgeData(sessionId);
      if ("error" in data) return res.status(data.status).json({ message: data.error });
      const png = await renderBadgePng(data);
      cacheSet(sessionId, png);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
      res.setHeader("X-Robots-Tag", "noindex");
      res.setHeader("X-Badge-Cache", "MISS");
      return res.send(png);
    } catch (err: any) {
      console.error("[badge] render failed:", err?.message || err);
      return res.status(500).json({ message: "Badge render failed" });
    }
  });

  // HTML share page with Open Graph + Twitter Card unfurls
  app.get("/badge/:sessionId", async (req: Request, res: Response) => {
    try {
      const sessionId = String(req.params.sessionId);
      const data = await loadBadgeData(sessionId);
      if ("error" in data) {
        res.status(data.status);
        return res.type("html").send(
          `<!doctype html><meta charset="utf-8"><title>Badge unavailable</title>` +
          `<body style="background:#0a1424;color:#94a3b8;font-family:system-ui;display:flex;` +
          `align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">` +
          `<div><h1 style="color:#22d3ee">Badge unavailable</h1><p>${esc(data.error)}</p>` +
          `<p><a href="/" style="color:#22c587">ARK Platform →</a></p></div></body>`,
        );
      }

      const origin = publicOrigin(req);
      const imgUrl = `${origin}/badge/${sessionId}.png`;
      const pageUrl = `${origin}/badge/${sessionId}`;
      const title = `${data.displayName} — ${data.tier} on ARK CCGE`;
      const description =
        `Earned ${data.tier} tier (JCSE ${data.jcseScore.toFixed(1)} / 50) on the ${data.scenarioTier} scenario ` +
        `“${data.scenarioTitle}”. ARK Score ${data.arkScore} · ARK-ID ${data.arkIdSuffix}.`;

      res.setHeader("Cache-Control", "public, max-age=300");
      res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(pageUrl)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(imgUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="1200" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(imgUrl)}" />
<style>
  :root { color-scheme: dark; }
  html,body { margin:0; padding:0; background:#0a1424; color:#e2f4ff;
    font-family:'Inter',system-ui,sans-serif; min-height:100vh; }
  body { background:
    radial-gradient(circle at 30% 20%, #0e2540 0%, #0a1424 60%, #050a14 100%);
    display:flex; flex-direction:column; align-items:center; padding:48px 24px 64px; }
  .brand { color:#22d3ee; letter-spacing:6px; font-weight:700; font-size:14px; }
  h1 { margin:24px 0 8px; font-size:28px; text-align:center; line-height:1.25; }
  .sub { color:#94a3b8; text-align:center; max-width:640px; line-height:1.5; margin:0 0 32px; }
  .badge-wrap { width:min(640px,100%); aspect-ratio:1/1; border-radius:24px;
    overflow:hidden; box-shadow:0 30px 80px rgba(34,211,238,0.18),
    inset 0 0 0 1px rgba(34,211,238,0.25); }
  .badge-wrap img { width:100%; height:100%; display:block; }
  .actions { display:flex; gap:12px; margin-top:32px; flex-wrap:wrap; justify-content:center; }
  .btn { display:inline-flex; align-items:center; gap:8px; padding:12px 20px;
    border-radius:10px; background:#0f1f36; color:#e2f4ff; text-decoration:none;
    border:1px solid rgba(34,211,238,0.4); font-weight:600; font-size:15px; cursor:pointer; }
  .btn.primary { background:linear-gradient(135deg,#22d3ee,#22c587); color:#03121e;
    border-color:transparent; }
  .btn:hover { filter:brightness(1.1); }
  .meta { color:#64748b; font-size:12px; margin-top:32px; letter-spacing:2px; }
</style>
</head>
<body>
  <div class="brand">ARK PLATFORM · CCGE ARENA</div>
  <h1>${esc(data.displayName)} earned <span style="color:#22d3ee">${esc(data.tier)}</span></h1>
  <p class="sub">JCSE ${data.jcseScore.toFixed(1)} / 50 on the ${esc(data.scenarioTier)} scenario
    <strong>${esc(data.scenarioTitle)}</strong>${data.industry ? ` — ${esc(data.industry)}` : ""}.
    Current ARK Score <strong style="color:#22d3ee">${data.arkScore}</strong>.</p>
  <div class="badge-wrap"><img src="${esc(imgUrl)}" alt="ARK CCGE ${esc(data.tier)} badge" /></div>
  <div class="actions">
    <a class="btn primary" href="/" data-testid="link-explore-ark">Try ARK Platform →</a>
    <a class="btn" href="${esc(imgUrl)}" download="ark-badge-${esc(sessionId)}.png" data-testid="link-download-png">Download PNG</a>
  </div>
  <div class="meta">ARK-ID ${esc(data.arkIdSuffix)} · ${esc(data.earnedOn)}</div>
</body>
</html>`);
    } catch (err: any) {
      console.error("[badge] page failed:", err?.message || err);
      return res.status(500).type("html").send("Badge page failed");
    }
  });
}
