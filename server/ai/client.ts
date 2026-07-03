import Anthropic from "@anthropic-ai/sdk";
import { AI_MODELS, AI_PREMIUM_MODELS, AI_TIER_MODEL_POLICY, type AiKind, type SubscriptionPlan } from "@shared/schema";
import { isFeatureEnabled } from "../featureFlags";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });
  }
  return _client;
}

export const MODELS = AI_MODELS;

export function isClaudeAvailable(): boolean {
  return !!(process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL);
}

export class ModelPolicyViolationError extends Error {
  status = 403;
  upgradePath = "/subscription";
  constructor(public plan: SubscriptionPlan, public model: string, public kind: AiKind) {
    super(
      `Model ${model} is not permitted for kind=${kind} on plan ${plan}. Upgrade for full model access.`,
    );
  }
}

/**
 * Phase O — single chokepoint enforcing AI_TIER_MODEL_POLICY. Called by every
 * Anthropic call site immediately before `client.messages.create`. Dead code
 * when `revenueGuardrail` is OFF, so existing behaviour is preserved.
 */
export function assertModelAllowed(plan: SubscriptionPlan, model: string, kind: AiKind): void {
  if (!isFeatureEnabled("revenueGuardrail")) return;
  const policy = AI_TIER_MODEL_POLICY[plan as keyof typeof AI_TIER_MODEL_POLICY]
    ?? AI_TIER_MODEL_POLICY.INDIVIDUAL_FREE;
  if (!policy.allowedModels.includes(model)) {
    throw new ModelPolicyViolationError(plan, model, kind);
  }
  // Premium (Sonnet-class) models across every provider obey the same
  // per-kind restriction Sonnet always had.
  if (AI_PREMIUM_MODELS.includes(model) && !policy.sonnetKindsAllowed.includes(kind)) {
    throw new ModelPolicyViolationError(plan, model, kind);
  }
}

/**
 * Phase O — gate the CCGE-finish `useClaude` boolean at the route layer.
 * Returns the boolean unchanged when the plan allows it, FALSE otherwise.
 */
export function resolveUseClaude(plan: SubscriptionPlan, requested: boolean | undefined): boolean {
  if (!requested) return false;
  if (!isFeatureEnabled("revenueGuardrail")) return true; // legacy behaviour
  const policy = AI_TIER_MODEL_POLICY[plan as keyof typeof AI_TIER_MODEL_POLICY]
    ?? AI_TIER_MODEL_POLICY.INDIVIDUAL_FREE;
  return policy.allowUseClaude;
}
