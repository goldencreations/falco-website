import { extractApplicationsList } from "@/lib/application-adapters";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { ensureResourceBranchAllowed } from "@/lib/authorization";
import type { SessionUser } from "@/lib/auth";
import {
 extractLoansList,
 extractPaymentsList,
 type LoanListRow,
} from "@/lib/loan-adapters";
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
 const completed = inMonth.filter((p) => p.status === "completed");
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

export function buildBalanceSnapshot(loans: LoanListRow[]): BalanceSnapshotPoint[] {
 const paid = loans.reduce((sum, l) => sum + l.total_paid, 0);
 const outstanding = loans.reduce((sum, l) => sum + l.total_outstanding, 0);
 return [{ name: "Portfolio", paid, outstanding }];
}

export function summarizePortfolio(loans: LoanListRow[], payments: Payment[]) {
 const total_borrowed = loans.reduce((sum, l) => sum + l.principal_amount, 0);
 const total_paid = loans.reduce((sum, l) => sum + l.total_paid, 0);
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

 const [loansRes, paymentsRes, appsRes] = await Promise.all([
 falcoServerFetch<unknown>("/loans", {
 request,
 query: {
 customer_id: customerId,
 branch_id: branchId,
 page: "1",
 page_size: "100",
 },
 }),
 falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 customer_id: customerId,
 branch_id: branchId,
 page: "1",
 page_size: "200",
 },
 }),
 falcoServerFetch<unknown>("/applications", {
 request,
 query: {
 branch_id: branchId,
 page: "1",
 page_size: "100",
 },
 }),
 ]);

 const loans = loansRes.ok ? extractLoansList(loansRes.data) : [];
 const payments = paymentsRes.ok ? extractPaymentsList(paymentsRes.data) : [];
 const applications = appsRes.ok
 ? extractApplicationsList(appsRes.data).filter((a) => a.customer_id === customerId)
 : [];

 const paymentTrend = buildPaymentTrend(loans, payments);
 const loanDistribution = buildLoanDistribution(loans);
 const creditHistory = customer.credit_score
 ? buildCreditScoreHistory(customer.credit_score, customer.created_at)
 : [];
 const balanceSnapshot = buildBalanceSnapshot(loans);
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
