import { adaptApiApplicationListRow, extractApplicationDetail } from "@/lib/application-adapters";

import {

 isBlockedApplicationRawStatus,

 isFinalApprovalRawStatus,

 isManagerReviewableRawStatus,

 isTerminalApplicationRawStatus,

 normalizeWorkflowStage,

 rawApplicationStatus,

} from "@/lib/application-status";

import {

 canFinalApproveApplication,

 canManagerReviewApplication,

} from "@/lib/application-workflow-permissions";

import type { SessionUser } from "@/lib/auth";

import { formatFalcoApiError, type FalcoApiError } from "@/lib/falco-api";

import { extractLoanFromWorkflowResponse } from "@/lib/loan-disbursement";

import { falcoServerFetch } from "@/lib/server-falco";



type StepResult = { ok: true } | { ok: false; error: string };



type WorkflowRow = ReturnType<typeof adaptApiApplicationListRow>;



function falcoFailure(error: FalcoApiError): StepResult {

 return { ok: false, error: formatFalcoApiError(error) };

}



function buildReviewBody(

 decision: "approve" | "reject" | "request_more_info",

 options: {

 approved_amount?: number;

 review_notes?: string;

 rejection_reason?: string;

 }

): Record<string, unknown> {

 const body: Record<string, unknown> = { decision };

 if (decision === "approve") {

 const amount = options.approved_amount;

 if (amount == null || !Number.isFinite(amount) || amount <= 0) {

 throw new Error("approved_amount must be a positive number for approval.");

 }

 body.approved_amount = amount;

 }

 if (options.review_notes?.trim()) body.review_notes = options.review_notes.trim();

 if (decision === "reject" && options.rejection_reason?.trim()) {

 body.rejection_reason = options.rejection_reason.trim();

 }

 return body;

}



async function fetchApplicationRow(applicationId: string): Promise<WorkflowRow | null> {

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}`);

 if (!res.ok) return null;

 const detail = extractApplicationDetail(res.data);

 if (!detail) return null;

 return adaptApiApplicationListRow({ application: detail });

}



async function postReview(

 applicationId: string,

 body: Record<string, unknown>

): Promise<StepResult & { data?: unknown }> {

 const res = await falcoServerFetch<unknown>(

 `/applications/${encodeURIComponent(applicationId)}/review`,

 { method: "POST", body }

 );

 if (!res.ok) return falcoFailure(res.error);

 return { ok: true, data: res.data };

}



async function postSubmit(applicationId: string): Promise<StepResult> {

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}/submit`, {

 method: "POST",

 });

 if (!res.ok) return falcoFailure(res.error);

 return { ok: true };

}



async function patchAssign(applicationId: string, body: Record<string, unknown>): Promise<StepResult> {

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}/assign`, {

 method: "PATCH",

 body,

 });

 if (!res.ok) {

 if (/cannot transition/i.test(res.error.message)) {

 return { ok: true };

 }

 return falcoFailure(res.error);

 }

 return { ok: true };

}



function describeRow(row: WorkflowRow): string {

 const raw = row.raw_status ?? rawApplicationStatus(row.status);

 const stage = row.workflow_stage ?? "loan_officer";

 return `status "${raw}" (stage: ${stage})`;

}



/**

 * Advances an application through backend workflow using API status + `workflow_stage`

 * and the caller's permissions from `/api/me`.

 */

export async function runServerApplicationApprovalWorkflow(

 applicationId: string,

 approvedAmount: number,

 actor: Pick<SessionUser, "role" | "permissions" | "full_name" | "email">

): Promise<{ ok: true; loanId?: string; message?: string } | { ok: false; error: string }> {

 if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {

 return { ok: false, error: "Approved amount must be greater than zero." };

 }



 const actorName = actor.full_name || actor.email || "Reviewer";

 const mayManagerReview = canManagerReviewApplication(actor);

 const mayFinalApprove = canFinalApproveApplication(actor);



 let row = await fetchApplicationRow(applicationId);

 if (!row) return { ok: false, error: "Application not found." };



 const raw0 = row.raw_status ?? rawApplicationStatus(row.status);

 if (isTerminalApplicationRawStatus(raw0)) {

 const loanId = row.loan_id ?? extractLoanFromWorkflowResponse({ application: row })?.id;

 return {
 ok: true,
 loanId,
 message: loanId
 ? "Application is already approved. The loan account exists and is ready for disbursement."
 : "Application is already approved for disbursement.",
 };

 }

 if (isBlockedApplicationRawStatus(raw0)) {

 return { ok: false, error: `Cannot approve application in ${describeRow(row)}.` };

 }



 let finalData: unknown;

 let progressedManager = false;



 for (let step = 0; step < 14; step++) {

 row = (await fetchApplicationRow(applicationId)) ?? row;

 const raw = row.raw_status ?? rawApplicationStatus(row.status);

 const stage = row.workflow_stage ?? normalizeWorkflowStage(undefined);



 if (isTerminalApplicationRawStatus(raw)) {

 const loanId =

 row.loan_id ?? extractLoanFromWorkflowResponse(finalData)?.id ?? undefined;

 return {
 ok: true,
 loanId,
 message: loanId
 ? "Application approved successfully. Loan created and pending disbursement."
 : "Application approved successfully.",
 };

 }

 if (isBlockedApplicationRawStatus(raw)) {

 return { ok: false, error: `Cannot approve application in ${describeRow(row)}.` };

 }



 if (raw === "draft") {

 const submit = await postSubmit(applicationId);

 if (!submit.ok) return submit;

 continue;

 }



 if (raw === "submitted" || (raw === "pending_review" && stage === "loan_officer")) {

 const assign = await patchAssign(applicationId, { workflow_stage: "manager" });

 if (!assign.ok) return assign;

 continue;

 }



 if (isManagerReviewableRawStatus(raw)) {

 if (!mayManagerReview) {
 return {
 ok: false,
 error: `Application is ${describeRow(row)} and needs manager review. Your account lacks loans.review / applications.review.`,
 };
 }



 if (stage !== "manager") {

 const assign = await patchAssign(applicationId, { workflow_stage: "manager" });

 if (!assign.ok) return assign;

 continue;

 }



 let reviewBody: Record<string, unknown>;

 try {

 reviewBody = buildReviewBody("approve", {

 approved_amount: approvedAmount,

 review_notes: `Manager approval by ${actorName}.`,

 });

 } catch (e) {

 return { ok: false, error: e instanceof Error ? e.message : "Invalid approval amount." };

 }



 const review = await postReview(applicationId, reviewBody);

 if (!review.ok) return review;

 progressedManager = true;

 continue;

 }



 if (isFinalApprovalRawStatus(raw)) {

 if (!mayFinalApprove && mayManagerReview) {

 let finalizeBody: Record<string, unknown>;

 try {

 finalizeBody = buildReviewBody("approve", {

 approved_amount: approvedAmount,

 review_notes: `Disbursement prepare — loan created by ${actorName}.`,

 });

 } catch (e) {

 return { ok: false, error: e instanceof Error ? e.message : "Invalid approval amount." };

 }

 const finalize = await postReview(applicationId, finalizeBody);

 if (!finalize.ok) return finalize;

 finalData = finalize.data;

 const loanId =

 extractLoanFromWorkflowResponse(finalData)?.id ??

 (await fetchApplicationRow(applicationId))?.loan_id;

 if (loanId) {

 return { ok: true, loanId, message: "Loan account created for disbursement." };

 }

 return {

 ok: false,

 error:

 "Application is approved but no loan account was returned. Deploy the latest backend or contact support.",

 };

 }

 if (!mayFinalApprove) {

 return {

 ok: false,

 error: `Application is ${describeRow(row)} and needs final approval. Your account lacks loans.approve.`,

 };

 }



 if (stage !== "top_admin") {

 const assign = await patchAssign(applicationId, { workflow_stage: "top_admin" });

 if (!assign.ok) return assign;

 continue;

 }



 let finalBody: Record<string, unknown>;

 try {

 finalBody = buildReviewBody("approve", {

 approved_amount: approvedAmount,

 review_notes: `Final approval by ${actorName} — loan created for disbursement.`,

 });

 } catch (e) {

 return { ok: false, error: e instanceof Error ? e.message : "Invalid approval amount." };

 }



 const final = await postReview(applicationId, finalBody);

 if (!final.ok) {

 const after = await fetchApplicationRow(applicationId);

 const afterRaw = after?.raw_status ?? rawApplicationStatus(after?.status);

 if (after && afterRaw && isTerminalApplicationRawStatus(afterRaw)) {

 const loanId =

 after.loan_id ?? extractLoanFromWorkflowResponse({ application: after })?.id ?? undefined;

 return { ok: true, loanId };

 }

 return final;

 }

 finalData = final.data;

 continue;

 }



 return {

 ok: false,

 error: `Cannot approve application in ${describeRow(row)}. Expected draft, submitted, under review, or approved.`,

 };

 }



 const last = await fetchApplicationRow(applicationId);

 return {

 ok: false,

 error: `Approval workflow did not complete. Application is still ${last ? describeRow(last) : "unknown"}.`,

 };

}



/** @deprecated Use `runServerApplicationApprovalWorkflow`. */

export async function runServerActivateApplicationWorkflow(

 applicationId: string,

 approvedAmount: number,

 actorName: string

): Promise<{ ok: true; loanId?: string } | { ok: false; error: string }> {

 return runServerApplicationApprovalWorkflow(applicationId, approvedAmount, {

 role: "super_admin",

 permissions: ["loans.review", "loans.approve", "applications.review"],

 full_name: actorName,

 email: "",

 });

}


