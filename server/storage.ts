import { db } from "./db";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import {
  users, type User, type InsertUser, type UpdateUser,
  assessments, type Assessment, type InsertAssessment,
  type ContextCraftLevel, type CcgeTier, type KcseBreakdown,
  upskillingPlans, type UpskillingPlan, type InsertUpskillingPlan,
  pivotOpportunities, type PivotOpportunity, type InsertPivotOpportunity,
  transferabilityVectors, type TransferabilityVector, type InsertTransferabilityVector,
  jnomicsCards, type JnomicsCard, type InsertJnomicsCard,
  departments, type Department, type InsertDepartment,
  ccgeCards, type CcgeCard, type InsertCcgeCard,
  ccgeScenarios, type CcgeScenario, type InsertCcgeScenario,
  gameSessions, type GameSession, type InsertGameSession,
  spcListings, type SpcListing, type InsertSpcListing,
  spcPurchases, type SpcPurchase,
  userCredits, type UserCredits,
  endorsements, type Endorsement, type InsertEndorsement,
  checkoutSessions, type CheckoutSession, type InsertCheckoutSession,
  billingEvents, type BillingEvent, type InsertBillingEvent,
  arkEvents,
  aiUsage,
  ccmiPillarScores, type CcmiPillarScores,
  arkScoreHistory, type ArkScoreHistory,
  lhcsSignals, type LhcsSignals,
} from "@shared/schema";
import { or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: UpdateUser): Promise<User | undefined>;

  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  getAssessmentsByUser(userId: string): Promise<Assessment[]>;
  getLatestAssessment(userId: string): Promise<Assessment | undefined>;
  updateAssessmentScore(id: string, data: Partial<Pick<Assessment, "jstTotal" | "jstJobs" | "jstSkills" | "jstTalent">>): Promise<Assessment | undefined>;

  createUpskillingPlans(plans: InsertUpskillingPlan[]): Promise<UpskillingPlan[]>;
  getUpskillingPlansByAssessment(assessmentId: string): Promise<UpskillingPlan[]>;

  createPivotOpportunities(pivots: InsertPivotOpportunity[]): Promise<PivotOpportunity[]>;
  getPivotsByAssessment(assessmentId: string): Promise<PivotOpportunity[]>;

  createTransferabilityVectors(vectors: InsertTransferabilityVector[]): Promise<TransferabilityVector[]>;
  getVectorsByAssessment(assessmentId: string): Promise<TransferabilityVector[]>;

  getAllJnomicsCards(): Promise<JnomicsCard[]>;
  getJnomicsCardsByIds(ids: string[]): Promise<JnomicsCard[]>;
  upsertJnomicsCard(card: InsertJnomicsCard): Promise<JnomicsCard>;

  getAllDepartments(): Promise<Department[]>;
  createDepartment(dept: InsertDepartment): Promise<Department>;

  // CCGE
  getAllCcgeCards(): Promise<CcgeCard[]>;
  upsertCcgeCard(card: InsertCcgeCard): Promise<CcgeCard>;
  getAllCcgeScenarios(): Promise<CcgeScenario[]>;
  getCcgeScenario(id: string): Promise<CcgeScenario | undefined>;
  upsertCcgeScenario(scenario: InsertCcgeScenario): Promise<CcgeScenario>;
  createGameSession(session: InsertGameSession): Promise<GameSession>;
  getGameSession(id: string): Promise<GameSession | undefined>;
  getGameSessionsByUser(userId: string): Promise<GameSession[]>;
  updateGameSession(id: string, data: Partial<GameSession>): Promise<GameSession | undefined>;
  finalizeSession(args: {
    sessionId: string;
    actorUserId: string;
    playedCardIds: string[];
    breakdown: KcseBreakdown;
    tier: CcgeTier | null;
  }): Promise<{
    session: GameSession;
    flywheel: {
      arkScoreDelta: number;
      certUpgradedFrom: ContextCraftLevel | null;
      certUpgradedTo: ContextCraftLevel | null;
      newJstTotal: number | null;
      newJstSkills: number | null;
    };
  }>;

  // SPHINX Marketplace
  createSpcListing(listing: InsertSpcListing & { kcseScore: number; hiveScore: number; status?: string }): Promise<SpcListing>;
  getSpcListing(id: string): Promise<SpcListing | undefined>;
  getAllSpcListings(filters?: { pillar?: string; status?: string }): Promise<SpcListing[]>;
  getSpcListingsByCreator(creatorId: string): Promise<SpcListing[]>;
  updateSpcListing(id: string, data: Partial<SpcListing>): Promise<SpcListing | undefined>;
  getSpcPurchasesByBuyer(buyerId: string): Promise<SpcPurchase[]>;
  getSpcPurchasesByCreator(creatorId: string): Promise<SpcPurchase[]>;
  hasBuyerPurchasedListing(buyerId: string, listingId: string): Promise<boolean>;
  getCredits(userId: string): Promise<UserCredits | undefined>;

  // GUIN+ endorsements
  createEndorsement(e: InsertEndorsement): Promise<Endorsement>;
  getEndorsementsForUser(recipientId: string): Promise<Endorsement[]>;
  getEndorsementBetween(endorserId: string, recipientId: string): Promise<Endorsement | undefined>;

  // Billing
  createCheckoutSession(data: InsertCheckoutSession): Promise<CheckoutSession>;
  getCheckoutSession(id: string): Promise<CheckoutSession | undefined>;
  updateCheckoutSession(id: string, data: Partial<CheckoutSession>): Promise<CheckoutSession | undefined>;
  createBillingEvent(e: InsertBillingEvent): Promise<BillingEvent>;
  getBillingEventsByUser(userId: string, limit?: number): Promise<BillingEvent[]>;
  exportUserData(userId: string): Promise<Record<string, any>>;
  deleteUserCascade(userId: string): Promise<{ deletedTables: Record<string, number> }>;
  // PDD §3.4 — ARK identity surfaces
  getCcmiPillars(userId: string): Promise<CcmiPillarScores | undefined>;
  getLhcsSignals(userId: string): Promise<LhcsSignals | undefined>;
  getArkScoreHistory(userId: string, days?: number): Promise<ArkScoreHistory[]>;

  completeCheckoutSession(args: {
    sessionId: string;
    actorUserId: string;
    success: boolean;
  }): Promise<{
    ok: boolean;
    user: User;
    session: CheckoutSession;
    fromPlan: string;
    toPlan: string;
    transition: "subscription.upgraded" | "subscription.downgraded" | null;
    amountCents: number;
    externalSessionId: string | null;
    stripeSubscriptionId: string | null;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    // Hash password at the storage boundary so every code path (registration,
    // seeders, integration tests) gets the same protection. Skip if the
    // caller already passed a bcrypt hash (e.g. backfill replay).
    const { hashPassword, isBcryptHash } = await import("./passwords");
    const password = isBcryptHash(user.password) ? user.password : await hashPassword(user.password);
    const [created] = await db.insert(users).values({ ...user, password }).returning();
    return created;
  }

  async updateUser(id: string, data: UpdateUser): Promise<User | undefined> {
    // If a fresh password is being written via updateUser, hash it the same
    // way createUser does. Already-hashed values pass through unchanged.
    let patch: UpdateUser = data;
    if (typeof data.password === "string" && data.password.length > 0) {
      const { hashPassword, isBcryptHash } = await import("./passwords");
      const password = isBcryptHash(data.password) ? data.password : await hashPassword(data.password);
      patch = { ...data, password };
    }
    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    return updated;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [created] = await db.insert(assessments).values(assessment).returning();
    return created;
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [row] = await db.select().from(assessments).where(eq(assessments.id, id));
    return row;
  }

  async getAssessmentsByUser(userId: string): Promise<Assessment[]> {
    return db.select().from(assessments).where(eq(assessments.userId, userId));
  }

  async getLatestAssessment(userId: string): Promise<Assessment | undefined> {
    const results = await db
      .select()
      .from(assessments)
      .where(eq(assessments.userId, userId))
      .orderBy(sql`${assessments.createdAt} DESC`)
      .limit(1);
    return results[0];
  }

  async updateAssessmentScore(
    id: string,
    data: Partial<Pick<Assessment, "jstTotal" | "jstJobs" | "jstSkills" | "jstTalent">>
  ): Promise<Assessment | undefined> {
    const [updated] = await db.update(assessments).set(data).where(eq(assessments.id, id)).returning();
    return updated;
  }

  async createUpskillingPlans(plans: InsertUpskillingPlan[]): Promise<UpskillingPlan[]> {
    if (plans.length === 0) return [];
    return db.insert(upskillingPlans).values(plans).returning();
  }

  async getUpskillingPlansByAssessment(assessmentId: string): Promise<UpskillingPlan[]> {
    return db.select().from(upskillingPlans).where(eq(upskillingPlans.assessmentId, assessmentId));
  }

  async createPivotOpportunities(pivots: InsertPivotOpportunity[]): Promise<PivotOpportunity[]> {
    if (pivots.length === 0) return [];
    return db.insert(pivotOpportunities).values(pivots).returning();
  }

  async getPivotsByAssessment(assessmentId: string): Promise<PivotOpportunity[]> {
    return db.select().from(pivotOpportunities).where(eq(pivotOpportunities.assessmentId, assessmentId));
  }

  async createTransferabilityVectors(vectors: InsertTransferabilityVector[]): Promise<TransferabilityVector[]> {
    if (vectors.length === 0) return [];
    return db.insert(transferabilityVectors).values(vectors).returning();
  }

  async getVectorsByAssessment(assessmentId: string): Promise<TransferabilityVector[]> {
    return db.select().from(transferabilityVectors).where(eq(transferabilityVectors.assessmentId, assessmentId));
  }

  async getAllJnomicsCards(): Promise<JnomicsCard[]> {
    return db.select().from(jnomicsCards);
  }

  async getJnomicsCardsByIds(ids: string[]): Promise<JnomicsCard[]> {
    if (ids.length === 0) return [];
    const all = await db.select().from(jnomicsCards);
    return all.filter(c => ids.includes(c.id));
  }

  async upsertJnomicsCard(card: InsertJnomicsCard): Promise<JnomicsCard> {
    const [created] = await db
      .insert(jnomicsCards)
      .values(card)
      .onConflictDoUpdate({ target: jnomicsCards.id, set: card })
      .returning();
    return created;
  }

  async getAllDepartments(): Promise<Department[]> {
    return db.select().from(departments);
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [created] = await db.insert(departments).values(dept).returning();
    return created;
  }

  // ── CCGE ────────────────────────────────────────────────────
  async getAllCcgeCards(): Promise<CcgeCard[]> {
    return db.select().from(ccgeCards);
  }

  async upsertCcgeCard(card: InsertCcgeCard): Promise<CcgeCard> {
    const [created] = await db
      .insert(ccgeCards)
      .values(card)
      .onConflictDoUpdate({ target: ccgeCards.id, set: card })
      .returning();
    return created;
  }

  async getAllCcgeScenarios(): Promise<CcgeScenario[]> {
    return db.select().from(ccgeScenarios);
  }

  async getCcgeScenario(id: string): Promise<CcgeScenario | undefined> {
    const [s] = await db.select().from(ccgeScenarios).where(eq(ccgeScenarios.id, id));
    return s;
  }

  async upsertCcgeScenario(scenario: InsertCcgeScenario): Promise<CcgeScenario> {
    const [created] = await db
      .insert(ccgeScenarios)
      .values(scenario)
      .onConflictDoUpdate({ target: ccgeScenarios.id, set: scenario })
      .returning();
    return created;
  }

  async createGameSession(session: InsertGameSession): Promise<GameSession> {
    const [created] = await db.insert(gameSessions).values(session).returning();
    return created;
  }

  async getGameSession(id: string): Promise<GameSession | undefined> {
    const [s] = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
    return s;
  }

  async getGameSessionsByUser(userId: string): Promise<GameSession[]> {
    return db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.userId, userId))
      .orderBy(desc(gameSessions.startedAt));
  }

  async updateGameSession(id: string, data: Partial<GameSession>): Promise<GameSession | undefined> {
    const [updated] = await db.update(gameSessions).set(data).where(eq(gameSessions.id, id)).returning();
    return updated;
  }

  async finalizeSession(args: {
    sessionId: string;
    actorUserId: string;
    playedCardIds: string[];
    breakdown: KcseBreakdown;
    tier: CcgeTier | null;
  }) {
    const { planFlywheel } = await import("./ccge");
    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, args.sessionId))
        .for("update");
      if (!session) {
        const err: any = new Error("Session not found");
        err.status = 404;
        throw err;
      }
      if (session.userId !== args.actorUserId) {
        const err: any = new Error("You may only finish your own sessions.");
        err.status = 403;
        throw err;
      }
      if (session.status !== "in_progress") {
        const err: any = new Error("Session is already finished");
        err.status = 409;
        throw err;
      }

      const [user] = await tx.select().from(users).where(eq(users.id, args.actorUserId)).for("update");
      if (!user) {
        const err: any = new Error("User not found");
        err.status = 404;
        throw err;
      }

      const [latestAssessment] = await tx
        .select()
        .from(assessments)
        .where(eq(assessments.userId, args.actorUserId))
        .orderBy(sql`${assessments.createdAt} DESC`)
        .limit(1);

      const plan = planFlywheel(
        (user.contextCraftCertLevel as ContextCraftLevel) || "NONE",
        args.breakdown.final,
        latestAssessment ?? null,
      );

      if (plan.certUpgradedTo) {
        await tx
          .update(users)
          .set({ contextCraftCertLevel: plan.certUpgradedTo })
          .where(eq(users.id, args.actorUserId));
      }

      if (latestAssessment && plan.newJstSkills !== null && plan.newJstTotal !== null) {
        await tx
          .update(assessments)
          .set({ jstSkills: plan.newJstSkills, jstTotal: plan.newJstTotal })
          .where(eq(assessments.id, latestAssessment.id));
      }

      const [updatedSession] = await tx
        .update(gameSessions)
        .set({
          played: args.playedCardIds,
          status: "finished",
          kcseScore: args.breakdown.final,
          kcseBreakdown: args.breakdown,
          certTierEarned: args.tier,
          arkScoreDelta: plan.arkScoreDelta,
          certUpgradedFrom: plan.certUpgradedFrom,
          certUpgradedTo: plan.certUpgradedTo,
          finishedAt: new Date(),
        })
        .where(eq(gameSessions.id, args.sessionId))
        .returning();

      return {
        session: updatedSession,
        flywheel: {
          arkScoreDelta: plan.arkScoreDelta,
          certUpgradedFrom: plan.certUpgradedFrom,
          certUpgradedTo: plan.certUpgradedTo,
          newJstTotal: plan.newJstTotal,
          newJstSkills: plan.newJstSkills,
        },
      };
    });
  }

  // ── SPHINX Marketplace ──────────────────────────────────────
  async createSpcListing(
    listing: InsertSpcListing & { kcseScore: number; hiveScore: number; status?: string },
  ): Promise<SpcListing> {
    const [created] = await db.insert(spcListings).values(listing).returning();
    return created;
  }

  async getSpcListing(id: string): Promise<SpcListing | undefined> {
    const [s] = await db.select().from(spcListings).where(eq(spcListings.id, id));
    return s;
  }

  async getAllSpcListings(filters?: { pillar?: string; status?: string }): Promise<SpcListing[]> {
    const rows = await db.select().from(spcListings).orderBy(desc(spcListings.createdAt));
    return rows.filter((r) => {
      if (filters?.pillar && r.pillar !== filters.pillar) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    });
  }

  async getSpcListingsByCreator(creatorId: string): Promise<SpcListing[]> {
    return db
      .select()
      .from(spcListings)
      .where(eq(spcListings.creatorId, creatorId))
      .orderBy(desc(spcListings.createdAt));
  }

  async updateSpcListing(id: string, data: Partial<SpcListing>): Promise<SpcListing | undefined> {
    const [updated] = await db.update(spcListings).set(data).where(eq(spcListings.id, id)).returning();
    return updated;
  }

  async getSpcPurchasesByBuyer(buyerId: string): Promise<SpcPurchase[]> {
    return db
      .select()
      .from(spcPurchases)
      .where(eq(spcPurchases.buyerId, buyerId))
      .orderBy(desc(spcPurchases.purchasedAt));
  }

  async getSpcPurchasesByCreator(creatorId: string): Promise<SpcPurchase[]> {
    return db
      .select()
      .from(spcPurchases)
      .where(eq(spcPurchases.creatorId, creatorId))
      .orderBy(desc(spcPurchases.purchasedAt));
  }

  async hasBuyerPurchasedListing(buyerId: string, listingId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: spcPurchases.id })
      .from(spcPurchases)
      .where(and(eq(spcPurchases.buyerId, buyerId), eq(spcPurchases.listingId, listingId)))
      .limit(1);
    return !!row;
  }

  async getCredits(userId: string): Promise<UserCredits | undefined> {
    const [c] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
    return c;
  }

  async createEndorsement(e: InsertEndorsement): Promise<Endorsement> {
    const [created] = await db.insert(endorsements).values(e).returning();
    return created;
  }

  async getEndorsementsForUser(recipientId: string): Promise<Endorsement[]> {
    return db
      .select()
      .from(endorsements)
      .where(eq(endorsements.recipientId, recipientId))
      .orderBy(desc(endorsements.createdAt));
  }

  async getEndorsementBetween(endorserId: string, recipientId: string): Promise<Endorsement | undefined> {
    const [row] = await db
      .select()
      .from(endorsements)
      .where(and(eq(endorsements.endorserId, endorserId), eq(endorsements.recipientId, recipientId)))
      .limit(1);
    return row;
  }

  async createCheckoutSession(data: InsertCheckoutSession): Promise<CheckoutSession> {
    const [row] = await db.insert(checkoutSessions).values(data).returning();
    return row;
  }

  async getCheckoutSession(id: string): Promise<CheckoutSession | undefined> {
    const [row] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, id));
    return row;
  }

  async updateCheckoutSession(id: string, data: Partial<CheckoutSession>): Promise<CheckoutSession | undefined> {
    const [row] = await db.update(checkoutSessions).set(data).where(eq(checkoutSessions.id, id)).returning();
    return row;
  }

  async createBillingEvent(e: InsertBillingEvent): Promise<BillingEvent> {
    const [row] = await db.insert(billingEvents).values(e).returning();
    return row;
  }

  async getBillingEventsByUser(userId: string, limit = 20): Promise<BillingEvent[]> {
    return db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.userId, userId))
      .orderBy(desc(billingEvents.createdAt))
      .limit(limit);
  }

  async exportUserData(userId: string): Promise<Record<string, any>> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      const err: any = new Error("User not found");
      err.status = 404;
      throw err;
    }
    const { password: _pw, ...safeUser } = user as any;
    const [
      userAssessments, userGameSessions, userListings, userPurchasesBuyer, userPurchasesCreator,
      userEndorsementsGiven, userEndorsementsReceived, credits, userCheckouts, userBilling, userArk, userAi,
    ] = await Promise.all([
      db.select().from(assessments).where(eq(assessments.userId, userId)),
      db.select().from(gameSessions).where(eq(gameSessions.userId, userId)),
      db.select().from(spcListings).where(eq(spcListings.creatorId, userId)),
      db.select().from(spcPurchases).where(eq(spcPurchases.buyerId, userId)),
      db.select().from(spcPurchases).where(eq(spcPurchases.creatorId, userId)),
      db.select().from(endorsements).where(eq(endorsements.endorserId, userId)),
      db.select().from(endorsements).where(eq(endorsements.recipientId, userId)),
      db.select().from(userCredits).where(eq(userCredits.userId, userId)),
      db.select().from(checkoutSessions).where(eq(checkoutSessions.userId, userId)),
      db.select().from(billingEvents).where(eq(billingEvents.userId, userId)),
      db.select().from(arkEvents).where(eq(arkEvents.userId, userId)),
      db.select().from(aiUsage).where(eq(aiUsage.userId, userId)),
    ]);
    const assessmentIds = userAssessments.map((a) => a.id);
    const [plans, pivots, vectors] = assessmentIds.length
      ? await Promise.all([
          db.select().from(upskillingPlans).where(inArray(upskillingPlans.assessmentId, assessmentIds)),
          db.select().from(pivotOpportunities).where(inArray(pivotOpportunities.assessmentId, assessmentIds)),
          db.select().from(transferabilityVectors).where(inArray(transferabilityVectors.assessmentId, assessmentIds)),
        ])
      : [[], [], []];
    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: "1.0",
      user: safeUser,
      assessments: userAssessments,
      upskillingPlans: plans,
      pivotOpportunities: pivots,
      transferabilityVectors: vectors,
      gameSessions: userGameSessions,
      spcListings: userListings,
      spcPurchasesAsBuyer: userPurchasesBuyer,
      spcPurchasesAsCreator: userPurchasesCreator,
      endorsementsGiven: userEndorsementsGiven,
      endorsementsReceived: userEndorsementsReceived,
      credits: credits[0] || null,
      checkoutSessions: userCheckouts,
      billingEvents: userBilling,
      arkEvents: userArk,
      aiUsage: userAi,
    };
  }

  async deleteUserCascade(userId: string): Promise<{ deletedTables: Record<string, number> }> {
    return await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
      if (!user) {
        const err: any = new Error("User not found");
        err.status = 404;
        throw err;
      }
      const userAssessments = await tx.select({ id: assessments.id }).from(assessments).where(eq(assessments.userId, userId));
      const aIds = userAssessments.map((a) => a.id);
      const counts: Record<string, number> = {};
      const del = async (label: string, q: any) => {
        const r = await q.returning();
        counts[label] = r.length;
      };
      if (aIds.length) {
        await del("upskillingPlans", tx.delete(upskillingPlans).where(inArray(upskillingPlans.assessmentId, aIds)));
        await del("pivotOpportunities", tx.delete(pivotOpportunities).where(inArray(pivotOpportunities.assessmentId, aIds)));
        await del("transferabilityVectors", tx.delete(transferabilityVectors).where(inArray(transferabilityVectors.assessmentId, aIds)));
      } else {
        counts.upskillingPlans = 0; counts.pivotOpportunities = 0; counts.transferabilityVectors = 0;
      }
      await del("aiUsage", tx.delete(aiUsage).where(eq(aiUsage.userId, userId)));
      await del("arkEvents", tx.delete(arkEvents).where(eq(arkEvents.userId, userId)));
      await del("billingEvents", tx.delete(billingEvents).where(eq(billingEvents.userId, userId)));
      await del("checkoutSessions", tx.delete(checkoutSessions).where(eq(checkoutSessions.userId, userId)));
      await del("userCredits", tx.delete(userCredits).where(eq(userCredits.userId, userId)));
      await del("endorsements", tx.delete(endorsements).where(or(eq(endorsements.endorserId, userId), eq(endorsements.recipientId, userId))));
      await del("spcPurchases", tx.delete(spcPurchases).where(or(eq(spcPurchases.buyerId, userId), eq(spcPurchases.creatorId, userId))));
      await del("spcListings", tx.delete(spcListings).where(eq(spcListings.creatorId, userId)));
      await del("gameSessions", tx.delete(gameSessions).where(eq(gameSessions.userId, userId)));
      // Phase J identity tables — must be cleared before users to honor
      // GDPR-style account deletion (no FK cascade defined in migration).
      await del("ccmiPillarScores", tx.delete(ccmiPillarScores).where(eq(ccmiPillarScores.userId, userId)));
      await del("arkScoreHistory", tx.delete(arkScoreHistory).where(eq(arkScoreHistory.userId, userId)));
      await del("lhcsSignals", tx.delete(lhcsSignals).where(eq(lhcsSignals.userId, userId)));
      await del("assessments", tx.delete(assessments).where(eq(assessments.userId, userId)));
      await del("users", tx.delete(users).where(eq(users.id, userId)));
      return { deletedTables: counts };
    });
  }

  async getCcmiPillars(userId: string): Promise<CcmiPillarScores | undefined> {
    const [row] = await db.select().from(ccmiPillarScores).where(eq(ccmiPillarScores.userId, userId));
    return row;
  }

  async getLhcsSignals(userId: string): Promise<LhcsSignals | undefined> {
    const [row] = await db.select().from(lhcsSignals).where(eq(lhcsSignals.userId, userId));
    return row;
  }

  async getArkScoreHistory(userId: string, days = 90): Promise<ArkScoreHistory[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(arkScoreHistory)
      .where(and(eq(arkScoreHistory.userId, userId), sql`${arkScoreHistory.createdAt} >= ${since}`))
      .orderBy(arkScoreHistory.createdAt);
    return rows;
  }

  async completeCheckoutSession(args: {
    sessionId: string;
    actorUserId: string;
    success: boolean;
  }) {
    const {
      isPaidPlan,
      nextPeriodEnd,
      syntheticStripeCustomerId,
      syntheticStripeSubscriptionId,
      transitionType,
    } = await import("./billing");
    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(checkoutSessions)
        .where(eq(checkoutSessions.id, args.sessionId))
        .for("update");
      if (!session) {
        const err: any = new Error("Checkout session not found");
        err.status = 404;
        throw err;
      }
      if (session.userId !== args.actorUserId) {
        const err: any = new Error("Not your checkout session.");
        err.status = 403;
        throw err;
      }
      if (session.status !== "pending") {
        const err: any = new Error(`Session already ${session.status}.`);
        err.status = 409;
        throw err;
      }
      if (session.amountCents > 0) {
        const err: any = new Error(
          "Payment verification required. Paid plan activation must be confirmed by the payment provider.",
        );
        err.status = 402;
        throw err;
      }

      const [user] = await tx.select().from(users).where(eq(users.id, args.actorUserId)).for("update");
      if (!user) {
        const err: any = new Error("User not found");
        err.status = 404;
        throw err;
      }
      const fromPlan = (user.subscriptionPlan as any) || "INDIVIDUAL_FREE";
      const toPlan = session.plan as any;
      const now = new Date();

      if (!args.success) {
        const [failedSession] = await tx
          .update(checkoutSessions)
          .set({ status: "failed", completedAt: now })
          .where(eq(checkoutSessions.id, session.id))
          .returning();
        await tx.insert(billingEvents).values({
          userId: user.id,
          type: "payment.failed",
          fromPlan, toPlan,
          amountCents: session.amountCents,
          externalId: session.externalSessionId,
          payload: { simulated: true, sessionId: session.id },
        });
        return {
          ok: false, user, session: failedSession, fromPlan, toPlan,
          transition: null, amountCents: session.amountCents,
          externalSessionId: session.externalSessionId,
          stripeSubscriptionId: user.stripeSubscriptionId,
        };
      }

      const periodEnd = isPaidPlan(toPlan) ? nextPeriodEnd(now) : null;
      const stripeCustomerId = user.stripeCustomerId || syntheticStripeCustomerId(user.id);
      const stripeSubscriptionId = isPaidPlan(toPlan) ? syntheticStripeSubscriptionId(session.id) : null;

      const updateData: any = {
        subscriptionPlan: toPlan,
        subscriptionStatus: "active",
        stripeCustomerId,
        stripeSubscriptionId,
        subscriptionCurrentPeriodEnd: periodEnd,
        subscriptionCanceledAt: null,
      };
      if (session.institution) updateData.institution = session.institution;
      const [updatedUser] = await tx.update(users).set(updateData).where(eq(users.id, user.id)).returning();

      const [completedSession] = await tx
        .update(checkoutSessions)
        .set({ status: "completed", completedAt: now })
        .where(eq(checkoutSessions.id, session.id))
        .returning();

      await tx.insert(billingEvents).values({
        userId: user.id,
        type: "checkout.completed",
        fromPlan, toPlan,
        amountCents: session.amountCents,
        externalId: session.externalSessionId,
        payload: { sessionId: session.id, simulated: true },
      });
      const transition = transitionType(fromPlan, toPlan);
      if (transition) {
        await tx.insert(billingEvents).values({
          userId: user.id,
          type: transition,
          fromPlan, toPlan,
          amountCents: session.amountCents,
          externalId: stripeSubscriptionId,
          payload: { simulated: true },
        });
      }

      return {
        ok: true, user: updatedUser, session: completedSession, fromPlan, toPlan,
        transition, amountCents: session.amountCents,
        externalSessionId: session.externalSessionId, stripeSubscriptionId,
      };
    });
  }
}

export const storage = new DatabaseStorage();
