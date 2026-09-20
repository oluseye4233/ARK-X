import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  DEFAULT_SEO,
  SOCIAL_IMAGE_URL,
  canonicalUrl,
  getPublicPageSeo,
} from "@shared/publicSeo";

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

export function SeoMetadata() {
  const [location] = useLocation();

  useEffect(() => {
    const page = getPublicPageSeo(location);
    const seo = page ?? DEFAULT_SEO;
    const canonical = canonicalUrl(page?.path ?? location);

    document.title = seo.title;
    upsertMeta('meta[name="description"]', { name: "description", content: seo.description });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: page ? "index, follow" : "noindex, nofollow",
    });
    upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "ARK by ATANDA" });
    upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: seo.title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: seo.description });
    upsertMeta('meta[property="og:image"]', { property: "og:image", content: SOCIAL_IMAGE_URL });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: seo.title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: seo.description });
    upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: SOCIAL_IMAGE_URL });

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [location]);

  return null;
}