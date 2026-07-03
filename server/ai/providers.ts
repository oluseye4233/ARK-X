import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import {
  AI_MODELS,
  AI_TIER_MODEL_POLICY,
  SELECTABLE_AI_MODELS,
  type AiKind,
  type AiProvider,
  type SubscriptionPlan,
} from "@shared/schema";
import { getAnthropic, isClaudeAvailable, assertModelAllowed } from "./client";
import { isFeatureEnabled } from "../featureFlags";

// ── LLM-resilient provider layer ──────────────────────────────────────
// Routes a generation request to Anthropic / OpenAI / Gemini based on the
// resolved model id, with an ordered fallback chain so a single provider
// outage never takes an AI feature down. Every call site keeps the
// mandatory guardrail order: enforceBudget → enforceCostBudget →
// (policy-checked chain) → API call → logUsage(actual model).

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
      },
    });
  }
  return _gemini;
}

export function providerFor(model: string): AiProvider | null {
  return SELECTABLE_AI_MODELS.find(m => m.id === model)?.provider ?? null;
}

export function isProviderAvailable(provider: AiProvider): boolean {
  switch (provider) {
    case "anthropic":
      return isClaudeAvailable();
    case "openai":
      return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
    case "gemini":
      return !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY && process.env.AI_INTEGRATIONS_GEMINI_BASE_URL);
  }
}

export function isModelAvailable(model: string): boolean {
  const provider = providerFor(model);
  return provider !== null && isProviderAvailable(provider);
}

/** Non-throwing mirror of assertModelAllowed (same policy source). */
export function isModelAllowed(plan: SubscriptionPlan, model: string, kind: AiKind): boolean {
  if (!isFeatureEnabled("revenueGuardrail")) return true;
  try {
    assertModelAllowed(plan, model, kind);
    return true;
  } catch {
    return false;
  }
}

export class NoAiProviderAvailableError extends Error {
  status = 503;
  constructor() {
    super("No AI provider is configured on this server.");
  }
}

/**
 * Build the ordered model chain for one generation:
 *   1. the user's preferred model — only if roster-valid, provider-available,
 *      AND allowed for (plan, kind);
 *   2. the feature's default model — policy semantics preserved: when no
 *      valid preference exists, assertModelAllowed throws exactly as before;
 *   3. Claude Haiku as the resilience anchor (allowed on every tier).
 */
export function resolveModelChain(opts: {
  plan: SubscriptionPlan;
  kind: AiKind;
  preferred?: string | null;
  defaultModel: string;
}): string[] {
  const chain: string[] = [];

  if (
    opts.preferred &&
    isModelAvailable(opts.preferred) &&
    isModelAllowed(opts.plan, opts.preferred, opts.kind)
  ) {
    chain.push(opts.preferred);
  }

  if (chain.length === 0) {
    // No usable preference — legacy behaviour: policy violation throws here.
    assertModelAllowed(opts.plan, opts.defaultModel, opts.kind);
  }
  if (isModelAvailable(opts.defaultModel) && isModelAllowed(opts.plan, opts.defaultModel, opts.kind)) {
    chain.push(opts.defaultModel);
  }
  if (isModelAvailable(AI_MODELS.HAIKU) && isModelAllowed(opts.plan, AI_MODELS.HAIKU, opts.kind)) {
    chain.push(AI_MODELS.HAIKU);
  }

  // Cross-provider resilience: if the preferred/default/Haiku candidates are
  // all unavailable (e.g. Anthropic outage), fall through to any other
  // available + plan-allowed model, economy tier first (cheapest fallback).
  if (chain.length === 0) {
    const rest = [...SELECTABLE_AI_MODELS]
      .sort((a, b) => (a.costTier === b.costTier ? 0 : a.costTier === "economy" ? -1 : 1))
      .filter(m => isModelAvailable(m.id) && isModelAllowed(opts.plan, m.id, opts.kind))
      .map(m => m.id);
    chain.push(...rest);
  }

  const deduped = Array.from(new Set(chain));
  if (deduped.length === 0) throw new NoAiProviderAvailableError();
  return deduped;
}

/**
 * Availability-only chain for internal utility calls (no user/plan context,
 * e.g. resume card-mapping, profile extraction). Preferred default first,
 * then any other available economy-tier model. Returns [] when no provider
 * is configured — callers degrade gracefully.
 */
export function resolveUtilityChain(defaultModel: string): string[] {
  const chain: string[] = [];
  if (isModelAvailable(defaultModel)) chain.push(defaultModel);
  for (const m of SELECTABLE_AI_MODELS) {
    if (m.costTier === "economy" && isModelAvailable(m.id)) chain.push(m.id);
  }
  return Array.from(new Set(chain));
}

export type GenerationResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
};

async function withTimeout<T>(p: Promise<T>, ms: number | undefined, label: string): Promise<T> {
  if (!ms) return p;
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Single-model generation, routed to the right provider SDK. */
export async function generateText(opts: {
  model: string;
  system: string;
  prompt: string;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<GenerationResult> {
  const provider = providerFor(opts.model);
  if (!provider) throw new Error(`Unknown AI model: ${opts.model}`);

  if (provider === "anthropic") {
    const message = await withTimeout(
      getAnthropic().messages.create({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      opts.timeoutMs,
      `anthropic ${opts.model}`,
    );
    const block = message.content[0];
    return {
      text: block && block.type === "text" ? block.text : "",
      tokensIn: message.usage.input_tokens,
      tokensOut: message.usage.output_tokens,
      model: opts.model,
    };
  }

  if (provider === "openai") {
    const completion = await withTimeout(
      getOpenAI().chat.completions.create({
        model: opts.model,
        max_completion_tokens: opts.maxTokens,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }),
      opts.timeoutMs,
      `openai ${opts.model}`,
    );
    return {
      text: completion.choices[0]?.message?.content ?? "",
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
      model: opts.model,
    };
  }

  // gemini
  const response = await withTimeout(
    getGemini().models.generateContent({
      model: opts.model,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens,
      },
    }),
    opts.timeoutMs,
    `gemini ${opts.model}`,
  );
  return {
    text: response.text ?? "",
    tokensIn: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: response.usageMetadata?.candidatesTokenCount ?? 0,
    model: opts.model,
  };
}

/**
 * Try each model in the chain until one succeeds. Provider/API errors fall
 * through to the next candidate; the final failure is rethrown so callers
 * keep their existing error semantics.
 */
export async function generateWithChain(opts: {
  chain: string[];
  system: string;
  prompt: string;
  maxTokens: number;
  timeoutMs?: number;
}): Promise<GenerationResult> {
  let lastErr: unknown = new NoAiProviderAvailableError();
  for (const model of opts.chain) {
    try {
      return await generateText({ model, system: opts.system, prompt: opts.prompt, maxTokens: opts.maxTokens, timeoutMs: opts.timeoutMs });
    } catch (err) {
      lastErr = err;
      console.warn(`[ai/providers] ${model} failed, trying next in chain:`, err instanceof Error ? err.message : err);
    }
  }
  throw lastErr;
}
