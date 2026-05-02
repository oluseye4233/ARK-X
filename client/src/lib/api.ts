import { queryClient } from "./queryClient";

async function apiRequest(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
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

  requestEmailNotification: (userId: string, email: string) =>
    apiRequest(`/api/notifications/assessment-summary`, {
      method: "POST",
      body: JSON.stringify({ userId, email }),
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

  // ── CCGE Game Engine ─────────────────────────────────
  getCcgeCards: () => apiRequest("/api/ccge/cards"),

  getCcgeScenarios: (tier?: string) =>
    apiRequest(`/api/ccge/scenarios${tier ? `?tier=${encodeURIComponent(tier)}` : ""}`),

  startCcgeSession: (userId: string, scenarioId: string) =>
    apiRequest("/api/ccge/sessions", {
      method: "POST",
      body: JSON.stringify({ userId, scenarioId }),
    }),

  getCcgeSession: (id: string) => apiRequest(`/api/ccge/sessions/${id}`),

  finishCcgeSession: (id: string, playedCardIds: string[]) =>
    apiRequest(`/api/ccge/sessions/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({ playedCardIds }),
    }),

  getCcgeUserSessions: (userId: string) =>
    apiRequest(`/api/ccge/sessions/user/${userId}`),

  // ── SPHINX Marketplace ───────────────────────────────
  hivePrecheck: (data: { title: string; description: string; body: string; pillar: string }) =>
    apiRequest("/api/sphinx/hive-precheck", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  publishSpcListing: (data: {
    creatorId: string;
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

  getSpcListing: (id: string, viewerId?: string) =>
    apiRequest(`/api/sphinx/listings/${id}${viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : ""}`),

  delistSpc: (id: string, creatorId: string) =>
    apiRequest(`/api/sphinx/listings/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ creatorId }),
    }),

  purchaseSpc: (listingId: string, buyerId: string) =>
    apiRequest(`/api/sphinx/listings/${listingId}/purchase`, {
      method: "POST",
      body: JSON.stringify({ buyerId }),
    }),

  getCredits: (userId: string) => apiRequest(`/api/sphinx/credits/${userId}`),

  getSpcListingsByCreator: (userId: string) =>
    apiRequest(`/api/sphinx/listings/by-creator/${userId}`),

  getSpcSales: (userId: string) => apiRequest(`/api/sphinx/sales/${userId}`),

  getSpcPurchases: (userId: string) => apiRequest(`/api/sphinx/purchases/${userId}`),

  // ── GUIN+ Identity ───────────────────────────────────
  getGuinById: (userId: string) => apiRequest(`/api/guin/by-id/${userId}`),
  getGuinByUsername: (username: string) =>
    apiRequest(`/api/guin/by-username/${encodeURIComponent(username)}`),
  createEndorsement: (data: {
    endorserId: string;
    recipientId: string;
    sessionId: string;
    message: string;
  }) =>
    apiRequest("/api/endorsements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  seed: () => apiRequest("/api/seed", { method: "POST" }),

  uploadResume: async (file: File, userId: string) => {
    const formData = new FormData();
    formData.append("resume", file);
    formData.append("userId", userId);
    const res = await fetch("/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || "Upload failed");
    }
    return res.json();
  },
};