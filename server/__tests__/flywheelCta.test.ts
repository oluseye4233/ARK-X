/**
 * Snapshot-style tests for pickFlywheelCta — one fixture per PDD branch (1..10).
 * Each fixture is built so all earlier branches return null, forcing the engine
 * to land on the targeted branch. Snapshots assert position, id, ctaHref, and
 * urgency so any reordering / wording change surfaces immediately.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFlywheelCta, type FlywheelInput } from "../flywheelCta";
import type { User, LhcsSignals, CcmiPillarScores } from "@shared/schema";

const baseUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "u1",
    username: "u",
    password: "x",
    name: "U",
    role: null,
    department: null,
    seniority: null,
    location: null,
    contextCraftCertLevel: "NONE",
    subscriptionPlan: "INDIVIDUAL_FREE",
    subscriptionStatus: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionCurrentPeriodEnd: null,
    subscriptionCanceledAt: null,
    institution: null,
    uploadsThisMonth: 0,
    uploadResetDate: null,
    arkScore: 0,
    jstIndex: 0,
    ccmi: 0,
    ccmiTier: "T0",
    vmstLevel: "L0",
    typology: null,
    arkIdString: null,
    cprScore: 0,
    mpsScore: 0,
    lcisScore: 0,
    lhcsStatus: "red",
    resumeReplacementPct: 0,
    ...overrides,
  }) as User;

const baseLhcs = (overrides: Partial<LhcsSignals> = {}): LhcsSignals =>
  ({
    id: "l1",
    userId: "u1",
    cprScore: 80,
    mpsScore: 0,
    lcisScore: 80,
    cprLight: "green",
    mpsLight: "red",
    lcisLight: "green",
    status: "amber",
    readinessPct: 60,
    updatedAt: new Date(),
    ...overrides,
  }) as LhcsSignals;

const basePillars = (overrides: Partial<CcmiPillarScores> = {}): CcmiPillarScores =>
  ({
    id: "p1",
    userId: "u1",
    p1: 80, p2: 80, p3: 80, p4: 80, p5: 80, p6: 80, p7: 80,
    composite: 240,
    tier: "T4",
    multiplier: 1.3,
    updatedAt: new Date(),
    ...overrides,
  }) as CcmiPillarScores;

// ─────────────────────────────────────────────────────────────
// Branch 1 — No resume uploaded
// ─────────────────────────────────────────────────────────────
test("flywheel branch 1: no resume → upload_resume (critical)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 500 }), // would otherwise hit later branch
    lhcs: baseLhcs(),
    pillars: basePillars(),
    hasResumeUploaded: false,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 1);
  assert.equal(cta.id, "upload_resume");
  assert.equal(cta.ctaHref, "/upload");
  assert.equal(cta.urgency, "critical");
});

// ─────────────────────────────────────────────────────────────
// Branch 2 — Foundation tier (ARK < 200)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 2: ARK < 200 → complete_onboarding (critical)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 150 }),
    lhcs: baseLhcs(),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 2);
  assert.equal(cta.id, "complete_onboarding");
  assert.equal(cta.ctaHref, "/assessment");
  assert.equal(cta.urgency, "critical");
});

// ─────────────────────────────────────────────────────────────
// Branch 3 — Critical pillar gap (any pillar < 35)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 3: weakest pillar < 35 → drill_<pillar> (high)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 350 }),
    lhcs: baseLhcs({ lcisLight: "green", mpsScore: 0 }),
    pillars: basePillars({ p4: 20 }), // P4 weakest
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 3);
  assert.equal(cta.id, "drill_p4");
  assert.equal(cta.pillar, "P4");
  assert.equal(cta.ctaHref, "/play");
  assert.equal(cta.urgency, "high");
});

// ─────────────────────────────────────────────────────────────
// Branch 4 — LCIS red (no recent learning)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 4: LCIS red → lcis_revival (high)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 350, ccmi: 100 }), // skip branch 5 (ccmi<150)
    lhcs: baseLhcs({ lcisLight: "red", mpsScore: 0 }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 4);
  assert.equal(cta.id, "lcis_revival");
  assert.equal(cta.ctaHref, "/play");
  assert.equal(cta.urgency, "high");
});

// ─────────────────────────────────────────────────────────────
// Branch 5 — CCMI ≥ 150 but no SPC published
// ─────────────────────────────────────────────────────────────
test("flywheel branch 5: CCMI≥150 + no MPS → publish_first_spc (high)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 350, ccmi: 200 }),
    lhcs: baseLhcs({ mpsScore: 0, lcisLight: "green" }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 5);
  assert.equal(cta.id, "publish_first_spc");
  assert.equal(cta.ctaHref, "/marketplace/publish");
  assert.equal(cta.urgency, "high");
});

// ─────────────────────────────────────────────────────────────
// Branch 6 — CPR red (narrow transferability)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 6: CPR red → cpr_diversify (medium)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 350, ccmi: 100 }), // skip branch 5
    lhcs: baseLhcs({
      cprLight: "red", lcisLight: "green",
      mpsScore: 30, mpsLight: "green", // skip branch 7
    }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 6);
  assert.equal(cta.id, "cpr_diversify");
  assert.equal(cta.ctaHref, "/pathways");
  assert.equal(cta.urgency, "medium");
});

// ─────────────────────────────────────────────────────────────
// Branch 7 — MPS amber/red but has listings
// ─────────────────────────────────────────────────────────────
test("flywheel branch 7: MPS amber + listings live → mps_promote (medium)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 350, ccmi: 100 }), // skip branch 5
    lhcs: baseLhcs({
      cprLight: "green", lcisLight: "green",
      mpsScore: 45, mpsLight: "amber",
    }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 7);
  assert.equal(cta.id, "mps_promote");
  assert.equal(cta.ctaHref, "/marketplace");
  assert.equal(cta.urgency, "medium");
});

// ─────────────────────────────────────────────────────────────
// Branch 8 — Strong tier (400-479)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 8: ARK 400-479 → cert_upgrade (medium)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 450, ccmi: 100 }), // skip branch 5
    lhcs: baseLhcs({
      cprLight: "green", lcisLight: "green",
      mpsScore: 80, mpsLight: "green", // skip branch 7
    }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 8);
  assert.equal(cta.id, "cert_upgrade");
  assert.equal(cta.ctaHref, "/play");
  assert.equal(cta.urgency, "medium");
});

// ─────────────────────────────────────────────────────────────
// Branch 9 — Exceptional (480-539)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 9: ARK 480-539 → legendary_chase (medium)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 500, ccmi: 100 }),
    lhcs: baseLhcs({
      cprLight: "green", lcisLight: "green",
      mpsScore: 80, mpsLight: "green",
    }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 9);
  assert.equal(cta.id, "legendary_chase");
  assert.equal(cta.ctaHref, "/marketplace");
  assert.equal(cta.urgency, "medium");
});

// ─────────────────────────────────────────────────────────────
// Branch 10 — Default (Legendary maintenance)
// ─────────────────────────────────────────────────────────────
test("flywheel branch 10: Legendary (ARK ≥ 540) → maintain_lead (low)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 580, ccmi: 100 }),
    lhcs: baseLhcs({
      cprLight: "green", lcisLight: "green",
      mpsScore: 80, mpsLight: "green",
    }),
    pillars: basePillars(),
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.equal(cta.position, 10);
  assert.equal(cta.id, "maintain_lead");
  assert.equal(cta.ctaHref, "/dashboard");
  assert.equal(cta.urgency, "low");
});

// ─────────────────────────────────────────────────────────────
// Fallthrough invariant
// ─────────────────────────────────────────────────────────────
test("flywheel: pickFlywheelCta always returns a CTA (default catch-all)", () => {
  const input: FlywheelInput = {
    user: baseUser({ arkScore: 600 }),
    lhcs: null,
    pillars: null,
    hasResumeUploaded: true,
  };
  const cta = pickFlywheelCta(input);
  assert.ok(cta);
  assert.equal(cta.position, 10);
});
