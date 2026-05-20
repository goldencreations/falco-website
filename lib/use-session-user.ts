"use client";

import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/types";

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

export function useSessionUser() {
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
 load();
 return () => {
 active = false;
 };
 }, []);

 return { user, loaded };
}
