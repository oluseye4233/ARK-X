/**
 * Password hashing + verification.
 *
 * Uses bcryptjs (pure JS, no native build) with cost factor 10. The
 * `verifyPassword` helper auto-detects the legacy plaintext rows seeded
 * before this module existed, so legacy users can still log in once and
 * have their stored hash silently upgraded by the route handler.
 */
import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

// bcrypt hashes always start with $2a$, $2b$, or $2y$. Anything else is
// treated as a legacy plaintext row.
const BCRYPT_PREFIX = /^\$2[aby]\$/;

export function isBcryptHash(stored: string): boolean {
  return BCRYPT_PREFIX.test(stored);
}

export async function hashPassword(plain: string): Promise<string> {
  if (!plain) throw new Error("hashPassword: empty password");
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Returns:
 *   { ok: true,  needsRehash: false } — bcrypt match
 *   { ok: true,  needsRehash: true  } — legacy plaintext match (caller MUST rehash)
 *   { ok: false, needsRehash: false } — no match
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!plain || !stored) return { ok: false, needsRehash: false };
  if (isBcryptHash(stored)) {
    const ok = await bcrypt.compare(plain, stored);
    return { ok, needsRehash: false };
  }
  // Legacy plaintext row — constant-time compare to avoid leaking length.
  const a = Buffer.from(plain, "utf8");
  const b = Buffer.from(stored, "utf8");
  const ok = a.length === b.length && timingSafeEqualLoose(a, b);
  return { ok, needsRehash: ok };
}

function timingSafeEqualLoose(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
