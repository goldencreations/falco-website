import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { fetchBranchesForSessionUser } from "@/lib/branch-summary-fallback";
import {
 buildOfficerPortfolioSummaryPayload,
 loadOfficerLoansForReports,
} from "@/lib/officer-reports-server";
import { falcoServerFetch } from "@/lib/server-falco";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
 "Cache-Control": "private, no-store, no-cache, must-revalidate, proxy-revalidate",
 Pragma: "no-cache",
};

/** Proxies `GET /reports/portfolio-summary` (see `backend-documentation/reports-controller.md`). */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const asOf = url.searchParams.get("as_of")?.trim() || new Date().toISOString().slice(0, 10);

 if (auth.user.role === "loan_officer") {
 if (!branchId) {
 return NextResponse.json(
 { message: "Your account is not linked to a branch.", metrics: {}, by_product: [], by_branch: [] },
 { status: 400 }
 );
 }
 const loans = await loadOfficerLoansForReports(request, branchId, auth.user.id);
 const branches = await fetchBranchesForSessionUser(auth.user);
 const branchName = branches.find((b) => b.id === branchId)?.name;
 return NextResponse.json(buildOfficerPortfolioSummaryPayload(loans, asOf, branchId, branchName), {
 headers: NO_STORE_HEADERS,
 });
 }

 const res = await falcoServerFetch<unknown>("/reports/portfolio-summary", {
 request,
 query: {
 branch_id: branchId,
 as_of: asOf,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data, { headers: NO_STORE_HEADERS });
}
