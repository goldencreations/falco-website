import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  APP_ROLE_COOKIE_NAME,
  AUTH_COOKIE_NAME,
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

/** Redirect to login and clear all auth cookies to break any redirect loops. */
function redirectToLogin(request: NextRequest): NextResponse {
  const secure = process.env.NODE_ENV === "production";
  // Use ?logged_out=1 so the public-path → redirectHome branch is skipped
  // even if the browser fails to process the Set-Cookie headers on a 3xx.
  const loginUrl = new URL("/?logged_out=1", request.url);
  const response = NextResponse.redirect(loginUrl);
  const cookieBase = { httpOnly: true as const, sameSite: "lax" as const, secure, path: "/", maxAge: 0 };
  response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", cookieBase);
  response.cookies.set(APP_ROLE_COOKIE_NAME, "", cookieBase);
  response.cookies.set(AUTH_COOKIE_NAME, "", cookieBase);
  return response;
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
    if (isProtectedApp || !isPublicPath(pathname)) {
      return redirectToLogin(request);
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
      return redirectToLogin(request);
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    // Skip auto-redirect if arriving via a forced logout — show the login page.
    const loggedOut = request.nextUrl.searchParams.get("logged_out");
    if (loggedOut) return NextResponse.next();
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
