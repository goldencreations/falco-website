"use client";

import { useEffect, useState } from "react";
import { withCacheBypass } from "@/lib/client-fetch-cache";
import type { UserRole } from "@/lib/types";

/** Ping session while the tab is open so auth cookies slide forward. */
const SESSION_KEEPALIVE_MS = 15 * 60 * 1000;

export type SessionUserClient = {
 id: string;
 email: string;
 role: UserRole;
 branch_id: string;
 branch_name?: string;
 full_name: string;
 employee_id?: string;
 phone?: string;
 is_active?: boolean;
 permissions?: string[];
};

export function useSessionUser() {
 const [user, setUser] = useState<SessionUserClient | null>(null);
 const [loaded, setLoaded] = useState(false);

 useEffect(() => {
 let active = true;

 const load = async () => {
 try {
 // Always bypass the client fetch cache — session identity must not linger across logins.
 const response = await fetch(
 "/api/session",
 withCacheBypass({ credentials: "include", cache: "no-store" })
 );
 if (!response.ok) {
 if (active) setUser(null);
 return;
 }
 const payload = (await response.json()) as { user?: SessionUserClient };
 if (active) setUser(payload.user ?? null);
 } finally {
 if (active) setLoaded(true);
 }
 };

 void load();

 const interval = window.setInterval(() => {
 if (document.visibilityState !== "visible") return;
 void load();
 }, SESSION_KEEPALIVE_MS);

 return () => {
 active = false;
 window.clearInterval(interval);
 };
 }, []);

 return { user, loaded };
}
