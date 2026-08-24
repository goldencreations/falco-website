import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery, isBranchDataScoped } from "@/lib/authorization";
import { canCreateGroups, isCreateOnlyGroupOfficer } from "@/lib/group-access";
import { mapFormToGroupApi } from "@/lib/group-payload";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /groups` and `POST /groups`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/groups", {
 request,
 query: {
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 status: url.searchParams.get("status") ?? undefined,
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "100",
 q: url.searchParams.get("q") ?? undefined,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canCreateGroups(auth.user)) {
 return NextResponse.json(
 { message: "You do not have permission to create this group." },
 { status: 403 }
 );
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const apiBody = mapFormToGroupApi(body);
 if (isCreateOnlyGroupOfficer(auth.user)) {
 apiBody.branch_id = auth.user.branch_id;
 apiBody.loan_officer_id = auth.user.id;
 } else if (isBranchDataScoped(auth.user)) {
 apiBody.branch_id = auth.user.branch_id;
 }

 const res = await falcoServerFetch<unknown>("/groups", {
 method: "POST",
 body: apiBody,
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 {
 message: res.error.message,
 code: res.error.code,
 details: res.error.details,
 },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data, { status: 201 });
}
