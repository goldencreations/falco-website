import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
 ACCESS_TOKEN_COOKIE_NAME,
 APP_ROLE_COOKIE_NAME,
} from "@/lib/auth";
import {
 isForbiddenPathForRole,
 loginRedirectForRole,
 ROLE_HOME_PATH,
} from "@/lib/role-portal";
import type { UserRole } from "@/lib/types";

const PUBLIC_PATHS = new Set(["/", "/login"]);

function isPublicPath(pathname: string): boolean {
 return PUBLIC_PATHS.has(pathname);
}

function roleFromCookies(request: NextRequest): UserRole | null {
 const raw = request.cookies.get(APP_ROLE_COOKIE_NAME)?.value;
 if (raw && raw in ROLE_HOME_PATH) return raw as UserRole;
 return null;
}

function redirectHome(request: NextRequest, role: UserRole): NextResponse {
 return NextResponse.redirect(new URL(loginRedirectForRole(role), request.url));
}

export function middleware(request: NextRequest) {
 const { pathname } = request.nextUrl;

 if (
 pathname.startsWith("/_next") ||
 pathname.startsWith("/favicon") ||
 pathname.startsWith("/icon") ||
 pathname.startsWith("/api/login") ||
 pathname.startsWith("/api/health")
 ) {
 return NextResponse.next();
 }

 const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
 const role = roleFromCookies(request);

 const isProtectedApp =
 pathname.startsWith("/dashboard") ||
 pathname.startsWith("/manager") ||
 pathname.startsWith("/officer") ||
 pathname.startsWith("/accountant") ||
 pathname.startsWith("/api");

 if (!accessToken) {
 if (pathname.startsWith("/api")) {
 return NextResponse.json(
 { error: "Unauthorized", message: "Your session expired. Please sign in again." },
 { status: 401 }
 );
 }
 if (isProtectedApp) {
 return NextResponse.redirect(new URL("/", request.url));
 }
 if (!isPublicPath(pathname)) {
 return NextResponse.redirect(new URL("/", request.url));
 }
 return NextResponse.next();
 }

 if (!role) {
 if (isProtectedApp) {
 if (pathname.startsWith("/api")) {
 return NextResponse.json(
 { error: "Unauthorized", message: "Your session expired. Please sign in again." },
 { status: 401 }
 );
 }
 return NextResponse.redirect(new URL("/", request.url));
 }
 return NextResponse.next();
 }

 if (isPublicPath(pathname)) {
 return redirectHome(request, role);
 }

 if (isForbiddenPathForRole(role, pathname)) {
 return redirectHome(request, role);
 }

 return NextResponse.next();
}

export const config = {
 matcher: ["/((?!.*\\..*|_next).*)"],
};
