import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import {
 filterCustomersForLoanOfficer,
 loadBranchCustomersEnriched,
} from "@/lib/customer-portfolio";

/** Loan officer portfolio: branch customers assigned to the signed-in officer (enriched from LMS). */
export async function GET(request: Request) {
 const auth = await requireApiUser(request, ["loan_officer"]);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 if (!branch_id) {
 return NextResponse.json(
 { message: "Your account is not linked to a branch.", customers: [] },
 { status: 400 }
 );
 }

 const page_size = url.searchParams.get("page_size") ?? "100";
 const allInBranch = await loadBranchCustomersEnriched(request, branch_id, { pageSize: page_size });
 const customers = filterCustomersForLoanOfficer(allInBranch, auth.user.id);

 return NextResponse.json({
 customers,
 meta: {
 branch_id,
 officer_id: auth.user.id,
 total_in_branch: allInBranch.length,
 assigned_count: customers.length,
 },
 });
}
