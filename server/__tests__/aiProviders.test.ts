import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AI_MODELS, AI_PREMIUM_MODELS } from "@shared/schema";
import {
  resolveModelChain,
  resolveUtilityChain,
  NoAiProviderAvailableError,
} from "../ai/providers";

// ─────────────────────────────────────────────────────────────
// LLM-resilient chain resolution.
// Availability is derived from the AI_INTEGRATIONS_* env vars at
// call time, so each test controls exactly which providers exist.
// ─────────────────────────────────────────────────────────────

const ENV_KEYS = [
  "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function setProviders(p: { anthropic?: boolean; openai?: boolean; gemini?: boolean }) {
  const map = {
    anthropic: ["AI_INTEGRATIONS_ANTHROPIC_API_KEY", "AI_INTEGRATIONS_ANTHROPIC_BASE_URL"],
    openai: ["AI_INTEGRATIONS_OPENAI_API_KEY", "AI_INTEGRATIONS_OPENAI_BASE_URL"],
    gemini: ["AI_INTEGRATIONS_GEMINI_API_KEY", "AI_INTEGRATIONS_GEMINI_BASE_URL"],
  } as const;
  for (const [provider, keys] of Object.entries(map)) {
    for (const key of keys) {
      if (p[provider as keyof typeof p]) process.env[key] = "test-value";
      else delete process.env[key];
    }
  }
}

test("chain: preferred model leads, then default, then Haiku anchor", () => {
  setProviders({ anthropic: true, openai: true, gemini: true });
  const chain = resolveModelChain({
    plan: "INDIVIDUAL_PRO",
    kind: "narrative",
    preferred: "gemini-2.5-flash",
    defaultModel: AI_MODELS.SONNET,
  });
  assert.deepEqual(chain, ["gemini-2.5-flash", AI_MODELS.SONNET, AI_MODELS.HAIKU]);
});

test("chain: FREE plan silently drops a premium preference (no escalation)", () => {
  setProviders({ anthropic: true, openai: true, gemini: true });
  const chain = resolveModelChain({
    plan: "INDIVIDUAL_FREE",
    kind: "kcse",
    preferred: "gpt-5.4", // premium — not allowed on FREE
    defaultModel: AI_MODELS.HAIKU,
  });
  for (const m of chain) {
    assert.ok(!AI_PREMIUM_MODELS.includes(m), `FREE chain must not contain premium model ${m}`);
  }
  assert.equal(chain[0], AI_MODELS.HAIKU);
});

test("chain: Anthropic outage falls through to other providers (resilience tail)", () => {
  setProviders({ anthropic: false, openai: true, gemini: true });
  const chain = resolveModelChain({
    plan: "INDIVIDUAL_PRO",
    kind: "narrative",
    preferred: null,
    defaultModel: AI_MODELS.SONNET,
  });
  assert.ok(chain.length > 0, "chain must not be empty when OpenAI/Gemini are up");
  for (const m of chain) {
    assert.ok(!m.startsWith("claude-"), `chain must not contain unavailable Anthropic model ${m}`);
  }
});

test("chain: resilience tail on FREE stays economy-only even during outage", () => {
  setProviders({ anthropic: false, openai: true, gemini: true });
  const chain = resolveModelChain({
    plan: "INDIVIDUAL_FREE",
    kind: "kcse",
    preferred: null,
    defaultModel: AI_MODELS.HAIKU,
  });
  assert.ok(chain.length > 0);
  for (const m of chain) {
    assert.ok(!AI_PREMIUM_MODELS.includes(m), `FREE outage chain must not contain premium ${m}`);
  }
});

test("chain: no providers at all → NoAiProviderAvailableError (503)", () => {
  setProviders({});
  assert.throws(
    () =>
      resolveModelChain({
        plan: "INDIVIDUAL_PRO",
        kind: "narrative",
        preferred: null,
        defaultModel: AI_MODELS.SONNET,
      }),
    NoAiProviderAvailableError,
  );
});

test("utility chain: default first, then available economy models; [] when nothing is up", () => {
  setProviders({ anthropic: true, openai: true, gemini: true });
  const full = resolveUtilityChain(AI_MODELS.HAIKU);
  assert.equal(full[0], AI_MODELS.HAIKU);
  assert.ok(full.includes("gpt-5-mini") && full.includes("gemini-2.5-flash"));
  assert.ok(!full.includes(AI_MODELS.SONNET), "utility chain is economy-only past the default");

  setProviders({ anthropic: false, openai: true, gemini: false });
  const openaiOnly = resolveUtilityChain(AI_MODELS.HAIKU);
  assert.deepEqual(openaiOnly, ["gpt-5-mini"]);

  setProviders({});
  assert.deepEqual(resolveUtilityChain(AI_MODELS.HAIKU), []);
});
