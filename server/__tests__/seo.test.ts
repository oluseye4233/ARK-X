import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_PAGES } from "@shared/publicSeo";
import type { Request } from "express";
import { buildRobotsTxt, buildSitemapXml, injectSeoMetadata, requestPath } from "../seo";

test("sitemap contains each stable public page and excludes protected route families", () => {
  const sitemap = buildSitemapXml();
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  for (const page of PUBLIC_PAGES) {
    const expected = page.path === "/" ? "https://atanda.ai/" : `https://atanda.ai${page.path}`;
    assert.ok(sitemap.includes(`<loc>${expected}</loc>`), `missing ${expected}`);
  }
  for (const excluded of ["/dashboard", "/admin/", "/checkout/", "/confirm/", "/r/", "/workforce"]) {
    assert.ok(!sitemap.includes(excluded), `included protected route ${excluded}`);
  }
});

test("robots policy is plain crawler guidance with an absolute sitemap URL", () => {
  const robots = buildRobotsTxt();
  assert.match(robots, /^User-agent: \*/);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Sitemap: https:\/\/atanda\.ai\/sitemap\.xml/);
  assert.ok(!robots.includes("<html"));
});

test("HTML metadata is route-specific and private routes are noindex", () => {
  const template = '<title>Old</title><meta name="description" content="Old" /><!-- SEO_ROUTE_META -->';
  const signup = injectSeoMetadata(template, "/signup");
  assert.match(signup, /<title>Create Your ARK Account \| ATANDA<\/title>/);
  assert.match(signup, /rel="canonical" href="https:\/\/atanda\.ai\/signup"/);
  assert.match(signup, /name="robots" content="index, follow"/);
  assert.match(signup, /property="og:site_name" content="ARK by ATANDA"/);
  assert.match(signup, /property="og:image" content="https:\/\/atanda\.ai\/opengraph\.jpg"/);

  const dashboard = injectSeoMetadata(template, "/dashboard");
  assert.match(dashboard, /name="robots" content="noindex, nofollow"/);
  assert.match(dashboard, /rel="canonical" href="https:\/\/atanda\.ai\/dashboard"/);
});

test("SPA fallback keeps the original route after Express mount-path rewriting", () => {
  const req = { originalUrl: "/signup?campaign=f1000", path: "/" } as Request;
  assert.equal(requestPath(req), "/signup");
});