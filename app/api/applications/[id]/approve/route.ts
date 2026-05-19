import { NextResponse } from "next/server";

import { extractApplicationDetail } from "@/lib/application-adapters";

import { runServerApplicationApprovalWorkflow } from "@/lib/application-workflow-server";

import { canRunApplicationApprovalWorkflow } from "@/lib/application-workflow-permissions";

import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";

import { formatFalcoApiError } from "@/lib/falco-api";

import { falcoServerFetch } from "@/lib/server-falco";



/**

 * Approve an application using backend permissions (`/api/me`):

 * - `loans.review` / manager: `under_review` → `approved`

 * - `loans.approve` / admin: `approved` → `pending_disbursement` + loan

 */

export async function POST(

 request: Request,

 context: { params: Promise<{ id: string }> }

) {

 const auth = await requireApiUser(request);

 if ("response" in auth) return auth.response;



 if (!canRunApplicationApprovalWorkflow(auth.user)) {

 return NextResponse.json(

 {

 message:

 "You do not have permission to approve applications. Required: loans.review (manager) or loans.approve (final).",

 },

 { status: 403 }

 );

 }



 const { id } = await context.params;



 let body: Record<string, unknown> = {};

 try {

 const text = await request.text();

 if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;

 } catch {

 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });

 }



 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`);

 if (!pre.ok) {

 return NextResponse.json(

 {

 message: formatFalcoApiError(pre.error),

 details: pre.error.details,

 code: pre.error.code,

 },

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



 const requested = Number(body.approved_amount ?? row?.approved_amount ?? row?.requested_amount ?? 0);

 const approvedAmount = Number.isFinite(requested) && requested > 0 ? requested : Number(row?.requested_amount ?? 0);

 if (!approvedAmount || approvedAmount <= 0) {

 return NextResponse.json(

 {

 message: "approved_amount must be a positive number.",

 details: [{ field: "approved_amount", message: "Enter a valid approved amount." }],

 },

 { status: 400 }

 );

 }



 const result = await runServerApplicationApprovalWorkflow(id, approvedAmount, auth.user);

 if (!result.ok) {

 return NextResponse.json({ message: result.error }, { status: 422 });

 }



 const detail = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`);

 return NextResponse.json({

 ...(detail.ok && detail.data && typeof detail.data === "object" ? detail.data : { application: { id } }),

 loan_id: result.loanId ?? null,

 workflow_message: result.message ?? null,

 });

}


