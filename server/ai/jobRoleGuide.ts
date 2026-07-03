/**
 * Job-Role Guide (Verification Quest aid).
 *
 * During Primitive Card Verification a subscriber can name the job role they are
 * authoring their 7-pillar prompt for (e.g. "Project Manager"). This module asks
 * Claude (Haiku — a cheap factual lookup) to ground that role against the three
 * skill standards the card mappings already use, so the author has a reference:
 *
 *   • O*NET — the matching U.S. occupational titles/codes (the "job roles").
 *   • SFIA  — the typical level(s) of responsibility / control (autonomy & influence).
 *   • WEF   — the Future-of-Jobs outlook: ASCENDING (growing) vs DECLINING.
 *
 * Job-role facts are user-independent, so results are cached GLOBALLY by the
 * normalized role string (30-day TTL) to keep cost near-zero on repeat lookups.
 */
import { MODELS } from "./client";
import { resolveModelChain, generateWithChain } from "./providers";
import { logUsage, enforceBudget, enforceCostBudget } from "./usage";
import { cacheKey, cacheGet, cacheSet, maybeSweepExpired } from "./cache";
import type { SubscriptionPlan } from "@shared/schema";

export type OnetRole = { code: string; title: string; note: string };
export type SfiaLevel = { level: number; name: string; control: string };
export type WefOutlook = "ASCENDING" | "DECLINING" | "STABLE";

export type JobRoleGuide = {
  role: string;
  onet: OnetRole[];
  sfia: SfiaLevel[];
  wef: { outlook: WefOutlook; summary: string; signals: string[] };
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SFIA_LEVEL_NAMES: Record<number, string> = {
  1: "Follow",
  2: "Assist",
  3: "Apply",
  4: "Enable",
  5: "Ensure / advise",
  6: "Initiate / influence",
  7: "Set strategy / inspire",
};

const SYSTEM_PROMPT = `You are ARK Skill-Standards Cartographer. Given a JOB ROLE, return STRICT JSON mapping that role to three global skill standards. No prose around the JSON.

{
  "onet": [{"code": "O*NET-SOC code like 11-9199.00", "title": "official O*NET occupation title", "note": "≤12-word relevance hint"}],  // 3-5 closest O*NET occupations
  "sfia": [{"level": int 1-7, "name": "SFIA responsibility level name", "control": "≤18-word autonomy/influence descriptor for this role at this level"}],  // 2-3 typical levels for this role
  "wef": {"outlook": one of ["ASCENDING","DECLINING","STABLE"], "summary": "≤30-word WEF Future-of-Jobs demand outlook for this role", "signals": ["≤8-word driver", "≤8-word driver"]}  // 2-3 signals
}

SFIA levels: 1 Follow, 2 Assist, 3 Apply, 4 Enable, 5 Ensure/advise, 6 Initiate/influence, 7 Set strategy/inspire. Pick the levels a real practitioner in this role typically operates at. Use genuine O*NET-SOC codes and titles. Be accurate, concise.`;

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

/**
 * Resolve the job-role guide for `role`. Cache-first (global, by normalized
 * role); only misses spend AI budget. Throws `{status:503}` when Claude is
 * not configured so the route can degrade gracefully.
 */
export async function getJobRoleGuide(opts: {
  userId: string;
  plan: SubscriptionPlan;
  role: string;
}): Promise<JobRoleGuide> {
  const normalized = normalizeRole(opts.role);
  if (!normalized) {
    const err: any = new Error("A job role is required.");
    err.status = 400;
    throw err;
  }

  const key = cacheKey(["job_role_guide", "v1", normalized]);
  const cached = await cacheGet<JobRoleGuide>(key);
  if (cached) return cached;

  await enforceBudget(opts.userId, opts.plan);
  await enforceCostBudget(opts.userId, opts.plan);
  // LLM-resilient: no Anthropic-only precheck; the chain falls back across
  // providers and throws 503 only when nothing is usable.
  const chain = resolveModelChain({
    plan: opts.plan,
    kind: "job_role_guide",
    defaultModel: MODELS.HAIKU,
  });

  const gen = await generateWithChain({
    chain,
    system: SYSTEM_PROMPT,
    prompt: `Job role: ${opts.role.slice(0, 80)}`,
    maxTokens: 1200,
  });

  await logUsage({
    userId: opts.userId,
    kind: "job_role_guide",
    model: gen.model,
    tokensIn: gen.tokensIn,
    tokensOut: gen.tokensOut,
  });

  const raw = gen.text;
  let obj: any;
  try {
    obj = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    const e: any = new Error("Could not parse the job-role guide.");
    e.status = 502;
    throw e;
  }

  const onet: OnetRole[] = (Array.isArray(obj.onet) ? obj.onet : [])
    .slice(0, 5)
    .map((o: any) => ({
      code: String(o?.code ?? "").slice(0, 20),
      title: String(o?.title ?? "").slice(0, 120),
      note: String(o?.note ?? "").slice(0, 120),
    }))
    .filter((o: OnetRole) => o.title.length > 0);

  const sfia: SfiaLevel[] = (Array.isArray(obj.sfia) ? obj.sfia : [])
    .slice(0, 4)
    .map((s: any) => {
      const level = Math.max(1, Math.min(7, parseInt(s?.level) || 1));
      return {
        level,
        name: String(s?.name || SFIA_LEVEL_NAMES[level] || `Level ${level}`).slice(0, 60),
        control: String(s?.control ?? "").slice(0, 160),
      };
    })
    .filter((s: SfiaLevel) => s.control.length > 0)
    .sort((a: SfiaLevel, b: SfiaLevel) => a.level - b.level);

  const outlookRaw = String(obj?.wef?.outlook ?? "STABLE").toUpperCase();
  const outlook: WefOutlook =
    outlookRaw === "ASCENDING" || outlookRaw === "DECLINING" ? outlookRaw : "STABLE";
  const wef = {
    outlook,
    summary: String(obj?.wef?.summary ?? "").slice(0, 220),
    signals: (Array.isArray(obj?.wef?.signals) ? obj.wef.signals : [])
      .slice(0, 3)
      .map((x: any) => String(x).slice(0, 80))
      .filter((x: string) => x.length > 0),
  };

  if (onet.length === 0 && sfia.length === 0 && !wef.summary) {
    const e: any = new Error("The job-role guide came back empty — try a more specific role.");
    e.status = 502;
    throw e;
  }

  const guide: JobRoleGuide = { role: opts.role.trim().slice(0, 80), onet, sfia, wef };
  await cacheSet(key, "job_role_guide", guide as unknown as Record<string, unknown>, CACHE_TTL_MS);
  maybeSweepExpired().catch(() => {});
  return guide;
}
