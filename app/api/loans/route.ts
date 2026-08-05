import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { enrichLoansFully } from "@/lib/loan-enrichment";
import { filterLoansForLoanOfficer } from "@/lib/loan-officer-portfolio-server";
import { extractLoansList } from "@/lib/loan-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const pageSize =
 auth.user.role === "loan_officer" || auth.user.role === "branch_manager"
 ? url.searchParams.get("page_size") ?? "100"
 : url.searchParams.get("page_size") ?? "50";

 const res = await falcoServerFetch<unknown>("/loans", {
 request,
 query: {
 page: url.searchParams.get("page") ?? "1",
 page_size: pageSize,
 status: url.searchParams.get("status") ?? undefined,
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 customer_id: url.searchParams.get("customer_id") ?? undefined,
 in_arrears: url.searchParams.get("in_arrears") ?? undefined,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 let loans = await enrichLoansFully(extractLoansList(res.data), {
 request,
 branchId: branchId ?? undefined,
 includeNextDue: url.searchParams.get("include_next_due") === "1",
 });

 if (auth.user.role === "loan_officer" && branchId) {
 loans = await filterLoansForLoanOfficer(loans, request, branchId, auth.user.id);
 }
 const raw = res.data;
 if (raw && typeof raw === "object" && !Array.isArray(raw)) {
 const o = raw as Record<string, unknown>;
 if (Array.isArray(o.data)) return NextResponse.json({ ...o, data: loans });
 if (Array.isArray(o.loans)) return NextResponse.json({ ...o, loans });
 if (Array.isArray(o.items)) return NextResponse.json({ ...o, items: loans });
 }
 return NextResponse.json({ data: loans, loans });
}
