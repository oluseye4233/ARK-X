async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || "Request failed");
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  register: (data: any) =>
    apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),

  importCcgeCompendium: (markdown: string, dryRun: boolean) =>
    apiRequest("/api/admin/ccge/import-compendium", {
      method: "POST",
      body: JSON.stringify({ markdown, dryRun }),
    }),

  me: () => apiRequest("/api/auth/me"),

  getUser: (id: string) => apiRequest(`/api/users/${id}`),

  getLatestAssessment: (userId: string) =>
    apiRequest(`/api/assessments/user/${userId}/latest`),

  getAllAssessments: (userId: string) =>
    apiRequest(`/api/assessments/user/${userId}`),

  updateProfile: (userId: string, data: any) =>
    apiRequest(`/api/users/${userId}/profile`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  requestEmailNotification: (_userId: string, email: string) =>
    apiRequest(`/api/notifications/assessment-summary`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  createAssessment: (data: any) =>
    apiRequest("/api/assessments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getJnomicsCards: () => apiRequest("/api/jnomics-cards"),

  getJnomicsCardsByIds: (ids: string[]) =>
    apiRequest("/api/jnomics-cards/by-ids", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getEnterpriseIntelligence: (filter?: { dimension: string; value: string }) => {
    const qs = filter
      ? `?dimension=${encodeURIComponent(filter.dimension)}&value=${encodeURIComponent(filter.value)}`
      : "";
    return apiRequest(`/api/enterprise/intelligence${qs}`);
  },

  getDepartmentStaff: (department: string) =>
    apiRequest(`/api/enterprise/departments/${encodeURIComponent(department)}/staff`),

  inviteStaffMember: (staffId: string) =>
    apiRequest(`/api/workforce/staff/${encodeURIComponent(staffId)}/invite`, {
      method: "POST",
    }),

  nudgeStaffMember: (staffId: string) =>
    apiRequest(`/api/workforce/staff/${encodeURIComponent(staffId)}/nudge`, {
      method: "POST",
    }),

  getContextCraftLevels: () => apiRequest("/api/context-craft/levels"),

  updateContextCraftCert: (userId: string, level: string) =>
    apiRequest(`/api/users/${userId}/context-craft-cert`, {
      method: "PUT",
      body: JSON.stringify({ level }),
    }),

  getSubscriptionPlans: () => apiRequest("/api/subscription/plans"),

  // F1000 (First 1000) soft-launch promo
  getF1000Stats: () => apiRequest("/api/f1000/stats"),
  getF1000Me: () => apiRequest("/api/f1000/me"),
  claimF1000: () => apiRequest("/api/f1000/claim", { method: "POST" }),

  updateSubscription: (userId: string, plan: string, institution?: string) =>
    apiRequest(`/api/users/${userId}/subscription`, {
      method: "PUT",
      body: JSON.stringify({ plan, institution }),
    }),

  getBillingMe: () => apiRequest("/api/billing/me"),

  startCheckout: (plan: string, institution?: string) =>
    apiRequest("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan, institution }),
    }),

  getCheckoutSession: (id: string) => apiRequest(`/api/billing/checkout/${id}`),

  completeCheckout: (id: string, success = true) =>
    apiRequest(`/api/billing/checkout/${id}/complete`, {
      method: "POST",
      body: JSON.stringify({ success }),
    }),

  cancelSubscription: () => apiRequest("/api/billing/cancel", { method: "POST" }),

  getCcgeCards: () => apiRequest("/api/ccge/cards"),

  getCcgeScenarios: (tier?: string) =>
    apiRequest(`/api/ccge/scenarios${tier ? `?tier=${encodeURIComponent(tier)}` : ""}`),

  createCustomCcgeScenario: (data: {
    industry: string;
    role: string;
    problem: string;
    tier?: "Bronze" | "Silver" | "Gold" | "Platinum";
  }) =>
    apiRequest("/api/ccge/scenarios/custom", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  startCcgeSession: (_userId: string, scenarioId: string) =>
    apiRequest("/api/ccge/sessions", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    }),

  getCcgeSession: (id: string) => apiRequest(`/api/ccge/sessions/${id}`),

  finishCcgeSession: (
    id: string,
    playedCardIds: string[],
    customCard: { name: string; body: string },
    useClaude?: boolean,
  ) =>
    apiRequest(`/api/ccge/sessions/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({
        playedCardIds,
        customCardName: customCard.name,
        customCardBody: customCard.body,
        ...(useClaude !== undefined ? { useClaude } : {}),
      }),
    }),

  getCcgeUserSessions: (userId: string) =>
    apiRequest(`/api/ccge/sessions/user/${userId}`),

  // ── Primitive Card Verification (Task #55) ──
  getVerificationStatus: () => apiRequest("/api/verification/status"),

  getVerificationQuest: (cardId: string) =>
    apiRequest(`/api/verification/quest/${cardId}`),

  submitVerification: (
    cardId: string,
    submissions: { challengeId: string; prompt: string }[],
  ) =>
    apiRequest(`/api/verification/${cardId}/submit`, {
      method: "POST",
      body: JSON.stringify({ submissions }),
    }),

  // DATA-pillar evidence: documents & certifications uploaded under a card.
  getVerificationDocuments: (cardId: string) =>
    apiRequest(`/api/verification/${cardId}/documents`),

  addVerificationDocument: (
    cardId: string,
    doc: { kind: "DOCUMENT" | "CERTIFICATION"; fileName: string; label?: string; dataUrl: string },
  ) =>
    apiRequest(`/api/verification/${cardId}/documents`, {
      method: "POST",
      body: JSON.stringify(doc),
    }),

  deleteVerificationDocument: (id: string) =>
    apiRequest(`/api/verification/documents/${id}`, { method: "DELETE" }),

  // Job-role guide: grounds a named role against O*NET / SFIA / WEF as a writing aid.
  getJobRoleGuide: (role: string) =>
    apiRequest(`/api/verification/job-role-guide?role=${encodeURIComponent(role)}`),

  hivePrecheck: (data: { title: string; description: string; body: string; pillar: string }) =>
    apiRequest("/api/sphinx/hive-precheck", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  publishSpcListing: (data: {
    title: string;
    description: string;
    body: string;
    pillar: string;
    priceCredits: number;
    scope?: "OPEN" | "CORPORATE" | "BOTH";
  }) =>
    apiRequest("/api/sphinx/listings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Phase K — Corporate marketplace
  getCorporateListings: (pillar?: string) => {
    const params = new URLSearchParams();
    if (pillar && pillar !== "All") params.set("pillar", pillar);
    const qs = params.toString();
    return apiRequest(`/api/sphinx/corporate/listings${qs ? `?${qs}` : ""}`);
  },
  getSpcFeedback: (listingId: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/feedback`),
  submitSpcFeedback: (listingId: string, stars: number, comment?: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ stars, comment: comment?.trim() || undefined }),
    }),

  getSpcListings: (filters?: { pillar?: string; category?: string; search?: string; disc?: string; rarity?: string; version?: string; tier?: string }) => {
    const params = new URLSearchParams();
    if (filters?.pillar && filters.pillar !== "All") params.set("pillar", filters.pillar);
    if (filters?.category && filters.category !== "All") params.set("category", filters.category);
    if (filters?.search && filters.search.trim()) params.set("search", filters.search.trim());
    if (filters?.disc && filters.disc !== "All") params.set("disc", filters.disc);
    if (filters?.rarity && filters.rarity !== "All") params.set("rarity", filters.rarity);
    if (filters?.version && filters.version !== "All") params.set("version", filters.version);
    if (filters?.tier && filters.tier !== "All") params.set("tier", filters.tier);
    const qs = params.toString();
    return apiRequest(`/api/sphinx/listings${qs ? `?${qs}` : ""}`);
  },

  // M3 — synergy / pairs / roundtable / notifications
  calculateSynergy: (cardIds: string[]) =>
    apiRequest("/api/sphinx/synergies/calculate", {
      method: "POST",
      body: JSON.stringify({ cardIds }),
    }),
  getTopPairs: () => apiRequest("/api/sphinx/pairs/top"),
  getComplementaryFor: (listingId: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/complementary`),
  getRoundtable: () => apiRequest("/api/sphinx/roundtable"),
  getNotifications: () => apiRequest("/api/notifications"),
  // M4 — Synthesis & ZPOS
  createSynthesisSession: (listingIds: string[], zposMethod?: string) =>
    apiRequest("/api/sphinx/synthesis/sessions", {
      method: "POST",
      body: JSON.stringify({ listingIds, zposMethod }),
    }),
  getSynthesisSession: (id: string) =>
    apiRequest(`/api/sphinx/synthesis/sessions/${id}`),
  finalizeSynthesisSession: (id: string) =>
    apiRequest(`/api/sphinx/synthesis/sessions/${id}/finalize`, { method: "POST" }),
  getListingSyntheses: (listingId: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/syntheses`),

  markNotificationsRead: (ids?: string[]) =>
    apiRequest("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ ids: ids ?? undefined }),
    }),

  runSpcAiAnalysis: (listingId: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/ai-analysis`, { method: "POST" }),

  getSpcListing: (id: string, _viewerId?: string) =>
    apiRequest(`/api/sphinx/listings/${id}`),

  delistSpc: (id: string, _creatorId?: string) =>
    apiRequest(`/api/sphinx/listings/${id}`, { method: "DELETE" }),

  purchaseSpc: (listingId: string, _buyerId?: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/purchase`, { method: "POST" }),

  getCredits: (userId: string) => apiRequest(`/api/sphinx/credits/${userId}`),

  getSpcListingsByCreator: (userId: string) =>
    apiRequest(`/api/sphinx/listings/by-creator/${userId}`),

  getSpcSales: (userId: string) => apiRequest(`/api/sphinx/sales/${userId}`),

  getSpcPurchases: (userId: string) => apiRequest(`/api/sphinx/purchases/${userId}`),

  getGuinById: (userId: string) => apiRequest(`/api/guin/by-id/${userId}`),
  getGuinByUsername: (username: string) =>
    apiRequest(`/api/guin/by-username/${encodeURIComponent(username)}`),
  createEndorsement: (data: {
    recipientId: string;
    sessionId: string;
    message: string;
  }) =>
    apiRequest("/api/endorsements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Phase G — Cohorts (Institutional Tier)
  getMyCohorts: () => apiRequest("/api/me/cohorts"),
  getCohorts: () => apiRequest("/api/cohorts"),
  createCohort: (data: { name: string; institution: string; description?: string }) =>
    apiRequest("/api/cohorts", { method: "POST", body: JSON.stringify(data) }),
  getCohort: (id: string) => apiRequest(`/api/cohorts/${id}`),
  addCohortMembers: (id: string, emails: string[]) =>
    apiRequest(`/api/cohorts/${id}/members`, { method: "POST", body: JSON.stringify({ emails }) }),
  removeCohortMember: (id: string, userId: string) =>
    apiRequest(`/api/cohorts/${id}/members/${userId}`, { method: "DELETE" }),
  createCohortAssignment: (
    id: string,
    data: { scenarioId: string; dueAt?: string | null; note?: string },
  ) => apiRequest(`/api/cohorts/${id}/assignments`, { method: "POST", body: JSON.stringify(data) }),
  getCohortGrades: (id: string) => apiRequest(`/api/cohorts/${id}/grades`),
  getCohortComparison: () => apiRequest("/api/cohorts/comparison"),
  cohortGradesCsvUrl: (id: string) => `/api/cohorts/${id}/grades.csv`,

  // ── Task #25 — Institution Workforce / HR Connectors ──
  getWorkforceConnectors: () => apiRequest("/api/workforce/connectors"),
  getWorkforceStaff: () => apiRequest("/api/workforce/staff"),
  getWorkforceIntelligence: () => apiRequest("/api/workforce/intelligence"),
  getWorkforceImportBatches: () => apiRequest("/api/workforce/import-batches"),
  workforceIntelligenceCsvUrl: () => "/api/workforce/intelligence.csv",
  linkWorkforceStaff: (id: string) =>
    apiRequest(`/api/workforce/staff/${id}/link`, { method: "POST" }),
  inviteWorkforceStaff: (id: string) =>
    apiRequest(`/api/workforce/staff/${id}/invite`, { method: "POST" }),
  // On-demand re-sync from a live HR API connector (BambooHR / Gusto / Workday).
  syncWorkforceConnector: (adapter: string) =>
    apiRequest("/api/workforce/sync", {
      method: "POST",
      body: JSON.stringify({ adapter }),
    }),
  // Read-only connection test — authenticates + counts records, never writes.
  testWorkforceConnector: (adapter: string) =>
    apiRequest("/api/workforce/test-connection", {
      method: "POST",
      body: JSON.stringify({ adapter }),
    }),
  // ── Task #35 — Scheduled HR-roster sync ──
  getWorkforceConnectorConfigs: () => apiRequest("/api/workforce/connector-configs"),
  setWorkforceConnectorConfig: (
    adapter: string,
    body: { enabled: boolean; intervalMinutes?: number },
  ) =>
    apiRequest(`/api/workforce/connector-configs/${adapter}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  previewWorkforceImport: async (
    file: File,
    opts?: { adapter?: string; columnMapping?: Record<string, string> },
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("adapter", opts?.adapter ?? "csv");
    if (opts?.columnMapping) fd.append("columnMapping", JSON.stringify(opts.columnMapping));
    const res = await fetch("/api/workforce/import/preview", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(e.message || "Preview failed");
    }
    return res.json();
  },
  runWorkforceImport: async (
    file: File,
    opts?: { adapter?: string; columnMapping?: Record<string, string> },
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("adapter", opts?.adapter ?? "csv");
    if (opts?.columnMapping) fd.append("columnMapping", JSON.stringify(opts.columnMapping));
    const res = await fetch("/api/workforce/import", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(e.message || "Import failed");
    }
    return res.json();
  },

  seed: () => apiRequest("/api/seed", { method: "POST" }),

  // ── PDD §3.4 — ARK identity surfaces ──
  getArkIdentity: () => apiRequest("/api/ark/identity"),
  recalcArk: () => apiRequest("/api/ark/recalc", { method: "POST" }),
  getArkFlywheelCta: () => apiRequest("/api/ark/flywheel-cta"),
  getArkHistory: (days = 90) => apiRequest(`/api/ark/history?days=${days}`),
  getArkLhcs: () => apiRequest("/api/ark/lhcs"),

  uploadResume: async (file: File, _userId: string) => {
    const formData = new FormData();
    formData.append("resume", file);
    const res = await fetch("/api/resume/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || "Upload failed");
    }
    return res.json();
  },

  // Self-assessment + LinkedIn + archetype-quiz intake. Server pipes all
  // through the same cumulative analyze→persist→recalc pipeline as
  // /api/resume/upload, merging every contributed source into one ARK profile.
  submitAssessmentText: (input: { text: string; source: "self" | "linkedin" | "quiz" }) =>
    apiRequest("/api/assessment/text", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Which intake sources the user has contributed + the completeness meter.
  getAssessmentSources: (): Promise<{
    sources: Array<{ source: string; label: string; present: boolean; primary: boolean; updatedAt: string | null }>;
    completeness: number;
    sourcesUsed: string[];
  }> => apiRequest("/api/assessment/sources"),

  // Drop a contributed source; server re-runs the cumulative merge over the
  // remaining sources, updating sourcesUsed + completeness + ARK.
  removeAssessmentSource: (source: string) =>
    apiRequest(`/api/assessment/sources/${source}`, { method: "DELETE" }),

  // ── M5 — Matrix Forge Lab (.docx) ──
  runForgeLab: async (
    file: File,
    meta: { title: string; description: string; pillar: string },
  ) => {
    const fd = new FormData();
    fd.append("docx", file);
    fd.append("title", meta.title);
    fd.append("description", meta.description);
    fd.append("pillar", meta.pillar);
    const res = await fetch("/api/sphinx/forge-lab/run", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(e.message || "Forge Lab failed.");
    }
    return res.json();
  },

  // ── M5 — Bonsai onboarding progress ──
  getBonsaiProgress: () => apiRequest("/api/sphinx/bonsai/progress"),
  completeBonsaiStage: (stageId: number) =>
    apiRequest(`/api/sphinx/bonsai/progress/${stageId}/complete`, { method: "POST" }),

  // ── Task #22 — Context Craft Book Companion ──
  getBookJourney: () => apiRequest("/api/book/journey"),
  getBookLedger: () => apiRequest("/api/book/ledger"),
  captureBookSnapshot: (kind: "final" = "final") =>
    apiRequest("/api/book/ledger/snapshot", {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
  getBookSlugs: () => apiRequest("/api/book/slugs"),

  // ── Free JST Assessment (guest funnel — no login) ──
  getFreeAssessmentSpots: () => apiRequest("/api/free-assessment/spots"),
  submitFreeAssessment: (input: { method: "questionnaire" | "linkedin"; answers?: string[]; text?: string }) =>
    apiRequest("/api/free-assessment", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  submitFreeAssessmentResume: async (file: File) => {
    const fd = new FormData();
    fd.append("method", "resume");
    fd.append("resume", file);
    const res = await fetch("/api/free-assessment", {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(e.message || "Assessment failed");
    }
    return res.json();
  },

  // ── Suggested Training Providers ──
  getTrainingProviders: (filters?: { region?: string; deliveryMode?: string; q?: string }) => {
    const params = new URLSearchParams();
    if (filters?.region && filters.region !== "All") params.set("region", filters.region);
    if (filters?.deliveryMode && filters.deliveryMode !== "All") params.set("deliveryMode", filters.deliveryMode);
    if (filters?.q && filters.q.trim()) params.set("q", filters.q.trim());
    const qs = params.toString();
    return apiRequest(`/api/training/providers${qs ? `?${qs}` : ""}`);
  },
  getSuggestedTraining: () => apiRequest("/api/training/suggested"),
  getTrainingProvider: (slug: string) =>
    apiRequest(`/api/training/providers/${encodeURIComponent(slug)}`),
  registerTrainingProvider: (data: {
    name: string;
    description?: string;
    website?: string;
    logoUrl?: string;
    regions?: string[];
    deliveryModes?: string[];
    accreditations?: string[];
  }) =>
    apiRequest("/api/training/providers", { method: "POST", body: JSON.stringify(data) }),
  updateTrainingProvider: (id: string, data: any) =>
    apiRequest(`/api/training/providers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getMyTrainingProviders: () => apiRequest("/api/training/my-providers"),
  addTrainingCourse: (
    providerId: string,
    data: {
      title: string;
      description?: string;
      category: string;
      skills?: string[];
      level?: string;
      durationLabel?: string;
      priceLabel?: string;
      certification?: string;
      url?: string;
    },
  ) =>
    apiRequest(`/api/training/providers/${providerId}/courses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteTrainingCourse: (id: string) =>
    apiRequest(`/api/training/courses/${id}`, { method: "DELETE" }),
  trackTrainingClick: (providerId: string, courseId?: string): Promise<{ url: string | null }> =>
    apiRequest("/api/training/click", {
      method: "POST",
      body: JSON.stringify({ providerId, courseId }),
    }),
  getAdminTrainingProviders: (status?: string) =>
    apiRequest(`/api/admin/training/providers${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  setTrainingProviderStatus: (
    id: string,
    body: { status?: string; sponsored?: boolean; sponsoredWeight?: number },
  ) =>
    apiRequest(`/api/admin/training/providers/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // ── Shareable ARK Report links ──
  createReportShare: (): Promise<{ token: string; path: string }> =>
    apiRequest("/api/report/share", { method: "POST" }),
  revokeReportShare: (): Promise<{ ok: boolean }> =>
    apiRequest("/api/report/share", { method: "DELETE" }),
  getSharedReport: (token: string) => apiRequest(`/api/report/shared/${token}`),

  // ── ARK RESUME (Task #59) ──
  getArkResume: () => apiRequest("/api/ark-resume"),
  setArkResumeHeadshot: (dataUrl: string): Promise<{ ok: boolean; headshotDataUrl: string | null }> =>
    apiRequest("/api/ark-resume/headshot", { method: "POST", body: JSON.stringify({ dataUrl }) }),
  deleteArkResumeHeadshot: (): Promise<{ ok: boolean }> =>
    apiRequest("/api/ark-resume/headshot", { method: "DELETE" }),
  getConfirmations: () => apiRequest("/api/confirmations"),
  issueConfirmation: (data: {
    userId: string;
    type: "EMPLOYMENT" | "CERTIFICATION" | "SKILL";
    targetRef: string;
    targetLabel?: string;
    status?: "PENDING" | "CONFIRMED" | "REJECTED" | "UNVERIFIED";
    confirmerOrg?: string;
    confirmerName?: string;
    confirmerLogoUrl?: string;
    note?: string;
  }) => apiRequest("/api/confirmations", { method: "POST", body: JSON.stringify(data) }),

  // ── ARK RESUME external confirmation invites (Task #60) ──
  listConfirmationInvites: () => apiRequest("/api/ark-resume/confirmation-invites"),
  createConfirmationInvite: (data: {
    type: "EMPLOYMENT" | "CERTIFICATION" | "SKILL";
    targetRef: string;
    targetLabel?: string;
    recipientEmail: string;
    recipientName?: string;
    recipientOrg?: string;
    note?: string;
  }) =>
    apiRequest("/api/ark-resume/confirmation-invites", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  revokeConfirmationInvite: (id: string) =>
    apiRequest(`/api/ark-resume/confirmation-invites/${id}/revoke`, { method: "POST" }),
  resendConfirmationInvite: (id: string) =>
    apiRequest(`/api/ark-resume/confirmation-invites/${id}/resend`, { method: "POST" }),
  getConfirmationInvite: (token: string) => apiRequest(`/api/confirmation-invites/${token}`),
  respondConfirmationInvite: (
    token: string,
    data: {
      decision: "approve" | "reject";
      responderName?: string;
      responderOrg?: string;
      responseNote?: string;
    },
  ) =>
    apiRequest(`/api/confirmation-invites/${token}/respond`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
