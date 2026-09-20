/**
 * Live-database coverage for the account-deletion inventory. The fixture spans
 * newer profile, verification, confirmation, matchmaking and shared-record
 * policies, then proves a retry is harmless and another account is untouched.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  users, assessmentSources, cardVerifications, verificationDocuments,
  guinMaxProfiles, guinMaxMatchRequests, opportunities, opportunityRequirements,
  opportunityApplications, matchmakingIntroductions, skillConfirmations,
  confirmationInvites, notifications, bonsaiProgress, bookJourneyBadges,
  bookLedgerSnapshots, reportShares, staffRecords, trainingProviders, trainingClicks,
  hrImportBatches, hrConnectorTests, hrConnectorConfigs, cohorts, cohortMemberships,
  cohortAssignments, ccgeScenarios, testResults, spcListings, spcFeedback,
  complementaryPairs, roundtableState, synthesisSessions, synthesisCreatorsSplit,
  platformCreditLedger,
} from "@shared/schema";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let deletedUserId = "";
let otherUserId = "";

async function count(table: any, predicate: any) {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(predicate);
  return row.count;
}

before(async () => {
  await db.execute(sql`SELECT 1`);
  deletedUserId = (await storage.createUser({
    username: `privacy-delete-${suffix}@example.test`, password: "x", name: "Delete Me",
    role: null, department: null, seniority: null, location: null, contextCraftCertLevel: "NONE",
  })).id;
  otherUserId = (await storage.createUser({
    username: `privacy-keep-${suffix}@example.test`, password: "x", name: "Keep Me",
    role: null, department: null, seniority: null, location: null, contextCraftCertLevel: "NONE",
  })).id;
});

after(async () => {
  for (const id of [deletedUserId, otherUserId]) {
    if (!id) continue;
    try { await storage.deleteUserCascade(id); } catch { /* already deleted */ }
  }
});

test("deleteUserCascade removes newer personal records, unlinks shared records, and is retry-safe", async () => {
  const [opportunity] = await db.insert(opportunities).values({
    title: "Private role", organization: "Example", createdBy: deletedUserId,
  }).returning();
  await db.insert(opportunityRequirements).values({ opportunityId: opportunity.id, cardId: "codec-ant" });
  await db.insert(opportunityApplications).values({ opportunityId: opportunity.id, userId: otherUserId });
  await db.insert(matchmakingIntroductions).values({
    opportunityId: opportunity.id, employerId: deletedUserId, candidateId: otherUserId, cxs: 80,
  });
  await db.insert(assessmentSources).values([
    { userId: deletedUserId, source: "resume", content: "private" },
    { userId: otherUserId, source: "resume", content: "keep" },
  ]);
  await db.insert(cardVerifications).values({ userId: deletedUserId, cardId: "codec-ant" });
  await db.insert(verificationDocuments).values({
    userId: deletedUserId, cardId: "codec-ant", fileName: "private.pdf",
    mimeType: "application/pdf", dataUrl: "data:application/pdf;base64,AA==",
  });
  await db.insert(guinMaxProfiles).values({ userId: deletedUserId });
  await db.insert(guinMaxMatchRequests).values({
    requesterId: deletedUserId, candidateId: otherUserId, cxs: 70,
  });
  await db.insert(skillConfirmations).values([
    { userId: deletedUserId, type: "SKILL", targetRef: "codec-ant", confirmerOrg: "Private" },
    {
      userId: otherUserId, type: "SKILL", targetRef: "codec-bee",
      confirmerUserId: deletedUserId, confirmerOrg: "Private Employer",
      confirmerName: "Delete Me", confirmerLogoUrl: "https://private.example/logo.png",
    },
  ]);
  await db.insert(confirmationInvites).values({
    token: `privacy-${suffix}`, userId: deletedUserId, type: "SKILL", targetRef: "codec-ant",
    recipientEmail: "recipient@example.test", expiresAt: new Date(Date.now() + 60_000),
  });
  await db.insert(notifications).values({ userId: deletedUserId, type: "synthesis.completed", title: "Private" });
  await db.insert(bonsaiProgress).values({ userId: deletedUserId });
  await db.insert(bookJourneyBadges).values({ userId: deletedUserId, nodeId: "prologue", badge: "Private", earnedVia: "assessment" });
  await db.insert(bookLedgerSnapshots).values({ userId: deletedUserId, kind: "baseline", jstIndex: 1, ccmi: 2, arkScore: 3 });
  await db.insert(reportShares).values({ token: `share-${suffix}`, userId: deletedUserId });
  const [staff] = await db.insert(staffRecords).values({
    institution: `Privacy ${suffix}`, fullName: "Shared Staff", email: `staff-${suffix}@example.test`, arkUserId: deletedUserId,
  }).returning();
  const [provider] = await db.insert(trainingProviders).values({
    name: "Shared Provider", slug: `privacy-provider-${suffix}`, ownerUserId: deletedUserId,
  }).returning();
  await db.insert(trainingClicks).values({ providerId: provider.id, userId: deletedUserId });
  const institution = `Privacy Institution ${suffix}`;
  const [batch] = await db.insert(hrImportBatches).values({
    institution, adapter: "csv", filename: "shared.csv", importedBy: deletedUserId,
  }).returning();
  await db.insert(hrConnectorTests).values({
    institution, adapter: "workday", ok: true, testedBy: deletedUserId,
  });
  await db.insert(hrConnectorConfigs).values({
    institution, adapter: "workday", enabled: true, createdBy: deletedUserId,
  });
  const [cohort] = await db.insert(cohorts).values({
    instructorId: deletedUserId, institution, name: "Private cohort",
  }).returning();
  await db.insert(cohortMemberships).values({ cohortId: cohort.id, userId: otherUserId });
  await db.insert(cohortAssignments).values({
    cohortId: cohort.id, scenarioId: "scenario-1", assignedBy: deletedUserId,
  });
  await db.insert(ccgeScenarios).values({
    id: `private-scenario-${suffix}`, tier: "T1", title: "Private", prompt: "Private",
    targetPillars: ["P1"], tokenBudget: 100, difficulty: 1,
    creatorUserId: deletedUserId, isCustom: true,
  });
  await db.insert(testResults).values({
    userId: deletedUserId, source: "paste", hiveScore: 80, kcseScore: 40, passes: true,
  });
  const [listing] = await db.insert(spcListings).values({
    creatorId: deletedUserId, title: "Private listing", description: "Private", body: "Private",
    pillar: "Data", priceCredits: 10, kcseScore: 40, hiveScore: 80,
  }).returning();
  await db.insert(spcFeedback).values({
    listingId: listing.id, buyerId: otherUserId, creatorId: deletedUserId, stars: 5,
  });
  await db.insert(complementaryPairs).values({
    listingId: listing.id, partnerListingId: `partner-${suffix}`, score: 90, rank: 1,
  });
  await db.insert(roundtableState).values({
    listingId: listing.id, creatorId: deletedUserId, seatNumber: 1000 + (Date.now() % 1_000_000),
    score: 90, hiveScore: 80, salesCount: 1,
  });
  const [synthesis] = await db.insert(synthesisSessions).values({
    buyerId: otherUserId, sourceListingIds: [listing.id],
    lockedPrices: [{ listingId: listing.id, creatorId: deletedUserId, priceCredits: 10 }],
    splitPreview: [{ creatorId: deletedUserId, sourceListingId: listing.id, sourcePriceCredits: 10, weight: 1, creditedAmount: 7 }],
    totalCreditPrice: 10, zposMethod: "SYNTHESIS", preTokens: 100, postTokens: 50,
    reductionPct: 50, semanticPreservation: 95, combinedOutput: "Private synthesis",
  }).returning();
  await db.insert(synthesisCreatorsSplit).values({
    sessionId: synthesis.id, creatorId: deletedUserId, sourceListingId: listing.id,
    sourcePriceCredits: 10, weightBp: 10000, creditedAmount: 7,
  });
  await db.insert(platformCreditLedger).values({
    source: "synthesis", sourceRefId: synthesis.id, amount: 3,
  });

  const result = await storage.deleteUserCascade(deletedUserId);
  assert.equal(result.deletedTables.users, 1);
  for (const [table, predicate] of [
    [users, eq(users.id, deletedUserId)],
    [assessmentSources, eq(assessmentSources.userId, deletedUserId)],
    [cardVerifications, eq(cardVerifications.userId, deletedUserId)],
    [verificationDocuments, eq(verificationDocuments.userId, deletedUserId)],
    [guinMaxProfiles, eq(guinMaxProfiles.userId, deletedUserId)],
    [guinMaxMatchRequests, or(eq(guinMaxMatchRequests.requesterId, deletedUserId), eq(guinMaxMatchRequests.candidateId, deletedUserId))],
    [opportunities, eq(opportunities.createdBy, deletedUserId)],
    [skillConfirmations, eq(skillConfirmations.userId, deletedUserId)],
    [confirmationInvites, eq(confirmationInvites.userId, deletedUserId)],
    [notifications, eq(notifications.userId, deletedUserId)],
    [reportShares, eq(reportShares.userId, deletedUserId)],
    [cohorts, eq(cohorts.instructorId, deletedUserId)],
    [ccgeScenarios, eq(ccgeScenarios.creatorUserId, deletedUserId)],
    [testResults, eq(testResults.userId, deletedUserId)],
    [spcListings, eq(spcListings.creatorId, deletedUserId)],
    [synthesisSessions, eq(synthesisSessions.id, synthesis.id)],
    [synthesisCreatorsSplit, eq(synthesisCreatorsSplit.sessionId, synthesis.id)],
    [platformCreditLedger, eq(platformCreditLedger.sourceRefId, synthesis.id)],
  ] as const) assert.equal(await count(table, predicate), 0);

  assert.equal(await count(users, eq(users.id, otherUserId)), 1);
  assert.equal(await count(assessmentSources, eq(assessmentSources.userId, otherUserId)), 1);
  const [retainedConfirmation] = await db.select().from(skillConfirmations).where(and(
    eq(skillConfirmations.userId, otherUserId), eq(skillConfirmations.targetRef, "codec-bee"),
  ));
  assert.equal(retainedConfirmation.confirmerUserId, null);
  assert.equal(retainedConfirmation.confirmerOrg, "Former confirmer");
  assert.equal(retainedConfirmation.confirmerName, null);
  assert.equal(retainedConfirmation.confirmerLogoUrl, null);
  assert.equal((await db.select().from(staffRecords).where(eq(staffRecords.id, staff.id)))[0].arkUserId, null);
  assert.equal((await db.select().from(trainingProviders).where(eq(trainingProviders.id, provider.id)))[0].ownerUserId, null);
  assert.equal((await db.select().from(trainingClicks).where(eq(trainingClicks.providerId, provider.id)))[0].userId, null);
  assert.equal((await db.select().from(hrImportBatches).where(eq(hrImportBatches.id, batch.id)))[0].importedBy, "deleted-account");
  assert.equal((await db.select().from(hrConnectorTests).where(eq(hrConnectorTests.institution, institution)))[0].testedBy, "deleted-account");
  const [retainedConfig] = await db.select().from(hrConnectorConfigs).where(eq(hrConnectorConfigs.institution, institution));
  assert.equal(retainedConfig.createdBy, "deleted-account");
  assert.equal(retainedConfig.enabled, true);

  await assert.rejects(() => storage.deleteUserCascade(deletedUserId), (error: any) =>
    error?.status === 404 && error?.message === "User not found",
  );
  assert.equal(await count(users, eq(users.id, otherUserId)), 1);
});