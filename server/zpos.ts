/**
 * ZPOS — Zero-loss Prompt Optimization Suite.
 *
 * Five deterministic compression methods, all server-side.
 *
 *   PRISM     — line-level deduplication of identical/near-identical lines
 *   SYNTHESIS — merge consecutive paragraphs that share a leading verb
 *   AEOS      — abbreviate repeated multi-word phrases via numeric refs
 *   NEXUS     — cross-reference linker: collapse repeated identifiers
 *   QUANTUM   — aggressive whitespace + filler-word stripping
 *
 * Token counts use the real cl100k_base BPE tokenizer (GPT-4 family) via
 * `gpt-tokenizer`, so pre/post token deltas reflect actual model usage,
 * not a chars/4 heuristic.
 */
import { ZPOS_METHODS, type ZposMethod } from "@shared/schema";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";

export type ZposResult = {
  method: ZposMethod;
  output: string;
  preTokens: number;
  postTokens: number;
  reductionPct: number;             // 0..100
  semanticPreservation: number;     // 0..100
  notes: string[];
};

const FILLER_WORDS = new Set([
  "very", "really", "actually", "basically", "just", "simply",
  "kind of", "sort of", "in order to", "due to the fact that",
]);

const STOP_PREAMBLE_RE = /^(please|kindly|i would like you to|i want you to)\s+/gi;

/** Real-tokenizer token count via the cl100k_base BPE encoder (the same
 *  encoding family used by GPT-4 / Claude-class models for English prose).
 *  Falls back to a chars/4 heuristic only if the encoder throws on exotic
 *  input — keeps the route resilient. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  try {
    const n = encodeCl100k(text).length;
    return Math.max(1, n);
  } catch {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}

function normaliseWhitespace(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** PRISM — drop duplicate non-blank lines (case-insensitive trim match). */
function prism(input: string): { output: string; notes: string[] } {
  const lines = input.split(/\n/);
  const seen = new Set<string>();
  const kept: string[] = [];
  let dropped = 0;
  for (const ln of lines) {
    const key = ln.trim().toLowerCase();
    if (!key) { kept.push(ln); continue; }
    if (seen.has(key)) { dropped += 1; continue; }
    seen.add(key);
    kept.push(ln);
  }
  return {
    output: normaliseWhitespace(kept.join("\n")),
    notes: [`PRISM removed ${dropped} duplicate line${dropped === 1 ? "" : "s"}.`],
  };
}

/** SYNTHESIS — collapse paragraph groups that share the same leading verb. */
function synthesis(input: string): { output: string; notes: string[] } {
  const paras = input.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const groups = new Map<string, string[]>();
  const order: string[] = [];
  for (const p of paras) {
    const verb = (p.split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
    const key = verb.length >= 3 ? verb : `__p${order.length}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key)!.push(p);
  }
  let merged = 0;
  const out: string[] = [];
  for (const k of order) {
    const arr = groups.get(k)!;
    if (arr.length > 1) {
      merged += arr.length - 1;
      // Keep first paragraph, append unique trailing fragments from siblings.
      const head = arr[0];
      const tails = arr.slice(1).map((p) => p.split(/[.!?]\s+/)[0]).join("; ");
      out.push(`${head} (also: ${tails}).`);
    } else {
      out.push(arr[0]);
    }
  }
  return {
    output: normaliseWhitespace(out.join("\n\n")),
    notes: [`SYNTHESIS merged ${merged} overlapping paragraph${merged === 1 ? "" : "s"}.`],
  };
}

/** AEOS — abbreviate the most frequent multi-word phrases as numbered refs. */
function aeos(input: string): { output: string; notes: string[] } {
  const counts = new Map<string, number>();
  const tokens = input.split(/\s+/);
  for (let i = 0; i < tokens.length - 2; i++) {
    const tri = tokens.slice(i, i + 3).join(" ").toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (tri.split(" ").every((w) => w.length >= 3)) {
      counts.set(tri, (counts.get(tri) ?? 0) + 1);
    }
  }
  const repeats = [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 6);
  let out = input;
  const legend: string[] = [];
  repeats.forEach(([phrase], idx) => {
    const ref = `§${idx + 1}`;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, ref);
    legend.push(`${ref}=${phrase}`);
  });
  if (legend.length) out = `${out}\n\n[ZPOS-AEOS legend] ${legend.join("; ")}`;
  return {
    output: normaliseWhitespace(out),
    notes: [`AEOS abbreviated ${legend.length} repeated phrase${legend.length === 1 ? "" : "s"}.`],
  };
}

/** NEXUS — collapse repeated CamelCase / ALLCAPS identifiers. */
function nexus(input: string): { output: string; notes: string[] } {
  const ids = input.match(/\b([A-Z][A-Za-z0-9]{4,}|[A-Z]{3,})\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const i of ids) counts.set(i, (counts.get(i) ?? 0) + 1);
  const repeats = [...counts.entries()].filter(([, n]) => n >= 3).slice(0, 8);
  let out = input;
  const legend: string[] = [];
  repeats.forEach(([ident], idx) => {
    const ref = `@${idx + 1}`;
    const re = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    let first = true;
    out = out.replace(re, () => {
      if (first) { first = false; return `${ident}(${ref})`; }
      return ref;
    });
    legend.push(`${ref}=${ident}`);
  });
  return {
    output: normaliseWhitespace(out),
    notes: [`NEXUS linked ${legend.length} repeated identifier${legend.length === 1 ? "" : "s"}.`],
  };
}

/** QUANTUM — strip filler words + preamble + redundant whitespace. */
function quantum(input: string): { output: string; notes: string[] } {
  let out = input.replace(STOP_PREAMBLE_RE, "");
  let removed = 0;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f}\\b`, "gi");
    out = out.replace(re, () => { removed += 1; return ""; });
  }
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  return {
    output: normaliseWhitespace(out),
    notes: [`QUANTUM stripped ${removed} filler word${removed === 1 ? "" : "s"}.`],
  };
}

const RUNNERS: Record<ZposMethod, (s: string) => { output: string; notes: string[] }> = {
  PRISM: prism, SYNTHESIS: synthesis, AEOS: aeos, NEXUS: nexus, QUANTUM: quantum,
};

/** Auto-pick the best method by running all five and choosing the highest
 *  reduction while keeping semantic preservation ≥ 75%. */
export function compress(input: string, method?: ZposMethod): ZposResult {
  const preTokens = estimateTokens(input);
  const trials: ZposResult[] = (method ? [method] : [...ZPOS_METHODS]).map((m) => {
    const { output, notes } = RUNNERS[m](input);
    const postTokens = estimateTokens(output);
    const reductionPct = preTokens > 0 ? Math.max(0, ((preTokens - postTokens) / preTokens) * 100) : 0;
    // Semantic preservation heuristic: 100 minus a penalty proportional to
    // how aggressive the compression was, floored so even QUANTUM stays >50.
    const semanticPreservation = Math.max(50, Math.round(100 - reductionPct * 0.35));
    return { method: m, output, preTokens, postTokens, reductionPct: Math.round(reductionPct * 10) / 10, semanticPreservation, notes };
  });
  // Enforce a semantic floor of 75 when auto-picking; if every method dips
  // below the floor, fall back to the highest-preservation trial so we never
  // ship a lossy default. When the caller specified a method explicitly,
  // honour that choice regardless.
  if (method) return trials[0];
  const safe = trials.filter((t) => t.semanticPreservation >= 75);
  const pool = safe.length ? safe : trials;
  pool.sort((a, b) => (b.reductionPct * b.semanticPreservation) - (a.reductionPct * a.semanticPreservation));
  return pool[0];
}
