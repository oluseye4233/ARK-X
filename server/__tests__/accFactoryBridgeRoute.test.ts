import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "http";
import { generateKeyPairSync } from "crypto";
import express from "express";
import { registerRoutes } from "../routes";
import { storage } from "../storage";

const USER_ID = "ark-user-bridge-test";
const PRIVATE_KEY_ENV = "ARK_X_ACC_FACTORY_PRIVATE_KEY";
const KID_ENV = "ARK_X_ACC_FACTORY_KID";

let server: Server;
let baseUrl: string;
let evidence: any[] = [];
let verificationSpy: ReturnType<typeof mock.method>;
let previousPrivateKey: string | undefined;
let previousKid: string | undefined;

function jwtPart(assertion: string, index: number) {
  return JSON.parse(Buffer.from(assertion.split(".")[index], "base64url").toString("utf8"));
}

before(async () => {
  previousPrivateKey = process.env[PRIVATE_KEY_ENV];
  previousKid = process.env[KID_ENV];
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env[PRIVATE_KEY_ENV] = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env[KID_ENV] = "ark-x-acc-factory-test-1";

  const app = express();
  app.use((req, _res, next) => {
    if (req.headers["x-test-user"] === "authenticated") {
      (req as any).session = { userId: USER_ID };
    }
    next();
  });
  server = await registerRoutes(createServer(app), app);
  verificationSpy = mock.method(storage, "getCardVerifications", async () => evidence as any);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No listening address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  verificationSpy.mock.restore();
  if (previousPrivateKey === undefined) delete process.env[PRIVATE_KEY_ENV];
  else process.env[PRIVATE_KEY_ENV] = previousPrivateKey;
  if (previousKid === undefined) delete process.env[KID_ENV];
  else process.env[KID_ENV] = previousKid;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function requestEligibility() {
  return fetch(`${baseUrl}/api/acc-factory/eligibility`, {
    method: "POST",
    headers: { "x-test-user": "authenticated" },
  });
}

test("ACC-FACTORY eligibility requires an authenticated ARK session", async () => {
  const response = await fetch(`${baseUrl}/api/acc-factory/eligibility`, { method: "POST" });
  assert.equal(response.status, 401);
});

test("ACC-FACTORY eligibility refuses attempted, low-score, and badge-like evidence", async () => {
  evidence = [
    { status: "attempted", score: 100, tier: "Platinum", badgeUrl: "https://example.test/badge" },
    { status: "verified", score: 79, tier: "Gold", badgeUrl: "https://example.test/badge" },
  ];
  const response = await requestEligibility();
  assert.equal(response.status, 403);
});

for (const tier of ["Gold", "Platinum"]) {
  test(`ACC-FACTORY eligibility mints a bounded assertion for verified HIVE ${tier}`, async () => {
    evidence = [{ status: "verified", score: tier === "Gold" ? 80 : 90, tier }];
    const response = await requestEligibility();
    assert.equal(response.status, 200);
    const { assertion } = await response.json() as { assertion: string };
    const header = jwtPart(assertion, 0);
    const claims = jwtPart(assertion, 1);
    assert.deepEqual(header, { alg: "RS256", typ: "JWT", kid: "ark-x-acc-factory-test-1" });
    assert.equal(claims.iss, "ark-x");
    assert.equal(claims.aud, "acc-factory");
    assert.equal(claims.sub, USER_ID);
    assert.equal(claims.eligibility, "hive_gold");
    assert.equal(claims.discountPercent, 50);
    assert.equal(claims.version, 1);
    assert.match(claims.jti, /^[0-9a-f-]{36}$/);
    assert.equal(claims.exp - claims.iat, 300);
    assert.ok(claims.exp > Math.floor(Date.now() / 1000));
    assert.equal(assertion.split(".").length, 3);
  });
}

test("ACC-FACTORY bridge fails closed when its dedicated signing configuration is absent", async () => {
  evidence = [{ status: "verified", score: 90, tier: "Platinum" }];
  delete process.env[PRIVATE_KEY_ENV];
  const response = await requestEligibility();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).message, "ACC-FACTORY eligibility bridge is not configured.");
  // Restore for any concurrently registered assertions in this suite.
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env[PRIVATE_KEY_ENV] = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
});