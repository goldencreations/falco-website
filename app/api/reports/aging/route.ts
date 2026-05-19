import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { buildOfficerAgingPayload, loadOfficerLoansForReports } from "@/lib/officer-reports-server";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /reports/aging`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));

 if (auth.user.role === "loan_officer") {
 if (!branchId) {
 return NextResponse.json({ message: "Your account is not linked to a branch.", rows: [], totals: {} }, { status: 400 });
 }
 const loans = await loadOfficerLoansForReports(request, branchId, auth.user.id);
 return NextResponse.json(buildOfficerAgingPayload(loans));
 }

 const res = await falcoServerFetch<unknown>("/reports/aging", {
 request,
 query: {
 branch_id: branchId,
 as_of: url.searchParams.get("as_of") ?? undefined,
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
