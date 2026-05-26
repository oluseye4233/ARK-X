import type { Request, Response, NextFunction } from "express";
import { MVP_FEATURES, type FeatureKey } from "@shared/featureFlags";

/**
 * Server-side flag resolver. Reads the MVP defaults from `shared/featureFlags.ts`
 * and overlays `FEATURE_<KEY>` env vars on top so ops can flip a surface
 * without a redeploy. Env values are read once at module load — restart the
 * process to pick up changes.
 */

function envKey(key: FeatureKey): string {
  // sphinxAdvanced  →  FEATURE_SPHINX_ADVANCED
  const snake = key.replace(/([A-Z])/g, "_$1").toUpperCase();
  return `FEATURE_${snake}`;
}

function readFlag(key: FeatureKey): boolean {
  const raw = process.env[envKey(key)];
  if (raw === undefined || raw === "") return MVP_FEATURES[key];
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return MVP_FEATURES[key];
}

const RESOLVED: Record<FeatureKey, boolean> = (() => {
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of Object.keys(MVP_FEATURES) as FeatureKey[]) out[k] = readFlag(k);
  return out;
})();

export function isFeatureEnabled(key: FeatureKey): boolean {
  return RESOLVED[key];
}

export function getResolvedFeatures(): Readonly<Record<FeatureKey, boolean>> {
  return RESOLVED;
}

/**
 * Express middleware: 404 (not 403) when the flag is off, so disabled surfaces
 * are indistinguishable from unimplemented routes. Mount BEFORE `requireAuth`
 * — there's no reason to do session work for a route that doesn't exist.
 */
export function requireFeature(key: FeatureKey) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (RESOLVED[key]) return next();
    return res.status(404).json({ error: "Not Found" });
  };
}
