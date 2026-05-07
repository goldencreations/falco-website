import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, parseSessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/api/login")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = parseSessionToken(token);

  if (
    !user &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/manager") ||
      pathname.startsWith("/officer") ||
      pathname.startsWith("/api"))
  ) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!user && isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!user) return NextResponse.next();

  if (user.role === "branch_manager" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/manager/dashboard", request.url));
  }
  if (user.role === "loan_officer" && (pathname.startsWith("/dashboard") || pathname.startsWith("/manager"))) {
    return NextResponse.redirect(new URL("/officer/dashboard", request.url));
  }
  if (user.role === "super_admin" && pathname.startsWith("/manager")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (user.role === "super_admin" && pathname.startsWith("/officer")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (user.role === "branch_manager" && pathname.startsWith("/officer")) {
    return NextResponse.redirect(new URL("/manager/dashboard", request.url));
  }
  if (pathname.startsWith("/users") && user.role !== "super_admin") {
    return NextResponse.redirect(
      new URL(user.role === "branch_manager" ? "/manager/dashboard" : "/officer/dashboard", request.url)
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)"],
};
