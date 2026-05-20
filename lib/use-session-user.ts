"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";
import { useSession } from "@/components/session-provider";

export type SessionUserClient = {
  id: string;
  email: string;
  role: UserRole;
  branch_id: string;
  full_name: string;
  employee_id?: string;
  phone?: string;
  is_active?: boolean;
  permissions?: string[];
};

/**
 * Returns the current session user. When called inside a SessionProvider the
 * data is shared — no extra network call. Falls back to a local fetch when
 * used outside a SessionProvider (e.g. manager/officer layouts).
 */
export function useSessionUser() {
  const ctx = useSession();

  const [localUser, setLocalUser] = useState<SessionUserClient | null>(null);
  const [localLoaded, setLocalLoaded] = useState(false);

  useEffect(() => {
    if (ctx !== null) return; // provider handles it
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/session", { credentials: "include" });
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: SessionUserClient };
        if (active && payload.user) setLocalUser(payload.user);
      } finally {
        if (active) setLocalLoaded(true);
      }
    };
    void load();
    return () => { active = false; };
  }, [ctx]);

  if (ctx !== null) return ctx;
  return { user: localUser, loaded: localLoaded };
}
