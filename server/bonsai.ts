// M5 — Bonsai seller-onboarding progress.
// Single user-scoped row in `bonsai_progress`. NO ARK/HIVE side-effects.
import { db } from "./db";
import { eq } from "drizzle-orm";
import { bonsaiProgress, type BonsaiProgress } from "@shared/schema";
import { BONSAI_STAGES, TOTAL_BONSAI_STAGES } from "@shared/bonsaiStages";

export async function getBonsaiProgressForUser(userId: string): Promise<BonsaiProgress> {
  const [row] = await db.select().from(bonsaiProgress).where(eq(bonsaiProgress.userId, userId));
  if (row) return row;
  const [created] = await db
    .insert(bonsaiProgress)
    .values({ userId, currentStage: 1, completedStages: [] })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [refetch] = await db.select().from(bonsaiProgress).where(eq(bonsaiProgress.userId, userId));
  return refetch;
}

export async function completeBonsaiStage(
  userId: string,
  stageId: number,
): Promise<BonsaiProgress> {
  if (!Number.isInteger(stageId) || stageId < 1 || stageId > TOTAL_BONSAI_STAGES) {
    const err: any = new Error(`Invalid stage id (must be 1..${TOTAL_BONSAI_STAGES}).`);
    err.status = 400;
    throw err;
  }
  // Enforce dependency order — stage k can only be completed after all
  // declared dependencies are already in `completedStages`.
  const stage = BONSAI_STAGES.find((s) => s.id === stageId)!;
  const existing = await getBonsaiProgressForUser(userId);
  for (const dep of stage.dependencies) {
    if (!existing.completedStages.includes(dep)) {
      const err: any = new Error(`Stage ${stageId} requires stage ${dep} first.`);
      err.status = 409;
      throw err;
    }
  }
  const completed = Array.from(new Set([...existing.completedStages, stageId])).sort((a, b) => a - b);
  // Advance current pointer to the lowest uncompleted id (or cap at last+1).
  let next = existing.currentStage;
  for (let i = 1; i <= TOTAL_BONSAI_STAGES; i++) {
    if (!completed.includes(i)) { next = i; break; }
    if (i === TOTAL_BONSAI_STAGES) next = TOTAL_BONSAI_STAGES;
  }
  const [updated] = await db
    .update(bonsaiProgress)
    .set({ completedStages: completed, currentStage: next, updatedAt: new Date() })
    .where(eq(bonsaiProgress.userId, userId))
    .returning();
  return updated;
}
