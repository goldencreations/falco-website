import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import {
 organizationPatchBody,
 parseOrganizationSettings,
 type OrganizationSettings,
} from "@/lib/settings-adapters";
import {
 canManageOrganizationSettings,
 canViewOrganizationSettings,
} from "@/lib/settings-permissions";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /settings/organization`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canViewOrganizationSettings(auth.user)) {
 return NextResponse.json({ message: "Forbidden" }, { status: 403 });
 }

 const res = await falcoServerFetch<unknown>("/settings/organization", { request });
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const settings = parseOrganizationSettings(res.data);
 return NextResponse.json({ settings });
}

/** Proxies `PATCH /settings/organization`. */
export async function PATCH(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canManageOrganizationSettings(auth.user)) {
 return NextResponse.json({ message: "Forbidden" }, { status: 403 });
 }

 let body: OrganizationSettings;
 try {
 body = (await request.json()) as OrganizationSettings;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>("/settings/organization", {
 method: "PATCH",
 body: organizationPatchBody(body),
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const settings = parseOrganizationSettings(res.data);
 return NextResponse.json({ settings });
}
