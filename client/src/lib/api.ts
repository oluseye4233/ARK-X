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
  }) =>
    apiRequest("/api/sphinx/listings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSpcListings: (filters?: { pillar?: string }) => {
    const params = new URLSearchParams();
    if (filters?.pillar && filters.pillar !== "All") params.set("pillar", filters.pillar);
    const qs = params.toString();
    return apiRequest(`/api/sphinx/listings${qs ? `?${qs}` : ""}`);
  },

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
};
