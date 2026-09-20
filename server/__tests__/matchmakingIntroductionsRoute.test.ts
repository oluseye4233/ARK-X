import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import { inArray } from "drizzle-orm";
import { db } from "../db";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import {
  cardVerifications,
  guinMaxProfiles,
  matchmakingIntroductions,
  opportunities,
  opportunityApplications,
  opportunityRequirements,
  users,
} from "@shared/schema";

const CARD_ID = "codec-elephant";
const createdUserIds: string[] = [];
const createdOpportunityIds: string[] = [];
let server: Server;
let baseUrl = "";

async function makeUser(label: string) {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const user = await storage.createUser({
    username: `guin-route-${label}-${nonce}@private.test`,
    password: `secret-${nonce}`,
    name: `Guin ${label}`,
    role: null,
    department: null,
    seniority: null,
    location: null,
    contextCraftCertLevel: "NONE",
  });
  createdUserIds.push(user.id);
  return user;
}

async function setProfile(
  userId: string,
  overrides: Partial<{
    discoveryOptIn: boolean;
    adultAttested: boolean;
    available: boolean;
    selectedTier: string | null;
    region: string | null;
    language: string | null;
  }> = {},
) {
  return storage.upsertGuinMaxProfile(userId, {
    discoveryOptIn: true,
    adultAttested: true,
    available: true,
    selectedTier: "Bronze",
    region: null,
    language: "en",
    ...overrides,
  });
}

async function setEvidence(userId: string, tier: string | null = "Bronze", status = "verified") {
  await db.insert(cardVerifications).values({
    userId,
    cardId: CARD_ID,
    score: status === "verified" ? 80 : 20,
    tier,
    status,
    submissions: [],
  }).onConflictDoUpdate({
    target: [cardVerifications.userId, cardVerifications.cardId],
    set: { tier, status, updatedAt: new Date() },
  });
}

async function makeOpportunity(ownerId: string, status = "OPEN") {
  const made = await storage.createOpportunity({
    type: "JOB",
    title: "Verified Systems Builder",
    organization: "Context Works",
    description: "Evidence-based role",
    location: null,
    remote: true,
    archetypePreference: null,
    jstFloor: 0,
    status,
    createdBy: ownerId,
  }, [{ cardId: CARD_ID, minTier: "Bronze", weight: 1, roleLabel: null }]);
  createdOpportunityIds.push(made.opportunity.id);
  return made.opportunity;
}

async function request(userId: string, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "x-test-user-id": userId,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function createIntroduction(ownerId: string, opportunityId: string, candidateId: string) {
  const response = await request(ownerId, `/api/matchmaking/opportunities/${opportunityId}/introductions`, {
    method: "POST",
    body: JSON.stringify({ candidateId }),
  });
  const text = await response.text();
  assert.equal(response.status, 201, text);
  return JSON.parse(text).introduction as { id: string };
}

before(async () => {
  await db.execute("select 1");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { userId: req.header("x-test-user-id") };
    next();
  });
  server = await registerRoutes(createServer(app), app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No ephemeral test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (createdOpportunityIds.length) {
    await db.delete(matchmakingIntroductions).where(inArray(matchmakingIntroductions.opportunityId, createdOpportunityIds));
    await db.delete(opportunityApplications).where(inArray(opportunityApplications.opportunityId, createdOpportunityIds));
    await db.delete(opportunityRequirements).where(inArray(opportunityRequirements.opportunityId, createdOpportunityIds));
    await db.delete(opportunities).where(inArray(opportunities.id, createdOpportunityIds));
  }
  if (createdUserIds.length) {
    await db.delete(cardVerifications).where(inArray(cardVerifications.userId, createdUserIds));
    await db.delete(guinMaxProfiles).where(inArray(guinMaxProfiles.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

test("only the open opportunity owner can review consented, available, tier-qualified, verified candidates", async () => {
  const owner = await makeUser("owner");
  const stranger = await makeUser("stranger");
  const eligible = await makeUser("eligible");
  const optedOut = await makeUser("opted-out");
  const unavailable = await makeUser("unavailable");
  const underTier = await makeUser("under-tier");
  const unverified = await makeUser("unverified");
  const opportunity = await makeOpportunity(owner.id);

  await Promise.all([
    setProfile(eligible.id),
    setProfile(optedOut.id, { discoveryOptIn: false }),
    setProfile(unavailable.id, { available: false }),
    setProfile(underTier.id, { selectedTier: "Gold" }),
    setProfile(unverified.id),
  ]);
  await Promise.all([
    setEvidence(eligible.id),
    setEvidence(optedOut.id),
    setEvidence(unavailable.id),
    setEvidence(underTier.id, "Bronze"),
    setEvidence(unverified.id, "Bronze", "attempted"),
  ]);

  const denied = await request(stranger.id, `/api/matchmaking/opportunities/${opportunity.id}/candidates`);
  assert.equal(denied.status, 403);

  const response = await request(owner.id, `/api/matchmaking/opportunities/${opportunity.id}/candidates`);
  assert.equal(response.status, 200);
  const body = await response.json();
  const candidateIds = body.candidates.map((candidate: any) => candidate.candidateId);
  assert.equal(candidateIds.includes(eligible.id), true);
  for (const excluded of [optedOut.id, unavailable.id, underTier.id, unverified.id]) {
    assert.equal(candidateIds.includes(excluded), false);
  }
});

test("candidate inbox includes opportunity context but excludes contact and private account data", async () => {
  const owner = await makeUser("inbox-owner");
  const candidate = await makeUser("inbox-candidate");
  await setProfile(candidate.id);
  await setEvidence(candidate.id);
  const opportunity = await makeOpportunity(owner.id);
  await createIntroduction(owner.id, opportunity.id, candidate.id);

  const response = await request(candidate.id, "/api/matchmaking/introductions/candidate");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.length, 1);
  assert.deepEqual(body[0].opportunity, {
    title: opportunity.title,
    type: opportunity.type,
    organization: opportunity.organization,
    location: null,
    remote: true,
  });
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes(owner.username), false);
  assert.equal(serialized.includes(owner.password), false);
  assert.equal(serialized.includes(candidate.username), false);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("username"), false);
});

test("acceptance is cancelled when consent is revoked after the request", async () => {
  const owner = await makeUser("consent-owner");
  const candidate = await makeUser("consent-candidate");
  await setProfile(candidate.id);
  await setEvidence(candidate.id);
  const opportunity = await makeOpportunity(owner.id);
  const introduction = await createIntroduction(owner.id, opportunity.id, candidate.id);
  await setProfile(candidate.id, { discoveryOptIn: false });

  const response = await request(candidate.id, `/api/matchmaking/introductions/${introduction.id}/accept`, { method: "POST" });
  assert.equal(response.status, 409);
  const stored = await storage.getMatchmakingIntroduction(introduction.id);
  assert.equal(stored?.status, "CANCELLED");
});

test("acceptance is cancelled when verified evidence is revoked after the request", async () => {
  const owner = await makeUser("evidence-owner");
  const candidate = await makeUser("evidence-candidate");
  await setProfile(candidate.id);
  await setEvidence(candidate.id);
  const opportunity = await makeOpportunity(owner.id);
  const introduction = await createIntroduction(owner.id, opportunity.id, candidate.id);
  await setEvidence(candidate.id, "Bronze", "attempted");

  const response = await request(candidate.id, `/api/matchmaking/introductions/${introduction.id}/accept`, { method: "POST" });
  assert.equal(response.status, 409);
  const stored = await storage.getMatchmakingIntroduction(introduction.id);
  assert.equal(stored?.status, "CANCELLED");
});

test("concurrent terminal actions produce exactly one winner and cannot overwrite it", async () => {
  const owner = await makeUser("race-owner");
  const candidate = await makeUser("race-candidate");
  await setProfile(candidate.id);
  await setEvidence(candidate.id);
  const opportunity = await makeOpportunity(owner.id);
  const introduction = await createIntroduction(owner.id, opportunity.id, candidate.id);

  const [accepted, declined] = await Promise.all([
    request(candidate.id, `/api/matchmaking/introductions/${introduction.id}/accept`, { method: "POST" }),
    request(candidate.id, `/api/matchmaking/introductions/${introduction.id}/decline`, { method: "POST" }),
  ]);
  assert.deepEqual([accepted.status, declined.status].sort((a, b) => a - b), [200, 409]);
  const stored = await storage.getMatchmakingIntroduction(introduction.id);
  assert.ok(stored?.status === "ACCEPTED" || stored?.status === "DECLINED");

  const retry = await request(owner.id, `/api/matchmaking/introductions/${introduction.id}/cancel`, { method: "POST" });
  assert.equal(retry.status, 404);
  assert.equal((await storage.getMatchmakingIntroduction(introduction.id))?.status, stored?.status);
});

test("closed opportunities reject review, introductions, and applications", async () => {
  const owner = await makeUser("closed-owner");
  const candidate = await makeUser("closed-candidate");
  await setProfile(candidate.id);
  await setEvidence(candidate.id);
  const opportunity = await makeOpportunity(owner.id, "CLOSED");

  assert.equal((await request(owner.id, `/api/matchmaking/opportunities/${opportunity.id}/candidates`)).status, 403);
  assert.equal((await request(owner.id, `/api/matchmaking/opportunities/${opportunity.id}/introductions`, {
    method: "POST",
    body: JSON.stringify({ candidateId: candidate.id }),
  })).status, 403);
  assert.equal((await request(candidate.id, `/api/matchmaking/opportunities/${opportunity.id}/apply`, { method: "POST" })).status, 409);
});

test("an opportunity owner cannot apply to their own open opportunity", async () => {
  const owner = await makeUser("self-owner");
  const opportunity = await makeOpportunity(owner.id);
  const response = await request(owner.id, `/api/matchmaking/opportunities/${opportunity.id}/apply`, { method: "POST" });
  assert.equal(response.status, 403);
});