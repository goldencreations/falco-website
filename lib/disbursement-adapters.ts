import { adaptApiLoanRow, extractLoansList } from "@/lib/loan-adapters";
import type { Disbursement, DisbursementPaymentChannel, DisbursementStatus } from "@/lib/disbursement-types";

const STATUSES: DisbursementStatus[] = [
 "pending_approval",
 "approved",
 "processing",
 "completed",
 "rejected",
];

function asStatus(v: string | undefined, gateway?: string | null): DisbursementStatus {
 const s = (v ?? "pending_approval").toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
 // Terminal gateway failures map to rejected in the console.
 if (s === "reversed" || s === "cancelled" || s === "canceled" || s === "failed" || s === "refunded") {
  return "rejected";
 }
 // In-flight ClickPesa payout — only after approve submits to the gateway.
 if (s === "processing" || s === "submitted" || s === "payout_authorized") return "processing";
 // Gateway rows still reported as "pending" after submit are awaiting ClickPesa, not staff approval.
 if ((s === "pending" || s === "awaiting_approval") && gateway) return "processing";
 // Console prepare / no gateway yet.
 if (s === "pending" || s === "awaiting_approval") return "pending_approval";
 return STATUSES.includes(s as DisbursementStatus) ? (s as DisbursementStatus) : "pending_approval";
}

/** Map Falco `disbursement_channel` + legacy UI channels to the UI enum used by the disbursement page. */
function asPaymentChannel(v: string | undefined, fallback: string): DisbursementPaymentChannel {
 const raw = (v ?? fallback).toLowerCase();
 if (raw === "mobile_money" || raw === "momo") return "mpesa";
 if (raw === "bank_transfer" || raw === "bank") return "crdb";
 if (
 raw === "mpesa" ||
 raw === "airtel_money" ||
 raw === "yas" ||
 raw === "halopesa" ||
 raw === "crdb" ||
 raw === "nmb" ||
 raw === "cash" ||
 raw === "other"
 ) {
 return raw as DisbursementPaymentChannel;
 }
 return "other";
}

function num(v: unknown, d = 0): number {
 if (v == null || v === "") return d;
 const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
 return Number.isFinite(n) ? n : d;
}

function str(v: unknown, d = ""): string {
 if (v == null) return d;
 return String(v);
}

function unwrapDisbursement(row: Record<string, unknown>): Record<string, unknown> {
 const inner = row.disbursement;
 if (inner && typeof inner === "object") return inner as Record<string, unknown>;
 return row;
}

export type DisbursementViewRow = Disbursement & {
 loan_number?: string;
 customer_display_name?: string;
 prepared_by_name?: string;
 approved_by_name?: string;
 rejected_by_name?: string;
};

function customerDisplayFromRecord(customer: Record<string, unknown> | undefined): string {
 if (!customer) return "";
 const custFn = str(customer.first_name ?? "");
 const custLn = str(customer.last_name ?? "");
 const custFull = str(customer.full_name).trim();
 return custFull || `${custFn} ${custLn}`.trim();
}

function firstNonEmptyStr(...values: unknown[]): string {
 for (const v of values) {
 if (v == null) continue;
 const s = String(v).trim();
 if (s) return s;
 }
 return "";
}

/** Resolve staff display name from nested user object or flat `*_name` fields (never return raw user id). */
function staffDisplayName(
 actor: unknown,
 row: Record<string, unknown>,
 nameKeys: string[]
): string {
 if (actor && typeof actor === "object") {
 const o = actor as Record<string, unknown>;
 const nested = str(o.full_name ?? o.name ?? o.display_name).trim();
 if (nested) return nested;
 }
 for (const key of nameKeys) {
 const label = str(row[key]).trim();
 if (label) return label;
 }
 return "";
}

export function adaptApiDisbursementRow(raw: Record<string, unknown>): DisbursementViewRow {
 const row = unwrapDisbursement(raw);
 const loan = row.loan && typeof row.loan === "object" ? (row.loan as Record<string, unknown>) : undefined;
 const customerFromLoan =
 loan?.customer && typeof loan.customer === "object"
 ? (loan.customer as Record<string, unknown>)
 : undefined;
 const customer =
 row.customer && typeof row.customer === "object"
 ? (row.customer as Record<string, unknown>)
 : customerFromLoan;

 const loanNumber = str(loan?.loan_number ?? row.loan_number);
 const customerDisplay =
 customerDisplayFromRecord(customer) ||
 str(row.customer_name ?? row.customer_display_name ?? row.borrower_name);

 const prepared = row.prepared_by_user ?? row.prepared_by;
 const prepName = staffDisplayName(prepared, row, [
 "prepared_by_name",
 "prepared_by_display_name",
 "creator_name",
 "created_by_name",
 ]);

 const appr = row.approved_by_user ?? row.approved_by;
 const apprName = staffDisplayName(appr, row, ["approved_by_name", "approved_by_display_name"]);

 const rej = row.rejected_by_user ?? row.rejected_by;
 const rejName = staffDisplayName(rej, row, ["rejected_by_name", "rejected_by_display_name"]);

 const method = asPaymentChannel(
 row.disbursement_channel ? str(row.disbursement_channel) : undefined,
 str(row.method ?? row.payment_channel ?? row.disbursement_method ?? "cash")
 );

 const payout =
 row.payout && typeof row.payout === "object"
 ? (row.payout as Record<string, unknown>)
 : row.payment_destination && typeof row.payment_destination === "object"
 ? (row.payment_destination as Record<string, unknown>)
 : undefined;

 const accountName =
 firstNonEmptyStr(
 row.account_name,
 row.bank_account_name,
 payout?.account_name,
 payout?.bank_account_name,
 payout?.recipient_name
 ) || null;
 const accountNumber =
 firstNonEmptyStr(
 row.account_number,
 row.mobile_money_phone,
 row.bank_account_number,
 payout?.account_number,
 payout?.mobile_money_phone,
 payout?.bank_account_number
 ) || null;
 const bankName =
 firstNonEmptyStr(row.bank_name, row.bank, payout?.bank_name, row.bank_bic) || null;

 const gateway = row.gateway != null ? str(row.gateway) : null;

 const canRetryRaw = row.can_retry ?? row.canRetry;
 const can_retry =
  canRetryRaw === true || canRetryRaw === 1 || canRetryRaw === "1" || canRetryRaw === "true";

 return {
 id: str(row.id),
 loan_id: str(row.loan_id ?? loan?.id),
 amount: num(row.amount ?? row.disbursed_amount ?? row.requested_amount, 0),
 method,
 account_name: accountName,
 account_number: accountNumber,
 bank_name: bankName,
 transaction_reference: row.transaction_reference != null ? str(row.transaction_reference) : null,
 status: asStatus(row.status ? str(row.status) : undefined, gateway),
 gateway,
 order_reference: row.order_reference != null ? str(row.order_reference) : null,
 can_retry: can_retry || undefined,
 metadata:
 row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
 ? (row.metadata as Record<string, unknown>)
 : undefined,
 prepared_by: str(row.prepared_by ?? row.created_by ?? ""),
 approved_by: row.approved_by != null ? str(row.approved_by) : null,
 approved_at: row.approved_at ? str(row.approved_at) : null,
 rejected_by: row.rejected_by != null ? str(row.rejected_by) : null,
 rejected_at: row.rejected_at ? str(row.rejected_at) : null,
 rejection_reason: row.rejection_reason != null ? str(row.rejection_reason) : null,
 disbursed_at: row.disbursed_at ? str(row.disbursed_at) : null,
 notes: row.notes != null ? str(row.notes) : null,
 created_at: str(row.created_at, new Date().toISOString()),
 updated_at: str(row.updated_at ?? row.created_at, new Date().toISOString()),

 loan_number: loanNumber || undefined,
 customer_display_name: customerDisplay || undefined,
 prepared_by_name: prepName || undefined,
 approved_by_name: apprName || undefined,
 rejected_by_name: rejName || undefined,
 };
}

export type EligibleLoanRow = {
 id: string;
 loan_number: string;
 customer_id: string;
 branch_id?: string;
 principal_amount: number;
 remaining: number;
 customer_display_name?: string;
 /** Linked loan application (when resolved from `/applications`). */
 application_id?: string;
 application_number?: string;
 application_status?: string;
};

function adaptEligibleLoan(raw: Record<string, unknown>): EligibleLoanRow {
 const loan = raw.loan && typeof raw.loan === "object" ? (raw.loan as Record<string, unknown>) : raw;
 const customer =
 raw.customer && typeof raw.customer === "object" ? (raw.customer as Record<string, unknown>) : undefined;
 const custFn = str(customer?.first_name ?? "");
 const custLn = str(customer?.last_name ?? "");
 const custFull = str(customer?.full_name).trim();
 const customerDisplay = custFull || `${custFn} ${custLn}`.trim();

 const principal = num(loan.principal_amount ?? loan.principal, 0);
 const outstanding = num(
 raw.remaining ??
 raw.remaining_principal ??
 loan.remaining_principal ??
 loan.principal_outstanding ??
 loan.total_outstanding,
 0
 );
 const remaining = outstanding > 0 ? outstanding : principal;

 const app =
 loan.application && typeof loan.application === "object"
 ? (loan.application as Record<string, unknown>)
 : undefined;

 return {
 id: str(loan.id),
 loan_number: str(loan.loan_number ?? loan.id),
 customer_id: str(loan.customer_id ?? ""),
 branch_id: str(loan.branch_id ?? raw.branch_id ?? "") || undefined,
 principal_amount: principal,
 remaining: remaining > 0 ? remaining : principal,
 customer_display_name: customerDisplay || str(raw.customer_name) || undefined,
 application_id: str(loan.application_id ?? app?.id ?? raw.application_id ?? "") || undefined,
 application_number: str(app?.application_number ?? loan.application_number ?? "") || undefined,
 application_status: app?.status != null ? String(app.status) : undefined,
 };
}

export type DisbursementKpis = {
 pending_approval: number;
 approved: number;
 completed: number;
 rejected: number;
 mtd_completed_volume: number;
};

export function extractDisbursementsApiPayload(json: unknown): {
 disbursements: DisbursementViewRow[];
 kpis: DisbursementKpis | null;
 eligible_loans: EligibleLoanRow[];
} {
 if (!json || typeof json !== "object") {
 return { disbursements: [], kpis: null, eligible_loans: [] };
 }
 const o = json as Record<string, unknown>;

 const rawList = o.disbursements ?? o.data ?? [];
 const list = Array.isArray(rawList) ? rawList : [];

 const rawEligible =
 o.eligible_loans ??
 o.eligibleLoans ??
 o.pending_disbursement_loans ??
 o.pendingDisbursementLoans ??
 (Array.isArray(o.loans) ? o.loans : []);
 const eligible = Array.isArray(rawEligible) ? rawEligible : [];

 const kpRaw = o.kpis ?? o.summary;

 const disbursements = (list as Record<string, unknown>[]).map(adaptApiDisbursementRow);
 const eligible_loans = (eligible as Record<string, unknown>[])
 .map(adaptEligibleLoan)
 .filter((row) => Boolean(row.id));

 let kpis: DisbursementKpis | null = null;
 if (kpRaw && typeof kpRaw === "object") {
 const k = kpRaw as Record<string, unknown>;
 kpis = {
 pending_approval: num(k.pending_approval ?? k.pending, 0),
 approved: num(k.approved, 0),
 completed: num(k.completed, 0),
 rejected: num(k.rejected, 0),
 mtd_completed_volume: num(k.mtd_completed_volume ?? k.mtd_volume ?? k.completed_volume_mtd, 0),
 };
 }

 if (!kpis && disbursements.length > 0) {
 kpis = {
 pending_approval: disbursements.filter((d) => d.status === "pending_approval").length,
 approved: disbursements.filter((d) => d.status === "approved").length,
 completed: disbursements.filter((d) => d.status === "completed").length,
 rejected: disbursements.filter((d) => d.status === "rejected").length,
 mtd_completed_volume: disbursements
 .filter((d) => d.status === "completed")
 .reduce((s, d) => s + d.amount, 0),
 };
 }

 return {
 disbursements,
 kpis,
 eligible_loans,
 };
}

function normalizeLoanStatusKey(v: unknown): string {
 return String(v ?? "")
 .trim()
 .toLowerCase()
 .replace(/-/g, "_")
 .replace(/\s+/g, "_");
}

/** True when the loan account is awaiting fund release (`disbursements-controller.md`). */
export function isPendingDisbursementLoanStatus(status: unknown): boolean {
 const s = normalizeLoanStatusKey(status);
 return (
 s === "pending_disbursement" ||
 s === "pending_disbursal" ||
 s === "awaiting_disbursement" ||
 s === "approved_pending_disbursement" ||
 s === "approved" ||
 s === "pending_approval"
 );
}

export function extractRawLoanRows(json: unknown): Record<string, unknown>[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data)
 ? o.data
 : Array.isArray(o.loans)
 ? o.loans
 : Array.isArray(o.items)
 ? o.items
 : [];
 if (!Array.isArray(rows)) return [];
 return rows.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object");
}

function readRawLoanStatus(raw: Record<string, unknown>): string {
 const loan = raw.loan && typeof raw.loan === "object" ? (raw.loan as Record<string, unknown>) : raw;
 return normalizeLoanStatusKey(loan.status ?? loan.loan_status ?? raw.status);
}

/** Whether a loan account can receive a disbursement (`disbursements-controller.md`). */
export function loanIsDisbursable(raw: Record<string, unknown>): boolean {
 if (raw.is_disbursable === true || raw.can_disburse === true || raw.eligible_for_disbursement === true) {
 return true;
 }
 if (isPendingDisbursementLoanStatus(readRawLoanStatus(raw))) return true;

 const loan = raw.loan && typeof raw.loan === "object" ? (raw.loan as Record<string, unknown>) : raw;
 const app =
 raw.application && typeof raw.application === "object"
 ? (raw.application as Record<string, unknown>)
 : loan.application && typeof loan.application === "object"
 ? (loan.application as Record<string, unknown>)
 : undefined;
 if (app && isPendingDisbursementLoanStatus(app.status)) return true;

 const status = readRawLoanStatus(raw);
 const disbursedAt = str(loan.disbursement_date ?? loan.disbursed_at, "");
 const notYetDisbursed =
 !disbursedAt || disbursedAt.startsWith("1970") || disbursedAt === "null";
 const principal = num(loan.principal_amount ?? loan.principal, 0);

 if (notYetDisbursed && principal > 0) {
 if (isPendingDisbursementLoanStatus(status)) return true;
 if (status === "active" || status === "approved") return true;
 }

 if (status && status !== "unknown") {
 if (["paid_off", "written_off", "defaulted", "in_arrears", "restructured"].includes(status)) {
 return false;
 }
 if (status === "active" && !notYetDisbursed) return false;
 }

 return adaptApiLoanRow(raw).status === "pending_disbursement";
}

const BLOCKING_DISBURSEMENT_STATUSES = new Set([
 "pending_approval",
 "approved",
 "completed",
 "pending",
 "processing",
]);

function isAmbiguousRejectedDisbursement(d: DisbursementViewRow): boolean {
 if (d.status !== "rejected") return false;
 const err = d.metadata?.gateway_error;
 const text = typeof err === "string" ? err : "";
 return /cURL error 28|timed out|timeout|ambiguous/i.test(text);
}

/** Loans that already have an active disbursement attempt (`disbursements-controller.md`). */
export function loanIdsWithBlockingDisbursement(disbursements: DisbursementViewRow[]): Set<string> {
 const ids = new Set<string>();
 for (const d of disbursements) {
 if (!d.loan_id) continue;
 const status = String(d.status).toLowerCase().replace(/-/g, "_");
 if (BLOCKING_DISBURSEMENT_STATUSES.has(status) || isAmbiguousRejectedDisbursement(d)) {
 ids.add(d.loan_id);
 }
 }
 return ids;
}

/** Principal reserved by in-flight console rows (pending approval / ClickPesa in flight). */
export function inFlightReservedByLoanId(disbursements: DisbursementViewRow[]): Map<string, number> {
 const map = new Map<string, number>();
 for (const d of disbursements) {
 if (!d.loan_id || d.status === "rejected") continue;
 if (
 d.status !== "pending_approval" &&
 d.status !== "approved" &&
 d.status !== "processing"
 ) {
 continue;
 }
 map.set(d.loan_id, (map.get(d.loan_id) ?? 0) + d.amount);
 }
 return map;
}

/** @deprecated Use inFlightReservedByLoanId */
export function reservedPrincipalByLoanId(disbursements: DisbursementViewRow[]): Map<string, number> {
 return inFlightReservedByLoanId(disbursements);
}

/**
 * Build a disbursement picker row without strict `loanIsDisbursable` checks.
 * Used to link loans to applications when the list API omits `loan_id`.
 */
export function loanRowForDisbursementPicker(
 raw: Record<string, unknown>,
 reservedByLoan: Map<string, number>,
 blockingIds?: Set<string>
): EligibleLoanRow | null {
 const adapted = adaptApiLoanRow(raw);
 if (!adapted.id) return null;
 if (blockingIds?.has(adapted.id)) return null;

 const loan =
 raw.loan && typeof raw.loan === "object" ? (raw.loan as Record<string, unknown>) : raw;
 const status = readRawLoanStatus(raw);
 if (status === "paid_off" || status === "written_off") return null;

 const disbursedAt = str(loan.disbursement_date ?? loan.disbursed_at, "");
 const notYetDisbursed =
 !disbursedAt || disbursedAt.startsWith("1970") || disbursedAt === "null";
 if (status === "active" && !notYetDisbursed && adapted.principal_outstanding <= 0.009) {
 return null;
 }

 const principal =
 adapted.principal_amount > 0
 ? adapted.principal_amount
 : num(loan.principal_amount ?? loan.principal, 0);
 if (principal <= 0) return null;

 const outstanding =
 adapted.principal_outstanding > 0
 ? adapted.principal_outstanding
 : adapted.total_outstanding > 0
 ? adapted.total_outstanding
 : principal;
 const baseRemaining = outstanding > 0 ? outstanding : principal;
 const reserved = reservedByLoan.get(adapted.id) ?? 0;
 const remaining = Math.max(0, baseRemaining - reserved);

 return {
 id: adapted.id,
 loan_number: adapted.loan_number || adapted.id,
 customer_id: adapted.customer_id,
 branch_id: adapted.branch_id || undefined,
 principal_amount: principal,
 remaining: remaining > 0.009 ? remaining : principal,
 customer_display_name: adapted.customerDisplayName || undefined,
 application_id: adapted.application_id || undefined,
 };
}

/** @internal Strict eligibility for API console parity. */
function eligibleRowFromLoanRaw(
 raw: Record<string, unknown>,
 reservedByLoan: Map<string, number>,
 blockingIds?: Set<string>
): EligibleLoanRow | null {
 if (!loanIsDisbursable(raw)) return null;

 const adapted = adaptApiLoanRow(raw);
 if (!adapted.id) return null;
 if (blockingIds?.has(adapted.id)) return null;

 const loan =
 raw.loan && typeof raw.loan === "object" ? (raw.loan as Record<string, unknown>) : raw;
 const principal = num(
 loan.principal_amount ?? loan.principal ?? adapted.principal_amount,
 adapted.principal_amount
 );
 const outstanding = num(
 loan.principal_outstanding ??
 loan.total_outstanding ??
 loan.outstanding_balance ??
 adapted.principal_outstanding,
 principal
 );
 const baseRemaining = outstanding > 0 ? outstanding : principal;
 const reserved = reservedByLoan.get(adapted.id) ?? 0;
 const remaining = Math.max(0, baseRemaining - reserved);
 if (remaining <= 0.009) return null;

 return {
 id: adapted.id,
 loan_number: adapted.loan_number || adapted.id,
 customer_id: adapted.customer_id,
 branch_id: adapted.branch_id || undefined,
 principal_amount: principal > 0 ? principal : adapted.principal_amount,
 remaining,
 customer_display_name: adapted.customerDisplayName || undefined,
 application_id: adapted.application_id || undefined,
 };
}

/** Index every loan with `application_id` for the disbursement application picker. */
export function indexLoansByApplicationIdFromListJson(
 json: unknown,
 options?: {
 blockingIds?: Set<string>;
 inFlight?: Map<string, number>;
 }
): Map<string, EligibleLoanRow> {
 const blocking = options?.blockingIds ?? new Set<string>();
 const inFlight = options?.inFlight ?? new Map<string, number>();
 const byAppId = new Map<string, EligibleLoanRow>();

 for (const l of extractLoansList(json)) {
 const appId = l.application_id?.trim();
 if (!appId || blocking.has(l.id)) continue;
 if (l.status === "paid_off" || l.status === "written_off") continue;

 const principal = l.principal_amount > 0 ? l.principal_amount : 0;
 if (principal <= 0) continue;

 const baseRemaining =
 l.principal_outstanding > 0
 ? l.principal_outstanding
 : l.total_outstanding > 0
 ? l.total_outstanding
 : principal;
 const reserved = inFlight.get(l.id) ?? 0;
 const remaining = Math.max(0, baseRemaining - reserved);

 const row: EligibleLoanRow = {
 id: l.id,
 loan_number: l.loan_number || l.id,
 customer_id: l.customer_id,
 branch_id: l.branch_id || undefined,
 principal_amount: principal,
 remaining: remaining > 0.009 ? remaining : principal,
 customer_display_name: l.customerDisplayName || undefined,
 application_id: appId,
 };

 const prev = byAppId.get(appId);
 if (!prev || row.remaining > prev.remaining) {
 byAppId.set(appId, row);
 }
 }

 return byAppId;
}

/** Derive picker rows from `GET /loans` (relaxed; links applications to loans). */
export function buildLoanRowsForDisbursementPicker(
 json: unknown,
 options?: { disbursements?: DisbursementViewRow[]; blockingIds?: Set<string> }
): EligibleLoanRow[] {
 const disbursements = options?.disbursements ?? [];
 const blocking =
 options?.blockingIds ?? loanIdsWithBlockingDisbursement(disbursements);
 const reserved = inFlightReservedByLoanId(disbursements);
 const rows = extractRawLoanRows(json);
 return rows
 .map((raw) => loanRowForDisbursementPicker(raw, reserved, blocking))
 .filter((r): r is EligibleLoanRow => r != null);
}

/** Derive eligible loans from `GET /loans` when the console omits `eligible_loans`. */
export function buildEligibleLoansFromLoansListJson(
 json: unknown,
 options?: { disbursements?: DisbursementViewRow[]; blockingIds?: Set<string> }
): EligibleLoanRow[] {
 const disbursements = options?.disbursements ?? [];
 const blocking =
 options?.blockingIds ?? loanIdsWithBlockingDisbursement(disbursements);
 const reserved = inFlightReservedByLoanId(disbursements);
 const rows = extractRawLoanRows(json);
 const fromRaw = rows
 .map((raw) => eligibleRowFromLoanRaw(raw, reserved, blocking))
 .filter((r): r is EligibleLoanRow => r != null);

 if (fromRaw.length > 0) return fromRaw;

 const relaxed = buildLoanRowsForDisbursementPicker(json, options);
 if (relaxed.length > 0) return relaxed;

 const fallback: EligibleLoanRow[] = [];
 for (const l of extractLoansList(json)) {
 if (blocking.has(l.id)) continue;
 if (l.status !== "pending_disbursement") continue;
 const baseRemaining =
 l.principal_outstanding > 0 ? l.principal_outstanding : l.principal_amount > 0 ? l.principal_amount : 0;
 const reservedAmt = reserved.get(l.id) ?? 0;
 const remaining = Math.max(0, baseRemaining - reservedAmt);
 if (remaining <= 0.009) continue;
 fallback.push({
 id: l.id,
 loan_number: l.loan_number,
 customer_id: l.customer_id,
 principal_amount: l.principal_amount,
 remaining,
 customer_display_name: l.customerDisplayName || undefined,
 });
 }
 return fallback;
}

/** Merge API `eligible_loans` with `/loans` fallbacks; prefer higher `remaining` per loan id. */
export function mergeEligibleLoanLists(...lists: EligibleLoanRow[][]): EligibleLoanRow[] {
 const byId = new Map<string, EligibleLoanRow>();
 for (const list of lists) {
 for (const row of list) {
 if (!row.id) continue;
 const prev = byId.get(row.id);
 if (!prev || row.remaining > prev.remaining) {
 byId.set(row.id, row);
 } else if (prev && !prev.customer_display_name && row.customer_display_name) {
 byId.set(row.id, { ...prev, customer_display_name: row.customer_display_name });
 }
 }
 }
 return Array.from(byId.values()).sort((a, b) => a.loan_number.localeCompare(b.loan_number));
}

/**
 * Normalize a Tanzanian mobile number to the `255XXXXXXXXX` format required by the
 * mobile-money disbursement gateway (mpesa/airtel_money/yas/halopesa).
 * Accepts `07XXXXXXXX`, `+255XXXXXXXXX`, `255XXXXXXXXX`, or bare `7XXXXXXXX` input.
 */
export function normalizeTanzanianMsisdn(raw: string): string {
 const digits = raw.replace(/\D/g, "");
 if (!digits) return "";
 if (digits.startsWith("255") && digits.length === 12) return digits;
 if (digits.startsWith("0") && digits.length === 10) return `255${digits.slice(1)}`;
 if (digits.length === 9) return `255${digits}`;
 // Fallback: strip a leading country-code-looking "255" duplication or return digits as-is
 // so validation (below) can flag it rather than silently mangling an unrecognized format.
 return digits;
}

/** `true` only for a well-formed `255XXXXXXXXX` (12-digit) Tanzanian MSISDN. */
export function isValidTanzanianMsisdn(value: string): boolean {
 return /^255\d{9}$/.test(value);
}

/** Map UI create form → `POST /disbursements` console body (Falco channel fields + UI aliases). */
export function mapUiDisbursementCreateToFalco(body: Record<string, unknown>): Record<string, unknown> {
 const loanIdRaw = String(body.loan_id ?? "").trim();
 const loanIdNum = Number(loanIdRaw);
 const amount = Number(body.amount);
 const method = String(body.method ?? "cash").toLowerCase();
 const channelPayload = mapUiLoanDisburseToFalco({
 ...body,
 loan_id: loanIdRaw,
 amount,
 disbursed_amount: amount,
 method,
 });

 const payload: Record<string, unknown> = {
 loan_id: Number.isFinite(loanIdNum) && loanIdNum > 0 ? loanIdNum : loanIdRaw,
 amount,
 disbursed_amount: amount,
 method,
 disbursement_channel: channelPayload.disbursement_channel,
 disbursement_date: channelPayload.disbursement_date,
 mobile_money_phone: channelPayload.mobile_money_phone,
 bank_account_number: channelPayload.bank_account_number,
 bank_account_name: channelPayload.bank_account_name,
 bank_bic: channelPayload.bank_bic,
 bank_transfer_type: channelPayload.bank_transfer_type,
 };

 const notes = body.notes != null ? String(body.notes).trim() : "";
 if (notes) payload.notes = notes;

 const accountName = body.account_name != null ? String(body.account_name).trim() : "";
 const accountNumber = body.account_number != null ? String(body.account_number).trim() : "";
 if (accountName) {
 payload.account_name = accountName;
 if (!payload.bank_account_name) payload.bank_account_name = accountName;
 }
 if (accountNumber) {
 const isMobileMoney = channelPayload.disbursement_channel === "mobile_money";
 payload.account_number = isMobileMoney ? normalizeTanzanianMsisdn(accountNumber) : accountNumber;
 if (!payload.mobile_money_phone && isMobileMoney) {
 payload.mobile_money_phone = normalizeTanzanianMsisdn(accountNumber);
 }
 if (!payload.bank_account_number && channelPayload.disbursement_channel === "bank_transfer") {
 payload.bank_account_number = accountNumber;
 }
 }

 const bankName = body.bank_name != null ? String(body.bank_name).trim() : "";
 if (bankName) payload.bank_name = bankName;
 const bankBic = body.bank_bic != null ? String(body.bank_bic).trim() : "";
 if (bankBic) payload.bank_bic = bankBic;
 const bankTransferType =
 body.bank_transfer_type != null ? String(body.bank_transfer_type).trim().toUpperCase() : "";
 if (bankTransferType) payload.bank_transfer_type = bankTransferType;

 const txRef = body.transaction_reference != null ? String(body.transaction_reference).trim() : "";
 if (txRef) payload.transaction_reference = txRef;

 // Never invent or forward order_reference — backend generates a unique ClickPesa reference.
 delete payload.order_reference;

 return payload;
}

/** Map UI / gateway fields → `POST /loans/{id}/disburse` body. */
export function mapUiLoanDisburseToFalco(body: Record<string, unknown>): Record<string, unknown> {
 const loanId = String(body.loan_id ?? "");
 const amount = Number(body.amount ?? body.disbursed_amount);
 const method = String(body.method ?? "cash");
 const notes = body.notes != null ? String(body.notes) : null;
 const disbursementDate = String(body.disbursement_date ?? new Date().toISOString().slice(0, 10));

 const mobileChannels = ["mpesa", "airtel_money", "yas", "halopesa"];
 const bankChannels = ["crdb", "nmb"];

 let disbursement_channel: "cash" | "mobile_money" | "bank_transfer" = "cash";
 if (mobileChannels.includes(method)) disbursement_channel = "mobile_money";
 else if (bankChannels.includes(method)) disbursement_channel = "bank_transfer";

 const base: Record<string, unknown> = {
 loan_id: loanId,
 disbursement_date: disbursementDate,
 disbursed_amount: amount,
 disbursement_channel,
 notes,
 mobile_money_phone: null,
 bank_account_number: null,
 bank_account_name: null,
 bank_bic: null,
 bank_transfer_type: null,
 };

 if (disbursement_channel === "mobile_money") {
 const rawPhone = String(body.account_number ?? body.mobile_money_phone ?? "");
 base.mobile_money_phone = rawPhone.trim() ? normalizeTanzanianMsisdn(rawPhone) : null;
 }

 if (disbursement_channel === "bank_transfer") {
 base.bank_account_number = String(body.account_number ?? "").trim() || null;
 base.bank_account_name = String(body.account_name ?? "").trim() || null;
 base.bank_bic = String(body.bank_bic ?? "").trim() || null;
 base.bank_transfer_type = String(body.bank_transfer_type ?? "").trim().toUpperCase() || null;
 }

 return base;
}
