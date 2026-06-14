import { cookies } from "next/headers";
import { falcoFetch } from "@/lib/falco-api";
import { mapApiRoleToAppRole } from "@/lib/api-roles";
import type { UserRole } from "@/lib/types";

/** Legacy demo cookie — cleared on login/logout. */
export const AUTH_COOKIE_NAME = "falco_auth";
/** Laravel Sanctum personal access token (httpOnly). */
export const ACCESS_TOKEN_COOKIE_NAME = "falco_access_token";
/** Mapped app role for middleware routing (httpOnly, set only by /api/login). */
export const APP_ROLE_COOKIE_NAME = "falco_app_role";

export type SessionUser = {
 id: string;
 email: string;
 role: UserRole;
 branch_id: string;
 branch_name?: string;
 full_name: string;
 permissions: string[];
};

export type ApiMeUser = {
 id: number | string;
 email: string;
 full_name: string;
 role: string;
 branch_id: string | null;
 branch_name?: string | null;
 permissions?: string[];
};

function normalizeBranchId(branchId: string | null | undefined): string {
 if (branchId === null || branchId === undefined) return "";
 return String(branchId);
}

export function sessionUserFromApiMe(user: ApiMeUser, permissions: string[]): SessionUser | null {
 const role = mapApiRoleToAppRole(user.role);
 if (!role) return null;
 return {
 id: String(user.id),
 email: user.email,
 role,
 branch_id: normalizeBranchId(user.branch_id),
 branch_name: user.branch_name ? String(user.branch_name) : undefined,
 full_name: user.full_name,
 permissions,
 };
}

export async function fetchSessionUserFromToken(accessToken: string): Promise<SessionUser | null> {
 try {
 const payload = await falcoFetch<{ user: ApiMeUser }>("/api/me", { token: accessToken });
 const perms = payload.user.permissions ?? [];
 return sessionUserFromApiMe(payload.user, perms);
 } catch {
 return null;
 }
}

export async function getServerSessionUser(): Promise<SessionUser | null> {
 const store = await cookies();
 const token = store.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
 if (!token) return null;
 return fetchSessionUserFromToken(token);
}
