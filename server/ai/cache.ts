import { db } from "../db";
import { aiCache } from "@shared/schema";
import { eq, lt } from "drizzle-orm";
import { createHash } from "crypto";

export function cacheKey(parts: (string | number)[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const [row] = await db.select().from(aiCache).where(eq(aiCache.cacheKey, key));
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    db.delete(aiCache).where(eq(aiCache.cacheKey, key)).catch(() => {});
    return null;
  }
  return row.value as T;
}

export async function cacheSet<T extends Record<string, unknown>>(
  key: string,
  kind: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  await db
    .insert(aiCache)
    .values({ cacheKey: key, kind, value, expiresAt })
    .onConflictDoUpdate({ target: aiCache.cacheKey, set: { value, expiresAt } });
}

let lastSweep = 0;
export async function maybeSweepExpired(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  try {
    await db.delete(aiCache).where(lt(aiCache.expiresAt, new Date()));
  } catch (err) {
    console.error("[ai/cache] sweep failed:", err);
  }
}
