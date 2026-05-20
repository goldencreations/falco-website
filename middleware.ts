import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
 ACCESS_TOKEN_COOKIE_NAME,
 APP_ROLE_COOKIE_NAME,
 type SessionUser,
} from "@/lib/auth";
import type { UserRole } from "@/lib/types";

const PUBLIC_PATHS = ["/", "/login"];

function isPublicPath(pathname: string): boolean {
 return PUBLIC_PATHS.includes(pathname);
}

function roleFromCookies(request: NextRequest): UserRole | null {
 const raw = request.cookies.get(APP_ROLE_COOKIE_NAME)?.value;
 if (
 raw === "super_admin" ||
 raw === "branch_manager" ||
 raw === "loan_officer" ||
 raw === "credit_analyst" ||
 raw === "collections_officer" ||
 raw === "accountant" ||
 raw === "customer_service"
 ) {
 return raw;
 }
 return null;
}

function syntheticUserForMiddleware(role: UserRole, pathname: string): SessionUser | null {
 /* branch_id unknown in middleware — officer/manager path checks only use role */
 return {
 id: "",
 email: "",
 role,
 branch_id: "",
 full_name: "",
 permissions: [],
 };
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

 const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
 const role = roleFromCookies(request);

 if (
 !accessToken &&
 (pathname.startsWith("/dashboard") ||
 pathname.startsWith("/manager") ||
 pathname.startsWith("/officer") ||
 pathname.startsWith("/api"))
 ) {
 if (pathname.startsWith("/api")) {
 return NextResponse.json(
 {
 error: "Unauthorized",
 message: "Your session expired. Please sign in again.",
 },
 { status: 401 }
 );
 }
 return NextResponse.redirect(new URL("/", request.url));
 }

 if (!accessToken && isPublicPath(pathname)) {
 return NextResponse.next();
 }

 if (!accessToken) {
 return NextResponse.redirect(new URL("/login", request.url));
 }

 if (!role) {
 if (
 pathname.startsWith("/dashboard") ||
 pathname.startsWith("/manager") ||
 pathname.startsWith("/officer") ||
 pathname.startsWith("/api")
 ) {
 if (pathname.startsWith("/api")) {
 return NextResponse.json(
 {
 error: "Unauthorized",
 message: "Your session expired. Please sign in again.",
 },
 { status: 401 }
 );
 }
 return NextResponse.redirect(new URL("/", request.url));
 }
 return NextResponse.next();
 }

 const user = syntheticUserForMiddleware(role, pathname);

 if (user.role === "branch_manager" && pathname.startsWith("/dashboard")) {
 return NextResponse.redirect(new URL("/manager/dashboard", request.url));
 }
 if (
 user.role === "loan_officer" &&
 (pathname.startsWith("/dashboard") || pathname.startsWith("/manager"))
 ) {
 return NextResponse.redirect(new URL("/officer/dashboard", request.url));
 }
 if (user.role === "super_admin" && pathname.startsWith("/manager")) {
 return NextResponse.redirect(new URL("/dashboard", request.url));
 }
 if (user.role === "super_admin" && pathname.startsWith("/officer")) {
 return NextResponse.redirect(new URL("/dashboard", request.url));
 }
 if (user.role === "super_admin" && pathname.startsWith("/staff/team")) {
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
