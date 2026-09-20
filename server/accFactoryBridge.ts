import { createPrivateKey, createPublicKey, randomUUID, sign, type KeyObject } from "crypto";
import type { CardVerification } from "@shared/schema";

/**
 * ACC-FACTORY consumes these assertions as a resource server.  This key is
 * deliberately separate from SESSION_SECRET: compromise of either credential
 * must not permit forging the other kind of token.
 */
const PRIVATE_KEY_ENV = "ARK_X_ACC_FACTORY_PRIVATE_KEY";
const KID_ENV = "ARK_X_ACC_FACTORY_KID";
const ASSERTION_TTL_SECONDS = 5 * 60;

export class AccFactoryBridgeConfigurationError extends Error {
  constructor() {
    super("ACC-FACTORY eligibility bridge is not configured.");
  }
}

type BridgeSigningConfig = { privateKey: KeyObject; kid: string };

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signingConfig(): BridgeSigningConfig {
  const pem = process.env[PRIVATE_KEY_ENV]?.replace(/\\n/g, "\n").trim();
  const kid = process.env[KID_ENV]?.trim();
  if (!pem || !kid || kid.length > 200) throw new AccFactoryBridgeConfigurationError();

  try {
    const privateKey = createPrivateKey(pem);
    // The bridge intentionally has one interoperable algorithm. Rejecting
    // symmetric, EC, and undersized RSA keys avoids algorithm confusion and
    // guarantees the JWK verifier configuration is unambiguous.
    if (privateKey.asymmetricKeyType !== "rsa") throw new Error("not RSA");
    const modulusLength = privateKey.asymmetricKeyDetails?.modulusLength;
    if (!modulusLength || modulusLength < 2048) throw new Error("weak RSA key");
    return { privateKey, kid };
  } catch {
    throw new AccFactoryBridgeConfigurationError();
  }
}

/** Durable, server-side verification evidence only; presentation badges count for nothing. */
export function hasEligibleHiveEvidence(verifications: CardVerification[]): boolean {
  return verifications.some((verification) =>
    verification.status === "verified"
    && verification.score >= 80
    && (verification.tier === "Gold" || verification.tier === "Platinum"),
  );
}

export type AccFactoryEligibilityClaims = {
  iss: "ark-x";
  aud: "acc-factory";
  sub: string;
  jti: string;
  eligibility: "hive_gold";
  discountPercent: 50;
  iat: number;
  exp: number;
  version: 1;
};

export function mintAccFactoryEligibilityAssertion(subject: string, now = Math.floor(Date.now() / 1000)): string {
  const { privateKey, kid } = signingConfig();
  const header = base64UrlJson({ alg: "RS256", typ: "JWT", kid });
  const claims: AccFactoryEligibilityClaims = {
    iss: "ark-x",
    aud: "acc-factory",
    sub: subject,
    jti: randomUUID(),
    eligibility: "hive_gold",
    discountPercent: 50,
    iat: now,
    exp: now + ASSERTION_TTL_SECONDS,
    version: 1,
  };
  const payload = base64UrlJson(claims);
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Public material only, suitable for ACC-FACTORY's JWKS resolver. */
export function accFactoryJwks(): { keys: Array<Record<string, unknown>> } {
  const { privateKey, kid } = signingConfig();
  const exported = createPublicKey(privateKey).export({ format: "jwk" });
  return {
    keys: [{ ...exported, kid, use: "sig", alg: "RS256" }],
  };
}
