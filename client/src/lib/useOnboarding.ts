import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";

const STORAGE_PREFIX = "ark.onboarding.completed.";

function storageKey(userId: string | undefined | null) {
  return userId ? `${STORAGE_PREFIX}${userId}` : null;
}

export function useOnboarding() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Track which user the modal was opened for, so a `close()` triggered after
  // an account switch can never write completion under the wrong user key.
  const openedForUserId = useRef<string | null>(null);

  useEffect(() => {
    // Reset visibility whenever the auth subject changes. Logged-out → close.
    if (!isAuthenticated || !user?.id) {
      setIsOpen(false);
      openedForUserId.current = null;
      return;
    }
    // If the modal is open for a *different* user (account switch with the
    // tour still open), close it before re-evaluating for the new user.
    if (openedForUserId.current && openedForUserId.current !== user.id) {
      setIsOpen(false);
      openedForUserId.current = null;
    }
    const key = storageKey(user.id);
    if (!key) return;
    try {
      const seen = localStorage.getItem(key);
      if (!seen) {
        setIsOpen(true);
        openedForUserId.current = user.id;
      }
    } catch {
      // localStorage unavailable (private mode, SSR, quota) — never auto-open.
    }
  }, [isAuthenticated, user?.id]);

  const open = useCallback(() => {
    if (!user?.id) return;
    openedForUserId.current = user.id;
    setIsOpen(true);
  }, [user?.id]);

  const close = useCallback((markCompleted = true) => {
    setIsOpen(false);
    const targetUserId = openedForUserId.current;
    openedForUserId.current = null;
    if (!markCompleted || !targetUserId) return;
    const key = storageKey(targetUserId);
    if (!key) return;
    try {
      localStorage.setItem(key, new Date().toISOString());
    } catch {
      // ignore — best-effort persistence
    }
  }, []);

  const reset = useCallback(() => {
    const key = storageKey(user?.id);
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [user?.id]);

  return { isOpen, open, close, reset };
}
