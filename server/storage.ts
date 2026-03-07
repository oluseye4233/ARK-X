import { db } from "./db";
import { eq } from "drizzle-orm";
import {
  users, type User, type InsertUser,
  assessments, type Assessment, type InsertAssessment,
  upskillingPlans, type UpskillingPlan, type InsertUpskillingPlan,
  pivotOpportunities, type PivotOpportunity, type InsertPivotOpportunity,
  transferabilityVectors, type TransferabilityVector, type InsertTransferabilityVector,
  jnomicsCards, type JnomicsCard, type InsertJnomicsCard,
  departments, type Department, type InsertDepartment,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createAssessment(assessment: InsertAssessment): Promise<Assessment>;
  getAssessmentsByUser(userId: string): Promise<Assessment[]>;
  getLatestAssessment(userId: string): Promise<Assessment | undefined>;

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
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [created] = await db.insert(assessments).values(assessment).returning();
    return created;
  }

  async getAssessmentsByUser(userId: string): Promise<Assessment[]> {
    return db.select().from(assessments).where(eq(assessments.userId, userId));
  }

  async getLatestAssessment(userId: string): Promise<Assessment | undefined> {
    const results = await db
      .select()
      .from(assessments)
      .where(eq(assessments.userId, userId))
      .orderBy(assessments.createdAt)
      .limit(1);
    return results[0];
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
}

export const storage = new DatabaseStorage();