import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import { inArray } from "drizzle-orm";
import { discoverGuinMax, isGuinMaxEligible } from "../guinMax";
import { db } from "../db";
import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { cardVerifications, guinMaxMatchRequests, guinMaxProfiles, users } from "@shared/schema";

const search = { needs: [{ cardId: "codec-system", minTier: "Bronze" }], requesterArchetype: "ARCHITECT" as const };
const base = (userId: string) => ({
  userId, name: userId, optIn: true, adultAttested: true, available: true,
  selectedTier: "Bronze", region: "NG", language: "en", jstIndex: 150,
  archetype: "ORCHESTRATOR" as const, ccmiPillars: [60, 60, 60, 60, 60, 60, 60],
  verifications: [{ cardId: "codec-system", tier: "Bronze", status: "verified" }],
});

test("GUIN MAX is deterministic and ranks stable ties by user id", () => {
  const result = discoverGuinMax([base("z"), base("a")], search, [60, 60, 60, 60, 60, 60, 60]);
  assert.deepEqual(result.map(r => r.userId), ["a", "z"]);
  assert.deepEqual(result, discoverGuinMax([base("z"), base("a")], search, [60, 60, 60, 60, 60, 60, 60]));
});
test("GUIN MAX gates consent, adult attestation, and unverified evidence", () => {
  assert.equal(isGuinMaxEligible({ ...base("x"), optIn: false }, search), false);
  assert.equal(isGuinMaxEligible({ ...base("x"), adultAttested: false }, search), false);
  assert.equal(isGuinMaxEligible({ ...base("x"), available: false }, search), false);
  assert.equal(isGuinMaxEligible({ ...base("x"), verifications: [{ cardId: "codec-system", tier: "Bronze", status: "attempted" }] }, search), false);
  assert.equal(isGuinMaxEligible({ ...base("x"), selectedTier: "self-claimed" }, search), false);
});
test("GUIN MAX returns an honest empty result and no sensitive fields", () => {
  const out = discoverGuinMax([{ ...base("x"), region: "KE" }], { ...search, region: "NG" });
  assert.deepEqual(out, []);
  assert.equal(JSON.stringify(discoverGuinMax([base("x")], search)).includes("email"), false);
});
test("a requested location requires an explicit matching candidate location", () => {
  assert.equal(isGuinMaxEligible({ ...base("x"), region: null }, { ...search, region: "NG" }), false);
});

const CARD_ID = "codec-system";
const createdUserIds: string[] = [];
let server: Server;
let baseUrl = "";

async function makeUser(label: string) {
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const user = await storage.createUser({
    username: `guin-max-${label}-${nonce}@private.test`,
    password: `secret-${nonce}`,
    name: `Guin Max ${label}`,
    role: null,
    department: null,
    seniority: null,
    location: null,
    contextCraftCertLevel: "NONE",
  });
  createdUserIds.push(user.id);
  return user;
}

async function setProfile(userId: string, discoveryOptIn = true) {
  return storage.upsertGuinMaxProfile(userId, {
    discoveryOptIn,
    adultAttested: true,
    available: true,
    selectedTier: "Bronze",
    region: null,
    language: "en",
  });
}

async function setEvidence(userId: string, status = "verified") {
  await db.insert(cardVerifications).values({
    userId, cardId: CARD_ID, score: status === "verified" ? 80 : 20,
    tier: "Bronze", status, submissions: [],
  }).onConflictDoUpdate({
    target: [cardVerifications.userId, cardVerifications.cardId],
    set: { tier: "Bronze", status, updatedAt: new Date() },
  });
}

async function httpRequest(userId: string, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "x-test-user-id": userId,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function makeRequest(requesterId: string, candidateId: string) {
  const response = await httpRequest(requesterId, "/api/guin-max/requests", {
    method: "POST",
    body: JSON.stringify({ candidateId, search: { needs: [{ cardId: CARD_ID, minTier: "Bronze" }] } }),
  });
  const text = await response.text();
  assert.equal(response.status, 201, text);
  return JSON.parse(text) as { id: string };
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
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No ephemeral test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  if (createdUserIds.length) {
    await db.delete(guinMaxMatchRequests).where(inArray(guinMaxMatchRequests.requesterId, createdUserIds));
    await db.delete(cardVerifications).where(inArray(cardVerifications.userId, createdUserIds));
    await db.delete(guinMaxProfiles).where(inArray(guinMaxProfiles.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

async function eligiblePair(label: string) {
  const requester = await makeUser(`${label}-requester`);
  const candidate = await makeUser(`${label}-candidate`);
  await Promise.all([setProfile(requester.id), setProfile(candidate.id)]);
  await Promise.all([setEvidence(requester.id), setEvidence(candidate.id)]);
  return { requester, candidate, request: await makeRequest(requester.id, candidate.id) };
}

test("mentor request acceptance re-checks both parties' current consent", async () => {
  const pair = await eligiblePair("consent");
  await setProfile(pair.requester.id, false);
  const response = await httpRequest(pair.candidate.id, `/api/guin-max/requests/${pair.request.id}/accept`, { method: "POST" });
  assert.equal(response.status, 409);
  assert.equal((await storage.getGuinMaxRequest(pair.request.id))?.status, "CANCELLED");
});

test("mentor request acceptance re-checks current verified evidence", async () => {
  const pair = await eligiblePair("evidence");
  await setEvidence(pair.candidate.id, "attempted");
  const response = await httpRequest(pair.candidate.id, `/api/guin-max/requests/${pair.request.id}/accept`, { method: "POST" });
  assert.equal(response.status, 409);
  assert.equal((await storage.getGuinMaxRequest(pair.request.id))?.status, "CANCELLED");
});

test("only request participants can perform their authorized mentor request actions", async () => {
  const pair = await eligiblePair("authorization");
  const stranger = await makeUser("authorization-stranger");
  for (const action of ["accept", "decline", "cancel"]) {
    const response = await httpRequest(stranger.id, `/api/guin-max/requests/${pair.request.id}/${action}`, { method: "POST" });
    assert.equal(response.status, 403);
  }
  const requesterAccept = await httpRequest(pair.requester.id, `/api/guin-max/requests/${pair.request.id}/accept`, { method: "POST" });
  assert.equal(requesterAccept.status, 403);
  const candidateCancel = await httpRequest(pair.candidate.id, `/api/guin-max/requests/${pair.request.id}/cancel`, { method: "POST" });
  assert.equal(candidateCancel.status, 403);
  assert.equal((await storage.getGuinMaxRequest(pair.request.id))?.status, "PENDING");
});

test("concurrent mentor accept, decline, and cancel actions produce one terminal result", async () => {
  const pair = await eligiblePair("race");
  const responses = await Promise.all([
    httpRequest(pair.candidate.id, `/api/guin-max/requests/${pair.request.id}/accept`, { method: "POST" }),
    httpRequest(pair.candidate.id, `/api/guin-max/requests/${pair.request.id}/decline`, { method: "POST" }),
    httpRequest(pair.requester.id, `/api/guin-max/requests/${pair.request.id}/cancel`, { method: "POST" }),
  ]);
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  assert.equal(responses.filter(response => response.status === 409 || response.status === 404).length, 2);
  const terminal = (await storage.getGuinMaxRequest(pair.request.id))?.status;
  assert.ok(terminal === "ACCEPTED" || terminal === "DECLINED" || terminal === "CANCELLED");
});

test("mentor request inbox and responses exclude contact and sensitive account data", async () => {
  const pair = await eligiblePair("privacy");
  const inbox = await httpRequest(pair.candidate.id, "/api/guin-max/requests");
  assert.equal(inbox.status, 200);
  const inboxText = await inbox.text();
  for (const sensitive of [pair.requester.username, pair.requester.password, pair.candidate.username, pair.requester.id, pair.candidate.id, "username", "password", "requesterId", "candidateId"]) {
    assert.equal(inboxText.includes(sensitive), false);
  }
  const accepted = await httpRequest(pair.candidate.id, `/api/guin-max/requests/${pair.request.id}/accept`, { method: "POST" });
  assert.equal(accepted.status, 200);
  const responseText = await accepted.text();
  assert.equal(responseText.includes(pair.requester.id), false);
  assert.equal(responseText.includes(pair.candidate.id), false);
});