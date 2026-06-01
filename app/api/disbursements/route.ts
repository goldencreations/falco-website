import { NextResponse } from "next/server";
import {
 extractDisbursementsApiPayload,
 mapUiDisbursementCreateToFalco,
} from "@/lib/disbursement-adapters";
import { extractLoanDetail } from "@/lib/loan-adapters";
import { formatFalcoApiError } from "@/lib/falco-api";
import {
 enrichDisbursementRowsWithCustomerNames,
 enrichDisbursementRowsWithUserNames,
} from "@/lib/disbursement-enrichment";
import { resolveEligibleDisbursementTargets } from "@/lib/disbursement-eligible";
import { canPrepareDisbursement } from "@/lib/disbursement-permissions";
import {
 ensureResourceBranchAllowed,
 requireApiUser,
 resolvedBranchIdForListQuery,
} from "@/lib/authorization";
import { extractRawLoanRows } from "@/lib/disbursement-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));

 const res = await falcoServerFetch<unknown>("/disbursements", {
 query: {
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "50",
 status: url.searchParams.get("status") ?? undefined,
 loan_id: url.searchParams.get("loan_id") ?? undefined,
 search: url.searchParams.get("search") ?? undefined,
 branch_id: branchId,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const payload = extractDisbursementsApiPayload(res.data);
 const withCustomers = await enrichDisbursementRowsWithCustomerNames(payload.disbursements);
 const disbursements = await enrichDisbursementRowsWithUserNames(withCustomers);

 const includeEligible = url.searchParams.get("include_eligible") !== "0";
 const eligible_loans = includeEligible
 ? payload.eligible_loans.length > 0
 ? payload.eligible_loans
 : (await resolveEligibleDisbursementTargets(auth.user, branchId)).eligible_loans
 : [];

 return NextResponse.json({
 disbursements,
 kpis: payload.kpis,
 eligible_loans,
 });
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canPrepareDisbursement(auth.user)) {
 return NextResponse.json(
 { error: "You do not have permission to prepare disbursements." },
 { status: 403 }
 );
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
 }

 const mapped = mapUiDisbursementCreateToFalco(body);
 if (!mapped.loan_id) {
 return NextResponse.json({ message: "loan_id is required", error: "loan_id is required" }, { status: 400 });
 }
 const amount = Number(mapped.amount);
 if (!Number.isFinite(amount) || amount <= 0) {
 return NextResponse.json(
 {
 message: "amount must be a positive number",
 error: "amount must be a positive number",
 details: [{ field: "amount", message: "Enter a valid disbursement amount." }],
 },
 { status: 400 }
 );
 }

 const loanId = String(mapped.loan_id);
 const loanRes = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(loanId)}`);
 if (!loanRes.ok) {
 const msg = formatFalcoApiError(loanRes.error);
 return NextResponse.json(
 { message: msg, error: msg, details: loanRes.error.details },
 { status: loanRes.error.status }
 );
 }
 const loanDetail = extractLoanDetail(loanRes.data);
 const loanRows = extractRawLoanRows(loanRes.data);
 const loanRaw = loanRows[0] ?? (loanRes.data as Record<string, unknown>);
 const loan =
 loanRaw && typeof loanRaw === "object" && loanRaw.loan && typeof loanRaw.loan === "object"
 ? (loanRaw.loan as Record<string, unknown>)
 : (loanRaw as Record<string, unknown>);
 const loanBranchId =
 loan.branch_id != null
 ? String(loan.branch_id)
 : loanDetail?.branch_id
 ? String(loanDetail.branch_id)
 : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, loanBranchId);
 if (denied) return denied;

 const res = await falcoServerFetch<unknown>("/disbursements", {
 method: "POST",
 body: mapped,
 });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}
