/**
 * Book Companion (Task #22) — generic chapter badge art.
 *
 * Renders the named badge for a journey node (e.g. "System Architect") in the
 * same Satori + Resvg style as the CCGE session badges, but the art is generic
 * (not user-specific): no PII, cacheable per nodeId. The /book page overlays
 * EARNED / LOCKED state from the per-user journey data.
 */

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts, TIER_PALETTE, type BadgeData } from "./render";

export type ChapterBadgeData = {
  chapterLabel: string; // "Chapter 1"
  title: string; // "The System Frame"
  badge: string; // "System Architect"
  pillar: string | null; // "System"
  ccLevel: string | null; // "CC_100"
  tier: BadgeData["tier"]; // art colourway
};

function chapterBadgeNode(data: ChapterBadgeData): any {
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
              { type: "div", props: { children: "CONTEXT CRAFT" } },
              {
                type: "div",
                props: {
                  style: { color: muted, fontSize: 22, letterSpacing: 4, fontWeight: 400 },
                  children: "BOOK COMPANION · BADGE",
                },
              },
            ],
          },
        },
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
              {
                type: "div",
                props: {
                  style: {
                    width: 420,
                    height: 420,
                    borderRadius: 9999,
                    border: `10px solid ${palette.ring}`,
                    boxShadow: `0 0 80px ${palette.glow}, inset 0 0 60px ${palette.glow}`,
                    background: `radial-gradient(circle, ${palette.chip} 0%, ${bg} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    textAlign: "center",
                    padding: 40,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 24, color: muted, letterSpacing: 6, fontWeight: 400 },
                        children: data.chapterLabel.toUpperCase(),
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 56,
                          fontWeight: 700,
                          color: palette.ring,
                          lineHeight: 1.1,
                          marginTop: 12,
                        },
                        children: data.badge,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 26, color: muted, letterSpacing: 4, marginTop: 16 },
                        children: data.pillar ? `${data.pillar.toUpperCase()} PILLAR` : "MILESTONE",
                      },
                    },
                  ],
                },
              },
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
                        children: data.ccLevel ? data.ccLevel.replace("_", "-") : "THE LAST SKILL",
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
                        children: data.title,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
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
                  style: { fontSize: 22, color: emerald, letterSpacing: 2 },
                  children: "ARK PLATFORM · CONTEXT CRAFT",
                },
              },
              {
                type: "div",
                props: {
                  style: { fontSize: 20, color: muted, letterSpacing: 4 },
                  children: data.tier.toUpperCase(),
                },
              },
            ],
          },
        },
      ],
    },
  };
}

export async function renderChapterBadgePng(data: ChapterBadgeData): Promise<Buffer> {
  const fonts = await loadFonts();
  const svg = await satori(chapterBadgeNode(data) as any, {
    width: 1200,
    height: 1200,
    fonts: fonts as any,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  return resvg.render().asPng();
}
