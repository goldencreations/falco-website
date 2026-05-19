import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { resolveFalcoAccessToken } from "@/lib/server-falco";

/** Proxies `PATCH /settings/profile/password` (204 on success). */
export async function PATCH(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: unknown;
 try {
 body = await request.json();
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const token = await resolveFalcoAccessToken(request);
 if (!token) {
 return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
 }

 const res = await fetch(`${getFalcoApiBaseUrl()}/settings/profile/password`, {
 method: "PATCH",
 headers: {
 Authorization: `Bearer ${token}`,
 Accept: "application/json",
 "Content-Type": "application/json",
 "User-Agent": "FalcoWebsite/1.0 (Next.js)",
 },
 body: JSON.stringify(body),
 cache: "no-store",
 });

 if (res.status === 204) {
 return new NextResponse(null, { status: 204 });
 }

 const text = await res.text();
 let data: unknown = null;
 if (text) {
 try {
 data = JSON.parse(text);
 } catch {
 data = { message: text };
 }
 }

 const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
 const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
 return NextResponse.json(
 {
 message:
 typeof err.message === "string"
 ? err.message
 : typeof o.message === "string"
 ? o.message
 : "Password change failed",
 details: err.details ?? o.details,
 },
 { status: res.status }
 );
}
