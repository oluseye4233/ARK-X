import { after, before, beforeEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import { registerRoutes } from "../routes";
import { DatabaseStorage, storage } from "../storage";
import { db } from "../db";
import { inArray } from "drizzle-orm";
import {
  assessmentSources,
  billingEvents,
  cardVerifications,
  confirmationInvites,
  guinMaxProfiles,
  matchmakingIntroductions,
  reportShares,
  skillConfirmations,
  users,
  verificationDocuments,
  type Assessment,
  type ReportShare,
  type User,
} from "@shared/schema";

const OWNER_ID = "privacy-owner";
const OTHER_ID = "privacy-other";
const NOW = new Date();
const owner = {
  id: OWNER_ID,
  username: "owner@example.test",
  password: "owner-password-hash",
  name: "Report Owner",
  role: "Analyst",
  subscriptionPlan: "INDIVIDUAL_PRO",
  arkScore: 400,
  jstIndex: 200,
  ccmi: 100,
  ccmiTier: "T2",
  vmstLevel: "L2",
  typology: "Conductor",
  arkIdString: "ARK-PRIVATE",
  cprScore: 60,
  mpsScore: 61,
  lcisScore: 62,
  lhcsStatus: "green",
  resumeReplacementPct: 70,
} as User;
const privateAssessment = {
  id: "assessment-private-id",
  userId: OWNER_ID,
  jstTotal: 200,
  jstJobs: 60,
  jstSkills: 70,
  jstTalent: 70,
  vulnerabilityLevel: 2,
  readinessProfile: "Conductor",
  candidateName: "Report Owner",
  currentEmployer: "Example Corp",
  currentRole: "Analyst",
  contactEmail: "private@example.test",
  contactPhone: "+1-private",
  linkLinkedin: "https://private.test/linkedin",
  linkGithub: "https://private.test/github",
  linkPortfolio: "https://private.test/portfolio",
  workHistory: [{ company: "Private Employer", role: "Secret Role" }],
  sourcesUsed: ["resume"],
  createdAt: NOW,
} as unknown as Assessment;

let server: Server;
let baseUrl = "";
let sessionUserId: string | undefined;
let shares = new Map<string, ReportShare>();
let deleted = new Set<string>();
let spies: Array<ReturnType<typeof mock.method>> = [];

function share(token: string, overrides: Partial<ReportShare> = {}): ReportShare {
  return {
    id: `share-${token}`,
    token,
    userId: OWNER_ID,
    revoked: false,
    createdAt: NOW,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

async function request(path: string, init: RequestInit = {}, userId?: string) {
  sessionUserId = userId;
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = {
      userId: sessionUserId,
      destroy(callback: () => void) { sessionUserId = undefined; callback(); },
    };
    next();
  });
  server = await registerRoutes(createServer(app), app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No ephemeral test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  for (const spy of spies) spy.mock.restore();
  spies = [];
  shares = new Map();
  deleted = new Set();
  spies.push(mock.method(storage, "getUser", async (id: string) =>
    id === OWNER_ID ? owner : id === OTHER_ID ? { ...owner, id: OTHER_ID, username: "other@example.test" } : undefined,
  ));
  spies.push(mock.method(storage, "getCcmiPillars", async () => undefined));
  spies.push(mock.method(storage, "getLhcsSignals", async () => undefined));
  spies.push(mock.method(storage, "getLatestAssessment", async (id: string) =>
    id === OWNER_ID ? privateAssessment : undefined,
  ));
  spies.push(mock.method(storage, "getReportShareByToken", async (token: string) => shares.get(token)));
  spies.push(mock.method(storage, "createReportShare", async (userId: string) => {
    const made = share(`token-${userId}`, { userId });
    shares.set(made.token, made);
    return made;
  }));
  spies.push(mock.method(storage, "revokeReportShare", async (userId: string) => {
    for (const [token, row] of shares) {
      if (row.userId === userId) shares.set(token, { ...row, revoked: true });
    }
  }));
  spies.push(mock.method(storage, "exportUserData", async (userId: string) => ({
    user: { id: userId, username: `${userId}@example.test` },
  })));
  spies.push(mock.method(storage, "deleteUserCascade", async (userId: string) => {
    if (deleted.has(userId)) {
      const error: any = new Error("User not found");
      error.status = 404;
      throw error;
    }
    deleted.add(userId);
    return { deletedTables: { users: 1 } };
  }));
});

after(async () => {
  for (const spy of spies) spy.mock.restore();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("share creation and revocation are scoped only to the authenticated owner", async () => {
  const created = await request("/api/report/share", {
    method: "POST",
    body: JSON.stringify({ userId: OTHER_ID }),
  }, OWNER_ID);
  assert.equal(created.status, 200);
  assert.equal((await created.json()).token, `token-${OWNER_ID}`);

  shares.set("other-token", share("other-token", { userId: OTHER_ID }));
  const revoked = await request("/api/report/share?userId=privacy-other", { method: "DELETE" }, OWNER_ID);
  assert.equal(revoked.status, 200);
  assert.equal(shares.get(`token-${OWNER_ID}`)?.revoked, true);
  assert.equal(shares.get("other-token")?.revoked, false);
  assert.equal((await request("/api/report/share", { method: "POST" })).status, 401);
});

test("invalid, revoked, and expired public tokens return the same data-free 404", async () => {
  shares.set("revoked", share("revoked", { revoked: true }));
  shares.set("expired", share("expired", { expiresAt: new Date(Date.now() - 1) }));
  for (const token of ["invalid", "revoked", "expired"]) {
    const response = await request(`/api/report/shared/${token}`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.deepEqual(body, { message: "This report link is no longer available." });
    assert.equal(JSON.stringify(body).includes(OWNER_ID), false);
  }
});

test("public report DTO excludes account secrets and private profile fields", async () => {
  shares.set("valid", share("valid"));
  const response = await request("/api/report/shared/valid");
  assert.equal(response.status, 200);
  const body = await response.json();
  const serialized = JSON.stringify(body);
  for (const secret of [
    owner.username, owner.password, OWNER_ID, privateAssessment.id,
    privateAssessment.contactEmail, privateAssessment.contactPhone,
    privateAssessment.linkLinkedin, privateAssessment.linkGithub,
    privateAssessment.linkPortfolio, "Private Employer", "Secret Role",
  ]) {
    assert.equal(serialized.includes(String(secret)), false, `leaked ${secret}`);
  }
  for (const key of ["password", "username", "userId", "contactEmail", "contactPhone", "workHistory", "sourcesUsed"]) {
    assert.equal(serialized.includes(`"${key}"`), false, `leaked key ${key}`);
  }
  assert.equal(body.assessment.currentEmployer, "Example Corp");
  assert.equal(body.assessment.readinessProfile, "Conductor");
});

test("export ignores cross-user selectors and requires authentication", async () => {
  const response = await request(`/api/users/me/export?userId=${OTHER_ID}`, {
    headers: { "x-user-id": OTHER_ID },
  }, OWNER_ID);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.id, OWNER_ID);
  assert.equal((await request("/api/users/me/export")).status, 401);
});

test("database export includes newer user-owned records and redacts secrets", async () => {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const ownerId = `privacy-export-owner-${nonce}`;
  const otherId = `privacy-export-other-${nonce}`;
  const userIds = [ownerId, otherId];
  const storageUnderTest = new DatabaseStorage();

  try {
    await db.insert(users).values([
      { id: ownerId, username: `${ownerId}@example.test`, password: "owner-secret-hash", name: "Export Owner" },
      { id: otherId, username: `${otherId}@example.test`, password: "other-secret-hash", name: "Other User" },
    ]);
    await db.insert(assessmentSources).values([
      { id: `source-owner-${nonce}`, userId: ownerId, source: "resume", content: "owner resume source" },
      { id: `source-other-${nonce}`, userId: otherId, source: "resume", content: "other resume source" },
    ]);
    await db.insert(cardVerifications).values({
      id: `verification-${nonce}`, userId: ownerId, cardId: `codec-${nonce}`,
      score: 88, tier: "Gold", status: "verified", submissions: [],
    });
    await db.insert(verificationDocuments).values({
      id: `document-${nonce}`, userId: ownerId, cardId: `codec-${nonce}`,
      kind: "CERTIFICATION", fileName: "certificate.pdf", mimeType: "application/pdf",
      label: "Owner evidence", dataUrl: "data:application/pdf;base64,T1dORVI=",
    });
    await db.insert(guinMaxProfiles).values({
      id: `guin-${nonce}`, userId: ownerId, discoveryOptIn: true,
      adultAttested: true, available: true, selectedTier: "Gold",
    });
    await db.insert(matchmakingIntroductions).values({
      id: `introduction-${nonce}`, opportunityId: `opportunity-${nonce}`,
      employerId: otherId, candidateId: ownerId, status: "PENDING",
      cxs: 91, scoreSnapshot: { owner: true }, evidence: [],
    });
    await db.insert(skillConfirmations).values({
      id: `confirmation-${nonce}`, userId: ownerId, type: "SKILL",
      targetRef: `codec-${nonce}`, targetLabel: "Owner skill", status: "CONFIRMED",
      confirmerUserId: otherId, confirmerOrg: "Example Org",
    });
    await db.insert(billingEvents).values({
      id: `billing-${nonce}`, userId: ownerId, type: "subscription.upgraded",
      payload: { actorAdminId: otherId, accountUserId: ownerId },
    });
    await db.insert(reportShares).values({
      id: `share-${nonce}`, userId: ownerId, token: `report-secret-${nonce}`,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db.insert(confirmationInvites).values({
      id: `invite-${nonce}`, token: `invite-secret-${nonce}`, userId: ownerId,
      type: "SKILL", targetRef: `codec-${nonce}`, recipientEmail: "recipient@example.test",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const archive = await storageUnderTest.exportUserData(ownerId);
    assert.equal(archive.schemaVersion, "2.0");
    assert.equal(archive.assessmentSources[0].content, "owner resume source");
    assert.equal(archive.cardVerifications[0].score, 88);
    assert.equal(archive.verificationDocuments[0].dataUrl, "data:application/pdf;base64,T1dORVI=");
    assert.equal(archive.guinMaxProfiles[0].selectedTier, "Gold");
    assert.equal(archive.matchmakingIntroductions[0].candidateId, ownerId);
    assert.equal(archive.matchmakingIntroductions[0].employerId, "[redacted-other-user]");
    assert.equal(archive.skillConfirmations[0].targetLabel, "Owner skill");
    assert.equal(archive.skillConfirmations[0].confirmerUserId, "[redacted-other-user]");
    assert.equal(archive.billingEvents[0].payload.actorAdminId, "[redacted-other-user]");
    assert.equal(archive.billingEvents[0].payload.accountUserId, ownerId);
    assert.equal(archive.reportShares[0].id, `share-${nonce}`);
    assert.equal(archive.confirmationInvites[0].id, `invite-${nonce}`);
    assert.equal(archive.assessmentSources.some((row: any) => row.userId === otherId), false);

    const serialized = JSON.stringify(archive);
    for (const secret of ["owner-secret-hash", `report-secret-${nonce}`, `invite-secret-${nonce}`, otherId]) {
      assert.equal(serialized.includes(secret), false, `export leaked ${secret}`);
    }
    assert.ok(archive.intentionalExclusions.sharedReferenceData.includes("aiCache"));
  } finally {
    await db.delete(billingEvents).where(inArray(billingEvents.userId, userIds));
    await db.delete(confirmationInvites).where(inArray(confirmationInvites.userId, userIds));
    await db.delete(reportShares).where(inArray(reportShares.userId, userIds));
    await db.delete(skillConfirmations).where(inArray(skillConfirmations.userId, userIds));
    await db.delete(matchmakingIntroductions).where(inArray(matchmakingIntroductions.candidateId, userIds));
    await db.delete(guinMaxProfiles).where(inArray(guinMaxProfiles.userId, userIds));
    await db.delete(verificationDocuments).where(inArray(verificationDocuments.userId, userIds));
    await db.delete(cardVerifications).where(inArray(cardVerifications.userId, userIds));
    await db.delete(assessmentSources).where(inArray(assessmentSources.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
});

test("deletion ignores cross-user selectors, requires confirmation, and retries safely", async () => {
  assert.equal((await request(`/api/users/me?userId=${OTHER_ID}`, { method: "DELETE" }, OWNER_ID)).status, 400);
  const first = await request(`/api/users/me?userId=${OTHER_ID}`, {
    method: "DELETE",
    body: JSON.stringify({ confirm: "DELETE", userId: OTHER_ID }),
  }, OWNER_ID);
  assert.equal(first.status, 200);
  assert.equal(deleted.has(OWNER_ID), true);
  assert.equal(deleted.has(OTHER_ID), false);

  const retry = await request("/api/users/me?confirm=DELETE", { method: "DELETE" }, OWNER_ID);
  assert.equal(retry.status, 404);
  assert.deepEqual(await retry.json(), { message: "User not found" });
  assert.equal(deleted.has(OTHER_ID), false);
});