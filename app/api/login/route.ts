import { NextResponse } from "next/server";

const SUPER_ADMIN_EMAIL = "superadmin@falco.com";
const SUPER_ADMIN_PASSWORD = "SuperAdmin@123";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    rememberMe?: boolean;
  };

  const isValidLogin =
    body.email?.toLowerCase() === SUPER_ADMIN_EMAIL &&
    body.password === SUPER_ADMIN_PASSWORD;

  if (!isValidLogin) {
    return NextResponse.json({ message: "Invalid super admin credentials." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set("falco_auth", "super_admin", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: body.rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 8,
  });

  return response;
}
