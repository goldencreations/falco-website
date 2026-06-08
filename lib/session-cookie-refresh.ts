import type { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE_NAME, APP_ROLE_COOKIE_NAME } from "@/lib/auth";
import { applyAppRoleCookie } from "@/lib/app-role-cookie";
import { resolveSessionMaxAgeSeconds } from "@/lib/session-config";
import { resolveFalcoAccessToken } from "@/lib/server-falco";
import type { UserRole } from "@/lib/types";

/** Extend httpOnly auth cookies on each successful session check (keeps active users signed in). */
export async function applySlidingSessionCookies(
 response: NextResponse,
 request: Request,
 role: UserRole
): Promise<void> {
 const token = await resolveFalcoAccessToken(request);
 if (!token) return;

 const maxAge = resolveSessionMaxAgeSeconds(true);
 const secure = process.env.NODE_ENV === "production";
 const base = {
 httpOnly: true as const,
 sameSite: "lax" as const,
 secure,
 path: "/",
 maxAge,
 };

 response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, token, base);
 applyAppRoleCookie(response, role, { maxAge, secure });
}
