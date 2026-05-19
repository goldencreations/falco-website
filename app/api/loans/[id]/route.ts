import { NextResponse } from "next/server";
import { extractLoanDetail } from "@/lib/loan-adapters";
import {
 requireApiUser,
 ensureResourceBranchAllowed,
 resolvedBranchIdForListQuery,
} from "@/lib/authorization";
import { enrichLoansFully, mergeEnrichedLoanIntoDetailPayload } from "@/lib/loan-enrichment";
import { ensureLoanInOfficerPortfolio } from "@/lib/loan-officer-portfolio-server";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const res = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(id)}`, { request });
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const loan = extractLoanDetail(res.data);
 if (loan) {
 const denied = ensureResourceBranchAllowed(auth.user, loan.branch_id);
 if (denied) return denied;

 const branchId = resolvedBranchIdForListQuery(auth.user, null);
 const [enriched] = await enrichLoansFully([loan], {
 request,
 branchId: branchId || loan.branch_id || undefined,
 });

 const portfolio = await ensureLoanInOfficerPortfolio(enriched, request, auth.user);
 if (!portfolio.allowed) {
 return NextResponse.json({ message: portfolio.message }, { status: 403 });
 }

 const payload = mergeEnrichedLoanIntoDetailPayload(res.data, enriched);
 return NextResponse.json(payload);
 }
 return NextResponse.json(res.data);
}
