import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/credit-analysis/applications", {
 request,
 query: {
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "50",
 status: url.searchParams.get("status") ?? undefined,
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 assigned_analyst_id: url.searchParams.get("assigned_analyst_id") ?? undefined,
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
