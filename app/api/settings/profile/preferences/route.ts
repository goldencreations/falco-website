import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { parsePreferences, preferencesPatchBody, type ProfilePreferences } from "@/lib/settings-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `PATCH /settings/profile/preferences`. */
export async function PATCH(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: ProfilePreferences;
 try {
 body = (await request.json()) as ProfilePreferences;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>("/settings/profile/preferences", {
 method: "PATCH",
 body: preferencesPatchBody(body),
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const preferences = parsePreferences(
 res.data && typeof res.data === "object" && "preferences" in (res.data as object)
 ? (res.data as { preferences: unknown }).preferences
 : res.data
 );

 return NextResponse.json({ preferences });
}
