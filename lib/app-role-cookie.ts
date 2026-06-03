import type { NextResponse } from "next/server";
import { APP_ROLE_COOKIE_NAME } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

const COOKIE_OPTS = {
 httpOnly: true as const,
 sameSite: "lax" as const,
 path: "/",
};

export function applyAppRoleCookie(
 response: NextResponse,
 role: UserRole,
 options?: { maxAge?: number; secure?: boolean }
): void {
 const secure = options?.secure ?? process.env.NODE_ENV === "production";
 response.cookies.set(APP_ROLE_COOKIE_NAME, role, {
 ...COOKIE_OPTS,
 secure,
 maxAge: options?.maxAge ?? 60 * 60 * 24 * 30,
 });
}

export function clearAppRoleCookie(response: NextResponse): void {
 const secure = process.env.NODE_ENV === "production";
 response.cookies.set(APP_ROLE_COOKIE_NAME, "", {
 ...COOKIE_OPTS,
 secure,
 maxAge: 0,
 });
}
