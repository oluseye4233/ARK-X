import type { InsertCcgeCard } from "@shared/schema";

const PILLAR_BY_PREFIX: Record<string, { pillar: string; emoji: string }> = {
  SYS: { pillar: "System", emoji: "⚙️" },
  ROL: { pillar: "Role", emoji: "🎭" },
  INS: { pillar: "Instruction", emoji: "📋" },
  EXM: { pillar: "Example", emoji: "📎" },
  CON: { pillar: "Constraint", emoji: "🚧" },
  FMT: { pillar: "Format", emoji: "📐" },
  DAT: { pillar: "Data", emoji: "📊" },
  SUP: { pillar: "SuperPrompt", emoji: "🏛️" },
};

export type ParseResult = {
  cards: InsertCcgeCard[];
  skipped: Array<{ id: string | null; reason: string; snippet: string }>;
  stats: { totalBlocks: number; parsed: number; byPillar: Record<string, number>; byType: Record<string, number> };
};

function cap(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function classifyType(prefix: string, kcseTotal: number): InsertCcgeCard["type"] {
  if (prefix === "SUP") return "SuperPrompt";
  if (kcseTotal >= 93) return "Ultra";
  if (kcseTotal >= 88) return "Premium";
  return "Standard";
}

export function parseCompendium(markdown: string): ParseResult {
  const cards: InsertCcgeCard[] = [];
  const skipped: ParseResult["skipped"] = [];
  const byPillar: Record<string, number> = {};
  const byType: Record<string, number> = {};

  // Split on card headings: ### [ID] Name
  const headingRe = /^###\s+\[([A-Z]{3}-[A-Z0-9]+)\]\s+(.+)$/gm;
  const matches: Array<{ id: string; name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(markdown)) !== null) {
    matches.push({ id: m[1], name: m[2].trim(), index: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : markdown.length;
    const block = markdown.slice(start, end);
    const { id, name } = matches[i];
    const prefix = id.split("-")[0];
    const pillarInfo = PILLAR_BY_PREFIX[prefix];

    if (!pillarInfo) {
      skipped.push({ id, reason: `Unknown ID prefix: ${prefix}`, snippet: cap(block, 120) });
      continue;
    }

    const contentMatch = block.match(/\*\*Content:\*\*\s*"([\s\S]*?)"\s*$/m) || block.match(/\*\*Content:\*\*\s*(.+)$/m);
    const tokensMatch = block.match(/\*\*Tokens:\*\*\s*(\d+)/);
    const kcseMatch = block.match(/\*\*KCSE Total:\*\*\s*(\d+)\s*\/\s*100/);
    const useCasesMatch = block.match(/\*\*Use Cases:\*\*\s*(.+)$/m);

    if (!contentMatch || !tokensMatch || !kcseMatch) {
      skipped.push({
        id,
        reason: `Missing required fields (content=${!!contentMatch}, tokens=${!!tokensMatch}, kcse=${!!kcseMatch})`,
        snippet: cap(block, 160),
      });
      continue;
    }

    const body = contentMatch[1].trim().replace(/^"|"$/g, "");
    const tokenCost = parseInt(tokensMatch[1], 10);
    const kcseTotal = parseInt(kcseMatch[1], 10);
    const description = useCasesMatch ? cap(useCasesMatch[1].trim(), 180) : `${pillarInfo.pillar} card`;
    const type = classifyType(prefix, kcseTotal);
    const baseKcse = Math.max(0, Math.min(50, Math.round(kcseTotal / 2)));

    const card: InsertCcgeCard = {
      id: id.toLowerCase(),
      name,
      pillar: pillarInfo.pillar,
      type,
      baseKcse,
      tokenCost,
      emoji: pillarInfo.emoji,
      description,
      body: body.length > 0 ? body : name,
    };

    cards.push(card);
    byPillar[pillarInfo.pillar] = (byPillar[pillarInfo.pillar] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
  }

  return {
    cards,
    skipped,
    stats: { totalBlocks: matches.length, parsed: cards.length, byPillar, byType },
  };
}
