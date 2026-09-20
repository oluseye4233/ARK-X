import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import { registerRoutes } from "../routes";

const originalAdminUserId = process.env.ADMIN_USER_ID;
const originalNodeEnv = process.env.NODE_ENV;
let server: Server;
let baseUrl = "";

async function request(userId?: string) {
  return fetch(`${baseUrl}/api/seed`, {
    method: "POST",
    headers: userId ? { "x-test-user-id": userId } : undefined,
  });
}

before(async () => {
  process.env.ADMIN_USER_ID = "seed-route-admin";
  process.env.NODE_ENV = "test";

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user-id");
    (req as any).session = userId ? { userId } : {};
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
  if (originalAdminUserId === undefined) delete process.env.ADMIN_USER_ID;
  else process.env.ADMIN_USER_ID = originalAdminUserId;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

test("seed endpoint rejects unauthenticated callers before any mutation", async () => {
  const response = await request();
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: "Authentication required." });
});

test("seed endpoint rejects authenticated non-admin callers before any mutation", async () => {
  const response = await request("ordinary-user");
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { message: "Admin only." });
});

test("seed endpoint remains disabled in production, including for the configured admin", async () => {
  process.env.NODE_ENV = "production";
  try {
    const response = await request("seed-route-admin");
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { message: "Forbidden" });
  } finally {
    process.env.NODE_ENV = "test";
  }
});