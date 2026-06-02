import { getAnthropic, isClaudeAvailable, MODELS } from "./ai/client";

// Biographical fields scraped from the combined resume/LinkedIn intake text to
// feed the "resume killer" header of the 2-page ARK Report. Extraction is
// best-effort: every path returns a complete shape and never throws.
export interface ProfileBio {
  candidateName: string | null;
  currentEmployer: string | null;
  currentRole: string | null;
  professionalQuals: string[];
  academicQuals: string[];
}

export const EMPTY_BIO: ProfileBio = {
  candidateName: null,
  currentEmployer: null,
  currentRole: null,
  professionalQuals: [],
  academicQuals: [],
};

// Per-source headers injected by buildCombinedText ("=== Resume ===").
const SOURCE_HEADER = /^=== .+ ===$/;
const SECTION_WORDS =
  /^(resume|curriculum\s*vitae|cv|profile|summary|objective|experience|work\s*experience|employment|education|skills|certifications?|contact|references?|professional\s*summary|about)\b/i;

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Heuristic name: first line that looks like a person's name (2-4 capitalized
// tokens, no digits/@, not a section header). Trailing credentials after a comma
// ("Oluseye Amusa, PMP") are dropped.
function heuristicName(lines: string[]): string | null {
  for (const raw of lines.slice(0, 12)) {
    if (SOURCE_HEADER.test(raw)) continue;
    const line = raw.replace(/,.*$/, "").trim();
    if (!line || line.length > 60) continue;
    if (/[0-9@]/.test(line)) continue;
    if (SECTION_WORDS.test(line)) continue;
    const tokens = line.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) continue;
    const looksName = tokens.every((t) => /^[A-Z][A-Za-z'’.-]*$/.test(t) || /^[A-Z][A-Z'’.-]+$/.test(t));
    if (looksName) return line;
  }
  return null;
}

const ACADEMIC_RE =
  /\b(ph\.?\s?d|doctorate|d\.?phil|m\.?b\.?a|mba|m\.?sc|msc|m\.?eng|m\.?a\b|m\.?s\b|master(?:'s|s)?|b\.?sc|bsc|b\.?eng|b\.?a\b|b\.?s\b|bachelor(?:'s|s)?|associate(?:'s)?\s+degree|hnd|ond|diploma|postgraduate|undergraduate)\b/i;

const PRO_QUAL_RE =
  /\b(pmp|prince2|pmi-acp|capm|csm|cspo|safe|popm|ssm|psm|pspo|cfa|cpa|acca|aca|cima|frm|cisa|cissp|cism|ceh|comptia|security\+|network\+|aws\s+certified|azure\s+(?:certified|administrator|architect)|gcp\s+(?:certified|professional)|google\s+cloud\s+certified|itil|six\s*sigma|lean(?:\s+six\s*sigma)?|black\s*belt|green\s*belt|chartered|c\.eng|p\.eng|series\s*\d+|cfp|shrm|phr|sphr|cma|cipd|cqf)\b/i;

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const key = v.toLowerCase().replace(/\s+/g, " ").trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(v.trim());
    }
  }
  return out;
}

function heuristicQuals(lines: string[]): { professional: string[]; academic: string[] } {
  const professional: string[] = [];
  const academic: string[] = [];
  for (const raw of lines) {
    if (SOURCE_HEADER.test(raw)) continue;
    // Split bullet/comma-packed credential lines into individual phrases.
    const parts = raw.split(/[•·|;]|,(?=\s)/).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length > 120) continue;
      if (ACADEMIC_RE.test(part)) academic.push(part);
      else if (PRO_QUAL_RE.test(part)) professional.push(part);
    }
  }
  return { professional: dedupe(professional).slice(0, 8), academic: dedupe(academic).slice(0, 8) };
}

// Best-effort current role/employer: prefer an experience line marked
// Present/Current, splitting on common "Role at Company" / "Company — Role"
// separators.
function heuristicRoleEmployer(lines: string[]): { role: string | null; employer: string | null } {
  const current = lines.find((l) => /\b(present|current)\b/i.test(l) && !SOURCE_HEADER.test(l));
  const candidate = current || "";
  if (!candidate) return { role: null, employer: null };
  const stripped = candidate.replace(/\(?\b(19|20)\d{2}\b.*$/, "").trim();
  const atMatch = stripped.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) return { role: atMatch[1].trim() || null, employer: atMatch[2].trim() || null };
  const dashMatch = stripped.split(/\s+[—–-]\s+/);
  if (dashMatch.length >= 2) {
    return { employer: dashMatch[0].trim() || null, role: dashMatch[1].trim() || null };
  }
  return { role: null, employer: null };
}

function heuristicBio(text: string): ProfileBio {
  const lines = cleanLines(text);
  const quals = heuristicQuals(lines);
  const re = heuristicRoleEmployer(lines);
  return {
    candidateName: heuristicName(lines),
    currentEmployer: re.employer,
    currentRole: re.role,
    professionalQuals: quals.professional,
    academicQuals: quals.academic,
  };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return dedupe(
    v
      .map((x) => (typeof x === "string" ? x : x == null ? "" : String(x)))
      .map((s) => s.trim())
      .filter(Boolean),
  ).slice(0, 8);
}

function asString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== "null" && t.toLowerCase() !== "n/a" ? t : null;
}

async function claudeBio(text: string): Promise<ProfileBio | null> {
  if (!isClaudeAvailable()) return null;
  const client = getAnthropic();
  const prompt = `Extract structured profile facts from the resume / LinkedIn text below. Return ONLY a JSON object, no prose, with exactly these keys:
{
  "full_name": string | null,            // the person's full name
  "current_employer": string | null,     // their current/most-recent company
  "current_role": string | null,         // their current/most-recent job title
  "professional_qualifications": string[],// professional certs/licenses (e.g. "PMP", "CFA", "AWS Certified Solutions Architect")
  "academic_qualifications": string[]     // degrees, ideally with field & institution (e.g. "BSc Computer Science, University of Lagos")
}
Use null / [] when a value is not present. Do not invent facts.

TEXT:
${text.slice(0, 9000)}`;

  const resp = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 600,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });
  const block = resp.content.find((b: any) => b.type === "text") as { text?: string } | undefined;
  const rawText = block?.text ?? "";
  const jsonStr = rawText.slice(rawText.indexOf("{"), rawText.lastIndexOf("}") + 1);
  if (!jsonStr) return null;
  const parsed = JSON.parse(jsonStr);
  return {
    candidateName: asString(parsed.full_name),
    currentEmployer: asString(parsed.current_employer),
    currentRole: asString(parsed.current_role),
    professionalQuals: asStringArray(parsed.professional_qualifications),
    academicQuals: asStringArray(parsed.academic_qualifications),
  };
}

// Public entry point. Tries Claude (Haiku) for robust extraction, then fills any
// gaps from deterministic heuristics. Always resolves to a complete ProfileBio.
export async function extractProfileBio(text: string): Promise<ProfileBio> {
  const safe = (text || "").trim();
  if (!safe) return { ...EMPTY_BIO };
  const heur = heuristicBio(safe);
  let ai: ProfileBio | null = null;
  try {
    ai = await claudeBio(safe);
  } catch (err) {
    console.error("[profileExtract] Claude extraction failed, using heuristics:", err);
  }
  if (!ai) return heur;
  return {
    candidateName: ai.candidateName ?? heur.candidateName,
    currentEmployer: ai.currentEmployer ?? heur.currentEmployer,
    currentRole: ai.currentRole ?? heur.currentRole,
    professionalQuals: ai.professionalQuals.length ? ai.professionalQuals : heur.professionalQuals,
    academicQuals: ai.academicQuals.length ? ai.academicQuals : heur.academicQuals,
  };
}
