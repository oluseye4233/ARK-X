import { randomBytes } from "crypto";
import { db } from "./db";
import { eq, sql, desc, and, inArray, isNull, isNotNull } from "drizzle-orm";
import { guestAssessments, type InsertGuestAssessment, type GuestAssessment } from "@shared/schema";
import { reportShares, type ReportShare } from "@shared/schema";
import { f1000Invites, type F1000Invite, F1000_PROMO } from "@shared/schema";
import {
  users, type User, type InsertUser, type UpdateUser,
  assessments, type Assessment, type InsertAssessment,
  assessmentSources, type AssessmentSource, type AssessmentSourceKey,
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
  spcFeedback, type SpcFeedback, type InsertSpcFeedback,
  SPC_FEEDBACK_BONUS_BY_STARS,
  userCredits, type UserCredits,
  SPC_STARTING_CREDITS,
  endorsements, type Endorsement, type InsertEndorsement,
  checkoutSessions, type CheckoutSession, type InsertCheckoutSession,
  billingEvents, type BillingEvent, type InsertBillingEvent,
  arkEvents,
  aiUsage,
  ccmiPillarScores, type CcmiPillarScores,
  arkScoreHistory, type ArkScoreHistory,
  lhcsSignals, type LhcsSignals,
  cohorts, type Cohort, type InsertCohort,
  cohortMemberships, type CohortMembership,
  cohortAssignments, type CohortAssignment, type InsertCohortAssignment,
  staffRecords, type StaffRecord, type StaffRecordWithArk,
  hrImportBatches, type HrImportBatch, type InsertHrImportBatch,
  hrConnectorTests, type HrConnectorTest, type InsertHrConnectorTest,
  hrConnectorConfigs, type HrConnectorConfig, type HrSyncStatus,
  type NormalizedHrRecord, type StaffAssessmentStatus,
  tenureBandFromHireDate,
  bookJourneyBadges, type BookJourneyBadge, type InsertBookJourneyBadge,
  bookLedgerSnapshots, type BookLedgerSnapshot, type InsertBookLedgerSnapshot,
  cardVerifications, type CardVerification, type VerificationSubmission,
  verificationArkDelta,
  verificationDocuments, type VerificationDocument, type InsertVerificationDocument,
  trainingProviders, type TrainingProvider, type InsertTrainingProvider, type TrainingProviderStatus,
  trainingCourses, type TrainingCourse, type InsertTrainingCourse,
  trainingClicks, type TrainingClick, type InsertTrainingClick,
  skillConfirmations, type SkillConfirmation, type InsertSkillConfirmation,
  opportunities, type Opportunity, type InsertOpportunity,
  opportunityRequirements, type OpportunityRequirement, type InsertOpportunityRequirement,
  opportunityApplications, type OpportunityApplication, type InsertOpportunityApplication,
  confirmationInvites, type ConfirmationInvite, type ConfirmationType,
  CONFIRMATION_INVITE_TTL_DAYS,
} from "@shared/schema";
import { or } from "drizzle-orm";

/** One row of a workforce breakdown (per department / tenure band / etc). */
export type WorkforceBreakdownRow = {
  key: string;
  count: number;
  linkedCount: number;
  assessedCount: number;
  avgArk: number;
  avgJst: number;
  avgVulnerability: number;
};

/** Aggregated workforce intelligence joining ARK scores with HR data. */
export type WorkforceIntelligence = {
  institution: string;
  totals: {
    staff: number;
    linked: number;
    assessed: number;
    avgArk: number;
    avgJst: number;
    avgVulnerability: number;
  };
  byDepartment: WorkforceBreakdownRow[];
  byTenureBand: WorkforceBreakdownRow[];
  byCompensationBand: WorkforceBreakdownRow[];
  byManager: WorkforceBreakdownRow[];
  byLocation: WorkforceBreakdownRow[];
};

/** One staff member surfaced in a department drill-down (no PII beyond name/title). */
export type StaffDrilldownRow = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  assessmentStatus: StaffAssessmentStatus;
  jstIndex: number | null;
  arkScore: number | null;
  vulnerabilityPct: number | null;
  nudgedAt: string | null;
};

/** One AI-vulnerability stratum + how many assessed staff fall in it. */
export type VulnerabilityBand = { name: string; value: number };

/** One month's institution-wide average JST (from ark_score_history). */
export type JstTrendPoint = { month: string; avgJst: number };

/**
 * Breakdown dimensions the enterprise overview can be sliced by. These are the
 * roster attributes the aggregation already groups on (department stays the
 * heatmap axis, so it is intentionally excluded as a filter dimension).
 */
export type WorkforceDimension = "tenureBand" | "compensationBand" | "manager" | "location";

/** Filterable dimension + its distinct real values (for the filter UI). */
export type WorkforceFilterOption = {
  dimension: WorkforceDimension;
  label: string;
  values: string[];
};

/** An active slice applied to the enterprise overview. */
export type WorkforceFilter = { dimension: WorkforceDimension; value: string };

/** Placeholder bucket for staff missing a value on a given dimension. */
const UNSPECIFIED_KEY = "Unspecified";
const workforceKey = (v: string | null | undefined) => (v ?? "").trim() || UNSPECIFIED_KEY;

/** dimension → human label + accessor, single source for filtering + options. */
const WORKFORCE_DIMENSIONS: {
  dimension: WorkforceDimension;
  label: string;
  keyOf: (s: StaffRecordWithArk) => string | null | undefined;
}[] = [
  { dimension: "tenureBand", label: "Tenure Band", keyOf: (s) => s.tenureBand },
  { dimension: "compensationBand", label: "Compensation Band", keyOf: (s) => s.compensationBand },
  { dimension: "manager", label: "Manager", keyOf: (s) => s.manager },
  { dimension: "location", label: "Location", keyOf: (s) => s.location },
];

/**
 * Enterprise-overview payload for the `/enterprise` dashboard. Reuses the
 * `getWorkforceIntelligence` aggregation (department heatmap + totals) and adds
 * a vulnerability distribution and a real JST trend, all driven by live
 * account/assessment data for the institution. When an admin applies a filter,
 * every surface is recomputed over the filtered staff subset and `activeFilter`
 * echoes the applied slice; `filterOptions` always reflects the full roster.
 */
export type EnterpriseIntelligence = WorkforceIntelligence & {
  vulnerabilityDistribution: VulnerabilityBand[];
  jstTrend: JstTrendPoint[];
  filterOptions: WorkforceFilterOption[];
  activeFilter: WorkforceFilter | null;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: UpdateUser): Promise<User | undefined>;

  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  getAssessmentsByUser(userId: string): Promise<Assessment[]>;

  upsertAssessmentSource(userId: string, source: AssessmentSourceKey, content: string): Promise<AssessmentSource>;
  getAssessmentSources(userId: string): Promise<AssessmentSource[]>;
  deleteAssessmentSource(userId: string, source: AssessmentSourceKey): Promise<boolean>;

  createGuestAssessment(row: InsertGuestAssessment): Promise<GuestAssessment>;
  countGuestAssessments(): Promise<number>;

  // ── F1000 promo ──
  allocateF1000Invite(userId: string): Promise<{ status: "claimed" | "existing" | "sold_out"; invite?: F1000Invite }>;
  getF1000InviteByUser(userId: string): Promise<F1000Invite | undefined>;
  getF1000Stats(): Promise<{ claimed: number; limit: number; remaining: number }>;
  getLatestAssessment(userId: string): Promise<Assessment | undefined>;
  updateAssessmentScore(id: string, data: Partial<Pick<Assessment, "jstTotal" | "jstJobs" | "jstSkills" | "jstTalent">>): Promise<Assessment | undefined>;
  updateAssessmentProfile(id: string, data: Partial<Pick<Assessment, "contactEmail" | "contactPhone" | "linkLinkedin" | "linkGithub" | "linkPortfolio" | "workHistory" | "academicQuals" | "professionalQuals">>): Promise<Assessment | undefined>;

  createReportShare(userId: string): Promise<ReportShare>;
  getActiveReportShareByUser(userId: string): Promise<ReportShare | undefined>;
  getReportShareByToken(token: string): Promise<ReportShare | undefined>;
  revokeReportShare(userId: string): Promise<void>;

  // ── ARK RESUME (Task #59) ──
  setUserHeadshot(userId: string, dataUrl: string | null): Promise<User | undefined>;
  getSkillConfirmations(userId: string): Promise<SkillConfirmation[]>;
  upsertSkillConfirmation(row: InsertSkillConfirmation): Promise<SkillConfirmation>;

  // ── ARK RESUME external confirmation invites (Task #60) ──
  createConfirmationInvite(input: {
    userId: string;
    type: ConfirmationType;
    targetRef: string;
    targetLabel?: string | null;
    recipientEmail: string;
    recipientName?: string | null;
    recipientOrg?: string | null;
    note?: string | null;
  }): Promise<ConfirmationInvite>;
  getConfirmationInvitesByUser(userId: string): Promise<ConfirmationInvite[]>;
  getConfirmationInviteByToken(token: string): Promise<ConfirmationInvite | undefined>;
  resolveConfirmationInvite(
    token: string,
    opts: {
      decision: "APPROVED" | "REJECTED";
      responderName?: string | null;
      responderOrg: string;
      responseNote?: string | null;
    },
  ): Promise<{ invite: ConfirmationInvite; confirmation: SkillConfirmation }>;
  revokeConfirmationInvite(id: string, userId: string): Promise<ConfirmationInvite | undefined>;
  resendConfirmationInvite(id: string, userId: string): Promise<ConfirmationInvite | undefined>;

  createUpskillingPlans(plans: InsertUpskillingPlan[]): Promise<UpskillingPlan[]>;
  getUpskillingPlansByAssessment(assessmentId: string): Promise<UpskillingPlan[]>;

  createPivotOpportunities(pivots: InsertPivotOpportunity[]): Promise<PivotOpportunity[]>;
  getPivotsByAssessment(assessmentId: string): Promise<PivotOpportunity[]>;

  createTransferabilityVectors(vectors: InsertTransferabilityVector[]): Promise<TransferabilityVector[]>;
  getVectorsByAssessment(assessmentId: string): Promise<TransferabilityVector[]>;

  getAllJnomicsCards(): Promise<JnomicsCard[]>;
  getJnomicsCardsByIds(ids: string[]): Promise<JnomicsCard[]>;
  upsertJnomicsCard(card: InsertJnomicsCard): Promise<JnomicsCard>;
  deleteJnomicsCardsByIdPrefix(prefix: string): Promise<number>;

  getAllDepartments(): Promise<Department[]>;
  createDepartment(dept: InsertDepartment): Promise<Department>;

  // CCGE
  getAllCcgeCards(): Promise<CcgeCard[]>;
  upsertCcgeCard(card: InsertCcgeCard): Promise<CcgeCard>;
  upsertCcgeCards(cards: InsertCcgeCard[]): Promise<number>;
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

  // Primitive Card Verification (Task #55)
  getCardVerification(userId: string, cardId: string): Promise<CardVerification | undefined>;
  getCardVerifications(userId: string): Promise<CardVerification[]>;
  finalizeCardVerification(args: {
    userId: string;
    cardId: string;
    score: number;
    tier: CcgeTier | null;
    submissions: VerificationSubmission[];
  }): Promise<{
    verification: CardVerification;
    jstBoost: number;
    improved: boolean;
    prevTier: CcgeTier | null;
  }>;
  // Verification documents (DATA-pillar evidence)
  addVerificationDocument(doc: InsertVerificationDocument): Promise<VerificationDocument>;
  getVerificationDocuments(userId: string, cardId: string): Promise<VerificationDocument[]>;
  deleteVerificationDocument(id: string, userId: string): Promise<boolean>;

  // SPHINX Marketplace
  createSpcListing(listing: InsertSpcListing & { kcseScore: number; hiveScore: number; status?: string; scope?: string; institution?: string | null }): Promise<SpcListing>;
  getSpcListing(id: string): Promise<SpcListing | undefined>;
  getAllSpcListings(filters?: { pillar?: string; status?: string; disc?: string; rarity?: string; version?: string; scope?: string; institution?: string }): Promise<SpcListing[]>;
  getSpcListingsByCreator(creatorId: string): Promise<SpcListing[]>;
  updateSpcListing(id: string, data: Partial<SpcListing>): Promise<SpcListing | undefined>;
  getSpcPurchasesByBuyer(buyerId: string): Promise<SpcPurchase[]>;
  getSpcPurchasesByCreator(creatorId: string): Promise<SpcPurchase[]>;
  hasBuyerPurchasedListing(buyerId: string, listingId: string): Promise<boolean>;
  getCredits(userId: string): Promise<UserCredits | undefined>;
  // ── Phase K — Corporate Marketplace ──
  getCorporateListings(institution: string, filters?: { pillar?: string; status?: string }): Promise<SpcListing[]>;
  submitSpcFeedback(args: { listingId: string; buyerId: string; stars: number; comment?: string | null }): Promise<{ feedback: SpcFeedback; creatorBonus: number; creatorBalance: number }>;
  getSpcFeedbackForListing(listingId: string): Promise<{
    count: number;
    average: number;
    histogram: Record<string, number>;
    recent: Array<{ id: string; stars: number; comment: string | null; createdAt: string; buyerName: string | null }>;
  }>;
  getSpcFeedbackByBuyer(listingId: string, buyerId: string): Promise<SpcFeedback | undefined>;

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

  // Phase G — Cohorts
  createCohort(c: InsertCohort): Promise<Cohort>;
  getCohort(id: string): Promise<Cohort | undefined>;
  getCohortsByInstructor(instructorId: string): Promise<Cohort[]>;
  getCohortsForStudent(userId: string): Promise<Cohort[]>;
  addCohortMembers(
    cohortId: string,
    rows: Array<{ userId?: string; invitedEmail?: string; status?: string }>,
  ): Promise<{ added: number; reactivated: number; skipped: number }>;
  getCohortMembers(cohortId: string): Promise<Array<CohortMembership & {
    user: { id: string; name: string; username: string; arkScore: number; jstIndex: number; ccmi: number; contextCraftCertLevel: string | null } | null;
  }>>;
  removeCohortMember(cohortId: string, userId: string): Promise<boolean>;
  reconcileCohortInvitesForUser(userId: string, email: string): Promise<number>;
  createCohortAssignment(a: InsertCohortAssignment): Promise<CohortAssignment>;
  getCohortAssignments(cohortId: string): Promise<CohortAssignment[]>;
  getCohortGrades(cohortId: string): Promise<Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    scenarioId: string;
    scenarioTitle: string;
    bestJcse: number | null;
    bestTier: string | null;
    attempts: number;
    dueAt: Date | null;
    lastAttemptAt: Date | null;
    onTime: boolean | null;
  }>>;
  getCohortComparison(instructorId: string): Promise<Array<{
    cohortId: string;
    cohortName: string;
    studentCount: number;
    avgJst: number;
    avgCcmi: number;
    avgArk: number;
  }>>;

  // ── Institution Workforce / HR Connectors (Task #25) ──
  createImportBatch(batch: InsertHrImportBatch): Promise<HrImportBatch>;
  getImportBatches(institution: string): Promise<HrImportBatch[]>;
  updateImportBatchCounts(
    id: string,
    counts: { importedRows: number; updatedRows: number },
  ): Promise<HrImportBatch | undefined>;
  /** Upsert a parsed roster into staff_records (matched on (institution,email),
   *  else externalId), auto-linking each staff member to an existing ARK account
   *  by email. All-or-nothing in a transaction. */
  upsertStaffRecords(
    institution: string,
    batchId: string,
    records: NormalizedHrRecord[],
  ): Promise<{ inserted: number; updated: number; linked: number }>;
  getStaffRecords(institution: string): Promise<StaffRecordWithArk[]>;
  /** Institution-scoped drill-down: the individual staff members in one
   *  department (matched to the same normalized key the workforce aggregation
   *  uses), each with per-person JST/vulnerability/assessment status. */
  getDepartmentStaff(institution: string, department: string): Promise<StaffDrilldownRow[]>;
  getStaffRecord(id: string): Promise<StaffRecord | undefined>;
  /** Match a staff row to an existing ARK account by email and set arkUserId.
   *  Returns the updated row, or null if no account matches. Institution-scoped. */
  linkStaffToArk(id: string, institution: string): Promise<StaffRecordWithArk | null>;
  /** Invite an unmatched staff member to create their ARK profile: links
   *  immediately if an account already exists for their email, else records the
   *  invite (invitedAt) so registration reconciliation links it on signup. */
  inviteStaff(id: string, institution: string): Promise<StaffRecordWithArk | null>;
  /** Nudge an assessed staff member toward upskilling: records nudgedAt so the
   *  drill-down reflects the action. Institution-scoped; returns the updated row,
   *  or null if the staff member isn't linked to an assessed ARK account. */
  nudgeStaff(id: string, institution: string): Promise<StaffRecordWithArk | null>;
  /** Auto-link any still-unlinked staff records matching this user's email
   *  (across institutions) when they register/log in. Returns rows linked. */
  reconcileStaffInvitesForUser(userId: string, email: string): Promise<number>;
  getWorkforceIntelligence(institution: string): Promise<WorkforceIntelligence>;
  getEnterpriseIntelligence(
    institution: string,
    filter?: WorkforceFilter,
  ): Promise<EnterpriseIntelligence>;
  /** Persist the most-recent connection-test outcome for a connector, upserted
   *  on (institution, adapter) so each connector keeps only its latest result. */
  recordConnectorTest(test: InsertHrConnectorTest): Promise<HrConnectorTest>;
  /** Last connection-test result per connector for an institution. */
  getConnectorTests(institution: string): Promise<HrConnectorTest[]>;

  // ── Scheduled HR sync (Task #35) ──
  /** All connector configs for one institution (admin UI). */
  getConnectorConfigs(institution: string): Promise<HrConnectorConfig[]>;
  /** Every enabled config across all institutions (the scheduler's work list). */
  getEnabledConnectorConfigs(): Promise<HrConnectorConfig[]>;
  /** Insert-or-update the (institution, adapter) config, setting enabled +
   *  cadence. `createdBy` only applies on first insert. */
  upsertConnectorConfig(input: {
    institution: string;
    adapter: string;
    enabled: boolean;
    intervalMinutes: number;
    createdBy: string;
  }): Promise<HrConnectorConfig>;
  /** Record the outcome of a sync attempt (status + message + summary +
   *  lastSyncedAt). On success/skip lastSyncedAt advances; on error it does
   *  too so the cadence doesn't tight-loop a failing adapter. */
  recordConnectorSyncResult(
    id: string,
    result: {
      status: HrSyncStatus;
      message: string;
      summary?: { inserted: number; updated: number; totalRows: number; errorRows: number } | null;
    },
  ): Promise<HrConnectorConfig | undefined>;

  // ── Book Companion (Task #22) ──
  getBookBadges(userId: string): Promise<BookJourneyBadge[]>;
  /** Idempotent award; returns the badge row + whether it was newly created. */
  awardBookBadge(badge: InsertBookJourneyBadge): Promise<{ badge: BookJourneyBadge; created: boolean }>;
  getLedgerSnapshots(userId: string): Promise<BookLedgerSnapshot[]>;
  /** Baseline is immutable (insert-once); final upserts on each capture. */
  upsertLedgerSnapshot(snap: InsertBookLedgerSnapshot): Promise<BookLedgerSnapshot>;

  // ── Suggested Training Providers (freemium · Explorer tier) ──
  createTrainingProvider(input: InsertTrainingProvider & { ownerUserId?: string | null; status?: TrainingProviderStatus }): Promise<TrainingProvider>;
  getTrainingProviderById(id: string): Promise<TrainingProvider | undefined>;
  getTrainingProviderBySlug(slug: string): Promise<TrainingProvider | undefined>;
  listTrainingProviders(filter?: { status?: TrainingProviderStatus; region?: string; deliveryMode?: string; q?: string }): Promise<TrainingProvider[]>;
  listTrainingProvidersByOwner(ownerUserId: string): Promise<TrainingProvider[]>;
  updateTrainingProvider(id: string, ownerUserId: string, patch: Partial<InsertTrainingProvider>): Promise<TrainingProvider | undefined>;
  setTrainingProviderStatus(id: string, status: TrainingProviderStatus): Promise<TrainingProvider | undefined>;
  setTrainingProviderSponsorship(id: string, sponsored: boolean, sponsoredWeight: number): Promise<TrainingProvider | undefined>;
  createTrainingCourse(input: InsertTrainingCourse): Promise<TrainingCourse>;
  getTrainingCourseById(id: string): Promise<TrainingCourse | undefined>;
  listTrainingCoursesByProvider(providerId: string): Promise<TrainingCourse[]>;
  listTrainingCoursesForProviders(providerIds: string[]): Promise<TrainingCourse[]>;
  deleteTrainingCourse(id: string): Promise<void>;
  recordTrainingClick(input: InsertTrainingClick): Promise<TrainingClick>;
  getTrainingClickStats(): Promise<Record<string, { views: number; clicks: number }>>;

  // ── ARK Matchmaking Engine ──────────────────────────────────────────
  createOpportunity(
    input: InsertOpportunity,
    requirements: Omit<InsertOpportunityRequirement, "opportunityId">[],
  ): Promise<{ opportunity: Opportunity; requirements: OpportunityRequirement[] }>;
  listOpportunities(filter?: { type?: string; status?: string }): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<{ opportunity: Opportunity; requirements: OpportunityRequirement[] } | undefined>;
  getRequirementsForOpportunities(opportunityIds: string[]): Promise<OpportunityRequirement[]>;
  upsertApplication(input: InsertOpportunityApplication): Promise<OpportunityApplication>;
  getApplicationsForUser(userId: string): Promise<OpportunityApplication[]>;
  getVerifiedCards(userId: string): Promise<{ cardId: string; tier: string }[]>;
  getCandidatePool(): Promise<MatchCandidateRow[]>;
}

/** A candidate row for team formation — user identity + dominant archetype
 *  inputs + their banked verifications (tier ≥ Bronze). */
export type MatchCandidateRow = {
  userId: string;
  name: string;
  jstIndex: number;
  archetypeArchitect: number;
  archetypeOrchestrator: number;
  archetypeConductor: number;
  verifications: { cardId: string; tier: string }[];
};

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

  async createGuestAssessment(row: InsertGuestAssessment): Promise<GuestAssessment> {
    const [created] = await db.insert(guestAssessments).values(row).returning();
    return created;
  }

  async countGuestAssessments(): Promise<number> {
    const [r] = await db.select({ c: sql<number>`count(*)` }).from(guestAssessments);
    return Number(r?.c ?? 0);
  }

  // ── F1000 promo ──────────────────────────────────────────────
  async getF1000InviteByUser(userId: string): Promise<F1000Invite | undefined> {
    const [row] = await db.select().from(f1000Invites).where(eq(f1000Invites.userId, userId));
    return row;
  }

  async getF1000Stats(): Promise<{ claimed: number; limit: number; remaining: number }> {
    const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(f1000Invites);
    const claimed = Number(r?.c ?? 0);
    return { claimed, limit: F1000_PROMO.limit, remaining: Math.max(0, F1000_PROMO.limit - claimed) };
  }

  /**
   * Atomically allocate the next F1000 invite code (strictly 1..1000) to a
   * signed-in user. Idempotent — a user who already holds a code gets it back
   * ("existing"). Returns "sold_out" once all 1000 are claimed. The unique
   * constraints on (seq, user_id, code) make this race-safe; a concurrent
   * seq collision (23505) is retried. On a fresh claim the user is flipped to
   * f1000Member and, if still on the free default, bumped to EXPLORER.
   */
  async allocateF1000Invite(
    userId: string,
  ): Promise<{ status: "claimed" | "existing" | "sold_out"; invite?: F1000Invite }> {
    const existing = await this.getF1000InviteByUser(userId);
    if (existing) return { status: "existing", invite: existing };

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await db.transaction(async (tx) => {
          const [already] = await tx
            .select()
            .from(f1000Invites)
            .where(eq(f1000Invites.userId, userId));
          if (already) return { status: "existing" as const, invite: already };

          const [m] = await tx
            .select({ max: sql<number>`COALESCE(MAX(${f1000Invites.seq}), 0)::int` })
            .from(f1000Invites);
          const seq = Number(m?.max ?? 0) + 1;
          if (seq > F1000_PROMO.limit) return { status: "sold_out" as const };

          const code = `F1000-${String(seq).padStart(4, "0")}-${randomBytes(6)
            .toString("hex")
            .toUpperCase()}`;
          const [invite] = await tx
            .insert(f1000Invites)
            .values({ seq, code, userId })
            .returning();

          const [u] = await tx.select().from(users).where(eq(users.id, userId));
          const patch: UpdateUser = { f1000Member: true };
          if (!u?.subscriptionPlan || u.subscriptionPlan === "INDIVIDUAL_FREE") {
            patch.subscriptionPlan = F1000_PROMO.defaultPlan;
          }
          await tx.update(users).set(patch).where(eq(users.id, userId));

          return { status: "claimed" as const, invite };
        });
      } catch (e) {
        const code = (e as { code?: string })?.code;
        const isUnique = code === "23505" || /duplicate key|unique constraint/i.test(String(e));
        if (isUnique && attempt < 4) continue; // lost the seq race — retry
        throw e;
      }
    }
    throw new Error("F1000 allocation failed after repeated contention");
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    const [row] = await db.select().from(assessments).where(eq(assessments.id, id));
    return row;
  }

  async getAssessmentsByUser(userId: string): Promise<Assessment[]> {
    return db.select().from(assessments).where(eq(assessments.userId, userId));
  }

  async upsertAssessmentSource(
    userId: string,
    source: AssessmentSourceKey,
    content: string,
  ): Promise<AssessmentSource> {
    const [row] = await db
      .insert(assessmentSources)
      .values({ userId, source, content })
      .onConflictDoUpdate({
        target: [assessmentSources.userId, assessmentSources.source],
        set: { content, updatedAt: sql`now()` },
      })
      .returning();
    return row;
  }

  async getAssessmentSources(userId: string): Promise<AssessmentSource[]> {
    return db.select().from(assessmentSources).where(eq(assessmentSources.userId, userId));
  }

  async deleteAssessmentSource(
    userId: string,
    source: AssessmentSourceKey,
  ): Promise<boolean> {
    const deleted = await db
      .delete(assessmentSources)
      .where(
        and(
          eq(assessmentSources.userId, userId),
          eq(assessmentSources.source, source),
        ),
      )
      .returning({ id: assessmentSources.id });
    return deleted.length > 0;
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

  async getActiveReportShareByUser(userId: string): Promise<ReportShare | undefined> {
    const rows = await db
      .select()
      .from(reportShares)
      .where(and(eq(reportShares.userId, userId), eq(reportShares.revoked, false)))
      .orderBy(sql`${reportShares.createdAt} DESC`)
      .limit(1);
    return rows[0];
  }

  async createReportShare(userId: string): Promise<ReportShare> {
    // Reuse the user's existing active share so re-sharing yields a stable URL.
    const existing = await this.getActiveReportShareByUser(userId);
    if (existing) return existing;
    const token = randomBytes(24).toString("base64url");
    const [row] = await db.insert(reportShares).values({ token, userId }).returning();
    return row;
  }

  async getReportShareByToken(token: string): Promise<ReportShare | undefined> {
    const rows = await db.select().from(reportShares).where(eq(reportShares.token, token)).limit(1);
    return rows[0];
  }

  async revokeReportShare(userId: string): Promise<void> {
    await db
      .update(reportShares)
      .set({ revoked: true })
      .where(and(eq(reportShares.userId, userId), eq(reportShares.revoked, false)));
  }

  // ── ARK RESUME (Task #59) ───────────────────────────────────
  async setUserHeadshot(userId: string, dataUrl: string | null): Promise<User | undefined> {
    const [row] = await db
      .update(users)
      .set({ headshotDataUrl: dataUrl })
      .where(eq(users.id, userId))
      .returning();
    return row;
  }

  async getSkillConfirmations(userId: string): Promise<SkillConfirmation[]> {
    return await db
      .select()
      .from(skillConfirmations)
      .where(eq(skillConfirmations.userId, userId))
      .orderBy(desc(skillConfirmations.updatedAt));
  }

  // Upsert keyed on (userId, type, targetRef): re-issuing a confirmation for the
  // same claim updates the status/confirmer rather than creating duplicates.
  async upsertSkillConfirmation(row: InsertSkillConfirmation): Promise<SkillConfirmation> {
    const [result] = await db
      .insert(skillConfirmations)
      .values({ ...row, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [skillConfirmations.userId, skillConfirmations.type, skillConfirmations.targetRef],
        set: {
          status: row.status ?? "PENDING",
          targetLabel: row.targetLabel ?? null,
          confirmerUserId: row.confirmerUserId ?? null,
          confirmerOrg: row.confirmerOrg,
          confirmerName: row.confirmerName ?? null,
          confirmerLogoUrl: row.confirmerLogoUrl ?? null,
          note: row.note ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // ── ARK RESUME external confirmation invites (Task #60) ──
  // Mint an unguessable, single-claim invite the candidate emails to an external
  // confirmer. Claim-existence is validated by the route before this is called.
  async createConfirmationInvite(input: {
    userId: string;
    type: ConfirmationType;
    targetRef: string;
    targetLabel?: string | null;
    recipientEmail: string;
    recipientName?: string | null;
    recipientOrg?: string | null;
    note?: string | null;
  }): Promise<ConfirmationInvite> {
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + CONFIRMATION_INVITE_TTL_DAYS * 86_400_000);
    const [row] = await db
      .insert(confirmationInvites)
      .values({
        token,
        userId: input.userId,
        type: input.type,
        targetRef: input.targetRef,
        targetLabel: input.targetLabel ?? null,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName ?? null,
        recipientOrg: input.recipientOrg ?? null,
        note: input.note ?? null,
        expiresAt,
      })
      .returning();
    return row;
  }

  async getConfirmationInvitesByUser(userId: string): Promise<ConfirmationInvite[]> {
    return await db
      .select()
      .from(confirmationInvites)
      .where(eq(confirmationInvites.userId, userId))
      .orderBy(desc(confirmationInvites.createdAt));
  }

  async getConfirmationInviteByToken(token: string): Promise<ConfirmationInvite | undefined> {
    const rows = await db
      .select()
      .from(confirmationInvites)
      .where(eq(confirmationInvites.token, token))
      .limit(1);
    return rows[0];
  }

  // Atomically resolve an invite: lock the row, reject if missing / already
  // responded / expired (lazily flipping a past-expiry row to EXPIRED), then
  // upsert the resulting skill_confirmation (confirmerUserId stays null — the
  // external confirmer has no platform account) and stamp the invite responded.
  async resolveConfirmationInvite(
    token: string,
    opts: {
      decision: "APPROVED" | "REJECTED";
      responderName?: string | null;
      responderOrg: string;
      responseNote?: string | null;
    },
  ): Promise<{ invite: ConfirmationInvite; confirmation: SkillConfirmation }> {
    return await db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(confirmationInvites)
        .where(eq(confirmationInvites.token, token))
        .for("update");
      if (!invite) throw new Error("INVITE_NOT_FOUND");
      if (invite.status !== "PENDING") throw new Error("INVITE_ALREADY_RESPONDED");
      if (invite.expiresAt.getTime() < Date.now()) {
        await tx
          .update(confirmationInvites)
          .set({ status: "EXPIRED" })
          .where(eq(confirmationInvites.id, invite.id));
        throw new Error("INVITE_EXPIRED");
      }

      const confStatus = opts.decision === "APPROVED" ? "CONFIRMED" : "REJECTED";
      const now = new Date();
      const [confirmation] = await tx
        .insert(skillConfirmations)
        .values({
          userId: invite.userId,
          type: invite.type,
          targetRef: invite.targetRef,
          targetLabel: invite.targetLabel ?? null,
          status: confStatus,
          confirmerUserId: null,
          confirmerOrg: opts.responderOrg,
          confirmerName: opts.responderName ?? null,
          confirmerLogoUrl: null,
          note: opts.responseNote ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [skillConfirmations.userId, skillConfirmations.type, skillConfirmations.targetRef],
          set: {
            status: confStatus,
            targetLabel: invite.targetLabel ?? null,
            confirmerUserId: null,
            confirmerOrg: opts.responderOrg,
            confirmerName: opts.responderName ?? null,
            confirmerLogoUrl: null,
            note: opts.responseNote ?? null,
            updatedAt: now,
          },
        })
        .returning();

      const [updatedInvite] = await tx
        .update(confirmationInvites)
        .set({
          status: opts.decision,
          responseNote: opts.responseNote ?? null,
          respondedAt: now,
        })
        .where(eq(confirmationInvites.id, invite.id))
        .returning();

      return { invite: updatedInvite, confirmation };
    });
  }

  // Candidate-driven lifecycle (Task #65). Revoke a PENDING invite the candidate
  // sent in error: flip it to EXPIRED so the no-login token immediately stops
  // working (the respond path rejects any non-PENDING invite). Scoped to the
  // owner; only a PENDING invite is revocable (already-answered invites keep
  // their audit status).
  async revokeConfirmationInvite(id: string, userId: string): Promise<ConfirmationInvite | undefined> {
    const [row] = await db
      .update(confirmationInvites)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(confirmationInvites.id, id),
          eq(confirmationInvites.userId, userId),
          eq(confirmationInvites.status, "PENDING"),
        ),
      )
      .returning();
    return row;
  }

  // Resend/regenerate a link for a PENDING or EXPIRED invite: mint a fresh token
  // (invalidating any previously-shared link), reset the TTL window, and return
  // it to PENDING. Scoped to the owner. Already-answered (APPROVED/REJECTED)
  // invites cannot be reopened — the candidate must send a new request instead.
  async resendConfirmationInvite(id: string, userId: string): Promise<ConfirmationInvite | undefined> {
    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + CONFIRMATION_INVITE_TTL_DAYS * 86_400_000);
    const [row] = await db
      .update(confirmationInvites)
      .set({ token, status: "PENDING", expiresAt, responseNote: null, respondedAt: null })
      .where(
        and(
          eq(confirmationInvites.id, id),
          eq(confirmationInvites.userId, userId),
          inArray(confirmationInvites.status, ["PENDING", "EXPIRED"]),
        ),
      )
      .returning();
    return row;
  }

  async updateAssessmentScore(
    id: string,
    data: Partial<Pick<Assessment, "jstTotal" | "jstJobs" | "jstSkills" | "jstTalent">>
  ): Promise<Assessment | undefined> {
    const [updated] = await db.update(assessments).set(data).where(eq(assessments.id, id)).returning();
    return updated;
  }

  async updateAssessmentProfile(
    id: string,
    data: Partial<
      Pick<
        Assessment,
        | "contactEmail"
        | "contactPhone"
        | "linkLinkedin"
        | "linkGithub"
        | "linkPortfolio"
        | "workHistory"
        | "academicQuals"
        | "professionalQuals"
      >
    >
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

  async deleteJnomicsCardsByIdPrefix(prefix: string): Promise<number> {
    const all = await db.select().from(jnomicsCards);
    const stale = all.filter(c => c.id.startsWith(prefix)).map(c => c.id);
    if (stale.length === 0) return 0;
    for (const id of stale) {
      await db.delete(jnomicsCards).where(eq(jnomicsCards.id, id));
    }
    return stale.length;
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

  async upsertCcgeCards(cards: InsertCcgeCard[]): Promise<number> {
    if (cards.length === 0) return 0;
    return await db.transaction(async (tx) => {
      let n = 0;
      for (const card of cards) {
        await tx
          .insert(ccgeCards)
          .values(card)
          .onConflictDoUpdate({ target: ccgeCards.id, set: card });
        n++;
      }
      return n;
    });
  }

  async getAllCcgeScenarios(): Promise<CcgeScenario[]> {
    return db.select().from(ccgeScenarios);
  }

  // Phase J.1: scenarios visible to a given user — all canon scenarios
  // (isCustom = false) plus the user's own custom scenarios. Other users'
  // custom scenarios remain private.
  async getCcgeScenariosForUser(userId: string | null): Promise<CcgeScenario[]> {
    const all = await db.select().from(ccgeScenarios);
    return all.filter((s) => !s.isCustom || (userId !== null && s.creatorUserId === userId));
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
    customCardName?: string;
    customCardBody?: string;
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
          customCardName: args.customCardName ?? null,
          customCardBody: args.customCardBody ?? null,
          craftScore: args.breakdown.craft ?? null,
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

  // ── Primitive Card Verification (Task #55) ──────────────────
  async getCardVerification(userId: string, cardId: string): Promise<CardVerification | undefined> {
    const [row] = await db
      .select()
      .from(cardVerifications)
      .where(and(eq(cardVerifications.userId, userId), eq(cardVerifications.cardId, cardId)));
    return row;
  }

  async getCardVerifications(userId: string): Promise<CardVerification[]> {
    return await db
      .select()
      .from(cardVerifications)
      .where(eq(cardVerifications.userId, userId))
      .orderBy(desc(cardVerifications.updatedAt));
  }

  /**
   * Atomic upsert of a verification attempt. ARK (JST-skills) is awarded ONLY on
   * a tier improvement vs. the row's previously-banked tier — the incremental
   * delta = verificationArkDelta(newTier) - verificationArkDelta(prevTier). This
   * mirrors the cert-upgrade flywheel: re-clearing the same tier never double-
   * awards, and a lower attempt never claws back. The JST boost is applied to
   * the user's latest assessment inside the same transaction; the route then
   * calls recalcArkForUser("card.verified") which recomputes ARK and enforces
   * the daily cap (the recalc owns its own transaction, like CCGE finish).
   */
  async finalizeCardVerification(args: {
    userId: string;
    cardId: string;
    score: number;
    tier: CcgeTier | null;
    submissions: VerificationSubmission[];
  }): Promise<{
    verification: CardVerification;
    jstBoost: number;
    improved: boolean;
    prevTier: CcgeTier | null;
  }> {
    return await db.transaction(async (tx) => {
      // Lock the user row first — exactly as finalizeSession does for CCGE.
      // This serializes ALL concurrent verification (and CCGE) writes for the
      // same user, so two simultaneous submits for DIFFERENT cards can't both
      // read the same latest-assessment jstSkills and clobber each other's
      // boost (lost update). Per-card row locking alone wouldn't help since
      // different cards are different rows.
      const [lockedUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, args.userId))
        .for("update");
      if (!lockedUser) {
        const err: any = new Error("User not found");
        err.status = 404;
        throw err;
      }

      const [existing] = await tx
        .select()
        .from(cardVerifications)
        .where(and(eq(cardVerifications.userId, args.userId), eq(cardVerifications.cardId, args.cardId)))
        .for("update");

      const prevTier = (existing?.tier as CcgeTier | null) ?? null;
      const prevTierValue = verificationArkDelta(prevTier);
      const newTierValue = verificationArkDelta(args.tier);
      const improved = newTierValue > prevTierValue;
      const jstBoost = improved ? newTierValue - prevTierValue : 0;

      // Banked best score/tier never regresses; the latest submissions snapshot
      // is always stored so the user can review their most recent attempt.
      const bestScore = Math.max(existing?.score ?? 0, args.score);
      const bestTier: CcgeTier | null =
        verificationArkDelta(args.tier) >= verificationArkDelta(prevTier) ? args.tier : prevTier;
      const status = bestTier ? "verified" : "attempted";
      const arkAwarded = (existing?.arkAwarded ?? 0) + jstBoost;
      const attempts = (existing?.attempts ?? 0) + 1;

      let verification: CardVerification;
      if (existing) {
        const [updated] = await tx
          .update(cardVerifications)
          .set({
            score: bestScore,
            tier: bestTier,
            status,
            submissions: args.submissions,
            arkAwarded,
            attempts,
            updatedAt: new Date(),
          })
          .where(eq(cardVerifications.id, existing.id))
          .returning();
        verification = updated;
      } else {
        const [created] = await tx
          .insert(cardVerifications)
          .values({
            userId: args.userId,
            cardId: args.cardId,
            score: bestScore,
            tier: bestTier,
            status,
            submissions: args.submissions,
            arkAwarded,
            attempts,
          })
          .returning();
        verification = created;
      }

      // Apply the incremental JST-skills boost to the user's latest assessment
      // so recalcArkForUser picks it up. Skills + total are bumped in lockstep
      // (the JST formula is linear), each clamped to its ceiling.
      if (jstBoost > 0) {
        const [latestAssessment] = await tx
          .select()
          .from(assessments)
          .where(eq(assessments.userId, args.userId))
          .orderBy(sql`${assessments.createdAt} DESC`)
          .limit(1);
        if (latestAssessment) {
          const newSkills = Math.min(100, latestAssessment.jstSkills + jstBoost);
          const skillsDelta = newSkills - latestAssessment.jstSkills;
          const newTotal = Math.min(300, latestAssessment.jstTotal + skillsDelta);
          await tx
            .update(assessments)
            .set({ jstSkills: newSkills, jstTotal: newTotal })
            .where(eq(assessments.id, latestAssessment.id));
        }
      }

      return { verification, jstBoost, improved, prevTier };
    });
  }

  // ── Verification documents (DATA-pillar evidence) ───────────
  async addVerificationDocument(doc: InsertVerificationDocument): Promise<VerificationDocument> {
    const [created] = await db.insert(verificationDocuments).values(doc).returning();
    return created;
  }

  async getVerificationDocuments(userId: string, cardId: string): Promise<VerificationDocument[]> {
    return await db
      .select()
      .from(verificationDocuments)
      .where(and(eq(verificationDocuments.userId, userId), eq(verificationDocuments.cardId, cardId)))
      .orderBy(sql`${verificationDocuments.createdAt} DESC`);
  }

  async deleteVerificationDocument(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(verificationDocuments)
      .where(and(eq(verificationDocuments.id, id), eq(verificationDocuments.userId, userId)))
      .returning({ id: verificationDocuments.id });
    return result.length > 0;
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

  async getAllSpcListings(filters?: { pillar?: string; status?: string; disc?: string; rarity?: string; version?: string; scope?: string; institution?: string }): Promise<SpcListing[]> {
    const rows = await db.select().from(spcListings).orderBy(desc(spcListings.createdAt));
    // M3 — disc/rarity/version live on jnomics_cards. When any of those filters
    // are set, intersect with cards referenced via synergy_tag_ids.
    let cardIndex: Map<string, { disc: string | null; rarity: string | null; version: string | null }> | null = null;
    if (filters?.disc || filters?.rarity || filters?.version) {
      const allCards = await db.select().from(jnomicsCards);
      cardIndex = new Map(allCards.map((c) => [c.id, { disc: c.disc, rarity: c.rarity, version: c.version }]));
    }
    return rows.filter((r) => {
      if (filters?.pillar && r.pillar !== filters.pillar) return false;
      if (filters?.status && r.status !== filters.status) return false;
      // Phase K — exclude CORPORATE-only listings from the open market.
      // The corporate surface (/api/sphinx/corporate/listings) uses
      // `getCorporateListings()` which has its own scope+institution filter.
      if (filters?.scope === "OPEN" && r.scope === "CORPORATE") return false;
      if (cardIndex) {
        const tags = r.synergyTagIds ?? [];
        const tagged = tags.map((id) => cardIndex!.get(id)).filter(Boolean) as Array<{ disc: string | null; rarity: string | null; version: string | null }>;
        if (filters?.disc && !tagged.some((t) => t.disc === filters.disc)) return false;
        if (filters?.rarity && !tagged.some((t) => t.rarity === filters.rarity)) return false;
        if (filters?.version && !tagged.some((t) => t.version === filters.version)) return false;
      }
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

  // ── Phase K — Corporate marketplace queries ──
  async getCorporateListings(
    institution: string,
    filters?: { pillar?: string; status?: string },
  ): Promise<SpcListing[]> {
    const norm = institution.trim().toLowerCase();
    if (!norm) return [];
    const rows = await db.select().from(spcListings).orderBy(desc(spcListings.createdAt));
    return rows.filter((r) => {
      // Scope must include corporate visibility.
      if (r.scope !== "CORPORATE" && r.scope !== "BOTH") return false;
      // Institution is snapshotted at publish time — compare case-insensitive.
      const inst = (r.institution ?? "").trim().toLowerCase();
      if (inst !== norm) return false;
      if (filters?.pillar && r.pillar !== filters.pillar) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    });
  }

  async submitSpcFeedback(args: {
    listingId: string;
    buyerId: string;
    stars: number;
    comment?: string | null;
  }): Promise<{ feedback: SpcFeedback; creatorBonus: number; creatorBalance: number }> {
    if (!Number.isInteger(args.stars) || args.stars < 1 || args.stars > 5) {
      throw new Error("Stars must be an integer between 1 and 5.");
    }
    return await db.transaction(async (tx) => {
      // Re-verify the buyer actually purchased this listing inside the txn —
      // mirrors the body-gate check, race-safe against listing deletion.
      const [listing] = await tx
        .select()
        .from(spcListings)
        .where(eq(spcListings.id, args.listingId))
        .for("update");
      if (!listing) throw new Error("Listing not found.");
      const [purchase] = await tx
        .select({ id: spcPurchases.id })
        .from(spcPurchases)
        .where(and(eq(spcPurchases.buyerId, args.buyerId), eq(spcPurchases.listingId, args.listingId)))
        .limit(1);
      if (!purchase) {
        throw new Error("Only verified buyers can leave feedback for this listing.");
      }
      if (listing.creatorId === args.buyerId) {
        throw new Error("You can't rate your own SPC.");
      }

      const bonus = SPC_FEEDBACK_BONUS_BY_STARS[args.stars as 1 | 2 | 3 | 4 | 5] ?? 0;
      const trimmedComment = args.comment?.trim() || null;

      // Insert feedback row. The unique index on (listing_id, buyer_id) makes
      // this the race-safe gate against double feedback; the precheck above
      // is best-effort UX.
      let feedback: SpcFeedback;
      try {
        const [created] = await tx
          .insert(spcFeedback)
          .values({
            listingId: args.listingId,
            buyerId: args.buyerId,
            creatorId: listing.creatorId,
            stars: args.stars,
            comment: trimmedComment,
            bonusAwarded: bonus,
          })
          .returning();
        feedback = created;
      } catch (err: any) {
        if (String(err?.code) === "23505" || /spc_feedback_listing_buyer_uidx/.test(String(err?.message))) {
          throw new Error("You have already left feedback for this listing.");
        }
        throw err;
      }

      // Award per-use bonus to the creator (if any) and bump total_earned.
      let creatorBalance = 0;
      if (bonus > 0) {
        // Initialize creator credit row if missing (idempotent).
        await tx
          .insert(userCredits)
          .values({
            userId: listing.creatorId,
            balance: SPC_STARTING_CREDITS,
            lifetimeEarned: SPC_STARTING_CREDITS,
            lifetimeSpent: 0,
          })
          .onConflictDoNothing();
        const [creator] = await tx
          .select()
          .from(userCredits)
          .where(eq(userCredits.userId, listing.creatorId))
          .for("update");
        const [updated] = await tx
          .update(userCredits)
          .set({
            balance: creator.balance + bonus,
            lifetimeEarned: creator.lifetimeEarned + bonus,
            updatedAt: new Date(),
          })
          .where(eq(userCredits.userId, listing.creatorId))
          .returning();
        creatorBalance = updated.balance;
        // Mirror the bonus into the listing's totalEarned so creator
        // dashboards show feedback rewards alongside purchase splits.
        await tx
          .update(spcListings)
          .set({ totalEarned: listing.totalEarned + bonus })
          .where(eq(spcListings.id, args.listingId));
      } else {
        const [creator] = await tx
          .select({ balance: userCredits.balance })
          .from(userCredits)
          .where(eq(userCredits.userId, listing.creatorId))
          .limit(1);
        creatorBalance = creator?.balance ?? 0;
      }

      return { feedback, creatorBonus: bonus, creatorBalance };
    });
  }

  async getSpcFeedbackForListing(listingId: string): Promise<{
    count: number;
    average: number;
    histogram: Record<string, number>;
    recent: Array<{ id: string; stars: number; comment: string | null; createdAt: string; buyerName: string | null }>;
  }> {
    const items = await db
      .select()
      .from(spcFeedback)
      .where(eq(spcFeedback.listingId, listingId))
      .orderBy(desc(spcFeedback.createdAt));
    const count = items.length;
    const sumStars = items.reduce((s, f) => s + f.stars, 0);
    const average = count > 0 ? Math.round((sumStars / count) * 10) / 10 : 0;
    const histogram: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    for (const f of items) histogram[String(f.stars)] = (histogram[String(f.stars)] ?? 0) + 1;
    // Resolve buyer display names in batch to populate recent comments —
    // never return raw buyerId/creatorId in the public feedback payload
    // (avoids enumeration / cross-user identity disclosure).
    const recentRows = items.slice(0, 20);
    const buyerIds = Array.from(new Set(recentRows.map((r) => r.buyerId)));
    const buyers = buyerIds.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, buyerIds))
      : [];
    const nameById = new Map(buyers.map((b) => [b.id, b.name]));
    const recent = recentRows.map((f) => ({
      id: f.id,
      stars: f.stars,
      comment: f.comment ?? null,
      createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
      buyerName: nameById.get(f.buyerId) ?? null,
    }));
    return { count, average, histogram, recent };
  }

  async getSpcFeedbackByBuyer(listingId: string, buyerId: string): Promise<SpcFeedback | undefined> {
    const [row] = await db
      .select()
      .from(spcFeedback)
      .where(and(eq(spcFeedback.listingId, listingId), eq(spcFeedback.buyerId, buyerId)))
      .limit(1);
    return row;
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

  // ===== Phase G — Cohorts =====
  async createCohort(c: InsertCohort): Promise<Cohort> {
    const [row] = await db.insert(cohorts).values(c).returning();
    return row;
  }

  async getCohort(id: string): Promise<Cohort | undefined> {
    const [row] = await db.select().from(cohorts).where(eq(cohorts.id, id));
    return row;
  }

  async getCohortsByInstructor(instructorId: string): Promise<Cohort[]> {
    return await db.select().from(cohorts).where(eq(cohorts.instructorId, instructorId)).orderBy(desc(cohorts.createdAt));
  }

  async getCohortsForStudent(userId: string): Promise<Cohort[]> {
    const rows = await db
      .select({ c: cohorts })
      .from(cohortMemberships)
      .innerJoin(cohorts, eq(cohorts.id, cohortMemberships.cohortId))
      .where(and(eq(cohortMemberships.userId, userId), eq(cohortMemberships.status, "active")));
    return rows.map(r => r.c);
  }

  async addCohortMembers(
    cohortId: string,
    rows: Array<{ userId?: string; invitedEmail?: string; status?: string }>,
  ): Promise<{ added: number; reactivated: number; skipped: number }> {
    let added = 0, reactivated = 0, skipped = 0;
    for (const r of rows) {
      let userId = r.userId ?? null;
      const invitedEmail = r.invitedEmail?.toLowerCase().trim() ?? null;
      // If only email is provided, try to resolve to a registered user.
      if (!userId && invitedEmail) {
        const [u] = await db.select({ id: users.id }).from(users).where(eq(users.username, invitedEmail));
        if (u) userId = u.id;
      }
      if (!userId && !invitedEmail) { skipped++; continue; }
      // Use email as a stable surrogate id when the user hasn't registered yet,
      // so we can still enforce the (cohort_id, user_id) unique index.
      const memberKey = userId ?? `invite:${invitedEmail}`;
      const status = userId ? (r.status ?? "active") : "invited";
      const [existing] = await db.select().from(cohortMemberships)
        .where(and(eq(cohortMemberships.cohortId, cohortId), eq(cohortMemberships.userId, memberKey)));
      if (existing) {
        if (existing.status === "removed") {
          await db.update(cohortMemberships).set({ status }).where(eq(cohortMemberships.id, existing.id));
          reactivated++;
        } else {
          skipped++;
        }
        continue;
      }
      await db.insert(cohortMemberships).values({
        cohortId,
        userId: memberKey,
        status,
        invitedEmail: userId ? null : invitedEmail,
      });
      added++;
    }
    return { added, reactivated, skipped };
  }

  async getCohortMembers(cohortId: string): Promise<Array<CohortMembership & {
    user: { id: string; name: string; username: string; arkScore: number; jstIndex: number; ccmi: number; contextCraftCertLevel: string | null } | null;
  }>> {
    const rows = await db
      .select({
        m: cohortMemberships,
        u: {
          id: users.id, name: users.name, username: users.username,
          arkScore: users.arkScore, jstIndex: users.jstIndex, ccmi: users.ccmi,
          contextCraftCertLevel: users.contextCraftCertLevel,
        },
      })
      .from(cohortMemberships)
      .leftJoin(users, eq(users.id, cohortMemberships.userId))
      .where(eq(cohortMemberships.cohortId, cohortId))
      .orderBy(desc(cohortMemberships.joinedAt));
    return rows.map(r => ({ ...r.m, user: r.u?.id ? r.u : null }));
  }

  async reconcileCohortInvitesForUser(userId: string, email: string): Promise<number> {
    // Convert any `invite:<email>` placeholder rows into real memberships keyed
    // by this user's id. If an active membership already exists for this user
    // in the same cohort, just drop the placeholder. Runs in a transaction so
    // partial updates can't leak.
    const key = `invite:${email.toLowerCase().trim()}`;
    return await db.transaction(async (tx) => {
      const placeholders = await tx.select().from(cohortMemberships).where(eq(cohortMemberships.userId, key));
      if (placeholders.length === 0) return 0;
      let converted = 0;
      for (const p of placeholders) {
        const [conflict] = await tx.select().from(cohortMemberships)
          .where(and(eq(cohortMemberships.cohortId, p.cohortId), eq(cohortMemberships.userId, userId)));
        if (conflict) {
          await tx.delete(cohortMemberships).where(eq(cohortMemberships.id, p.id));
          continue;
        }
        await tx.update(cohortMemberships)
          .set({ userId, status: "active", invitedEmail: null })
          .where(eq(cohortMemberships.id, p.id));
        converted++;
      }
      return converted;
    });
  }

  async removeCohortMember(cohortId: string, userId: string): Promise<boolean> {
    const res = await db.update(cohortMemberships)
      .set({ status: "removed" })
      .where(and(eq(cohortMemberships.cohortId, cohortId), eq(cohortMemberships.userId, userId)))
      .returning({ id: cohortMemberships.id });
    return res.length > 0;
  }

  async createCohortAssignment(a: InsertCohortAssignment): Promise<CohortAssignment> {
    const [row] = await db.insert(cohortAssignments).values(a).returning();
    return row;
  }

  async getCohortAssignments(cohortId: string): Promise<CohortAssignment[]> {
    return await db.select().from(cohortAssignments)
      .where(eq(cohortAssignments.cohortId, cohortId))
      .orderBy(desc(cohortAssignments.createdAt));
  }

  async getCohortGrades(cohortId: string): Promise<Array<{
    studentId: string; studentName: string; studentEmail: string;
    scenarioId: string; scenarioTitle: string;
    bestJcse: number | null; bestTier: string | null; attempts: number;
    dueAt: Date | null; lastAttemptAt: Date | null; onTime: boolean | null;
  }>> {
    const members = await db.select().from(cohortMemberships)
      .where(and(eq(cohortMemberships.cohortId, cohortId), eq(cohortMemberships.status, "active")));
    const assignments = await db.select().from(cohortAssignments).where(eq(cohortAssignments.cohortId, cohortId));
    if (members.length === 0 || assignments.length === 0) return [];
    const memberIds = members.map(m => m.userId);
    const scenarioIds = assignments.map(a => a.scenarioId);
    const scenarios = await db.select().from(ccgeScenarios).where(inArray(ccgeScenarios.id, scenarioIds));
    const scenarioMap = new Map(scenarios.map(s => [s.id, s] as const));
    const userRows = await db.select({
      id: users.id, name: users.name, username: users.username,
    }).from(users).where(inArray(users.id, memberIds));
    const userMap = new Map(userRows.map(u => [u.id, u] as const));
    const sessionRows = await db.select().from(gameSessions)
      .where(and(
        inArray(gameSessions.userId, memberIds),
        inArray(gameSessions.scenarioId, scenarioIds),
        eq(gameSessions.status, "finished"),
      ));
    const out: Array<{
      studentId: string; studentName: string; studentEmail: string;
      scenarioId: string; scenarioTitle: string;
      bestJcse: number | null; bestTier: string | null; attempts: number;
      dueAt: Date | null; lastAttemptAt: Date | null; onTime: boolean | null;
    }> = [];
    for (const m of members) {
      const u = userMap.get(m.userId);
      if (!u) continue;
      for (const a of assignments) {
        const sc = scenarioMap.get(a.scenarioId);
        if (!sc) continue;
        const attempts = sessionRows.filter(s => s.userId === m.userId && s.scenarioId === a.scenarioId);
        const best = attempts.reduce<typeof attempts[number] | null>((b, x) => {
          if (!b) return x;
          return (x.kcseScore ?? -1) > (b.kcseScore ?? -1) ? x : b;
        }, null);
        const last = attempts.reduce<typeof attempts[number] | null>((b, x) => {
          if (!b) return x;
          const bt = b.finishedAt?.getTime() ?? 0;
          const xt = x.finishedAt?.getTime() ?? 0;
          return xt > bt ? x : b;
        }, null);
        const onTime = a.dueAt && last?.finishedAt ? last.finishedAt.getTime() <= a.dueAt.getTime() : null;
        out.push({
          studentId: u.id, studentName: u.name, studentEmail: u.username,
          scenarioId: a.scenarioId, scenarioTitle: sc.title,
          bestJcse: best?.kcseScore ?? null,
          bestTier: best?.certTierEarned ?? null,
          attempts: attempts.length,
          dueAt: a.dueAt,
          lastAttemptAt: last?.finishedAt ?? null,
          onTime,
        });
      }
    }
    return out;
  }

  async getCohortComparison(instructorId: string): Promise<Array<{
    cohortId: string; cohortName: string; studentCount: number;
    avgJst: number; avgCcmi: number; avgArk: number;
  }>> {
    const list = await db.select().from(cohorts).where(eq(cohorts.instructorId, instructorId));
    const out: Array<{ cohortId: string; cohortName: string; studentCount: number; avgJst: number; avgCcmi: number; avgArk: number; }> = [];
    for (const c of list) {
      const members = await db.select({
        jstIndex: users.jstIndex, ccmi: users.ccmi, arkScore: users.arkScore,
      })
        .from(cohortMemberships)
        .innerJoin(users, eq(users.id, cohortMemberships.userId))
        .where(and(eq(cohortMemberships.cohortId, c.id), eq(cohortMemberships.status, "active")));
      const n = members.length;
      const sum = members.reduce((acc, m) => {
        acc.jst += m.jstIndex ?? 0; acc.ccmi += m.ccmi ?? 0; acc.ark += m.arkScore ?? 0;
        return acc;
      }, { jst: 0, ccmi: 0, ark: 0 });
      out.push({
        cohortId: c.id, cohortName: c.name, studentCount: n,
        avgJst: n ? Math.round(sum.jst / n) : 0,
        avgCcmi: n ? Math.round(sum.ccmi / n) : 0,
        avgArk: n ? Math.round(sum.ark / n) : 0,
      });
    }
    return out;
  }

  // ── Institution Workforce / HR Connectors (Task #25) ──
  async createImportBatch(batch: InsertHrImportBatch): Promise<HrImportBatch> {
    const [row] = await db.insert(hrImportBatches).values(batch).returning();
    return row;
  }

  async getImportBatches(institution: string): Promise<HrImportBatch[]> {
    return await db
      .select()
      .from(hrImportBatches)
      .where(eq(hrImportBatches.institution, institution))
      .orderBy(desc(hrImportBatches.createdAt));
  }

  async updateImportBatchCounts(
    id: string,
    counts: { importedRows: number; updatedRows: number },
  ): Promise<HrImportBatch | undefined> {
    const [row] = await db
      .update(hrImportBatches)
      .set({ importedRows: counts.importedRows, updatedRows: counts.updatedRows })
      .where(eq(hrImportBatches.id, id))
      .returning();
    return row;
  }

  async upsertStaffRecords(
    institution: string,
    batchId: string,
    records: NormalizedHrRecord[],
  ): Promise<{ inserted: number; updated: number; linked: number }> {
    return await db.transaction(async (tx) => {
      let inserted = 0;
      let updated = 0;
      let linked = 0;

      for (const rec of records) {
        const email = rec.email ? rec.email.trim().toLowerCase() : null;
        const externalId = rec.externalId?.trim() || null;

        // Auto-link to an existing ARK account by email (username == email).
        let arkUserId: string | null = null;
        if (email) {
          const [matched] = await tx
            .select({ id: users.id })
            .from(users)
            .where(sql`lower(${users.username}) = ${email}`);
          if (matched?.id) {
            arkUserId = matched.id;
            linked++;
          }
        }

        const values = {
          institution,
          importBatchId: batchId,
          externalId,
          fullName: rec.fullName,
          email,
          jobTitle: rec.jobTitle ?? null,
          department: rec.department ?? null,
          team: rec.team ?? null,
          hireDate: rec.hireDate ?? null,
          performanceRating: rec.performanceRating ?? null,
          compensationBand: rec.compensationBand ?? null,
          manager: rec.manager ?? null,
          location: rec.location ?? null,
        };

        // Find an existing row to update: email is the primary key, externalId
        // the fallback. Email-less + id-less rows always insert.
        let existing: { id: string; arkUserId: string | null } | undefined;
        if (email) {
          [existing] = await tx
            .select({ id: staffRecords.id, arkUserId: staffRecords.arkUserId })
            .from(staffRecords)
            .where(and(eq(staffRecords.institution, institution), eq(staffRecords.email, email)));
        } else if (externalId) {
          [existing] = await tx
            .select({ id: staffRecords.id, arkUserId: staffRecords.arkUserId })
            .from(staffRecords)
            .where(and(eq(staffRecords.institution, institution), eq(staffRecords.externalId, externalId)));
        }

        if (existing) {
          await tx
            .update(staffRecords)
            .set({
              ...values,
              // Preserve a prior manual link if the import didn't re-resolve one.
              arkUserId: arkUserId ?? existing.arkUserId ?? null,
              updatedAt: new Date(),
            })
            .where(eq(staffRecords.id, existing.id));
          updated++;
        } else {
          await tx.insert(staffRecords).values({ ...values, arkUserId });
          inserted++;
        }
      }

      return { inserted, updated, linked };
    });
  }

  async getStaffRecords(institution: string): Promise<StaffRecordWithArk[]> {
    const rows = await db
      .select({
        s: staffRecords,
        u: {
          id: users.id,
          arkScore: users.arkScore,
          jstIndex: users.jstIndex,
          ccmi: users.ccmi,
          resumeReplacementPct: users.resumeReplacementPct,
        },
      })
      .from(staffRecords)
      .leftJoin(users, eq(users.id, staffRecords.arkUserId))
      .where(eq(staffRecords.institution, institution))
      .orderBy(desc(staffRecords.updatedAt));

    return rows.map(({ s, u }) => {
      const linked = !!u?.id;
      const assessed = linked && (u!.arkScore ?? 0) > 0;
      const assessmentStatus: StaffAssessmentStatus = !linked
        ? s.invitedAt
          ? "invited"
          : "unlinked"
        : assessed
          ? "complete"
          : "pending";
      return {
        ...s,
        assessmentStatus,
        tenureBand: tenureBandFromHireDate(s.hireDate),
        ark: linked
          ? {
              arkScore: u!.arkScore ?? 0,
              jstIndex: u!.jstIndex ?? 0,
              ccmi: u!.ccmi ?? 0,
              vulnerabilityPct: u!.resumeReplacementPct ?? 0,
            }
          : null,
      };
    });
  }

  async getDepartmentStaff(
    institution: string,
    department: string,
  ): Promise<StaffDrilldownRow[]> {
    // Match against the same normalized key the workforce aggregation uses so a
    // clicked department row resolves exactly (including the "Unspecified" bucket
    // for staff with no department). Filtering happens server-side within the
    // institution scope — the department is a filter, never an identity.
    const wanted = (department ?? "").trim() || "Unspecified";
    const staff = await this.getStaffRecords(institution);
    const rank: Record<StaffAssessmentStatus, number> = {
      complete: 0,
      pending: 1,
      invited: 2,
      unlinked: 3,
    };
    return staff
      .filter((s) => ((s.department ?? "").trim() || "Unspecified") === wanted)
      .map((s) => ({
        id: s.id,
        fullName: s.fullName,
        jobTitle: s.jobTitle,
        assessmentStatus: s.assessmentStatus,
        jstIndex: s.ark ? s.ark.jstIndex : null,
        arkScore: s.ark ? s.ark.arkScore : null,
        vulnerabilityPct: s.ark ? s.ark.vulnerabilityPct : null,
        nudgedAt: s.nudgedAt ? s.nudgedAt.toISOString() : null,
      }))
      // Assessed staff first, then most-vulnerable at the top so the admin sees
      // who needs a nudge without scrolling; unassessed sink to the bottom.
      .sort((a, b) => {
        const r = rank[a.assessmentStatus] - rank[b.assessmentStatus];
        if (r !== 0) return r;
        return (b.vulnerabilityPct ?? -1) - (a.vulnerabilityPct ?? -1);
      });
  }

  async getStaffRecord(id: string): Promise<StaffRecord | undefined> {
    const [row] = await db.select().from(staffRecords).where(eq(staffRecords.id, id));
    return row;
  }

  async linkStaffToArk(id: string, institution: string): Promise<StaffRecordWithArk | null> {
    return await db.transaction(async (tx) => {
      const [staff] = await tx
        .select()
        .from(staffRecords)
        .where(and(eq(staffRecords.id, id), eq(staffRecords.institution, institution)));
      if (!staff) return null;
      const email = staff.email?.trim().toLowerCase();
      if (!email) return null;
      const [matched] = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = ${email}`);
      if (!matched?.id) return null;
      await tx
        .update(staffRecords)
        .set({ arkUserId: matched.id, updatedAt: new Date() })
        .where(eq(staffRecords.id, id));
      const [u] = await tx
        .select({
          arkScore: users.arkScore,
          jstIndex: users.jstIndex,
          ccmi: users.ccmi,
          resumeReplacementPct: users.resumeReplacementPct,
        })
        .from(users)
        .where(eq(users.id, matched.id));
      const assessed = (u?.arkScore ?? 0) > 0;
      return {
        ...staff,
        arkUserId: matched.id,
        assessmentStatus: assessed ? "complete" : "pending",
        tenureBand: tenureBandFromHireDate(staff.hireDate),
        ark: {
          arkScore: u?.arkScore ?? 0,
          jstIndex: u?.jstIndex ?? 0,
          ccmi: u?.ccmi ?? 0,
          vulnerabilityPct: u?.resumeReplacementPct ?? 0,
        },
      };
    });
  }

  async inviteStaff(id: string, institution: string): Promise<StaffRecordWithArk | null> {
    return await db.transaction(async (tx) => {
      const [staff] = await tx
        .select()
        .from(staffRecords)
        .where(and(eq(staffRecords.id, id), eq(staffRecords.institution, institution)));
      if (!staff) return null;
      const email = staff.email?.trim().toLowerCase();
      if (!email) return null;

      // If an ARK account already exists for this email, link immediately so the
      // invite resolves to a real account in one step. Otherwise record the
      // invite (invitedAt); registration reconciliation will link it later.
      const [matched] = await tx
        .select({
          id: users.id,
          arkScore: users.arkScore,
          jstIndex: users.jstIndex,
          ccmi: users.ccmi,
          resumeReplacementPct: users.resumeReplacementPct,
        })
        .from(users)
        .where(sql`lower(${users.username}) = ${email}`);

      const now = new Date();
      const arkUserId = matched?.id ?? null;
      await tx
        .update(staffRecords)
        .set({ arkUserId, invitedAt: now, updatedAt: now })
        .where(eq(staffRecords.id, id));

      const linked = !!matched?.id;
      const assessed = linked && (matched!.arkScore ?? 0) > 0;
      return {
        ...staff,
        arkUserId,
        invitedAt: now,
        updatedAt: now,
        assessmentStatus: !linked ? "invited" : assessed ? "complete" : "pending",
        tenureBand: tenureBandFromHireDate(staff.hireDate),
        ark: linked
          ? {
              arkScore: matched!.arkScore ?? 0,
              jstIndex: matched!.jstIndex ?? 0,
              ccmi: matched!.ccmi ?? 0,
              vulnerabilityPct: matched!.resumeReplacementPct ?? 0,
            }
          : null,
      };
    });
  }

  async nudgeStaff(id: string, institution: string): Promise<StaffRecordWithArk | null> {
    return await db.transaction(async (tx) => {
      const [staff] = await tx
        .select()
        .from(staffRecords)
        .where(and(eq(staffRecords.id, id), eq(staffRecords.institution, institution)));
      if (!staff) return null;
      // A nudge only makes sense once the staff member is linked to an assessed
      // ARK account — that's the "assessed-but-at-risk" cohort the drill-down
      // surfaces. Unlinked/pending staff should be invited instead.
      if (!staff.arkUserId) return null;
      const [matched] = await tx
        .select({
          id: users.id,
          arkScore: users.arkScore,
          jstIndex: users.jstIndex,
          ccmi: users.ccmi,
          resumeReplacementPct: users.resumeReplacementPct,
        })
        .from(users)
        .where(eq(users.id, staff.arkUserId));
      const assessed = !!matched?.id && (matched.arkScore ?? 0) > 0;
      if (!assessed) return null;

      const now = new Date();
      await tx
        .update(staffRecords)
        .set({ nudgedAt: now, updatedAt: now })
        .where(eq(staffRecords.id, id));

      return {
        ...staff,
        nudgedAt: now,
        updatedAt: now,
        assessmentStatus: "complete",
        tenureBand: tenureBandFromHireDate(staff.hireDate),
        ark: {
          arkScore: matched!.arkScore ?? 0,
          jstIndex: matched!.jstIndex ?? 0,
          ccmi: matched!.ccmi ?? 0,
          vulnerabilityPct: matched!.resumeReplacementPct ?? 0,
        },
      };
    });
  }

  async reconcileStaffInvitesForUser(userId: string, email: string): Promise<number> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return 0;
    // Link every still-unlinked staff record (across institutions) whose email
    // matches this newly-registered/authenticated user. Mirrors the cohort
    // invite reconciliation so an invited staff member is auto-linked on signup.
    const linked = await db
      .update(staffRecords)
      .set({ arkUserId: userId, updatedAt: new Date() })
      .where(
        and(
          isNull(staffRecords.arkUserId),
          sql`lower(${staffRecords.email}) = ${normalized}`,
        ),
      )
      .returning({ id: staffRecords.id });
    return linked.length;
  }

  async getWorkforceIntelligence(institution: string): Promise<WorkforceIntelligence> {
    const staff = await this.getStaffRecords(institution);
    return this.computeWorkforceIntelligence(institution, staff);
  }

  private computeWorkforceIntelligence(
    institution: string,
    staff: StaffRecordWithArk[],
  ): WorkforceIntelligence {
    const aggregate = (
      keyOf: (s: StaffRecordWithArk) => string | null | undefined,
    ): WorkforceBreakdownRow[] => {
      const groups = new Map<string, StaffRecordWithArk[]>();
      for (const s of staff) {
        const k = workforceKey(keyOf(s));
        const arr = groups.get(k) ?? [];
        arr.push(s);
        groups.set(k, arr);
      }
      const rows = Array.from(groups.entries()).map(([key, members]) => {
        const assessed = members.filter((m) => m.assessmentStatus === "complete" && m.ark);
        const n = assessed.length;
        const sum = assessed.reduce(
          (acc, m) => {
            acc.ark += m.ark!.arkScore;
            acc.jst += m.ark!.jstIndex;
            acc.vuln += m.ark!.vulnerabilityPct;
            return acc;
          },
          { ark: 0, jst: 0, vuln: 0 },
        );
        return {
          key,
          count: members.length,
          linkedCount: members.filter((m) => m.assessmentStatus !== "unlinked").length,
          assessedCount: n,
          avgArk: n ? Math.round(sum.ark / n) : 0,
          avgJst: n ? Math.round(sum.jst / n) : 0,
          avgVulnerability: n ? Math.round(sum.vuln / n) : 0,
        };
      });
      return rows.sort((a, b) => b.count - a.count);
    };

    const assessedAll = staff.filter((s) => s.assessmentStatus === "complete" && s.ark);
    const nAll = assessedAll.length;
    const sumAll = assessedAll.reduce(
      (acc, m) => {
        acc.ark += m.ark!.arkScore;
        acc.jst += m.ark!.jstIndex;
        acc.vuln += m.ark!.vulnerabilityPct;
        return acc;
      },
      { ark: 0, jst: 0, vuln: 0 },
    );

    return {
      institution,
      totals: {
        staff: staff.length,
        linked: staff.filter((s) => s.assessmentStatus !== "unlinked").length,
        assessed: nAll,
        avgArk: nAll ? Math.round(sumAll.ark / nAll) : 0,
        avgJst: nAll ? Math.round(sumAll.jst / nAll) : 0,
        avgVulnerability: nAll ? Math.round(sumAll.vuln / nAll) : 0,
      },
      byDepartment: aggregate((s) => s.department),
      byTenureBand: aggregate((s) => s.tenureBand),
      byCompensationBand: aggregate((s) => s.compensationBand),
      byManager: aggregate((s) => s.manager),
      byLocation: aggregate((s) => s.location),
    };
  }

  async getEnterpriseIntelligence(
    institution: string,
    filter?: WorkforceFilter,
  ): Promise<EnterpriseIntelligence> {
    // Fetch the full roster once, derive the filter options from it (so the
    // dropdown always reflects the whole org), then optionally narrow to the
    // requested slice before computing every downstream surface.
    const allStaff = await this.getStaffRecords(institution);

    // Filter options: only dimensions with ≥2 distinct real values are worth
    // slicing on. Values are the actual buckets present in the roster — no
    // fabricated categories.
    const filterOptions: WorkforceFilterOption[] = [];
    for (const dim of WORKFORCE_DIMENSIONS) {
      const values = Array.from(new Set(allStaff.map((s) => workforceKey(dim.keyOf(s))))).sort(
        (a, b) => a.localeCompare(b),
      );
      if (values.length >= 2) {
        filterOptions.push({ dimension: dim.dimension, label: dim.label, values });
      }
    }

    // Validate the requested filter against the real options so a client can
    // never inject a fabricated dimension/value; invalid → treated as no filter.
    let activeFilter: WorkforceFilter | null = null;
    let staff = allStaff;
    if (filter) {
      const dim = WORKFORCE_DIMENSIONS.find((d) => d.dimension === filter.dimension);
      const opt = filterOptions.find((o) => o.dimension === filter.dimension);
      if (dim && opt && opt.values.includes(filter.value)) {
        staff = allStaff.filter((s) => workforceKey(dim.keyOf(s)) === filter.value);
        activeFilter = { dimension: filter.dimension, value: filter.value };
      }
    }

    // Reuse the workforce aggregation for totals + department heatmap over the
    // (possibly filtered) staff subset.
    const intel = this.computeWorkforceIntelligence(institution, staff);

    // Vulnerability distribution over assessed staff. Higher replacement % =
    // worse; bands mirror the 5 strata rendered by the enterprise dashboard.
    const bands = { Critical: 0, "At Risk": 0, Transitional: 0, Resilient: 0, Flourishing: 0 };
    for (const s of staff) {
      if (s.assessmentStatus !== "complete" || !s.ark) continue;
      const v = s.ark.vulnerabilityPct;
      if (v >= 80) bands.Critical++;
      else if (v >= 60) bands["At Risk"]++;
      else if (v >= 40) bands.Transitional++;
      else if (v >= 20) bands.Resilient++;
      else bands.Flourishing++;
    }
    const vulnerabilityDistribution: VulnerabilityBand[] = [
      { name: "Critical", value: bands.Critical },
      { name: "At Risk", value: bands["At Risk"] },
      { name: "Transitional", value: bands.Transitional },
      { name: "Resilient", value: bands.Resilient },
      { name: "Flourishing", value: bands.Flourishing },
    ];

    // Trend is re-scoped to the filtered staff's linked accounts so it stays
    // consistent with the rest of the overview; unfiltered → whole institution.
    const userIds = activeFilter
      ? staff.map((s) => s.arkUserId).filter((id): id is string => !!id)
      : undefined;
    const jstTrend = await this.getInstitutionJstTrend(institution, 6, userIds);

    return { ...intel, vulnerabilityDistribution, jstTrend, filterOptions, activeFilter };
  }

  // Institution-wide monthly average JST from ark_score_history, restricted to
  // the institution's linked staff accounts. Real time-series — sparse months
  // simply don't appear rather than being padded with fabricated points.
  async getInstitutionJstTrend(
    institution: string,
    months = 6,
    userIds?: string[],
  ): Promise<JstTrendPoint[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    // A filter that matched no linked accounts must yield an empty trend, never
    // silently fall back to the whole institution.
    if (userIds && userIds.length === 0) return [];

    const rows = await db
      .select({ createdAt: arkScoreHistory.createdAt, jstIndex: arkScoreHistory.jstIndex })
      .from(arkScoreHistory)
      .innerJoin(
        staffRecords,
        and(
          eq(staffRecords.arkUserId, arkScoreHistory.userId),
          eq(staffRecords.institution, institution),
        ),
      )
      .where(
        userIds
          ? and(
              sql`${arkScoreHistory.createdAt} >= ${since}`,
              inArray(arkScoreHistory.userId, userIds),
            )
          : sql`${arkScoreHistory.createdAt} >= ${since}`,
      )
      .orderBy(arkScoreHistory.createdAt);

    const buckets = new Map<string, { label: string; sum: number; n: number; order: number }>();
    for (const r of rows) {
      const d = new Date(r.createdAt);
      const order = d.getFullYear() * 12 + d.getMonth();
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const b = buckets.get(key) ?? { label, sum: 0, n: 0, order };
      b.sum += r.jstIndex;
      b.n += 1;
      buckets.set(key, b);
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.order - b.order)
      .map((b) => ({ month: b.label, avgJst: Math.round(b.sum / b.n) }));
  }

  async recordConnectorTest(test: InsertHrConnectorTest): Promise<HrConnectorTest> {
    const [row] = await db
      .insert(hrConnectorTests)
      .values(test)
      .onConflictDoUpdate({
        target: [hrConnectorTests.institution, hrConnectorTests.adapter],
        set: {
          ok: test.ok,
          totalRows: test.totalRows ?? null,
          validRows: test.validRows ?? null,
          errorRows: test.errorRows ?? null,
          message: test.message ?? null,
          testedBy: test.testedBy,
          testedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getConnectorTests(institution: string): Promise<HrConnectorTest[]> {
    return db
      .select()
      .from(hrConnectorTests)
      .where(eq(hrConnectorTests.institution, institution));
  }

  // ── Scheduled HR sync (Task #35) ──
  async getConnectorConfigs(institution: string): Promise<HrConnectorConfig[]> {
    return await db
      .select()
      .from(hrConnectorConfigs)
      .where(eq(hrConnectorConfigs.institution, institution))
      .orderBy(hrConnectorConfigs.adapter);
  }

  async getEnabledConnectorConfigs(): Promise<HrConnectorConfig[]> {
    return await db
      .select()
      .from(hrConnectorConfigs)
      .where(eq(hrConnectorConfigs.enabled, true));
  }

  async upsertConnectorConfig(input: {
    institution: string;
    adapter: string;
    enabled: boolean;
    intervalMinutes: number;
    createdBy: string;
  }): Promise<HrConnectorConfig> {
    const [row] = await db
      .insert(hrConnectorConfigs)
      .values({
        institution: input.institution,
        adapter: input.adapter,
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes,
        createdBy: input.createdBy,
      })
      .onConflictDoUpdate({
        target: [hrConnectorConfigs.institution, hrConnectorConfigs.adapter],
        set: {
          enabled: input.enabled,
          intervalMinutes: input.intervalMinutes,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async recordConnectorSyncResult(
    id: string,
    result: {
      status: HrSyncStatus;
      message: string;
      summary?: { inserted: number; updated: number; totalRows: number; errorRows: number } | null;
    },
  ): Promise<HrConnectorConfig | undefined> {
    const [row] = await db
      .update(hrConnectorConfigs)
      .set({
        lastSyncedAt: new Date(),
        lastSyncStatus: result.status,
        lastSyncMessage: result.message,
        lastSyncSummary: result.summary ?? null,
        updatedAt: new Date(),
      })
      .where(eq(hrConnectorConfigs.id, id))
      .returning();
    return row;
  }

  // ── Book Companion (Task #22) ──
  async getBookBadges(userId: string): Promise<BookJourneyBadge[]> {
    return db
      .select()
      .from(bookJourneyBadges)
      .where(eq(bookJourneyBadges.userId, userId))
      .orderBy(desc(bookJourneyBadges.earnedAt));
  }

  async awardBookBadge(
    badge: InsertBookJourneyBadge,
  ): Promise<{ badge: BookJourneyBadge; created: boolean }> {
    // Idempotent: the unique (userId, nodeId) index makes a repeat award a
    // no-op. ON CONFLICT DO NOTHING returns no row, so we detect the existing
    // award and read it back.
    const [inserted] = await db
      .insert(bookJourneyBadges)
      .values(badge)
      .onConflictDoNothing({ target: [bookJourneyBadges.userId, bookJourneyBadges.nodeId] })
      .returning();
    if (inserted) return { badge: inserted, created: true };
    const [existing] = await db
      .select()
      .from(bookJourneyBadges)
      .where(and(eq(bookJourneyBadges.userId, badge.userId), eq(bookJourneyBadges.nodeId, badge.nodeId)));
    return { badge: existing, created: false };
  }

  async getLedgerSnapshots(userId: string): Promise<BookLedgerSnapshot[]> {
    return db
      .select()
      .from(bookLedgerSnapshots)
      .where(eq(bookLedgerSnapshots.userId, userId));
  }

  async upsertLedgerSnapshot(snap: InsertBookLedgerSnapshot): Promise<BookLedgerSnapshot> {
    if (snap.kind === "baseline") {
      // Baseline is immutable — capture once, never overwrite. If it already
      // exists, return it untouched.
      const [inserted] = await db
        .insert(bookLedgerSnapshots)
        .values(snap)
        .onConflictDoNothing({ target: [bookLedgerSnapshots.userId, bookLedgerSnapshots.kind] })
        .returning();
      if (inserted) return inserted;
      const [existing] = await db
        .select()
        .from(bookLedgerSnapshots)
        .where(and(eq(bookLedgerSnapshots.userId, snap.userId), eq(bookLedgerSnapshots.kind, "baseline")));
      return existing;
    }
    // Final snapshot refreshes on every capture.
    const [row] = await db
      .insert(bookLedgerSnapshots)
      .values(snap)
      .onConflictDoUpdate({
        target: [bookLedgerSnapshots.userId, bookLedgerSnapshots.kind],
        set: {
          jstIndex: snap.jstIndex,
          ccmi: snap.ccmi,
          arkScore: snap.arkScore,
          badgesEarned: snap.badgesEarned ?? 0,
          spcPublished: snap.spcPublished ?? 0,
          capturedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  // ── Suggested Training Providers (freemium · Explorer tier) ──
  async createTrainingProvider(
    input: InsertTrainingProvider & { ownerUserId?: string | null; status?: TrainingProviderStatus },
  ): Promise<TrainingProvider> {
    const [row] = await db.insert(trainingProviders).values(input).returning();
    return row;
  }

  async getTrainingProviderById(id: string): Promise<TrainingProvider | undefined> {
    const [row] = await db.select().from(trainingProviders).where(eq(trainingProviders.id, id));
    return row;
  }

  async getTrainingProviderBySlug(slug: string): Promise<TrainingProvider | undefined> {
    const [row] = await db.select().from(trainingProviders).where(eq(trainingProviders.slug, slug));
    return row;
  }

  async listTrainingProviders(filter?: {
    status?: TrainingProviderStatus; region?: string; deliveryMode?: string; q?: string;
  }): Promise<TrainingProvider[]> {
    const conds = [];
    if (filter?.status) conds.push(eq(trainingProviders.status, filter.status));
    if (filter?.region) conds.push(sql`${filter.region} = ANY(${trainingProviders.regions})`);
    if (filter?.deliveryMode) conds.push(sql`${filter.deliveryMode} = ANY(${trainingProviders.deliveryModes})`);
    if (filter?.q) {
      const needle = `%${filter.q.toLowerCase()}%`;
      conds.push(sql`(lower(${trainingProviders.name}) LIKE ${needle} OR lower(${trainingProviders.description}) LIKE ${needle})`);
    }
    const where = conds.length ? and(...conds) : undefined;
    return db
      .select()
      .from(trainingProviders)
      .where(where as any)
      .orderBy(desc(trainingProviders.sponsored), desc(trainingProviders.sponsoredWeight), desc(trainingProviders.createdAt));
  }

  async listTrainingProvidersByOwner(ownerUserId: string): Promise<TrainingProvider[]> {
    return db
      .select()
      .from(trainingProviders)
      .where(eq(trainingProviders.ownerUserId, ownerUserId))
      .orderBy(desc(trainingProviders.createdAt));
  }

  async updateTrainingProvider(
    id: string, ownerUserId: string, patch: Partial<InsertTrainingProvider>,
  ): Promise<TrainingProvider | undefined> {
    // Owner-scoped edit; any content change resets the provider to `pending`
    // so admins re-approve before it re-enters the public directory.
    const [row] = await db
      .update(trainingProviders)
      .set({ ...patch, status: "pending" })
      .where(and(eq(trainingProviders.id, id), eq(trainingProviders.ownerUserId, ownerUserId)))
      .returning();
    return row;
  }

  async setTrainingProviderStatus(id: string, status: TrainingProviderStatus): Promise<TrainingProvider | undefined> {
    const [row] = await db
      .update(trainingProviders)
      .set({ status })
      .where(eq(trainingProviders.id, id))
      .returning();
    return row;
  }

  async setTrainingProviderSponsorship(
    id: string, sponsored: boolean, sponsoredWeight: number,
  ): Promise<TrainingProvider | undefined> {
    const [row] = await db
      .update(trainingProviders)
      .set({ sponsored, sponsoredWeight })
      .where(eq(trainingProviders.id, id))
      .returning();
    return row;
  }

  async createTrainingCourse(input: InsertTrainingCourse): Promise<TrainingCourse> {
    const [row] = await db.insert(trainingCourses).values(input).returning();
    return row;
  }

  async getTrainingCourseById(id: string): Promise<TrainingCourse | undefined> {
    const [row] = await db.select().from(trainingCourses).where(eq(trainingCourses.id, id));
    return row;
  }

  async listTrainingCoursesByProvider(providerId: string): Promise<TrainingCourse[]> {
    return db
      .select()
      .from(trainingCourses)
      .where(eq(trainingCourses.providerId, providerId))
      .orderBy(desc(trainingCourses.createdAt));
  }

  async listTrainingCoursesForProviders(providerIds: string[]): Promise<TrainingCourse[]> {
    if (providerIds.length === 0) return [];
    return db.select().from(trainingCourses).where(inArray(trainingCourses.providerId, providerIds));
  }

  async deleteTrainingCourse(id: string): Promise<void> {
    await db.delete(trainingCourses).where(eq(trainingCourses.id, id));
  }

  async recordTrainingClick(input: InsertTrainingClick): Promise<TrainingClick> {
    const [row] = await db.insert(trainingClicks).values(input).returning();
    return row;
  }

  async getTrainingClickStats(): Promise<Record<string, { views: number; clicks: number }>> {
    const rows = await db
      .select({
        providerId: trainingClicks.providerId,
        kind: trainingClicks.kind,
        n: sql<number>`count(*)::int`,
      })
      .from(trainingClicks)
      .groupBy(trainingClicks.providerId, trainingClicks.kind);
    const out: Record<string, { views: number; clicks: number }> = {};
    for (const r of rows) {
      const bucket = (out[r.providerId] ??= { views: 0, clicks: 0 });
      if (r.kind === "view") bucket.views += r.n;
      else bucket.clicks += r.n;
    }
    return out;
  }

  // ── ARK Matchmaking Engine ──────────────────────────────────────────
  async createOpportunity(
    input: InsertOpportunity,
    requirements: Omit<InsertOpportunityRequirement, "opportunityId">[],
  ): Promise<{ opportunity: Opportunity; requirements: OpportunityRequirement[] }> {
    return await db.transaction(async (tx) => {
      const [opportunity] = await tx.insert(opportunities).values(input).returning();
      let reqs: OpportunityRequirement[] = [];
      if (requirements.length > 0) {
        reqs = await tx
          .insert(opportunityRequirements)
          .values(requirements.map((r) => ({ ...r, opportunityId: opportunity.id })))
          .returning();
      }
      return { opportunity, requirements: reqs };
    });
  }

  async listOpportunities(filter?: { type?: string; status?: string }): Promise<Opportunity[]> {
    const conds = [];
    if (filter?.type) conds.push(eq(opportunities.type, filter.type));
    if (filter?.status) conds.push(eq(opportunities.status, filter.status));
    const where = conds.length ? and(...conds) : undefined;
    return await db
      .select()
      .from(opportunities)
      .where(where as any)
      .orderBy(desc(opportunities.createdAt));
  }

  async getOpportunity(
    id: string,
  ): Promise<{ opportunity: Opportunity; requirements: OpportunityRequirement[] } | undefined> {
    const [opportunity] = await db.select().from(opportunities).where(eq(opportunities.id, id));
    if (!opportunity) return undefined;
    const reqs = await db
      .select()
      .from(opportunityRequirements)
      .where(eq(opportunityRequirements.opportunityId, id));
    return { opportunity, requirements: reqs };
  }

  async getRequirementsForOpportunities(opportunityIds: string[]): Promise<OpportunityRequirement[]> {
    if (opportunityIds.length === 0) return [];
    return await db
      .select()
      .from(opportunityRequirements)
      .where(inArray(opportunityRequirements.opportunityId, opportunityIds));
  }

  async upsertApplication(input: InsertOpportunityApplication): Promise<OpportunityApplication> {
    const [row] = await db
      .insert(opportunityApplications)
      .values(input)
      .onConflictDoUpdate({
        target: [opportunityApplications.opportunityId, opportunityApplications.userId],
        set: { matchScore: input.matchScore ?? 0, status: input.status ?? "INTERESTED" },
      })
      .returning();
    return row;
  }

  async getApplicationsForUser(userId: string): Promise<OpportunityApplication[]> {
    return await db
      .select()
      .from(opportunityApplications)
      .where(eq(opportunityApplications.userId, userId))
      .orderBy(desc(opportunityApplications.createdAt));
  }

  async getVerifiedCards(userId: string): Promise<{ cardId: string; tier: string }[]> {
    const rows = await db
      .select({ cardId: cardVerifications.cardId, tier: cardVerifications.tier })
      .from(cardVerifications)
      .where(and(eq(cardVerifications.userId, userId), isNotNull(cardVerifications.tier)));
    return rows
      .filter((r): r is { cardId: string; tier: string } => !!r.tier)
      .map((r) => ({ cardId: r.cardId, tier: r.tier }));
  }

  /** Build the candidate pool for team formation: every user who holds at
   *  least one banked verification, with their JST snapshot, archetype inputs
   *  (from their latest assessment) and verified cards. */
  async getCandidatePool(): Promise<MatchCandidateRow[]> {
    const verRows = await db
      .select({ userId: cardVerifications.userId, cardId: cardVerifications.cardId, tier: cardVerifications.tier })
      .from(cardVerifications)
      .where(isNotNull(cardVerifications.tier));
    if (verRows.length === 0) return [];

    const byUser = new Map<string, { cardId: string; tier: string }[]>();
    for (const r of verRows) {
      if (!r.tier) continue;
      if (!byUser.has(r.userId)) byUser.set(r.userId, []);
      byUser.get(r.userId)!.push({ cardId: r.cardId, tier: r.tier });
    }
    const userIds = Array.from(byUser.keys());

    const userRows = await db
      .select({ id: users.id, name: users.name, jstIndex: users.jstIndex })
      .from(users)
      .where(inArray(users.id, userIds));
    const userById = new Map(userRows.map((u) => [u.id, u]));

    // Latest assessment per user (for archetype inputs). Newest first; first seen wins.
    const aRows = await db
      .select({
        userId: assessments.userId,
        architect: assessments.archetypeArchitect,
        orchestrator: assessments.archetypeOrchestrator,
        conductor: assessments.archetypeConductor,
        createdAt: assessments.createdAt,
      })
      .from(assessments)
      .where(inArray(assessments.userId, userIds))
      .orderBy(desc(assessments.createdAt));
    const archByUser = new Map<string, { architect: number; orchestrator: number; conductor: number }>();
    for (const a of aRows) {
      if (!archByUser.has(a.userId)) {
        archByUser.set(a.userId, {
          architect: a.architect ?? 0,
          orchestrator: a.orchestrator ?? 0,
          conductor: a.conductor ?? 0,
        });
      }
    }

    const pool: MatchCandidateRow[] = [];
    for (const uid of userIds) {
      const u = userById.get(uid);
      if (!u) continue;
      const arch = archByUser.get(uid) ?? { architect: 0, orchestrator: 0, conductor: 0 };
      pool.push({
        userId: uid,
        name: u.name,
        jstIndex: u.jstIndex ?? 0,
        archetypeArchitect: arch.architect,
        archetypeOrchestrator: arch.orchestrator,
        archetypeConductor: arch.conductor,
        verifications: byUser.get(uid) ?? [],
      });
    }
    return pool;
  }
}

export const storage = new DatabaseStorage();
