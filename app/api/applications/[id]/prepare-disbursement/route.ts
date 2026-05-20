import { NextResponse } from "next/server";

import { ensureLoanForDisbursement } from "@/lib/prepare-disbursement-server";
import { canPrepareDisbursement } from "@/lib/disbursement-permissions";
import { ensureResourceBranchAllowed, requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";
import { extractApplicationDetail } from "@/lib/application-adapters";

export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canPrepareDisbursement(auth.user)) {
 return NextResponse.json({ message: "You do not have permission to prepare disbursements." }, { status: 403 });
 }

 const { id } = await context.params;

 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`);
 if (!pre.ok) {
 return NextResponse.json(
 { message: formatFalcoApiError(pre.error), details: pre.error.details },
 { status: pre.error.status }
 );
 }

 const row = extractApplicationDetail(pre.data);
 if (row) {
 const denied = ensureResourceBranchAllowed(
 auth.user,
 row.branch_id != null ? String(row.branch_id) : undefined
 );
 if (denied) return denied;
 }

 let body: Record<string, unknown> = {};
 try {
 const text = await request.text();
 if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const approvedAmount = Number(
 body.approved_amount ?? row?.approved_amount ?? row?.requested_amount ?? 0
 );
 if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
 return NextResponse.json(
 {
 message: "approved_amount must be a positive number.",
 details: [{ field: "approved_amount", message: "Enter a valid approved amount." }],
 },
 { status: 400 }
 );
 }

 const branchId = resolvedBranchIdForListQuery(auth.user, null);
 const result = await ensureLoanForDisbursement(id, approvedAmount, branchId, auth.user);

 if (!result.ok) {
 return NextResponse.json(
 { message: result.error, details: result.details ?? null },
 { status: 422 }
 );
 }

 return NextResponse.json({
 loan_id: result.loan_id,
 loan_number: result.loan_number ?? null,
 application_status: result.application_status ?? null,
 workflow_message: "Loan account is ready for disbursement.",
 });
}
