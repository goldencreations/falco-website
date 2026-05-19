import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { enrichLoansRequiringAttentionPayload } from "@/lib/loan-enrichment";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/dashboard/loans-requiring-attention", {
 request,
 query: { branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")) },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const enriched = await enrichLoansRequiringAttentionPayload(res.data, {
 request,
 branchId: branchId ?? undefined,
 });
 return NextResponse.json(enriched);
}
