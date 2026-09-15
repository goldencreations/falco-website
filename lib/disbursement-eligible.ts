import type { SessionUser } from "@/lib/auth";
import { isBranchDataScoped, isSuperAdmin, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { adaptApiApplicationListRow, extractApplicationsList } from "@/lib/application-adapters";
import {
 isBlockedApplicationRawStatus,
 rawApplicationStatus,
} from "@/lib/application-status";
import {
 buildLoanRowsForDisbursementPicker,
 extractDisbursementsApiPayload,
 extractRawLoanRows,
 indexLoansByApplicationIdFromListJson,
 inFlightReservedByLoanId,
 loanIdsWithBlockingDisbursement,
 mergeEligibleLoanLists,
 type EligibleLoanRow,
} from "@/lib/disbursement-adapters";
import { findLoanIdForApplication } from "@/lib/prepare-disbursement-server";
import { falcoServerFetch } from "@/lib/server-falco";
import type { LoanApplicationStatus } from "@/lib/types";

export type EligibleApplicationRow = {
 id: string;
 application_number: string;
 customer_display_name: string;
 status: LoanApplicationStatus;
 approved_amount: number;
 requested_amount: number;
 branch_id?: string;
 loan_id?: string;
 loan_number?: string;
 /** True when a loan account is linked and can be used in the disbursement form. */
 ready_for_disbursement: boolean;
 needs_final_approval?: boolean;
};

type AppRow = ReturnType<typeof adaptApiApplicationListRow>;

function effectiveBranchScope(user: SessionUser, branchId: string | undefined): string | undefined {
 return resolvedBranchIdForListQuery(user, branchId);
}

function rowInBranchScope(
 user: SessionUser,
 branchId: string | undefined,
 rowBranchId: string | undefined
): boolean {
 const scope = effectiveBranchScope(user, branchId);
 if (!scope) return true;
 const rid = (rowBranchId ?? "").trim();
 if (!rid) return true;
 return rid === scope.trim();
}

/** Any non-terminal application that may appear on the disbursement form. */
function isPipelineApplication(app: AppRow): boolean {
 const raw = app.raw_status ?? rawApplicationStatus(app.status);
 if (isBlockedApplicationRawStatus(raw) || raw === "disbursed") return false;
 return true;
}

function normalizeId(value: string | undefined): string {
 return String(value ?? "").trim();
}

function loanNumberToApplicationNumber(loanNumber: string): string {
 const ln = loanNumber.trim();
 if (ln.toUpperCase().startsWith("LN-")) return ln.slice(3).trim();
 return ln;
}

function toEligibleApplicationRow(app: AppRow, linkedLoan?: EligibleLoanRow): EligibleApplicationRow {
 const raw = app.raw_status ?? rawApplicationStatus(app.status);
 const amount = app.approved_amount ?? app.requested_amount;
 const loanId = linkedLoan?.id ?? app.loan_id;
 const hasLoan = Boolean(loanId);
 const isApproved =
  app.status === "approved" || raw === "approved" || raw === "pending_approval";
 /** Manager can approve, but only super-admin final approval creates the loan for disbursement. */
 const needsFinalApproval = isApproved && !hasLoan;
 const pastFinalApproval =
  raw === "pending_disbursement" ||
  raw === "pending_disbursal" ||
  raw === "awaiting_disbursement" ||
  app.status === "pending_disbursement";
 return {
 id: app.id,
 application_number: app.application_number,
    customer_display_name: app.customerDisplayName || linkedLoan?.customer_display_name || "",
 status: app.status,
 approved_amount: amount,
 requested_amount: app.requested_amount,
 branch_id: app.branch_id || linkedLoan?.branch_id || undefined,
 loan_id: loanId,
 loan_number: linkedLoan?.loan_number ?? app.loan_number,
 /** Ready only when a loan exists, or status is past final approval (not bare manager-approved). */
 ready_for_disbursement: hasLoan || pastFinalApproval,
 needs_final_approval: needsFinalApproval,
 };
}

/** Match loans to applications by id and by `LN-{application_number}` loan numbers. */
function linkApplicationsFromLoans(
 applications: EligibleApplicationRow[],
 loans: EligibleLoanRow[]
): EligibleApplicationRow[] {
 const byId = new Map(applications.map((a) => [normalizeId(a.id), { ...a }]));
 const byNumber = new Map<string, string>();
 for (const app of applications) {
 byNumber.set(app.application_number.trim().toLowerCase(), normalizeId(app.id));
 }

 for (const loan of loans) {
 let appId = normalizeId(loan.application_id);
 if (!appId || !byId.has(appId)) {
 const fromLn = loanNumberToApplicationNumber(loan.loan_number ?? "");
 if (fromLn) appId = byNumber.get(fromLn.toLowerCase()) ?? "";
 }
 if (!appId) continue;
 const app = byId.get(appId);
 if (!app) continue;

 byId.set(appId, {
 ...app,
 loan_id: loan.id,
 loan_number: loan.loan_number ?? app.loan_number,
 ready_for_disbursement: true,
 needs_final_approval: false,
 });
 }

 return Array.from(byId.values());
}

function applicationNumberFromLoan(loan: EligibleLoanRow): string {
 const ln = loan.loan_number ?? "";
 if (ln.startsWith("LN-")) return ln.slice(3);
 return loan.application_number ?? (ln || loan.id);
}

function synthesizeApplicationFromLoan(
 applicationId: string,
 loan: EligibleLoanRow
): EligibleApplicationRow {
 const amount = loan.principal_amount > 0 ? loan.principal_amount : loan.remaining;
 return {
 id: applicationId,
 application_number: applicationNumberFromLoan(loan),
    customer_display_name: loan.customer_display_name ?? "",
 status: "pending_disbursement",
 approved_amount: amount,
 requested_amount: amount,
 branch_id: loan.branch_id,
 loan_id: loan.id,
 loan_number: loan.loan_number,
 ready_for_disbursement: true,
 needs_final_approval: false,
 };
}

export function applyInFlightRemaining(
 rows: EligibleLoanRow[],
 inFlight: Map<string, number>
): EligibleLoanRow[] {
 return rows
 .map((row) => {
 const reserved = inFlight.get(row.id) ?? 0;
 const reportedRemaining = row.remaining > 0 ? row.remaining : row.principal_amount;
 const calculatedRemaining = Math.max(0, row.principal_amount - reserved);
 const remaining = Math.min(reportedRemaining, calculatedRemaining);
 return {
 ...row,
 remaining,
 };
 })
 .filter((row) => row.id && row.principal_amount > 0.009 && row.remaining > 0.009);
}

async function fetchLoansIndexedByApplicationId(
 user: SessionUser,
 branchId: string | undefined,
 disbursements: ReturnType<typeof extractDisbursementsApiPayload>["disbursements"]
): Promise<Map<string, EligibleLoanRow>> {
 const scopeBranch = effectiveBranchScope(user, branchId);
 const blocking = loanIdsWithBlockingDisbursement(disbursements);
 const inFlight = inFlightReservedByLoanId(disbursements);
 const byAppId = new Map<string, EligibleLoanRow>();

 const runQuery = async (branch?: string, status?: string) => {
 for (let page = 1; page <= 8; page++) {
 const res = await falcoServerFetch<unknown>("/loans", {
 query: {
 status,
 page: String(page),
 page_size: "100",
 branch_id: branch,
 },
 });
 if (!res.ok) break;

 const indexed = indexLoansByApplicationIdFromListJson(res.data, {
 blockingIds: blocking,
 inFlight,
 });
 for (const [appId, loan] of indexed) {
 if (!rowInBranchScope(user, branchId, loan.branch_id)) continue;
 const adjusted = applyInFlightRemaining([loan], inFlight)[0];
 if (!adjusted) continue;
 const key = normalizeId(appId);
 const prev = byAppId.get(key);
 if (!prev || adjusted.remaining > prev.remaining) {
 byAppId.set(key, adjusted);
 }
 }

 const batch = buildLoanRowsForDisbursementPicker(res.data, {
 disbursements,
 blockingIds: blocking,
 });
 for (const loan of batch) {
 if (!loan.application_id || blocking.has(loan.id)) continue;
 if (!rowInBranchScope(user, branchId, loan.branch_id)) continue;
 const adjusted = applyInFlightRemaining([loan], inFlight)[0];
 if (!adjusted) continue;
 const key = normalizeId(loan.application_id);
 const prev = byAppId.get(key);
 if (!prev || adjusted.remaining > prev.remaining) {
 byAppId.set(key, adjusted);
 }
 }

 if (extractRawLoanRows(res.data).length < 100) break;
 }
 };

 await runQuery(scopeBranch, undefined);
 if (byAppId.size === 0) await runQuery(scopeBranch, "pending_disbursement");
 if (byAppId.size === 0 && isSuperAdmin(user)) {
 await runQuery(undefined, undefined);
 await runQuery(undefined, "pending_disbursement");
 }

 return byAppId;
}

async function fetchConsoleEligibleLoans(
 user: SessionUser,
 branchId: string | undefined
): Promise<{
 eligible_loans: EligibleLoanRow[];
 disbursements: ReturnType<typeof extractDisbursementsApiPayload>["disbursements"];
}> {
 const scopeBranch = effectiveBranchScope(user, branchId);

 const consoleRes = await falcoServerFetch<unknown>("/disbursements", {
 query: {
 page: "1",
 page_size: "100",
 branch_id: scopeBranch,
 },
 });

 if (!consoleRes.ok) {
 return { eligible_loans: [], disbursements: [] };
 }

 const payload = extractDisbursementsApiPayload(consoleRes.data);
 const blocking = loanIdsWithBlockingDisbursement(payload.disbursements);
 const inFlight = inFlightReservedByLoanId(payload.disbursements);

 const eligible_loans = applyInFlightRemaining(
 payload.eligible_loans.filter((row) => row.id && !blocking.has(row.id)),
 inFlight
 ).filter((loan) => rowInBranchScope(user, branchId, loan.branch_id));

 return { eligible_loans, disbursements: payload.disbursements };
}

async function fetchPipelineApplications(
 user: SessionUser,
 branchId: string | undefined,
 loansByAppId: Map<string, EligibleLoanRow>
): Promise<EligibleApplicationRow[]> {
 const scopeBranch = effectiveBranchScope(user, branchId);
 const byId = new Map<string, EligibleApplicationRow>();

 const addApps = (apps: AppRow[]) => {
 for (const app of apps) {
 if (!app.id || !isPipelineApplication(app)) continue;
 if (!rowInBranchScope(user, branchId, app.branch_id)) continue;
 const linked = loansByAppId.get(normalizeId(app.id));
 byId.set(app.id, toEligibleApplicationRow(app, linked));
 }
 };

 const statusQueries: (string | undefined)[] = [
 "pending_disbursement",
 "approved",
 "pending_approval",
 undefined,
 ];

 for (const status of statusQueries) {
 const res = await falcoServerFetch<unknown>("/applications", {
 query: {
 status,
 page: "1",
 page_size: "100",
 branch_id: scopeBranch,
 },
 });
 if (res.ok) addApps(extractApplicationsList(res.data));
 }

 if (byId.size === 0 && isSuperAdmin(user)) {
 const res = await falcoServerFetch<unknown>("/applications", {
 query: { page: "1", page_size: "100" },
 });
 if (res.ok) addApps(extractApplicationsList(res.data));
 }

 for (const [appId, loan] of loansByAppId) {
 const appKey = normalizeId(appId);
 if (byId.has(appKey) || [...byId.keys()].some((k) => normalizeId(k) === appKey)) {
 const existingKey = [...byId.keys()].find((k) => normalizeId(k) === appKey) ?? appKey;
 const existing = byId.get(existingKey)!;
 if (!existing.loan_id) {
 byId.set(existingKey, {
 ...existing,
 loan_id: loan.id,
 loan_number: loan.loan_number,
 ready_for_disbursement: true,
 needs_final_approval: false,
 });
 }
 continue;
 }
 if (!rowInBranchScope(user, branchId, loan.branch_id)) continue;
 byId.set(appKey, synthesizeApplicationFromLoan(appKey, loan));
 }

 return Array.from(byId.values()).sort((a, b) =>
 a.application_number.localeCompare(b.application_number)
 );
}

function enrichLoansWithApplications(
 loans: EligibleLoanRow[],
 applications: EligibleApplicationRow[],
 blockingLoanIds: Set<string>
): EligibleLoanRow[] {
 const appById = new Map(applications.map((a) => [a.id, a]));
 const appByLoanId = new Map<string, EligibleApplicationRow>();
 for (const app of applications) {
 if (app.loan_id) appByLoanId.set(app.loan_id, app);
 }

 const byId = new Map<string, EligibleLoanRow>();
 for (const loan of loans) {
 const app = loan.application_id
 ? appById.get(loan.application_id)
 : appByLoanId.get(loan.id);
 byId.set(loan.id, {
 ...loan,
 application_id: app?.id ?? loan.application_id,
 application_number: app?.application_number ?? loan.application_number,
 application_status: app?.status ?? loan.application_status,
 customer_display_name: loan.customer_display_name ?? app?.customer_display_name,
 });
 }

 for (const app of applications) {
 if (!app.loan_id || byId.has(app.loan_id) || blockingLoanIds.has(app.loan_id)) continue;
 const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
 byId.set(app.loan_id, {
 id: app.loan_id,
 loan_number: app.loan_number ?? app.loan_id,
 customer_id: "",
 branch_id: app.branch_id,
 principal_amount: amount,
 remaining: amount,
 customer_display_name: app.customer_display_name,
 application_id: app.id,
 application_number: app.application_number,
 application_status: app.status,
 });
 }

 return Array.from(byId.values()).sort((a, b) => a.loan_number.localeCompare(b.loan_number));
}

export function buildSelectableLoansFromApplications(
 applications: EligibleApplicationRow[],
 loanById: Map<string, EligibleLoanRow>,
 blockingLoanIds: Set<string> = new Set()
): EligibleLoanRow[] {
 const rows: EligibleLoanRow[] = [];
 for (const app of applications) {
 if (!app.loan_id || blockingLoanIds.has(app.loan_id)) continue;
 const existing = loanById.get(app.loan_id);
 if (existing) {
 rows.push({
 ...existing,
 application_id: app.id,
 application_number: app.application_number,
 application_status: app.status,
 customer_display_name: existing.customer_display_name ?? app.customer_display_name,
 });
 continue;
 }
 const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
 rows.push({
 id: app.loan_id,
 loan_number: app.loan_number ?? app.loan_id,
 customer_id: "",
 branch_id: app.branch_id,
 principal_amount: amount,
 remaining: amount,
 customer_display_name: app.customer_display_name,
 application_id: app.id,
 application_number: app.application_number,
 application_status: app.status,
 });
 }
 return rows.sort((a, b) => a.loan_number.localeCompare(b.loan_number));
}

/**
 * Require the backend console to confirm that a linked loan is currently eligible.
 * Discovering a loan through `/loans` is not sufficient because it may already have
 * a payout in flight.
 */
export function constrainApplicationsToEligibleLoans(
 applications: EligibleApplicationRow[],
 eligibleLoans: EligibleLoanRow[]
): EligibleApplicationRow[] {
 const eligibleLoanIds = new Set(eligibleLoans.map((loan) => normalizeId(loan.id)).filter(Boolean));

 return applications.map((application) => {
 const loanId = normalizeId(application.loan_id);
 if (loanId && eligibleLoanIds.has(loanId)) {
 return {
 ...application,
 ready_for_disbursement: true,
 needs_final_approval: false,
 };
 }

 if (!application.loan_id && !application.ready_for_disbursement) {
 return application;
 }

 return {
 ...application,
 loan_id: undefined,
 loan_number: undefined,
 ready_for_disbursement: false,
 };
 });
}

export async function resolveEligibleDisbursementTargets(
 user: SessionUser,
 branchId: string | undefined
): Promise<{
 eligible_loans: EligibleLoanRow[];
 eligible_applications: EligibleApplicationRow[];
 branch_scope: string | null;
}> {
 const scope = effectiveBranchScope(user, branchId) ?? null;

 try {
 const { eligible_loans: fromConsole, disbursements } = await fetchConsoleEligibleLoans(
 user,
 branchId
 );
 const blockingLoanIds = loanIdsWithBlockingDisbursement(disbursements);

 const loansByAppId = await fetchLoansIndexedByApplicationId(user, branchId, disbursements);

 let eligible_applications = await fetchPipelineApplications(user, branchId, loansByAppId);

 const authoritativeLoanIds = new Set(fromConsole.map((loan) => normalizeId(loan.id)));
 const verifiedLoanDetails = Array.from(loansByAppId.values()).filter((loan) =>
 authoritativeLoanIds.has(normalizeId(loan.id))
 );
 const mergedLoans = mergeEligibleLoanLists(fromConsole, verifiedLoanDetails);

 eligible_applications = linkApplicationsFromLoans(eligible_applications, mergedLoans);

 const scopeBranch = effectiveBranchScope(user, branchId);
 const missingLoan = eligible_applications.filter((a) => !a.loan_id).slice(0, 25);
 await Promise.all(
 missingLoan.map(async (app) => {
 const found = await findLoanIdForApplication(app.id, app.application_number, scopeBranch);
 if (!found) return;
 const idx = eligible_applications.findIndex((x) => x.id === app.id);
 if (idx < 0) return;
 eligible_applications[idx] = {
 ...eligible_applications[idx],
 loan_id: found.loan_id,
 loan_number: found.loan_number,
 ready_for_disbursement: true,
 needs_final_approval: false,
 };
 })
 );

 eligible_applications = eligible_applications.filter(
 (application) => !application.loan_id || !blockingLoanIds.has(application.loan_id)
 );
 eligible_applications = constrainApplicationsToEligibleLoans(
 eligible_applications,
 mergedLoans
 );

 const enriched_loans = enrichLoansWithApplications(
  mergedLoans,
  eligible_applications,
  blockingLoanIds
 );
 return {
 eligible_loans: enriched_loans,
 eligible_applications,
 branch_scope: isBranchDataScoped(user) ? scope : scope,
 };
 } catch (err) {
 console.error("[disbursement-eligible]", err);
 return {
 eligible_loans: [],
 eligible_applications: [],
 branch_scope: isBranchDataScoped(user) ? scope : scope,
 };
 }
}

export async function resolveEligibleApplications(
 user: SessionUser,
 branchId: string | undefined
): Promise<EligibleApplicationRow[]> {
 const { eligible_applications } = await resolveEligibleDisbursementTargets(user, branchId);
 return eligible_applications;
}

export async function resolveEligibleLoans(
 user: SessionUser,
 branchId: string | undefined
): Promise<EligibleLoanRow[]> {
 const { eligible_loans } = await resolveEligibleDisbursementTargets(user, branchId);
 return eligible_loans;
}
