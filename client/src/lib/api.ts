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

  getDepartments: () => apiRequest("/api/departments"),

  getContextCraftLevels: () => apiRequest("/api/context-craft/levels"),

  updateContextCraftCert: (userId: string, level: string) =>
    apiRequest(`/api/users/${userId}/context-craft-cert`, {
      method: "PUT",
      body: JSON.stringify({ level }),
    }),

  getSubscriptionPlans: () => apiRequest("/api/subscription/plans"),

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

  finishCcgeSession: (id: string, playedCardIds: string[]) =>
    apiRequest(`/api/ccge/sessions/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({ playedCardIds }),
    }),

  getCcgeUserSessions: (userId: string) =>
    apiRequest(`/api/ccge/sessions/user/${userId}`),

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
};
