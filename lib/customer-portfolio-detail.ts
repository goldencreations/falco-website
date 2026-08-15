import { extractApplicationsList } from "@/lib/application-adapters";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { ensureResourceBranchAllowed } from "@/lib/authorization";
import type { SessionUser } from "@/lib/auth";
import {
 extractLoansList,
 type LoanListRow,
} from "@/lib/loan-adapters";
import { applyPaymentTotalsToLoans } from "@/lib/loan-enrichment";
import { effectiveCustomerTotalPaid } from "@/lib/loan-display";
import { extractPaymentsPayload, type PaymentViewRow } from "@/lib/payment-adapters";
import { falcoServerFetch } from "@/lib/server-falco";
import type { ApplicationViewRow } from "@/lib/application-adapters";
import type { Payment } from "@/lib/types";

export type PaymentTrendPoint = {
 month: string;
 expected: number;
 actual: number;
 onTime: number;
};

export type LoanDistributionPoint = {
 name: string;
 value: number;
};

export type CreditScorePoint = {
 month: string;
 score: number;
};

export type BalanceSnapshotPoint = {
 name: string;
 paid: number;
 outstanding: number;
};

export type CustomerPortfolioData = {
 loans: LoanListRow[];
 payments: Payment[];
 applications: ApplicationViewRow[];
 paymentTrend: PaymentTrendPoint[];
 loanDistribution: LoanDistributionPoint[];
 creditHistory: CreditScorePoint[];
 balanceSnapshot: BalanceSnapshotPoint[];
 summary: {
 total_loans: number;
 total_borrowed: number;
 total_paid: number;
 total_outstanding: number;
 total_payments: number;
 active_loans: number;
 completed_loans: number;
 };
};

function monthLabel(d: Date): string {
 return d.toLocaleString("en", { month: "short" });
}

/** Last N calendar months including current month. */
export function lastMonthKeys(count: number): Date[] {
 const now = new Date();
 const months: Date[] = [];
 for (let i = count - 1; i >= 0; i--) {
 months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
 }
 return months;
}

export function buildPaymentTrend(
 loans: LoanListRow[],
 payments: Payment[],
 monthCount = 8
): PaymentTrendPoint[] {
 const months = lastMonthKeys(monthCount);
 const monthlyExpected = loans
 .filter((l) => l.status === "active" || l.status === "in_arrears")
 .reduce((sum, l) => sum + l.installment_amount, 0);

 return months.map((monthStart) => {
 const y = monthStart.getFullYear();
 const m = monthStart.getMonth();
 const inMonth = payments.filter((p) => {
 const pd = new Date(p.payment_date);
 return pd.getFullYear() === y && pd.getMonth() === m;
 });
 const completed = inMonth.filter((p) => {
 const s = String(p.status ?? "").toLowerCase();
 return !s || s === "completed" || s === "verified";
 });
 const actual = completed.reduce((sum, p) => sum + p.amount, 0);
 const onTime =
 inMonth.length > 0 ? Math.round((completed.length / inMonth.length) * 100) : 0;
 return {
 month: monthLabel(monthStart),
 expected: monthlyExpected,
 actual,
 onTime,
 };
 });
}

export function buildLoanDistribution(loans: LoanListRow[]): LoanDistributionPoint[] {
 const distribution: Record<string, number> = {};
 for (const loan of loans) {
 const name = loan.productName?.trim() || loan.product_id || "Other";
 distribution[name] = (distribution[name] || 0) + loan.principal_amount;
 }
 return Object.entries(distribution).map(([name, value]) => ({ name, value }));
}

/** Interpolate credit score from customer join date to current score (no random mock). */
export function buildCreditScoreHistory(
 currentScore: number,
 customerSince: string,
 monthCount = 8
): CreditScorePoint[] {
 const start = new Date(customerSince);
 const score = Math.max(300, Math.min(850, currentScore));
 const months = lastMonthKeys(monthCount);
 const startScore = Math.max(300, score - Math.min(80, Math.max(20, score - 550)));

 return months.map((monthStart, index) => {
 const t = months.length <= 1 ? 1 : index / (months.length - 1);
 const interpolated = Math.round(startScore + (score - startScore) * t);
 const clamped = Math.max(300, Math.min(850, interpolated));
 if (monthStart < start && index === 0) {
 return { month: monthLabel(monthStart), score: startScore };
 }
 return { month: monthLabel(monthStart), score: clamped };
 });
}

export function buildBalanceSnapshot(loans: LoanListRow[], payments: Payment[] = []): BalanceSnapshotPoint[] {
 const paid = effectiveCustomerTotalPaid(loans, payments);
 const outstanding = loans.reduce((sum, l) => sum + l.total_outstanding, 0);
 return [{ name: "Portfolio", paid, outstanding }];
}

function mergePaymentsById(rows: PaymentViewRow[]): PaymentViewRow[] {
 const byId = new Map<string, PaymentViewRow>();
 for (const row of rows) {
 const key = row.id || `${row.loan_id}:${row.reference_number}:${row.payment_date}:${row.amount}`;
 if (!byId.has(key)) byId.set(key, row);
 }
 return [...byId.values()].sort((a, b) => String(b.payment_date).localeCompare(String(a.payment_date)));
}

function paymentBelongsToCustomer(
 payment: PaymentViewRow,
 customerId: string,
 loanIds: Set<string>,
 loanNumbers: Set<string>
): boolean {
 if (payment.customer_id && payment.customer_id === customerId) return true;
 if (payment.loan_id && loanIds.has(payment.loan_id)) return true;
 const loanNumber = payment.loan_number?.trim().toLowerCase();
 if (loanNumber && loanNumbers.has(loanNumber)) return true;
 return false;
}

function mergeLoansById(rows: LoanListRow[]): LoanListRow[] {
 const byId = new Map<string, LoanListRow>();
 for (const row of rows) {
 if (!row.id) continue;
 byId.set(row.id, row);
 }
 return [...byId.values()];
}

async function loadCustomerLoans(
 request: Request,
 customerId: string,
 branchId: string
): Promise<LoanListRow[]> {
 const collected: LoanListRow[] = [];

 const byCustomer = await falcoServerFetch<unknown>("/loans", {
 request,
 query: {
 customer_id: customerId,
 branch_id: branchId,
 page: "1",
 page_size: "100",
 },
 });
 if (byCustomer.ok) {
 collected.push(
 ...extractLoansList(byCustomer.data).filter((l) => !l.customer_id || l.customer_id === customerId)
 );
 }

 // Payments console resolves loans from the branch list; do the same so we don't miss
 // Automatic payments when `customer_id` filtering on /loans is incomplete.
 for (let page = 1; page <= 15; page++) {
 const res = await falcoServerFetch<unknown>("/loans", {
 request,
 query: {
 page: String(page),
 page_size: "100",
 branch_id: branchId || undefined,
 },
 });
 if (!res.ok) break;
 const batch = extractLoansList(res.data);
 for (const loan of batch) {
 if (loan.customer_id === customerId) collected.push(loan);
 }
 if (batch.length < 100) break;
 }

 return mergeLoansById(collected);
}

/**
 * Load payments the same way the Payments console does (branch list), then keep rows
 * for this customer. Also tries customer_id / loan_id filters when the API supports them.
 */
async function loadCustomerPayments(
 request: Request,
 customerId: string,
 branchId: string,
 loans: LoanListRow[]
): Promise<PaymentViewRow[]> {
 const loanIds = new Set(loans.map((l) => l.id).filter(Boolean));
 const loanNumbers = new Set(
 loans.map((l) => l.loan_number?.trim().toLowerCase()).filter((n): n is string => Boolean(n))
 );
 const collected: PaymentViewRow[] = [];

 const byCustomer = await falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 customer_id: customerId,
 branch_id: branchId,
 page: "1",
 page_size: "200",
 },
 });
 if (byCustomer.ok) {
 collected.push(
 ...extractPaymentsPayload(byCustomer.data).payments.filter((p) =>
 paymentBelongsToCustomer(p, customerId, loanIds, loanNumbers)
 )
 );
 }

 await Promise.all(
 [...loanIds].map(async (loanId) => {
 const res = await falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 loan_id: loanId,
 page: "1",
 page_size: "200",
 },
 });
 if (res.ok) collected.push(...extractPaymentsPayload(res.data).payments);
 })
 );

 // Same source as Payments page: branch-wide list, then filter to this customer / their loans.
 for (let page = 1; page <= 25; page++) {
 const res = await falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 page: String(page),
 page_size: "200",
 branch_id: branchId || undefined,
 },
 });
 if (!res.ok) break;
 const batch = extractPaymentsPayload(res.data).payments;
 for (const p of batch) {
 if (paymentBelongsToCustomer(p, customerId, loanIds, loanNumbers)) collected.push(p);
 }
 if (batch.length < 200) break;
 }

 // Attach loan_number from our loan set so payment↔loan matching is reliable.
 return mergePaymentsById(collected).map((p) => {
 if (p.loan_number?.trim()) return p;
 const loan = loans.find((l) => l.id === p.loan_id);
 return loan?.loan_number ? { ...p, loan_number: loan.loan_number } : p;
 });
}

export function summarizePortfolio(loans: LoanListRow[], payments: Payment[]) {
 const total_borrowed = loans.reduce((sum, l) => sum + l.principal_amount, 0);
 const total_paid = effectiveCustomerTotalPaid(loans, payments);
 const total_outstanding = loans.reduce((sum, l) => sum + l.total_outstanding, 0);
 const active_loans = loans.filter((l) => l.status === "active" || l.status === "in_arrears").length;
 const completed_loans = loans.filter((l) => l.status === "paid_off").length;
 return {
 total_loans: loans.length,
 total_borrowed,
 total_paid,
 total_outstanding,
 total_payments: payments.length,
 active_loans,
 completed_loans,
 };
}

export async function loadCustomerPortfolioData(
 request: Request,
 customerId: string,
 user: SessionUser
): Promise<{ ok: true; data: CustomerPortfolioData } | { ok: false; status: number; message: string }> {
 const custRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
 request,
 });
 if (!custRes.ok) {
 return { ok: false, status: custRes.error.status, message: custRes.error.message };
 }

 const row = extractCustomerDetail(custRes.data);
 if (!row) {
 return { ok: false, status: 502, message: "Unexpected customer response from server" };
 }

 const customer = adaptApiCustomerRowToCustomer(row);
 const denied = ensureResourceBranchAllowed(user, customer.branch_id);
 if (denied) {
 return { ok: false, status: 403, message: "You cannot access this customer's branch." };
 }

 const branchId = customer.branch_id;

 const [rawLoans, appsRes] = await Promise.all([
 loadCustomerLoans(request, customerId, branchId),
 falcoServerFetch<unknown>("/applications", {
 request,
 query: {
 branch_id: branchId,
 page: "1",
 page_size: "100",
 },
 }),
 ]);

 const payments = await loadCustomerPayments(request, customerId, branchId, rawLoans);
 // Same fix as loans list: LMS total_paid can lag behind completed Automatic payments.
 const loans = applyPaymentTotalsToLoans(rawLoans, payments);
 const applications = appsRes.ok
 ? extractApplicationsList(appsRes.data).filter((a) => a.customer_id === customerId)
 : [];

 const paymentTrend = buildPaymentTrend(loans, payments);
 const loanDistribution = buildLoanDistribution(loans);
 const creditHistory = customer.credit_score
 ? buildCreditScoreHistory(customer.credit_score, customer.created_at)
 : [];
 const balanceSnapshot = buildBalanceSnapshot(loans, payments);
 const summary = summarizePortfolio(loans, payments);

 return {
 ok: true,
 data: {
 loans,
 payments,
 applications,
 paymentTrend,
 loanDistribution,
 creditHistory,
 balanceSnapshot,
 summary,
 },
 };
}
