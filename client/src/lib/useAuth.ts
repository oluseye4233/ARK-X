import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role?: string | null;
  department?: string | null;
  seniority?: string | null;
  location?: string | null;
  contextCraftCertLevel?: string | null;
  subscriptionPlan?: string | null;
  subscriptionStatus?: string | null;
  institution?: string | null;
}

const ME_KEY = ["/api/auth/me"];

export function useAuth() {
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    staleTime: 1000 * 60,
    retry: false,
  });

  const login = useCallback(
    (userData: AuthUser) => {
      qc.setQueryData(ME_KEY, userData);
    },
    [qc]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    qc.setQueryData(ME_KEY, null);
    qc.clear();
  }, [qc]);

  const updateUser = useCallback(
    (updatedData: Partial<AuthUser>) => {
      const current = qc.getQueryData<AuthUser | null>(ME_KEY);
      if (current) qc.setQueryData(ME_KEY, { ...current, ...updatedData });
    },
    [qc]
  );

  return {
    user: user ?? null,
    login,
    logout,
    updateUser,
    isLoading,
    isAuthenticated: !!user,
  };
}
