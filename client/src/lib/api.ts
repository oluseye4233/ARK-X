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