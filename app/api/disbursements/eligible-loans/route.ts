import { NextResponse } from "next/server";

import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { canPrepareDisbursement } from "@/lib/disbursement-permissions";
import { resolveEligibleDisbursementTargets } from "@/lib/disbursement-eligible";

/** Eligible loans and applications for the create-disbursement form (branch-scoped). */
export async function GET(request: Request) {
 try {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canPrepareDisbursement(auth.user)) {
 return NextResponse.json(
 {
 message: "You do not have permission to prepare disbursements (disbursements.prepare).",
 },
 { status: 403 }
 );
 }

 const url = new URL(request.url);
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const { eligible_loans, eligible_applications, branch_scope } =
 await resolveEligibleDisbursementTargets(auth.user, branchId);

 return NextResponse.json({
 eligible_loans,
 eligible_applications,
 branch_scope,
 });
 } catch (err) {
 console.error("[api/disbursements/eligible-loans]", err);
 return NextResponse.json(
 {
 message: err instanceof Error ? err.message : "Failed to load eligible loans",
 eligible_loans: [],
 eligible_applications: [],
 branch_scope: null,
 },
 { status: 500 }
 );
 }
}
