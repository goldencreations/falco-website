import { NextResponse } from "next/server";
import { branchIdsMatch, isBranchDataScoped } from "@/lib/branch-scope";
import type { UserRole } from "@/lib/types";
import {
 ACCESS_TOKEN_COOKIE_NAME,
 fetchSessionUserFromToken,
 type SessionUser,
} from "@/lib/auth";

export { isBranchDataScoped } from "@/lib/branch-scope";

function getCookieValue(cookieHeader: string, name: string): string | null {
 const part = cookieHeader
 .split(";")
 .map((s) => s.trim())
 .find((p) => p.startsWith(`${name}=`));
 if (!part) return null;
 return decodeURIComponent(part.slice(name.length + 1));
}

export async function getSessionUserFromRequest(request: Request): Promise<SessionUser | null> {
 const token = getCookieValue(request.headers.get("cookie") ?? "", ACCESS_TOKEN_COOKIE_NAME);
 if (!token) return null;
 return fetchSessionUserFromToken(token);
}

export async function requireApiUser(
 request: Request,
 allowedRoles?: UserRole[]
): Promise<{ user: SessionUser } | { response: NextResponse }> {
 const user = await getSessionUserFromRequest(request);
 if (!user) {
 return {
 response: NextResponse.json(
 {
 error: "Unauthorized",
 message: "Your session expired. Please sign in again.",
 },
 { status: 401 }
 ),
 };
 }
 if (allowedRoles && !allowedRoles.includes(user.role)) {
 return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
 }
 return { user };
}

export function ensureBranchAccess(user: SessionUser, branchId: string): NextResponse | null {
 if (user.role === "super_admin") return null;
 if (isBranchDataScoped(user) && branchId.trim() !== user.branch_id.trim()) {
 return NextResponse.json({ error: "Forbidden for this branch" }, { status: 403 });
 }
 return null;
}

/** Super admin is not list-scoped to a single branch. */
export function isSuperAdmin(user: SessionUser): boolean {
 return user.role === "super_admin";
}

/**
 * Resolves `branch_id` for list endpoints (customers, applications, users, metrics, …).
 * Scoped users always get their assigned branch; super admins may filter optionally.
 */
export function resolvedBranchIdForListQuery(
 user: SessionUser,
 clientBranchId: string | null | undefined
): string | undefined {
 if (isSuperAdmin(user)) {
 const v = clientBranchId?.trim();
 return v ? v : undefined;
 }
 if (isBranchDataScoped(user)) return user.branch_id.trim();
 const v = clientBranchId?.trim();
 return v ? v : undefined;
}

/** Block reading a single record when its `branch_id` does not match the actor's branch. */
export function ensureResourceBranchAllowed(
 user: SessionUser,
 resourceBranchId: string | null | undefined
): NextResponse | null {
 if (!isBranchDataScoped(user)) return null;
 const rid = (resourceBranchId ?? "").trim();
 if (!rid || branchIdsMatch(rid, user.branch_id)) return null;
 return NextResponse.json(
  { error: "Forbidden", message: "This record is outside your branch." },
  { status: 403 }
 );
}

/** For routes with `:id` where `id` is a branch id (e.g. PATCH /branches/{branch}). */
export function ensurePathBranchIdAllowed(user: SessionUser, pathBranchId: string): NextResponse | null {
 if (isSuperAdmin(user)) return null;
 if (!isBranchDataScoped(user)) return null;
 if ((pathBranchId ?? "").trim() !== user.branch_id.trim()) {
 return NextResponse.json(
 { error: "Forbidden", message: "Branch scope violation." },
 { status: 403 }
 );
 }
 return null;
}
