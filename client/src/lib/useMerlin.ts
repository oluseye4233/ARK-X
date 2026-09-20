import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { buildMerlinGuidance, type MerlinPreference } from "@/lib/merlin-guidance";

const KEY = "ark.merlin.preference";

export function useMerlin() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [preference, setPreferenceState] = useState<MerlinPreference>(() => {
    if (typeof window === "undefined") return "certification";
    const value = window.localStorage.getItem(KEY);
    return value === "badges" || value === "resilience" || value === "mobility" || value === "certification" ? value : "certification";
  });
  const setPreference = (value: MerlinPreference) => { setPreferenceState(value); window.localStorage.setItem(KEY, value); };
  const query = useQuery({
    queryKey: ["merlin", user?.id],
    enabled: isAuthenticated && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const results = await Promise.allSettled([
        api.getLatestAssessment(user!.id), api.getArkIdentity(), api.getArkLhcs(), api.getBookJourney(), api.getBookLedger(), api.getCcgeUserSessions(user!.id),
      ]);
      if (results.every(result => result.status === "rejected")) throw new Error("MERLIN data is temporarily unavailable");
      const value = <T,>(index: number): T | null => results[index].status === "fulfilled" ? results[index].value as T : null;
      const sessions = value<any>(5);
      return {
        assessment: value<any>(0),
        identity: { ...(value<any>(1) ?? {}), contextCraftCertLevel: user!.contextCraftCertLevel ?? "NONE" },
        lhcs: value<any>(2), journey: value<any>(3), ledger: value<any>(4),
        sessions: Array.isArray(sessions) ? sessions : sessions?.sessions ?? [],
      };
    },
  });
  const guidance = query.data ? buildMerlinGuidance({ preference, ...query.data }) : null;
  return { ...query, guidance, preference, setPreference, isAuthenticated, authLoading };
}