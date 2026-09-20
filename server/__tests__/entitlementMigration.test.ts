import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../db";

const migration = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0027_entitlement_provenance.sql"),
  "utf8",
);
const correction = fs.readFileSync(
  path.resolve(process.cwd(), "migrations/0028_entitlement_provenance_correction.sql"),
  "utf8",
);

test("entitlement migrations verify only independently evidenced contracts and are repeatable", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE users (
        id text PRIMARY KEY,
        subscription_plan text,
        stripe_subscription_id text
      );
      CREATE TEMP TABLE billing_events (
        user_id text NOT NULL,
        type text NOT NULL,
        to_plan text,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      INSERT INTO users (id, subscription_plan, stripe_subscription_id) VALUES
        ('legacy-enterprise', 'ENTERPRISE', NULL),
        ('proven-enterprise', 'ENTERPRISE', NULL),
        ('legacy-stub', 'INDIVIDUAL_PRO', 'sub_stub_legacy'),
        ('legacy-unknown', 'INDIVIDUAL_PRO', 'sub_arbitrary');
      INSERT INTO billing_events (user_id, type, to_plan, payload) VALUES
        (
          'proven-enterprise',
          'subscription.upgraded',
          'ENTERPRISE',
          '{"source":"admin.enterprise.provision"}'::jsonb
        );
    `);

    await client.query(migration);
    let { rows } = await client.query(`
      SELECT id, entitlement_source, entitlement_verification_status
      FROM users
      ORDER BY id
    `);
    assert.deepEqual(rows, [
      {
        id: "legacy-enterprise",
        entitlement_source: "unverified",
        entitlement_verification_status: "unverified",
      },
      {
        id: "legacy-stub",
        entitlement_source: "unverified",
        entitlement_verification_status: "unverified",
      },
      {
        id: "legacy-unknown",
        entitlement_source: "unverified",
        entitlement_verification_status: "unverified",
      },
      {
        id: "proven-enterprise",
        entitlement_source: "contract",
        entitlement_verification_status: "verified",
      },
    ]);

    // Reproduce the unsafe classification written by the original migration,
    // then prove the corrective migration removes it without touching evidence.
    await client.query(`
      UPDATE users
      SET entitlement_source = 'contract',
          entitlement_verification_status = 'verified'
      WHERE id = 'legacy-enterprise'
    `);
    await client.query(correction);
    await client.query(correction);

    ({ rows } = await client.query(`
      SELECT id, entitlement_source, entitlement_verification_status
      FROM users
      WHERE id IN ('legacy-enterprise', 'proven-enterprise')
      ORDER BY id
    `));
    assert.deepEqual(rows, [
      {
        id: "legacy-enterprise",
        entitlement_source: "unverified",
        entitlement_verification_status: "unverified",
      },
      {
        id: "proven-enterprise",
        entitlement_source: "contract",
        entitlement_verification_status: "verified",
      },
    ]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});