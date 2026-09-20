export const SITE_ORIGIN = "https://atanda.ai";
export const SOCIAL_IMAGE_URL = `${SITE_ORIGIN}/opengraph.jpg`;

export interface PublicPageSeo {
  path: string;
  title: string;
  description: string;
}

export const PUBLIC_PAGES: readonly PublicPageSeo[] = [
  {
    path: "/",
    title: "ARK Career Intelligence | ATANDA",
    description:
      "Upload your CV and turn your experience into clear career intelligence, an ARK Score, and practical next steps in minutes.",
  },
  {
    path: "/demo",
    title: "ARK Product Demo | ATANDA",
    description:
      "Explore how ARK combines career intelligence, AI capability, mobility, and workforce insights in one platform.",
  },
  {
    path: "/demo-tour",
    title: "Guided ARK Platform Tour | ATANDA",
    description:
      "Take a guided, no-login tour of ARK career scores, skill games, pathways, marketplace tools, and workforce intelligence.",
  },
  {
    path: "/signup",
    title: "Create Your ARK Account | ATANDA",
    description:
      "Create an ARK account to build your career intelligence profile, understand your strengths, and plan your next move.",
  },
  {
    path: "/login",
    title: "Sign In to ARK | ATANDA",
    description:
      "Sign in securely to your ARK Career Intelligence account and continue building your verified career profile.",
  },
  {
    path: "/subscription",
    title: "ARK Plans and Pricing | ATANDA",
    description:
      "Compare ARK plans for individuals, professionals, students, and institutions and choose the intelligence tools you need.",
  },
  {
    path: "/context-craft",
    title: "Context Craft and AI Capability | ARK by ATANDA",
    description:
      "Learn how Context Craft develops practical AI capability and strengthens the CCMI dimension of your ARK identity.",
  },
  {
    path: "/f1000",
    title: "ARK First 1,000 Offer | ATANDA",
    description:
      "Discover the ARK First 1,000 launch offer and start building a clearer, verified picture of your career potential.",
  },
  {
    path: "/training",
    title: "Career Training Providers | ARK by ATANDA",
    description:
      "Explore training providers and development options aligned with the capability gaps identified by your ARK profile.",
  },
  {
    path: "/privacy",
    title: "ARK Privacy Policy | ATANDA",
    description:
      "Read how ATANDA collects, uses, protects, and manages personal information across the ARK Career Intelligence platform.",
  },
  {
    path: "/terms",
    title: "ARK Terms of Service | ATANDA",
    description:
      "Review the terms that govern access to and use of the ARK Career Intelligence platform and related ATANDA services.",
  },
] as const;

export const DEFAULT_SEO = PUBLIC_PAGES[0];

export function normalizeSeoPath(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

export function getPublicPageSeo(pathname: string): PublicPageSeo | undefined {
  const normalized = normalizeSeoPath(pathname);
  return PUBLIC_PAGES.find((page) => page.path === normalized);
}

export function canonicalUrl(path: string): string {
  return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}