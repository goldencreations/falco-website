import {
 adaptApiApplicationListRow,
 extractApplicationDetail,
 type ApplicationViewRow,
} from "@/lib/application-adapters";
import {
 ensureApplicationHasRequiredDocuments,
 satisfyRequiredDocumentsForSubmit,
 uploadRequiredDocumentsByType,
 normalizeDocumentType,
 formatRequiredDocumentLabel,
 uploadApplicationDocumentApi,
 fetchApplicationDocumentStatus,
 getMissingRequiredDocumentTypes,
} from "@/lib/application-documents";
import {
 APPLICATION_AUTO_ACTIVATE,
 APPLICATION_AUTO_DISBURSE_CASH,
 APPLICATION_DOCUMENTS_OPTIONAL,
} from "@/lib/application-workflow-config";
import { canFinalApproveApplication } from "@/lib/application-workflow-permissions";
import {
 disburseLoanCashApi,
 extractLoanFromWorkflowResponse,
} from "@/lib/loan-disbursement";
import { formatApiResponseError } from "@/lib/falco-api";
import type { LoanApplicationStatus } from "@/lib/types";

export type ApplicationApprovalResult =
 | { ok: true; data: unknown; message?: string; loanId?: string }
 | { ok: false; error: string };

function loanIdFromApprovalPayload(data: unknown): string | undefined {
 if (!data || typeof data !== "object") return undefined;
 const o = data as Record<string, unknown>;
 if (o.loan_id != null && String(o.loan_id).trim()) return String(o.loan_id).trim();
 const app = o.application;
 if (app && typeof app === "object") {
 const loanId = (app as Record<string, unknown>).loan_id;
 if (loanId != null && String(loanId).trim()) return String(loanId).trim();
 }
 const loan = extractLoanFromWorkflowResponse(data);
 return loan?.id ? String(loan.id) : undefined;
}

/** User-facing success copy after POST /api/applications/:id/approve succeeds. */
export function resolveApplicationApprovalSuccessMessage(
 result: { message?: string; loanId?: string; data?: unknown },
 user: Pick<{ role: string; permissions?: string[] }, "role" | "permissions">
): string {
 const loanId = result.loanId ?? loanIdFromApprovalPayload(result.data);
 const hasLoan = Boolean(loanId) || responseHasCreatedLoan(result.data);
 const raw = result.message?.trim();

 if (hasLoan) {
 return "Application approved successfully. A loan account was created and is pending disbursement — open Loan Disbursement to release funds.";
 }

 if (raw) {
 if (/already approved/i.test(raw)) {
 return "Application is already approved. Open Loan Disbursement if funds have not been released yet.";
 }
 if (/loan account created|pending disbursement/i.test(raw)) {
 return raw;
 }
 if (/needs final approval|lacks loans\.approve|must finalize/i.test(raw)) {
 if (canFinalApproveApplication(user)) {
 return "Application approved successfully. Complete any remaining workflow steps in Loan Disbursement if needed.";
 }
 return "Application approved at manager level. A user with final approval must create the loan before disbursement.";
 }
 return raw;
 }

 if (canFinalApproveApplication(user)) {
 return "Application approved successfully. Open Loan Disbursement when you are ready to release funds.";
 }

 return "Application approved at manager level. Final approval is still required to create the loan account.";
}

export {
 uploadApplicationDocumentApi,
 uploadRequiredDocumentsByType,
 ensureApplicationHasRequiredDocuments,
 fetchApplicationDocumentStatus,
 formatRequiredDocumentLabel,
 getMissingRequiredDocumentTypes,
};

export function extractApplicationIdFromResponse(json: unknown): string | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const app =
 o.application && typeof o.application === "object"
 ? (o.application as Record<string, unknown>)
 : o;
 const id = app.id;
 return id != null ? String(id) : null;
}

export function extractApplicationStatusFromResponse(json: unknown): string | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const app =
 o.application && typeof o.application === "object"
 ? (o.application as Record<string, unknown>)
 : o;
 return app.status != null ? String(app.status) : null;
}

export function responseHasCreatedLoan(json: unknown): boolean {
 if (!json || typeof json !== "object") return false;
 const o = json as Record<string, unknown>;
 return Boolean(o.loan && typeof o.loan === "object");
}

export function formatClientApiError(json: unknown, fallback: string): string {
 return formatApiResponseError(json, fallback);
}

/** Build review payload aligned with `loan-applications-controller.md`. */
export function buildReviewRequestBody(options: {
 decision: "approve" | "reject" | "request_more_info";
 approved_amount?: number;
 review_notes?: string;
 rejection_reason?: string;
}): Record<string, unknown> {
 const { decision, approved_amount, review_notes, rejection_reason } = options;
 const body: Record<string, unknown> = { decision };
 if (decision === "approve") {
 if (approved_amount == null || !Number.isFinite(approved_amount) || approved_amount <= 0) {
 throw new Error("Enter a valid approved amount greater than zero.");
 }
 body.approved_amount = approved_amount;
 }
 if (review_notes?.trim()) body.review_notes = review_notes.trim();
 if (decision === "reject" && rejection_reason?.trim()) {
 body.rejection_reason = rejection_reason.trim();
 }
 return body;
}

async function parseApiError(res: Response, json: unknown): Promise<string> {
 return formatClientApiError(json, `Request failed (${res.status})`);
}

export async function uploadApplicationDocumentsFromForm(
 applicationId: string,
 filesByType: Record<string, File | null | undefined>,
 requiredTypes: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
 if (!requiredTypes.length) return { ok: true };
 if (APPLICATION_DOCUMENTS_OPTIONAL) {
 return satisfyRequiredDocumentsForSubmit(applicationId, filesByType, requiredTypes);
 }
 const missingFiles = requiredTypes.filter((t) => !filesByType[normalizeDocumentType(t)]);
 if (missingFiles.length > 0) {
 return {
 ok: false,
 error: `Upload required documents: ${missingFiles.map(formatRequiredDocumentLabel).join(", ")}`,
 };
 }
 return uploadRequiredDocumentsByType(applicationId, filesByType, requiredTypes);
}

const NON_DELETABLE_STATUSES: LoanApplicationStatus[] = ["disbursed"];

export function canDeleteApplication(
 role: string,
 app: { status: LoanApplicationStatus; created_by?: string },
 userId?: string
): boolean {
 if (NON_DELETABLE_STATUSES.includes(app.status)) return false;
 if (role === "super_admin") return true;
 if (role === "branch_manager") {
 return [
 "draft",
 "submitted",
 "under_review",
 "approved",
 "rejected",
 "cancelled",
 "pending_disbursement",
 ].includes(app.status);
 }
 if (role === "loan_officer") {
 return app.status === "draft" && Boolean(userId) && app.created_by === userId;
 }
 return false;
}

export async function deleteApplicationApi(
 id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
 method: "DELETE",
 credentials: "include",
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 return { ok: false, error: await parseApiError(res, data) };
 }
 return { ok: true };
}

export async function submitApplicationApi(
 id: string
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}/submit`, {
 method: "POST",
 credentials: "include",
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) return { ok: false, error: await parseApiError(res, data) };
 return { ok: true, data };
}

/**
 * Server-driven approval using backend permissions (`loans.review`, `loans.approve`).
 * Manager: first-level review. Super admin: full path through loan creation.
 */
export async function approveApplicationApi(
 id: string,
 approvedAmount: number
): Promise<ApplicationApprovalResult> {
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}/approve`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ approved_amount: approvedAmount }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) return { ok: false, error: await parseApiError(res, data) };
 const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
 const message =
 typeof o.workflow_message === "string" && o.workflow_message.trim()
 ? o.workflow_message.trim()
 : undefined;
 const loanId = loanIdFromApprovalPayload(data);
 return { ok: true, data, message, loanId };
}

/** @deprecated Use `approveApplicationApi`. */
export async function activateApplicationApi(
 id: string,
 approvedAmount: number
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
 const r = await approveApplicationApi(id, approvedAmount);
 return r.ok ? { ok: true, data: r.data } : r;
}

export async function reviewApplicationApi(
 id: string,
 body: {
 decision: "approve" | "reject" | "request_more_info";
 approved_amount?: number;
 review_notes?: string;
 rejection_reason?: string;
 }
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
 let payload: Record<string, unknown>;
 try {
 payload = buildReviewRequestBody(body);
 } catch (e) {
 return { ok: false, error: e instanceof Error ? e.message : "Invalid review request." };
 }
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}/review`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) return { ok: false, error: await parseApiError(res, data) };
 return { ok: true, data };
}

export async function assignApplicationOfficerApi(
 id: string,
 body: { assigned_officer_id?: string; workflow_stage?: string }
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}/assign`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) return { ok: false, error: await parseApiError(res, data) };
 return { ok: true, data };
}

export async function patchApplicationApi(
 id: string,
 body: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) return { ok: false, error: await parseApiError(res, data) };
 return { ok: true, data };
}

const TERMINAL_APPLICATION_STATUSES: LoanApplicationStatus[] = [
 "pending_disbursement",
 "disbursed",
];

const BLOCKED_APPLICATION_STATUSES: LoanApplicationStatus[] = ["rejected", "cancelled"];

const INCOMPLETE_ACTIVATION_STATUSES: LoanApplicationStatus[] = [
 "draft",
 "submitted",
 "under_review",
 "approved",
];

async function refreshApplicationRow(applicationId: string): Promise<ApplicationViewRow | null> {
 return fetchApplicationViewRow(applicationId);
}

async function finalizeLoanActivation(
 applicationId: string,
 approvedAmount: number,
 finalData?: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
 const row = await refreshApplicationRow(applicationId);
 if (!row) {
 return { ok: false, error: "Application not found after activation." };
 }

 if (INCOMPLETE_ACTIVATION_STATUSES.includes(row.status)) {
 return {
 ok: false,
 error: `Activation did not complete — application is still "${row.status.replace(/_/g, " ")}". Final approval or loan creation may have failed on the server.`,
 };
 }

 if (!TERMINAL_APPLICATION_STATUSES.includes(row.status)) {
 return {
 ok: false,
 error: `Unexpected application status "${row.status}" after activation.`,
 };
 }

 if (!APPLICATION_AUTO_ACTIVATE || !APPLICATION_AUTO_DISBURSE_CASH) {
 return { ok: true };
 }

 if (row.status === "disbursed") {
 return { ok: true };
 }

 const loanRef =
 extractLoanFromWorkflowResponse(finalData) ??
 (row.loan_id ? { id: row.loan_id } : null);

 if (!loanRef?.id) {
 return {
 ok: false,
 error:
 "Application reached pending disbursement but no loan is linked. Ask the backend team to return `loan.id` on final approval.",
 };
 }

 const amount = loanRef.principal && loanRef.principal > 0 ? loanRef.principal : approvedAmount;
 const loanStatus = (loanRef.status ?? "").toLowerCase().replace(/-/g, "_");
 if (loanStatus === "active" || loanStatus === "paid_off") {
 return { ok: true };
 }

 const disburse = await disburseLoanCashApi(loanRef.id, amount);
 if (disburse.ok) return { ok: true };

 if (/already|active|disbursed|duplicate|blocked|completed/i.test(disburse.error)) {
 return { ok: true };
 }

 return {
 ok: false,
 error: `Loan was created but could not be activated: ${disburse.error}`,
 };
}

/**
 * Super admin fast-track aligned to backend transitions:
 * draft → submit → (submitted) → assign manager stage → under_review → review approve → approved
 * → assign top_admin stage → review approve (final) → pending_disbursement + loan.
 */
export async function runAdminActivateApplicationWorkflow(
 applicationId: string,
 approvedAmount: number,
 actorName: string,
 documentFiles?: Record<string, File | null | undefined>
): Promise<
 | { ok: true; data?: unknown }
 | { ok: false; error: string; missingDocuments?: string[] }
> {
 let row = await refreshApplicationRow(applicationId);
 if (!row) return { ok: false, error: "Application not found" };

 if (TERMINAL_APPLICATION_STATUSES.includes(row.status)) {
 return finalizeLoanActivation(applicationId, approvedAmount);
 }

 if (BLOCKED_APPLICATION_STATUSES.includes(row.status)) {
 return { ok: false, error: `Cannot activate application in status "${row.status}".` };
 }

 const docs = await ensureApplicationHasRequiredDocuments(
 applicationId,
 documentFiles,
 row.required_documents
 );
 if (!docs.ok) {
 return { ok: false, error: docs.error, missingDocuments: docs.missing };
 }

 let lastStatus = row.status;
 let finalData: unknown;

 for (let step = 0; step < 10; step++) {
 row = (await refreshApplicationRow(applicationId)) ?? row;
 if (TERMINAL_APPLICATION_STATUSES.includes(row.status)) {
 const done = await finalizeLoanActivation(applicationId, approvedAmount, finalData);
 return done.ok ? { ok: true, data: finalData } : done;
 }
 if (BLOCKED_APPLICATION_STATUSES.includes(row.status)) {
 return { ok: false, error: `Cannot activate application in status "${row.status}".` };
 }

 if (row.status === lastStatus && step > 0) {
 return {
 ok: false,
 error: `Workflow stalled at status "${row.status}". Complete the next step manually or contact support.`,
 };
 }
 lastStatus = row.status;

 if (row.status === "draft") {
 const submit = await submitApplicationApi(applicationId);
 if (!submit.ok) {
 const missingDocs = /missing required documents/i.test(submit.error);
 let missingDocuments: string[] | undefined;
 if (missingDocs) {
 const again = await fetchApplicationDocumentStatus(
 applicationId,
 row.product_id,
 row.required_documents
 );
 missingDocuments = again?.missing;
 }
 return { ok: false, error: submit.error, missingDocuments };
 }
 continue;
 }

 if (row.status === "submitted") {
 const assign = await assignApplicationOfficerApi(applicationId, {
 workflow_stage: "manager",
 });
 if (!assign.ok && !/cannot transition/i.test(assign.error)) {
 return assign;
 }
 continue;
 }

 if (row.status === "under_review") {
 const review = await reviewApplicationApi(applicationId, {
 decision: "approve",
 approved_amount: approvedAmount,
 review_notes: `Manager fast-track approval by ${actorName}.`,
 });
 if (!review.ok) return review;
 continue;
 }

 if (row.status === "approved") {
 await assignApplicationOfficerApi(applicationId, { workflow_stage: "top_admin" });
 const final = await runFinalApprovalWorkflow(applicationId, approvedAmount, actorName);
 if (!final.ok) {
 const afterFinal = await refreshApplicationRow(applicationId);
 if (afterFinal && TERMINAL_APPLICATION_STATUSES.includes(afterFinal.status)) {
 const done = await finalizeLoanActivation(applicationId, approvedAmount);
 return done.ok ? { ok: true } : done;
 }
 return final;
 }
 finalData = final.data;
 continue;
 }

 return {
 ok: false,
 error: `Cannot activate application from status "${row.status}".`,
 };
 }

 return {
 ok: false,
 error: `Workflow did not complete. Last status: "${lastStatus}".`,
 };
}

function roleShouldAutoActivate(role: string): boolean {
 return (
 APPLICATION_AUTO_ACTIVATE &&
 (role === "super_admin" || role === "branch_manager" || role === "loan_officer")
 );
}

/** Submit draft to review queue, or fast-track to loan (pending disbursement) when enabled. */
export async function runPostCreateWorkflow(options: {
 applicationId: string;
 isDraft: boolean;
 role: string;
 approvedAmount: number;
 actorName: string;
 documentFiles?: Record<string, File | null | undefined>;
 requiredDocuments?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
 const { applicationId, isDraft, role, approvedAmount } = options;
 if (isDraft) return { ok: true };

 if (options.requiredDocuments?.length) {
 const docs = await satisfyRequiredDocumentsForSubmit(
 applicationId,
 options.documentFiles ?? {},
 options.requiredDocuments
 );
 if (!docs.ok && !APPLICATION_DOCUMENTS_OPTIONAL) return docs;
 }

 if (roleShouldAutoActivate(role)) {
  // Use the server-side approve route which properly handles workflow_stage
  // transitions (assigns "manager" stage before reviewing, then "top_admin" for
  // final approval) rather than manually calling the review endpoint client-side
  // which can result in 422 when the stage hasn't been updated yet.
  const activated = await approveApplicationApi(applicationId, approvedAmount);
  if (activated.ok) return { ok: true };
  if (role === "super_admin" || role === "branch_manager") return activated;
 }

 const submit = await submitApplicationApi(applicationId);
 if (!submit.ok) return submit;

 return { ok: true };
}

export async function runFinalApprovalWorkflow(
 applicationId: string,
 approvedAmount: number,
 actorName: string
): Promise<{ ok: true; data?: unknown } | { ok: false; error: string }> {
 const review = await reviewApplicationApi(applicationId, {
 decision: "approve",
 approved_amount: approvedAmount,
 review_notes: `Final approval by ${actorName} — loan book created for disbursement.`,
 });
 if (!review.ok) return review;
 return { ok: true, data: review.data };
}

export async function fetchApplicationViewRow(id: string): Promise<ApplicationViewRow | null> {
 const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, { credentials: "include" });
 if (!res.ok) return null;
 const json = await res.json();
 const detail = extractApplicationDetail(json);
 if (!detail) return null;
 return adaptApiApplicationListRow({ application: detail });
}

export type ApplicationWorkflowAction = {
 id: string;
 label: string;
 variant?: "default" | "destructive";
 run: () => Promise<{ ok: boolean; error?: string }>;
};

const ADMIN_ACTIVATABLE: LoanApplicationStatus[] = [
 "draft",
 "submitted",
 "under_review",
 "approved",
];

const ADMIN_ALREADY_ACTIVE: LoanApplicationStatus[] = [
 "pending_disbursement",
 "disbursed",
];

export function getApplicationWorkflowActions(
 app: ApplicationViewRow,
 role: string,
 actorName: string
): ApplicationWorkflowAction[] {
 const actions: ApplicationWorkflowAction[] = [];
 const isAdmin = role === "super_admin";
 const isManager = role === "branch_manager";
 const isOfficer = role === "loan_officer";
 const canReview = isAdmin || isManager;
 const amount = app.approved_amount ?? app.requested_amount;

 if (isAdmin && ADMIN_ACTIVATABLE.includes(app.status) && !ADMIN_ALREADY_ACTIVE.includes(app.status)) {
 actions.push({
 id: "admin_activate",
 label: "Activate & create loan",
 run: async () => {
 const r = await runAdminActivateApplicationWorkflow(app.id, amount, actorName);
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 },
 });
 }

 if (app.status === "draft" && (isOfficer || isManager)) {
 actions.push({
 id: "submit",
 label: "Submit for review",
 run: async () => {
 const r = await submitApplicationApi(app.id);
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 },
 });
 }

 if (canReview && !isAdmin && app.status === "under_review") {
 actions.push({
 id: "approve",
 label: "Approve",
 run: async () => {
 const r = await reviewApplicationApi(app.id, {
 decision: "approve",
 approved_amount: amount,
 review_notes: `Approved by ${actorName}.`,
 });
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 },
 });
 }

 if (canReview && (app.status === "submitted" || app.status === "under_review")) {
 actions.push({
 id: "reject",
 label: "Reject",
 variant: "destructive",
 run: async () => {
 const r = await reviewApplicationApi(app.id, {
 decision: "reject",
 rejection_reason: `Rejected by ${actorName}.`,
 });
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 },
 });
 }

 if (canReview && app.status === "under_review") {
 actions.push({
 id: "more_info",
 label: "Request more information",
 run: async () => {
 const r = await reviewApplicationApi(app.id, {
 decision: "request_more_info",
 review_notes: `More information requested by ${actorName}.`,
 });
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 },
 });
 }

 return actions;
}

export type ApplicationChecklistItem = {
 key: string;
 label: string;
 complete: boolean;
 hint?: string;
};

export function buildApplicationChecklist(
 app: ApplicationViewRow,
 role?: string,
 requiredTypes?: string[]
): ApplicationChecklistItem[] {
 const isAdmin = role === "super_admin";
 const purposeOk = Boolean(app.purpose?.trim() && app.purpose.trim().toLowerCase() !== "general purpose");
 const required = requiredTypes ?? app.required_documents ?? [];
 const missingDocs =
 required.length > 0
 ? getMissingRequiredDocumentTypes(app.documents ?? [], required)
 : [];
 const docsOk =
 APPLICATION_DOCUMENTS_OPTIONAL ||
 (required.length > 0 ? missingDocs.length === 0 : (app.documents?.length ?? 0) > 0);
 const activated =
 app.status === "approved" ||
 app.status === "pending_disbursement" ||
 app.status === "disbursed";
 return [
 { key: "customer", label: "Customer linked", complete: Boolean(app.customer_id), hint: "Select customer" },
 { key: "product", label: "Loan product", complete: Boolean(app.product_id), hint: "Select product" },
 {
 key: "amount",
 label: "Requested amount",
 complete: app.requested_amount > 0,
 hint: "Enter amount > 0",
 },
 { key: "term", label: "Term (days)", complete: app.term_days > 0, hint: "Enter term in days" },
 {
 key: "purpose",
 label: "Loan purpose",
 complete: purposeOk,
 hint: "Describe purpose (not placeholder text)",
 },
 {
 key: "documents",
 label: APPLICATION_DOCUMENTS_OPTIONAL ? "Documents (optional)" : "Required documents",
 complete: docsOk,
 hint: APPLICATION_DOCUMENTS_OPTIONAL
 ? "Attach files if available; not required to activate"
 : missingDocs.length > 0
 ? `Missing: ${missingDocs.map(formatRequiredDocumentLabel).join(", ")}`
 : "Upload required documents before submit",
 },
 {
 key: "submit",
 label: APPLICATION_AUTO_ACTIVATE ? "Loan active (disbursement)" : isAdmin ? "Loan active (disbursement)" : "Submitted for review",
 complete: APPLICATION_AUTO_ACTIVATE ? activated : isAdmin ? activated : app.status !== "draft",
 hint: APPLICATION_AUTO_ACTIVATE
 ? "Submit activates the loan for disbursement when permitted"
 : isAdmin
 ? "Use Activate & create loan when checklist is complete"
 : "Submit application when checklist is complete",
 },
 ];
}

export function statusLabel(status: LoanApplicationStatus): string {
 return status.replace(/_/g, " ");
}
