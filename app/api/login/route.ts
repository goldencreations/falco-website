import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, authenticateByEmailPassword, buildSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
 const body = (await request.json()) as {
 email?: string;
 password?: string;
 rememberMe?: boolean;
 };

 const user = authenticateByEmailPassword({ email: body.email, password: body.password });
 if (!user) {
 return NextResponse.json(
 { message: "Invalid credentials. Use configured Super Admin, Branch Manager, or Loan Officer accounts." },
 { status: 401 }
 );
 }

 const redirectTo =
 user.role === "branch_manager"
 ? "/manager/dashboard"
 : user.role === "loan_officer"
 ? "/officer/dashboard"
 : "/dashboard";

 const response = NextResponse.json({
 ok: true,
 role: user.role,
 redirectTo,
 });

 response.cookies.set(AUTH_COOKIE_NAME, buildSessionToken(user), {
 httpOnly: true,
 sameSite: "lax",
 secure: process.env.NODE_ENV === "production",
 path: "/",
 maxAge: body.rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 8,
 });

 return response;
}
