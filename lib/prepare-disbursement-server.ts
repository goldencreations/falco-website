import { adaptApiApplicationListRow, extractApplicationDetail } from "@/lib/application-adapters";
import { runServerApplicationApprovalWorkflow } from "@/lib/application-workflow-server";
import {
 isBlockedApplicationRawStatus,
 isFinalApprovalRawStatus,
 isManagerReviewableRawStatus,
 isTerminalApplicationRawStatus,
 rawApplicationStatus,
} from "@/lib/application-status";
import type { SessionUser } from "@/lib/auth";
import { extractLoansList } from "@/lib/loan-adapters";
import { extractLoanFromWorkflowResponse } from "@/lib/loan-disbursement";
import { formatFalcoApiError, type FalcoApiErrorDetail } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";
import { extractRawLoanRows } from "@/lib/disbursement-adapters";

function normalizeId(value: string | undefined | null): string {
 return String(value ?? "").trim();
}

function loanNumberToApplicationNumber(loanNumber: string): string {
 const ln = loanNumber.trim();
 if (ln.toUpperCase().startsWith("LN-")) return ln.slice(3).trim();
 return ln;
}

/** Locate loan account for an application via `GET /loans` (list API omits `loan_id` on applications). */
export async function findLoanIdForApplication(
 applicationId: string,
 applicationNumber?: string,
 branchId?: string
): Promise<{ loan_id: string; loan_number: string } | null> {
 const appId = normalizeId(applicationId);
 const appNum = (applicationNumber ?? "").trim().toLowerCase();

 const branchPasses: (string | undefined)[] = branchId ? [branchId, undefined] : [undefined];

 for (const branchFilter of branchPasses) {
 for (let page = 1; page <= 15; page++) {
 const res = await falcoServerFetch<unknown>("/loans", {
 query: {
 page: String(page),
 page_size: "100",
 branch_id: branchFilter,
 },
 });
 if (!res.ok) break;

 for (const loan of extractLoansList(res.data)) {
 if (normalizeId(loan.application_id) === appId) {
 return { loan_id: loan.id, loan_number: loan.loan_number || loan.id };
 }
 if (appNum && loan.loan_number) {
 const fromLn = loanNumberToApplicationNumber(loan.loan_number).toLowerCase();
 if (fromLn === appNum) {
 return { loan_id: loan.id, loan_number: loan.loan_number || loan.id };
 }
 }
 }

 if (extractRawLoanRows(res.data).length < 100) break;
 }
 }

 return null;
}

async function fetchApplicationRow(applicationId: string) {
 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}`);
 if (!res.ok) return { row: null as ReturnType<typeof adaptApiApplicationListRow> | null, error: res.error };
 const detail = extractApplicationDetail(res.data);
 if (!detail) return { row: null, error: null };
 return { row: adaptApiApplicationListRow({ application: detail }), error: null };
}

/**
 * Ensures a disbursement loan account exists for an application.
 * 1. Reuse existing loan from `/loans`
 * 2. Otherwise `POST /applications/{id}/review` approve (manager: under_review→loan, admin: approved→loan)
 */
export async function ensureLoanForDisbursement(
 applicationId: string,
 approvedAmount: number,
 branchId?: string,
 actor?: Pick<SessionUser, "role" | "permissions" | "full_name" | "email">
): Promise<
 | { ok: true; loan_id: string; loan_number?: string; application_status?: string }
 | { ok: false; error: string; details?: FalcoApiErrorDetail[] }
> {
 const { row, error: fetchErr } = await fetchApplicationRow(applicationId);
 if (fetchErr) {
 return { ok: false, error: formatFalcoApiError(fetchErr), details: fetchErr.details };
 }
 if (!row) {
 return { ok: false, error: "Application not found." };
 }

 const scopeBranch = branchId ?? row.branch_id;

 const existing = await findLoanIdForApplication(applicationId, row.application_number, scopeBranch);
 if (existing) {
 return {
 ok: true,
 loan_id: existing.loan_id,
 loan_number: existing.loan_number,
 application_status: row.status,
 };
 }

 const raw = row.raw_status ?? rawApplicationStatus(row.status);

 if (isBlockedApplicationRawStatus(raw) || raw === "disbursed") {
 return { ok: false, error: `Application cannot be disbursed while in status "${raw}".` };
 }

 if (isTerminalApplicationRawStatus(raw)) {
 return {
 ok: false,
 error:
 "Application is pending disbursement but no loan account was found. Refresh or contact support.",
 };
 }

 if (!isFinalApprovalRawStatus(raw) && !isManagerReviewableRawStatus(raw)) {
 return {
 ok: false,
 error: `Application is in status "${raw}". Complete review and approval before disbursement.`,
 };
 }

 if (actor) {
 const workflow = await runServerApplicationApprovalWorkflow(applicationId, approvedAmount, actor);
 if (!workflow.ok) {
 const msg = workflow.error;
 const needsDeploy =
 /cannot transition/i.test(msg) ||
 /no loan account was returned/i.test(msg) ||
 /needs final approval/i.test(msg);
 return {
 ok: false,
 error: needsDeploy
 ? `${msg} Deploy the latest Falco backend so branch managers can create loan accounts from approved applications.`
 : msg,
 };
 }
 if (workflow.loanId) {
 const linked = await findLoanIdForApplication(
 applicationId,
 row.application_number,
 scopeBranch
 );
 return {
 ok: true,
 loan_id: workflow.loanId,
 loan_number: linked?.loan_number,
 application_status: "pending_disbursement",
 };
 }
 }

 const reviewRes = await falcoServerFetch<unknown>(
 `/applications/${encodeURIComponent(applicationId)}/review`,
 {
 method: "POST",
 body: {
 decision: "approve",
 approved_amount: approvedAmount,
 review_notes: "Prepared for disbursement from disbursement console.",
 },
 }
 );

 if (!reviewRes.ok) {
 const msg = formatFalcoApiError(reviewRes.error);
 const needsDeploy = /cannot transition/i.test(msg);
 return {
 ok: false,
 error: needsDeploy
 ? `${msg} Deploy the latest Falco backend so branch managers can create loan accounts from approved applications.`
 : msg,
 details: reviewRes.error.details,
 };
 }

 const fromResponse = extractLoanFromWorkflowResponse(reviewRes.data);
 if (fromResponse?.id) {
 const linked = await findLoanIdForApplication(
 applicationId,
 row.application_number,
 scopeBranch
 );
 return {
 ok: true,
 loan_id: fromResponse.id,
 loan_number: linked?.loan_number,
 application_status: "pending_disbursement",
 };
 }

 const afterLoan = await findLoanIdForApplication(applicationId, row.application_number, scopeBranch);
 if (afterLoan) {
 return {
 ok: true,
 loan_id: afterLoan.loan_id,
 loan_number: afterLoan.loan_number,
 application_status: "pending_disbursement",
 };
 }

 const afterApp = await fetchApplicationRow(applicationId);
 if (afterApp.row?.loan_id) {
 return {
 ok: true,
 loan_id: afterApp.row.loan_id,
 loan_number: afterApp.row.loan_number,
 application_status: afterApp.row.status,
 };
 }

 return {
 ok: false,
 error:
 "Approval succeeded but no loan account was returned. A super-admin may need to finalize approval on Pending Review, or deploy the updated backend that creates loans for managers.",
 };
}
