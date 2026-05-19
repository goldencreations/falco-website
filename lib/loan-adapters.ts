import { adaptApiCustomerRowToCustomer, resolveCustomerLoanOfficerId } from "@/lib/customer-adapters";
import type {
 Customer,
 Loan,
 LoanStatus,
 Payment,
 RepaymentFrequency,
 RepaymentSchedule,
 RiskClassification,
} from "@/lib/types";

function unwrapLoanRecord(row: Record<string, unknown>): Record<string, unknown> {
 const inner = row.loan;
 if (inner && typeof inner === "object") {
 const li = { ...(inner as Record<string, unknown>) };
 if (row.customer) li.customer = row.customer;
 if (row.product) li.product = row.product;
 if (row.branch) li.branch = row.branch;
 if (row.loan_officer) li.loan_officer = row.loan_officer;
 if (row.application) li.application = row.application;
 return li;
 }
 return row;
}

const LOAN_STATUSES: LoanStatus[] = [
 "draft",
 "pending_disbursement",
 "active",
 "in_arrears",
 "defaulted",
 "written_off",
 "paid_off",
 "restructured",
];

function asLoanStatus(v: string | undefined): LoanStatus {
 const raw = (v ?? "").trim().toLowerCase().replace(/-/g, "_");
 if (!raw) return "pending_disbursement";
 const aliases: Record<string, LoanStatus> = {
 approved: "pending_disbursement",
 pending_approval: "pending_disbursement",
 pending_disbursal: "pending_disbursement",
 awaiting_disbursement: "pending_disbursement",
 };
 if (aliases[raw]) return aliases[raw];
 const s = raw as LoanStatus;
 return LOAN_STATUSES.includes(s) ? s : "pending_disbursement";
}

const RISK: RiskClassification[] = [
 "current",
 "especially_mentioned",
 "substandard",
 "doubtful",
 "loss",
];

function asRiskClassification(v: string | undefined): RiskClassification {
 const s = (v ?? "current").toLowerCase().replace(/-/g, "_") as RiskClassification;
 return RISK.includes(s) ? s : "current";
}

function asRepaymentFrequency(v: string | undefined): RepaymentFrequency {
 if (v === "weekly" || v === "daily" || v === "bi_weekly" || v === "monthly") return v;
 return "monthly";
}

function num(v: unknown, fallback = 0): number {
 if (v == null || v === "") return fallback;
 const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
 return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
 if (v == null) return fallback;
 return String(v);
}

function customerDisplayFromRow(c: Record<string, unknown> | undefined): { name: string; phone: string } {
 if (!c) return { name: "", phone: "" };
 const fn = str(c.first_name);
 const ln = str(c.last_name);
 const full = str(c.full_name).trim();
 const name = full || `${fn} ${ln}`.trim();
 const phone = str(c.phone_number ?? c.phone_primary ?? "");
 return { name, phone };
}

/** Resolve customer id from loan row, nested customer, or parent application. */
export function resolveLoanCustomerId(row: Record<string, unknown>): string {
 const direct = str(row.customer_id ?? row.customerId ?? "");
 if (direct) return direct;
 const customer = row.customer;
 if (customer && typeof customer === "object") {
 const id = str((customer as Record<string, unknown>).id ?? "");
 if (id) return id;
 }
 const application = row.application;
 if (application && typeof application === "object") {
 const app = application as Record<string, unknown>;
 const fromApp = str(app.customer_id ?? app.customerId ?? "");
 if (fromApp) return fromApp;
 const appCustomer = app.customer;
 if (appCustomer && typeof appCustomer === "object") {
 const id = str((appCustomer as Record<string, unknown>).id ?? "");
 if (id) return id;
 }
 }
 return "";
}

export function resolveLoanProductId(row: Record<string, unknown>): string {
 const direct = str(row.product_id ?? row.productId ?? "");
 if (direct) return direct;
 const application = row.application;
 if (application && typeof application === "object") {
 const app = application as Record<string, unknown>;
 const fromApp = str(app.product_id ?? app.productId ?? "");
 if (fromApp) return fromApp;
 }
 return "";
}

function productNameFromRow(row: Record<string, unknown>): string {
 const p = row.product;
 if (p && typeof p === "object") return str((p as Record<string, unknown>).name);
 return str(row.product_name);
}

function branchNameFromRow(row: Record<string, unknown>): string {
 const b = row.branch;
 if (b && typeof b === "object") return str((b as Record<string, unknown>).name);
 return str(row.branch_name);
}

function officerIdFromRow(row: Record<string, unknown>): string {
 if (row.loan_officer_id != null && String(row.loan_officer_id).trim()) {
 return str(row.loan_officer_id);
 }
 if (row.assigned_officer_id != null && String(row.assigned_officer_id).trim()) {
 return str(row.assigned_officer_id);
 }
 const o = row.loan_officer ?? row.assigned_officer ?? row.officer;
 if (o && typeof o === "object") {
 const id = (o as Record<string, unknown>).id;
 if (id != null && String(id).trim()) return str(id);
 }
 const customer = row.customer;
 if (customer && typeof customer === "object") {
 const fromCustomer = resolveCustomerLoanOfficerId(customer as Record<string, unknown>);
 if (fromCustomer) return fromCustomer;
 }
 return "";
}

function officerNameFromRow(row: Record<string, unknown>): string {
 const o = row.loan_officer ?? row.assigned_officer ?? row.officer;
 if (o && typeof o === "object") return str((o as Record<string, unknown>).full_name);
 return str(row.loan_officer_name ?? row.officer_name);
}

/** Loan row for list/detail with display strings resolved from nested API objects when present. */
export type LoanListRow = Loan & {
 customerDisplayName: string;
 customerPhone: string;
 productName: string;
 branchName: string;
 loanOfficerDisplayName: string;
 /** Completed payments recorded in LMS for this loan (from payments API). */
 payment_count?: number;
 payments_recorded_total?: number;
 last_payment_date?: string;
};

function isEnrichedLoanListRow(row: Record<string, unknown>): boolean {
 return (
 typeof row.customerDisplayName === "string" &&
 (row.payments_recorded_total != null || row.payment_count != null)
 );
}

export function adaptApiLoanRow(raw: Record<string, unknown>): LoanListRow {
 const row = unwrapLoanRecord(raw);

 const principal = num(row.principal_amount ?? row.principal ?? row.disbursed_principal);
 const interest = num(row.interest_amount ?? row.total_interest);
 const fees = num(row.total_fees ?? row.fees_amount);
 const totalAmount = num(row.total_amount, principal + interest + fees);

 const principalOut = num(row.principal_outstanding ?? row.principal_remaining, principal);
 const interestOut = num(row.interest_outstanding ?? row.interest_remaining, interest);
 const feesOut = num(row.fees_outstanding, fees);
 const totalOut = num(row.total_outstanding ?? row.outstanding_balance, principalOut + interestOut + feesOut);

 const principalPaid = num(row.principal_paid);
 const interestPaid = num(row.interest_paid);
 const feesPaid = num(row.fees_paid);
 const totalPaid = num(row.total_paid, principalPaid + interestPaid + feesPaid);

 const customer = row.customer && typeof row.customer === "object" ? (row.customer as Record<string, unknown>) : undefined;
 const { name: custName, phone: custPhone } = customerDisplayFromRow(customer);
 const flatCustomerName = str(
 row.customer_name ??
 row.customer_display_name ??
 row.customer_full_name ??
 row.borrower_name ??
 ""
 ).trim();
 const flatCustomerPhone = str(row.customer_phone ?? row.phone_primary ?? row.phone_number ?? "").trim();
 const passThroughName = str(row.customerDisplayName ?? "").trim();
 const passThroughProduct = str(row.productName ?? "").trim();
 const passThroughPhone = str(row.customerPhone ?? "").trim();

 const applicationId = str(row.application_id ?? row.applicationId ?? "");

 return {
 id: str(row.id),
 loan_number: str(row.loan_number ?? row.loan_no ?? row.id),
 application_id: applicationId,
 customer_id: resolveLoanCustomerId(row),
 loan_mode: row.loan_mode === "group_based" ? "group_based" : "individual",
 group_id: row.group_id ? str(row.group_id) : undefined,
 product_id: resolveLoanProductId(row),
 branch_id: str(row.branch_id ?? ""),

 principal_amount: principal,
 interest_amount: interest,
 total_fees: fees,
 total_amount: totalAmount,

 principal_outstanding: principalOut,
 interest_outstanding: interestOut,
 fees_outstanding: feesOut,
 total_outstanding: totalOut,

 principal_paid: principalPaid,
 interest_paid: interestPaid,
 fees_paid: feesPaid,
 total_paid: totalPaid,

 term_days: num(row.term_days, 0),
 interest_rate: num(row.interest_rate ?? row.annual_interest_rate, 0),
 installment_amount: num(row.installment_amount ?? row.monthly_installment, 0),
 repayment_frequency: asRepaymentFrequency(row.repayment_frequency ? str(row.repayment_frequency) : undefined),

 disbursement_date: str(row.disbursement_date ?? row.disbursed_at ?? row.created_at, "1970-01-01"),
 first_payment_date: str(row.first_payment_date ?? row.first_due_date ?? row.disbursement_date, "1970-01-01"),
 maturity_date: str(row.maturity_date ?? row.maturity_at ?? row.due_date, "1970-01-01"),
 last_payment_date: row.last_payment_date ? str(row.last_payment_date) : undefined,

 status: asLoanStatus(row.status ? str(row.status) : undefined),
 days_in_arrears: num(row.days_in_arrears ?? row.days_overdue ?? row.days_past_due, 0),
 risk_classification: asRiskClassification(row.risk_classification ? str(row.risk_classification) : undefined),

 loan_officer_id: (() => {
 const id = officerIdFromRow(row);
 return id || undefined;
 })(),
 manager_id: row.manager_id ? str(row.manager_id) : undefined,

 disbursed_by: str(
 row.disbursed_by ??
 row.disbursed_by_id ??
 row.disbursed_by_user_id ??
 officerIdFromRow(row) ??
 ""
 ),
 created_at: str(row.created_at, new Date().toISOString()),
 updated_at: str(row.updated_at ?? row.created_at, new Date().toISOString()),

 customerDisplayName: passThroughName || custName || flatCustomerName,
 customerPhone: passThroughPhone || custPhone || flatCustomerPhone,
 productName: passThroughProduct || productNameFromRow(row),
 payment_count:
 row.payment_count != null ? num(row.payment_count) : undefined,
 payments_recorded_total:
 row.payments_recorded_total != null ? num(row.payments_recorded_total) : undefined,
 last_payment_date: row.last_payment_date ? str(row.last_payment_date) : undefined,
 branchName: branchNameFromRow(row) || "—",
 loanOfficerDisplayName: officerNameFromRow(row) || "—",
 };
}

export function extractLoansList(json: unknown): LoanListRow[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.loans) ? o.loans : Array.isArray(o.items) ? o.items : [];
 if (!Array.isArray(rows)) return [];
 return (rows as Record<string, unknown>[]).map((r) => adaptApiLoanRow(r));
}

/** Use server-enriched loan rows when present; otherwise adapt raw LMS list payloads. */
export function parseLoansFromApiResponse(json: unknown): LoanListRow[] {
 const rows = extractLoansList(json);
 if (!rows.length) return rows;
 const first = rows[0] as unknown as Record<string, unknown>;
 if (isEnrichedLoanListRow(first)) {
 return rows;
 }
 return rows;
}

export function extractLoanDetail(json: unknown): LoanListRow | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const loanObj =
 o.loan && typeof o.loan === "object" ? (o.loan as Record<string, unknown>) : unwrapLoanRecord(o);
 const merged: Record<string, unknown> = { ...loanObj };
 if (o.customer) merged.customer = o.customer;
 if (o.product) merged.product = o.product;
 if (o.branch) merged.branch = o.branch;
 if (o.loan_officer) merged.loan_officer = o.loan_officer;
 if (o.application) merged.application = o.application;
 if (!merged.id && !merged.loan_number) return null;
 return adaptApiLoanRow(merged);
}

export function extractCustomerFromLoanDetail(json: unknown): Customer | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const c = o.customer;
 if (!c || typeof c !== "object") return null;
 return adaptApiCustomerRowToCustomer(c as Record<string, unknown>);
}

export function adaptApiScheduleRow(raw: Record<string, unknown>): RepaymentSchedule {
 return {
 id: str(raw.id ?? `${raw.loan_id}-${raw.installment_number ?? raw.installment_no}`),
 loan_id: str(raw.loan_id ?? ""),
 installment_number: num(raw.installment_number ?? raw.installment_no ?? raw.sequence, 0),
 due_date: str(raw.due_date ?? raw.scheduled_date, "1970-01-01"),

 principal_due: num(raw.principal_due ?? raw.principal_amount, 0),
 interest_due: num(raw.interest_due ?? raw.interest_amount, 0),
 fees_due: num(raw.fees_due ?? raw.fees_amount, 0),
 total_due: num(raw.total_due ?? raw.amount_due, 0),

 principal_paid: num(raw.principal_paid, 0),
 interest_paid: num(raw.interest_paid, 0),
 fees_paid: num(raw.fees_paid, 0),
 total_paid: num(raw.total_paid, 0),

 balance: num(raw.balance ?? raw.remaining_balance, 0),
 is_paid: Boolean(raw.is_paid ?? raw.paid ?? num(raw.balance, 1) === 0),
 paid_date: raw.paid_date ? str(raw.paid_date) : undefined,
 days_overdue: num(raw.days_overdue ?? raw.days_late, 0),
 };
}

export function extractScheduleList(json: unknown): RepaymentSchedule[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data)
 ? o.data
 : Array.isArray(o.schedule)
 ? o.schedule
 : Array.isArray(o.installments)
 ? o.installments
 : Array.isArray(o.rows)
 ? o.rows
 : [];
 if (!Array.isArray(rows)) return [];
 return (rows as Record<string, unknown>[]).map(adaptApiScheduleRow);
}

function asPaymentMethod(v: string | undefined): Payment["payment_method"] {
 const s = (v ?? "cash").toLowerCase();
 if (s === "mobile_money" || s === "bank_transfer" || s === "cheque" || s === "cash") return s as Payment["payment_method"];
 return "cash";
}

function asPaymentStatus(v: string | undefined): Payment["status"] {
 const s = (v ?? "completed").toLowerCase();
 if (s === "verified") return "completed";
 if (s === "pending" || s === "completed" || s === "failed" || s === "reversed") {
 return s as Payment["status"];
 }
 return "completed";
}

export function adaptApiPaymentRow(raw: Record<string, unknown>): Payment {
 const inner = raw.payment && typeof raw.payment === "object" ? (raw.payment as Record<string, unknown>) : raw;
 return {
 id: str(inner.id),
 payment_number: str(inner.payment_number ?? inner.reference_number ?? inner.id),
 loan_id: str(inner.loan_id ?? ""),
 customer_id: str(inner.customer_id ?? ""),

 amount: num(inner.amount, 0),
 payment_method: asPaymentMethod(inner.payment_method ? str(inner.payment_method) : undefined),
 reference_number: str(inner.reference_number ?? inner.reference ?? ""),

 principal_allocated: num(inner.principal_allocated ?? inner.principal_amount, 0),
 interest_allocated: num(inner.interest_allocated ?? inner.interest_amount, 0),
 fees_allocated: num(inner.fees_allocated ?? inner.fees_amount, 0),
 penalty_allocated: num(inner.penalty_allocated ?? inner.penalty_amount, 0),

 status: asPaymentStatus(inner.status ? str(inner.status) : undefined),
 payment_date: str(inner.payment_date ?? inner.paid_at ?? inner.created_at, "1970-01-01"),

 mobile_money_provider: inner.mobile_money_provider ? str(inner.mobile_money_provider) : undefined,
 mobile_money_number: inner.mobile_money_number ? str(inner.mobile_money_number) : undefined,

 notes: inner.notes ? str(inner.notes) : undefined,
 received_by: str(inner.received_by ?? inner.recorded_by ?? ""),
 created_at: str(inner.created_at ?? inner.payment_date, "1970-01-01"),
 };
}

export function extractPaymentsList(json: unknown): Payment[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.payments) ? o.payments : [];
 if (!Array.isArray(rows)) return [];
 return (rows as Record<string, unknown>[]).map(adaptApiPaymentRow);
}

export function extractCollectionActivitiesCount(json: unknown): number {
 if (!json || typeof json !== "object") return 0;
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.activities) ? o.activities : [];
 return Array.isArray(rows) ? rows.length : 0;
}
