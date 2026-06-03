import type { LoanApplicationStatus } from "@/lib/types";

/** Normalize API status strings to app `LoanApplicationStatus` values. */
export function normalizeApplicationStatus(raw: string | undefined | null): LoanApplicationStatus {
 const s = rawApplicationStatus(raw);
 const aliases: Record<string, LoanApplicationStatus> = {
 pending_review: "under_review",
 in_review: "under_review",
 reviewing: "under_review",
 pending_approval: "approved",
 awaiting_approval: "approved",
 pending_disbursal: "pending_disbursement",
 awaiting_disbursement: "pending_disbursement",
 };
 if (aliases[s]) return aliases[s];

 const allowed: LoanApplicationStatus[] = [
 "draft",
 "submitted",
 "under_review",
 "approved",
 "pending_disbursement",
 "rejected",
 "disbursed",
 "cancelled",
 ];
 return allowed.includes(s as LoanApplicationStatus) ? (s as LoanApplicationStatus) : "draft";
}

export function rawApplicationStatus(raw: string | undefined | null): string {
 return String(raw ?? "draft")
 .trim()
 .toLowerCase()
 .replace(/-/g, "_");
}

export type ApplicationWorkflowStage = "loan_officer" | "manager" | "top_admin" | "completed";

export function normalizeWorkflowStage(raw: string | undefined | null): ApplicationWorkflowStage {
 const s = String(raw ?? "loan_officer")
 .trim()
 .toLowerCase()
 .replace(/-/g, "_");
 if (s === "manager" || s === "top_admin" || s === "completed" || s === "loan_officer") {
 return s;
 }
 return "loan_officer";
}

/** Statuses where manager-level `POST .../review` approve is valid on the API. */
export function isManagerReviewableRawStatus(raw: string): boolean {
 return raw === "under_review" || raw === "pending_review" || raw === "submitted";
}

/** Statuses where super-admin final `POST .../review` approve creates the loan. */
export function isFinalApprovalRawStatus(raw: string): boolean {
 return raw === "approved" || raw === "pending_approval";
}

export function isTerminalApplicationRawStatus(raw: string): boolean {
 return raw === "pending_disbursement" || raw === "disbursed";
}

export function isBlockedApplicationRawStatus(raw: string): boolean {
 return raw === "rejected" || raw === "cancelled";
}

/** Draft / submitted / in review — not yet approved. */
export function isPendingApplicationStatus(status: LoanApplicationStatus): boolean {
 return status === "draft" || status === "submitted" || status === "under_review";
}

/** Approved through disbursement (matches applications list KPIs). */
export function isApprovedApplicationStatus(status: LoanApplicationStatus): boolean {
 return status === "approved" || status === "pending_disbursement" || status === "disbursed";
}

/** Application (and linked loan) is ready for the disbursement console. */
export function isApplicationReadyForDisbursement(
 rawOrStatus: string | undefined | null,
 normalized?: LoanApplicationStatus
): boolean {
 const raw = rawApplicationStatus(rawOrStatus);
 if (raw === "disbursed" || isBlockedApplicationRawStatus(raw)) return false;
 if (
 raw === "pending_disbursement" ||
 raw === "pending_disbursal" ||
 raw === "awaiting_disbursement"
 ) {
 return true;
 }
 /** Manager-approved apps with a created loan account are disbursable on the console. */
 if (raw === "approved" || raw === "pending_approval") return true;
 return normalized === "pending_disbursement" || normalized === "approved";
}
