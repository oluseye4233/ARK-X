import { useState, useEffect, useCallback } from "react";

interface AuthUser {
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

const AUTH_KEY = "ark_user";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((userData: AuthUser) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedData: Partial<AuthUser>) => {
    if (user) {
      const newUser = { ...user, ...updatedData };
      localStorage.setItem(AUTH_KEY, JSON.stringify(newUser));
      setUser(newUser);
    }
  }, [user]);

  return { user, login, logout, updateUser, isAuthenticated: !!user };
}