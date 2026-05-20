"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionUserClient } from "@/lib/use-session-user";

interface SessionContextValue {
  user: SessionUserClient | null;
  loaded: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUserClient | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/session", { credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: SessionUserClient };
        if (active && payload.user) setUser(payload.user);
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ user, loaded }), [user, loaded]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

/** Returns null when called outside a SessionProvider (use useSessionUser for auto-fallback). */
export function useSession() {
  return useContext(SessionContext);
}
