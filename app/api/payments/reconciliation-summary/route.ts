import { NextResponse } from "next/server";
import { extractReconciliationSummary } from "@/lib/payment-adapters";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/payments/reconciliation-summary", {
 request,
 query: {
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 },
 });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
 { status: res.error.status }
 );
 }

 const summary = extractReconciliationSummary(res.data);
 return NextResponse.json({ summary });
}
