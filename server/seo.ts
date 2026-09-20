import type { Express, Request } from "express";
import {
  DEFAULT_SEO,
  PUBLIC_PAGES,
  SITE_ORIGIN,
  SOCIAL_IMAGE_URL,
  canonicalUrl,
  getPublicPageSeo,
} from "@shared/publicSeo";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSitemapXml(): string {
  const urls = PUBLIC_PAGES.map(
    ({ path }) => `  <url><loc>${escapeXml(canonicalUrl(path))}</loc></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /admin/",
    "Disallow: /checkout/",
    "Disallow: /confirm/",
    "Disallow: /r/",
    "Disallow: /workforce",
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    "",
  ].join("\n");
}

export function injectSeoMetadata(template: string, pathname: string): string {
  const page = getPublicPageSeo(pathname);
  const seo = page ?? DEFAULT_SEO;
  const canonical = canonicalUrl(page?.path ?? pathname);
  const robots = page ? "index, follow" : "noindex, nofollow";

  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeXml(seo.title)}</title>`)
    .replace(
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${escapeXml(seo.description)}" />`,
    )
    .replace(
      "<!-- SEO_ROUTE_META -->",
      [
        `<link rel="canonical" href="${escapeXml(canonical)}" />`,
        `<meta name="robots" content="${robots}" />`,
        `<meta property="og:site_name" content="ARK by ATANDA" />`,
        `<meta property="og:url" content="${escapeXml(canonical)}" />`,
        `<meta property="og:title" content="${escapeXml(seo.title)}" />`,
        `<meta property="og:description" content="${escapeXml(seo.description)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:image" content="${SOCIAL_IMAGE_URL}" />`,
        `<meta property="og:image:alt" content="ARK Career Intelligence by ATANDA" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeXml(seo.title)}" />`,
        `<meta name="twitter:description" content="${escapeXml(seo.description)}" />`,
        `<meta name="twitter:image" content="${SOCIAL_IMAGE_URL}" />`,
      ].join("\n    "),
    );
}

export function registerSeoRoutes(app: Express): void {
  app.get("/sitemap.xml", (_req, res) => {
    res.type("application/xml").send(buildSitemapXml());
  });
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(buildRobotsTxt());
  });
  app.get("/sign-up", (_req, res) => {
    res.redirect(301, "/signup");
  });
}

export function requestPath(req: Request): string {
  return new URL(req.originalUrl || "/", SITE_ORIGIN).pathname;
}