import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

export type BadgeData = {
  displayName: string;
  username: string;
  arkScore: number;
  jcseScore: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  certLevel: string;
  scenarioTitle: string;
  scenarioTier: string;
  industry: string | null;
  earnedOn: string;
  arkIdSuffix: string;
};

// Inter OTFs from rsms/inter, mirrored stably by jsDelivr at the v3.19 tag.
// Satori requires TTF/OTF (not WOFF2); these OTFs are ~260 KB each, cached
// in process memory forever after first successful load.
const FONT_URLS = [
  {
    url: "https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Regular.otf",
    weight: 400 as const,
  },
  {
    url: "https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Bold.otf",
    weight: 700 as const,
  },
];

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
let fontPromise: Promise<LoadedFont[]> | null = null;

async function loadFonts(): Promise<LoadedFont[]> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    const out: LoadedFont[] = [];
    for (const f of FONT_URLS) {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`font fetch failed ${f.url} ${res.status}`);
      out.push({ name: "Inter", data: await res.arrayBuffer(), weight: f.weight, style: "normal" });
    }
    return out;
  })();
  try {
    return await fontPromise;
  } catch (err) {
    fontPromise = null;
    throw err;
  }
}

const TIER_PALETTE: Record<BadgeData["tier"], { ring: string; glow: string; chip: string }> = {
  Bronze:   { ring: "#c97b3a", glow: "rgba(201,123,58,0.55)",  chip: "#3a2618" },
  Silver:   { ring: "#b8c6d6", glow: "rgba(184,198,214,0.55)", chip: "#1d2733" },
  Gold:     { ring: "#f6c453", glow: "rgba(246,196,83,0.65)",  chip: "#3a2f10" },
  Platinum: { ring: "#9defff", glow: "rgba(157,239,255,0.75)", chip: "#0a3540" },
};

function badgeNode(data: BadgeData): any {
  const palette = TIER_PALETTE[data.tier];
  const bg = "#0a1424";
  const cyan = "#22d3ee";
  const emerald = "#22c587";
  const muted = "#94a3b8";

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 1200,
        display: "flex",
        flexDirection: "column",
        background: `radial-gradient(circle at 30% 20%, #0e2540 0%, ${bg} 60%, #050a14 100%)`,
        color: "#e2f4ff",
        fontFamily: "Inter",
        padding: 80,
        position: "relative",
      },
      children: [
        // Header brand strip
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 28,
              letterSpacing: 6,
              color: cyan,
              fontWeight: 700,
            },
            children: [
              { type: "div", props: { children: "ARK PLATFORM" } },
              {
                type: "div",
                props: {
                  style: { color: muted, fontSize: 22, letterSpacing: 4, fontWeight: 400 },
                  children: "CCGE ARENA · CERTIFIED",
                },
              },
            ],
          },
        },
        // Main badge ring + scores
        {
          type: "div",
          props: {
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              marginTop: 30,
            },
            children: [
              // Tier disc
              {
                type: "div",
                props: {
                  style: {
                    width: 380,
                    height: 380,
                    borderRadius: 9999,
                    border: `10px solid ${palette.ring}`,
                    boxShadow: `0 0 80px ${palette.glow}, inset 0 0 60px ${palette.glow}`,
                    background: `radial-gradient(circle, ${palette.chip} 0%, ${bg} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 28, color: muted, letterSpacing: 8, fontWeight: 400 },
                        children: data.tier.toUpperCase(),
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 160,
                          fontWeight: 700,
                          color: palette.ring,
                          lineHeight: 1,
                          marginTop: 6,
                        },
                        children: String(data.jcseScore.toFixed(1)),
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 26, color: muted, letterSpacing: 4, marginTop: 4 },
                        children: "JCSE / 50",
                      },
                    },
                  ],
                },
              },
              // Scenario block
              {
                type: "div",
                props: {
                  style: {
                    marginTop: 50,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    maxWidth: 980,
                    textAlign: "center",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 22, color: cyan, letterSpacing: 4, fontWeight: 400 },
                        children: `SCENARIO · ${data.scenarioTier.toUpperCase()}${data.industry ? ` · ${data.industry.toUpperCase()}` : ""}`,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 44,
                          fontWeight: 700,
                          marginTop: 10,
                          color: "#f0f9ff",
                          lineHeight: 1.15,
                        },
                        children: data.scenarioTitle,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Footer: ARK score + identity
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              borderTop: `1px solid ${cyan}33`,
              paddingTop: 30,
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 20, color: muted, letterSpacing: 4 },
                        children: "AWARDED TO",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 40, fontWeight: 700, color: "#f0f9ff", marginTop: 4 },
                        children: data.displayName,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 22, color: emerald, marginTop: 4 },
                        children: `@${data.username}`,
                      },
                    },
                  ],
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 20, color: muted, letterSpacing: 4 },
                        children: `ARK SCORE · ${data.certLevel}`,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 64, fontWeight: 700, color: cyan, lineHeight: 1, marginTop: 4 },
                        children: String(data.arkScore),
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 18, color: muted, marginTop: 8, letterSpacing: 2 },
                        children: `${data.earnedOn} · ARK-ID ${data.arkIdSuffix}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export async function renderBadgeSvg(data: BadgeData): Promise<string> {
  const fonts = await loadFonts();
  const svg = await satori(badgeNode(data) as any, {
    width: 1200,
    height: 1200,
    fonts: fonts as any,
  });
  return svg;
}

export async function renderBadgePng(data: BadgeData): Promise<Buffer> {
  const svg = await renderBadgeSvg(data);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}
