import { getAnthropic, isClaudeAvailable, MODELS } from "./ai/client";
import type { WorkHistoryEntry } from "@shared/schema";

// Biographical fields scraped from the combined resume/LinkedIn intake text to
// feed the "resume killer" header of the 2-page ARK Report and the outward-
// facing ARK RESUME artifact. Extraction is best-effort: every path returns a
// complete shape and never throws.
export interface ProfileBio {
  candidateName: string | null;
  currentEmployer: string | null;
  currentRole: string | null;
  professionalQuals: string[];
  academicQuals: string[];
  // ── ARK RESUME (Task #59) contact + links + full multi-company history ──
  contactEmail: string | null;
  contactPhone: string | null;
  linkLinkedin: string | null;
  linkGithub: string | null;
  linkPortfolio: string | null;
  workHistory: WorkHistoryEntry[];
}

export const EMPTY_BIO: ProfileBio = {
  candidateName: null,
  currentEmployer: null,
  currentRole: null,
  professionalQuals: [],
  academicQuals: [],
  contactEmail: null,
  contactPhone: null,
  linkLinkedin: null,
  linkGithub: null,
  linkPortfolio: null,
  workHistory: [],
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

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[A-Za-z0-9_%\/-]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+/i;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}(?:\/[A-Za-z0-9._%\/#?=&-]*)?/i;

function normUrl(u: string | null): string | null {
  if (!u) return null;
  const t = u.trim().replace(/[.,;]+$/, "");
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

// Contact + external links: scan the whole document (these usually live in a
// header or contact block, not necessarily the first lines).
function heuristicContact(text: string): {
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
} {
  const email = text.match(EMAIL_RE)?.[0]?.trim() ?? null;
  const phone = text.match(PHONE_RE)?.[0]?.replace(/\s{2,}/g, " ").trim() ?? null;
  const linkedin = normUrl(text.match(LINKEDIN_RE)?.[0] ?? null);
  const github = normUrl(text.match(GITHUB_RE)?.[0] ?? null);
  // Portfolio = first URL that isn't linkedin/github and isn't an email host.
  let portfolio: string | null = null;
  for (const m of text.match(new RegExp(URL_RE, "gi")) ?? []) {
    const lower = m.toLowerCase();
    if (lower.includes("linkedin.com") || lower.includes("github.com")) continue;
    if (email && lower.includes(email.split("@")[1]?.toLowerCase() ?? "@@")) continue;
    portfolio = normUrl(m);
    break;
  }
  return { email, phone, linkedin, github, portfolio };
}

// Heuristic multi-company work history: find lines bearing a date range and
// split into "Role at Company" / "Company — Role". Best-effort; the Claude path
// produces far richer entries with highlights.
const DATE_RANGE_RE = /\b((?:19|20)\d{2}|present|current)\b\s*[–—-]\s*\b((?:19|20)\d{2}|present|current)\b/i;

function heuristicWorkHistory(lines: string[]): WorkHistoryEntry[] {
  const out: WorkHistoryEntry[] = [];
  for (const raw of lines) {
    if (SOURCE_HEADER.test(raw)) continue;
    const range = raw.match(DATE_RANGE_RE);
    if (!range) continue;
    const head = raw.replace(DATE_RANGE_RE, "").replace(/[()|,]+\s*$/, "").trim();
    if (!head || head.length > 120) continue;
    let company: string | null = null;
    let role: string | null = null;
    const atMatch = head.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (atMatch) {
      role = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      const dash = head.split(/\s+[—–-]\s+/);
      if (dash.length >= 2) {
        company = dash[0].trim();
        role = dash.slice(1).join(" - ").trim();
      } else {
        company = head;
      }
    }
    if (!company) continue;
    out.push({
      company,
      role: role || null,
      startDate: range[1] || null,
      endDate: range[2] || null,
      location: null,
      highlights: [],
    });
    if (out.length >= 12) break;
  }
  return out;
}

function heuristicBio(text: string): ProfileBio {
  const lines = cleanLines(text);
  const quals = heuristicQuals(lines);
  const re = heuristicRoleEmployer(lines);
  const contact = heuristicContact(text);
  return {
    candidateName: heuristicName(lines),
    currentEmployer: re.employer,
    currentRole: re.role,
    professionalQuals: quals.professional,
    academicQuals: quals.academic,
    contactEmail: contact.email,
    contactPhone: contact.phone,
    linkLinkedin: contact.linkedin,
    linkGithub: contact.github,
    linkPortfolio: contact.portfolio,
    workHistory: heuristicWorkHistory(lines),
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
  "academic_qualifications": string[],    // degrees, ideally with field & institution (e.g. "BSc Computer Science, University of Lagos")
  "contact_email": string | null,         // primary email address
  "contact_phone": string | null,         // primary phone number
  "linkedin_url": string | null,          // full LinkedIn profile URL
  "github_url": string | null,            // full GitHub profile URL
  "portfolio_url": string | null,         // personal website / portfolio URL (not linkedin/github)
  "work_history": [                        // every distinct role, most recent first
    {
      "company": string,
      "role": string | null,
      "start_date": string | null,        // e.g. "2021" or "Jan 2021"
      "end_date": string | null,          // e.g. "2024" or "Present"
      "location": string | null,
      "highlights": string[]              // up to 4 concise achievement bullets
    }
  ]
}
Use null / [] when a value is not present. Do not invent facts.

TEXT:
${text.slice(0, 12000)}`;

  const resp = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 1800,
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
    contactEmail: asString(parsed.contact_email),
    contactPhone: asString(parsed.contact_phone),
    linkLinkedin: normUrl(asString(parsed.linkedin_url)),
    linkGithub: normUrl(asString(parsed.github_url)),
    linkPortfolio: normUrl(asString(parsed.portfolio_url)),
    workHistory: asWorkHistory(parsed.work_history),
  };
}

// Normalize the Claude work_history array into clean WorkHistoryEntry[]. Drops
// entries with no company; caps the list + per-entry highlights.
function asWorkHistory(v: unknown): WorkHistoryEntry[] {
  if (!Array.isArray(v)) return [];
  const out: WorkHistoryEntry[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const company = asString(r.company);
    if (!company) continue;
    out.push({
      company,
      role: asString(r.role),
      startDate: asString(r.start_date),
      endDate: asString(r.end_date),
      location: asString(r.location),
      highlights: asStringArray(r.highlights).slice(0, 4),
    });
    if (out.length >= 12) break;
  }
  return out;
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
    contactEmail: ai.contactEmail ?? heur.contactEmail,
    contactPhone: ai.contactPhone ?? heur.contactPhone,
    linkLinkedin: ai.linkLinkedin ?? heur.linkLinkedin,
    linkGithub: ai.linkGithub ?? heur.linkGithub,
    linkPortfolio: ai.linkPortfolio ?? heur.linkPortfolio,
    workHistory: ai.workHistory.length ? ai.workHistory : heur.workHistory,
  };
}
