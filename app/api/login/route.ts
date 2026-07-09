import { NextResponse } from "next/server";
import {
 ACCESS_TOKEN_COOKIE_NAME,
 AUTH_COOKIE_NAME,
} from "@/lib/auth";
import { applyAppRoleCookie, clearAppRoleCookie } from "@/lib/app-role-cookie";
import { FalcoApiError, formatValidationDetails } from "@/lib/falco-api";
import { postStaffLoginToApi, type StaffLoginApiResponse } from "@/lib/falco-staff-login";
import { mapApiRoleToAppRole } from "@/lib/api-roles";
import { loginRedirectForRole } from "@/lib/role-portal";
import {
 resolveSessionMaxAgeSeconds,
 staffRememberMeFromLoginBody,
} from "@/lib/session-config";
import type { UserRole } from "@/lib/types";

type LoginBody = {
 email?: string;
 password?: string;
 rememberMe?: boolean;
};
function redirectForRole(role: UserRole): string {
 return loginRedirectForRole(role);
}

export async function POST(request: Request) {
 let body: LoginBody;
 try {
 body = (await request.json()) as LoginBody;
 } catch {
 return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
 }

 const email = body.email?.trim().toLowerCase();
 const password = body.password;
 if (!email || !password) {
 return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
 }

 try {
 const rememberMe = staffRememberMeFromLoginBody(body.rememberMe);
 const remote: StaffLoginApiResponse = await postStaffLoginToApi({
 email,
 password,
 rememberMe,
 });
 const accessToken =
 remote.access_token ?? remote.tokens?.access_token ?? null;
 if (!accessToken || !remote.user) {
 return NextResponse.json({ message: "Unexpected login response from server" }, { status: 502 });
 }

 const appRole = mapApiRoleToAppRole(remote.user.role);
 if (!appRole) {
 return NextResponse.json({ message: "Unknown account role" }, { status: 502 });
 }

 const maxAge = resolveSessionMaxAgeSeconds(rememberMe, remote.tokens?.expires_in);
 const secure = process.env.NODE_ENV === "production";
 const cookieBase = {
 httpOnly: true as const,
 sameSite: "lax" as const,
 secure,
 path: "/",
 maxAge,
 };

 const response = NextResponse.json({
 ok: true,
 role: appRole,
 redirectTo: redirectForRole(appRole),
 });

 clearAppRoleCookie(response);
 response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, accessToken, cookieBase);
 applyAppRoleCookie(response, appRole, { maxAge, secure });

 response.cookies.set(AUTH_COOKIE_NAME, "", {
 httpOnly: true,
 sameSite: "lax",
 secure,
 path: "/",
 maxAge: 0,
 });

 return response;
 } catch (e) {
 if (e instanceof FalcoApiError) {
 const extra = formatValidationDetails(e.details);
 const message = extra ? `${e.message} (${extra})` : e.message;
 const status =
 e.status === 403
 ? 403
 : e.status === 422
 ? 422
 : e.status === 401
 ? 401
 : e.status === 404
 ? 404
 : e.status === 409
 ? 409
 : e.status === 429
 ? 429
 : e.status >= 500 && e.status < 600
 ? e.status
 : 401;
 return NextResponse.json({ message }, { status });
 }
 const message = e instanceof Error ? e.message : "Login failed";
 if (message.includes("FALCO_API_BASE_URL")) {
 return NextResponse.json(
 { message: "Server is not configured with FALCO_API_BASE_URL" },
 { status: 500 }
 );
 }
 return NextResponse.json({ message: "Unable to reach authentication service" }, { status: 502 });
 }
}
