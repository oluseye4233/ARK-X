// ─────────────────────────────────────────────────────────────────────────
// Resume claim matching (Task #61)
// Confirmations are linked to resume claims (company name for EMPLOYMENT, the
// certification label for CERTIFICATION) by string match. An exact, lowercased
// match silently orphans legitimate confirmations when the confirmer phrases a
// claim slightly differently from the resume — e.g. "Vance Inc." vs. "Vance
// Industries", "AWS Certified Solutions Architect" vs. the same with an
// "– Associate" suffix, or a minor typo.
//
// These helpers normalize punctuation/casing/whitespace, strip generic company
// descriptor suffixes, and fall back to token-containment + a length-relative
// Levenshtein comparison so reasonable variants still attach. SKILL claims are
// intentionally NOT fuzzed — they match on the stable CODEC card id, which must
// stay exact.
// ─────────────────────────────────────────────────────────────────────────

// Generic corporate descriptor tokens dropped before comparing company names.
// Includes legal suffixes (inc/llc/ltd…) AND common descriptor words
// (industries/solutions/group…) so "Vance Inc." and "Vance Industries" both
// reduce to "vance".
const COMPANY_SUFFIX_TOKENS = new Set([
  "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation",
  "co", "company", "companies", "gmbh", "plc", "lp", "llp", "sa", "ag", "nv",
  "bv", "pty", "srl", "spa", "kg", "oy", "ab",
  "group", "holdings", "holding", "industries", "industry", "enterprises",
  "enterprise", "international", "intl", "global", "worldwide", "partners",
  "associates", "solutions", "systems", "technologies", "technology", "tech",
  "labs", "laboratories", "services", "service", "consulting", "ventures",
  "capital", "agency", "studio", "studios",
]);

// Lowercase, replace any non-alphanumeric run with a single space, collapse and
// trim. Diacritics are folded so "Genève" ≈ "geneve".
export function normalizeText(s: string): string {
  return (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Company-aware normalization: normalize, then drop trailing/standalone
// corporate descriptor tokens. Never reduces to empty — if every token is a
// descriptor, the plain normalized form is kept.
export function normalizeCompany(s: string): string {
  const base = normalizeText(s);
  if (!base) return "";
  const kept = base.split(" ").filter((t) => !COMPANY_SUFFIX_TOKENS.has(t));
  const result = kept.join(" ").trim();
  return result || base;
}

// Levenshtein edit distance (iterative, two-row). Bounded inputs (claim labels
// are capped at 200 chars upstream) so the O(n·m) cost is negligible.
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// Minor-typo tolerance: allow ~1 edit per 5 chars of the shorter string (min 1).
function fuzzyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const shorter = Math.min(a.length, b.length);
  const threshold = Math.max(1, Math.floor(shorter / 5));
  return levenshtein(a, b) <= threshold;
}

// True when one normalized phrase contains the other on whole-token boundaries
// (e.g. "vance" within "vance industries"). Requires the contained phrase to be
// non-trivial (>= 3 chars) to avoid spurious single-letter hits.
function tokenContains(a: string, b: string): boolean {
  if (!a || !b) return false;
  const [shortS, longS] = a.length <= b.length ? [a, b] : [b, a];
  if (shortS.length < 3) return false;
  return (` ${longS} `).includes(` ${shortS} `);
}

// Tolerant company-name match: normalized equality, token containment, or a
// length-relative fuzzy compare on the suffix-stripped forms.
export function companyMatches(a: string, b: string): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (tokenContains(na, nb)) return true;
  if (fuzzyEqual(na, nb)) return true;
  // Final fallback on the non-stripped forms catches cases where a descriptor
  // word is the only distinguishing token but punctuation/casing differed.
  return fuzzyEqual(normalizeText(a), normalizeText(b));
}

// Tolerant certification-label match: normalized equality, token containment
// (handles "… – Associate" / "(2023)" tails), or fuzzy compare.
export function certMatches(a: string, b: string): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (tokenContains(na, nb)) return true;
  return fuzzyEqual(na, nb);
}
