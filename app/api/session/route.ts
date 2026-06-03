import { NextResponse } from "next/server";
import { APP_ROLE_COOKIE_NAME } from "@/lib/auth";
import { applyAppRoleCookie } from "@/lib/app-role-cookie";
import { requireApiUser } from "@/lib/authorization";
import { applySlidingSessionCookies } from "@/lib/session-cookie-refresh";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const response = NextResponse.json(
 { user: auth.user },
 {
 headers: {
 "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
 Pragma: "no-cache",
 Expires: "0",
 },
 }
 );
 const cookieRole = request.headers
 .get("cookie")
 ?.split(";")
 .map((s) => s.trim())
 .find((p) => p.startsWith(`${APP_ROLE_COOKIE_NAME}=`))
 ?.slice(APP_ROLE_COOKIE_NAME.length + 1);

 if (cookieRole !== auth.user.role) {
 applyAppRoleCookie(response, auth.user.role);
 }

 await applySlidingSessionCookies(response, request, auth.user.role);

 return response;
}
