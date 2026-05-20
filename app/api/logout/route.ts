import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
 ACCESS_TOKEN_COOKIE_NAME,
 APP_ROLE_COOKIE_NAME,
 AUTH_COOKIE_NAME,
} from "@/lib/auth";
import { falcoFetch } from "@/lib/falco-api";

function clearAuthCookies(response: NextResponse) {
 const secure = process.env.NODE_ENV === "production";
 const empty = {
 httpOnly: true,
 sameSite: "lax" as const,
 secure,
 path: "/",
 maxAge: 0,
 };
 response.cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", empty);
 response.cookies.set(APP_ROLE_COOKIE_NAME, "", empty);
 response.cookies.set(AUTH_COOKIE_NAME, "", empty);
}

export async function POST() {
 const store = await cookies();
 const token = store.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

 const response = NextResponse.json({ ok: true });

 if (token) {
 try {
 await falcoFetch("/api/logout", { method: "POST", token });
 } catch {
 /* still clear cookies locally */
 }
 }

 clearAuthCookies(response);
 return response;
}
