import { NextResponse } from "next/server";
import type { UserRole } from "@/lib/types";
import { parseSessionToken, AUTH_COOKIE_NAME, type SessionUser } from "@/lib/auth";

export function getSessionUserFromRequest(request: Request): SessionUser | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const authCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  const value = authCookie?.slice(`${AUTH_COOKIE_NAME}=`.length);
  return parseSessionToken(value);
}

export function requireApiUser(
  request: Request,
  allowedRoles?: UserRole[]
): { user: SessionUser } | { response: NextResponse } {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export function ensureBranchAccess(user: SessionUser, branchId: string): NextResponse | null {
  if (user.role === "super_admin") return null;
  if (user.role === "branch_manager" && user.branch_id !== branchId) {
    return NextResponse.json({ error: "Forbidden for this branch" }, { status: 403 });
  }
  return null;
}
