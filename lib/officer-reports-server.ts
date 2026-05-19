import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import { filterLoansForLoanOfficer } from "@/lib/loan-officer-portfolio-server";
import { enrichLoansFully } from "@/lib/loan-enrichment";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import type { TimeseriesPoint } from "@/lib/reports-timeseries";
import type { RiskClassification } from "@/lib/types";
import { falcoServerFetch } from "@/lib/server-falco";

const ACTIVE_STATUSES = new Set(["active", "in_arrears", "defaulted", "restructured"]);

const PROVISION_RATE: Record<RiskClassification, number> = {
 current: 0.01,
 especially_mentioned: 0.05,
 substandard: 0.25,
 doubtful: 0.5,
 loss: 1,
};

const AGING_ORDER: RiskClassification[] = [
 "current",
 "especially_mentioned",
 "substandard",
 "doubtful",
 "loss",
];

function num(value: unknown, fallback = 0): number {
 const n = Number(value);
 return Number.isFinite(n) ? n : fallback;
}

function monthKey(iso: string): string {
 const d = iso.trim();
 if (d.length >= 7) return d.slice(0, 7);
 return "";
}

function monthsBetween(from: string, to: string): string[] {
 const start = new Date(from.length === 7 ? `${from}-01` : from);
 const end = new Date(to.length === 7 ? `${to}-01` : to);
 if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
 const keys: string[] = [];
 const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
 const last = new Date(end.getFullYear(), end.getMonth(), 1);
 while (cursor <= last) {
 keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
 cursor.setMonth(cursor.getMonth() + 1);
 }
 return keys;
}

function isPortfolioLoan(loan: LoanListRow): boolean {
 return ACTIVE_STATUSES.has(loan.status) && loan.total_outstanding > 0;
}

function isParLoan(loan: LoanListRow): boolean {
 return loan.status === "in_arrears" || loan.days_in_arrears > 0;
}

function isNplLoan(loan: LoanListRow): boolean {
 if (loan.days_in_arrears > 30) return true;
 return (
 loan.risk_classification === "substandard" ||
 loan.risk_classification === "doubtful" ||
 loan.risk_classification === "loss"
 );
}

export async function loadOfficerLoansForReports(
 request: Request,
 branchId: string,
 officerId: string
): Promise<LoanListRow[]> {
 const res = await falcoServerFetch<unknown>("/loans", {
 request,
 query: { page: "1", page_size: "500", branch_id: branchId },
 });
 if (!res.ok) return [];
 let loans = await enrichLoansFully(extractLoansList(res.data), { request, branchId });
 loans = await filterLoansForLoanOfficer(loans, request, branchId, officerId);
 return loans;
}

export function buildOfficerPortfolioSummaryPayload(
 loans: LoanListRow[],
 asOf: string,
 branchId: string,
 branchName?: string
): Record<string, unknown> {
 const portfolioLoans = loans.filter(isPortfolioLoan);
 const totalPortfolio = portfolioLoans.reduce((s, l) => s + l.total_outstanding, 0);
 const activeLoans = loans.filter((l) => l.status === "active" || l.status === "in_arrears").length;

 const parLoans = portfolioLoans.filter(isParLoan);
 const parAmount = parLoans.reduce((s, l) => s + l.total_outstanding, 0);
 const parRate = totalPortfolio > 0 ? (parAmount / totalPortfolio) * 100 : 0;

 const nplLoans = portfolioLoans.filter(isNplLoan);
 const nplOutstanding = nplLoans.reduce((s, l) => s + l.total_outstanding, 0);
 const nplRate = totalPortfolio > 0 ? (nplOutstanding / totalPortfolio) * 100 : 0;

 const requiredProvision = portfolioLoans.reduce(
 (s, l) => s + l.total_outstanding * (PROVISION_RATE[l.risk_classification] ?? 0.01),
 0
 );

 const productMap = new Map<
 string,
 { product_id: string; name: string; loan_count: number; outstanding_amount: number; par_amount: number }
 >();

 for (const loan of portfolioLoans) {
 const pid = loan.product_id?.trim() || loan.productName || "unknown";
 const row = productMap.get(pid) ?? {
 product_id: pid,
 name: loan.productName || pid,
 loan_count: 0,
 outstanding_amount: 0,
 par_amount: 0,
 };
 row.loan_count += 1;
 row.outstanding_amount += loan.total_outstanding;
 if (isParLoan(loan)) row.par_amount += loan.total_outstanding;
 productMap.set(pid, row);
 }

 const by_product = Array.from(productMap.values()).map((p) => ({
 ...p,
 par_rate: p.outstanding_amount > 0 ? (p.par_amount / p.outstanding_amount) * 100 : 0,
 }));

 const collected = loans.reduce((s, l) => s + Math.max(l.total_paid, l.payments_recorded_total ?? 0), 0);
 const disbursed = loans.reduce((s, l) => s + l.principal_amount, 0);

 return {
 as_of: asOf,
 metrics: {
 total_portfolio: totalPortfolio,
 outstanding_amount: totalPortfolio,
 active_loan_count: activeLoans,
 par_amount: parAmount,
 par_rate: parRate,
 npl_rate: nplRate,
 required_provision: requiredProvision,
 },
 by_product,
 by_branch: [
 {
 branch_id: branchId,
 name: branchName ?? branchId,
 loan_count: activeLoans,
 outstanding_amount: totalPortfolio,
 disbursed_amount: disbursed,
 collected_amount: collected,
 collection_rate: disbursed > 0 ? (collected / disbursed) * 100 : 0,
 },
 ],
 };
}

export function buildOfficerAgingPayload(loans: LoanListRow[]): Record<string, unknown> {
 const portfolioLoans = loans.filter(isPortfolioLoan);
 const bucketMap = new Map<
 RiskClassification,
 { loan_count: number; outstanding_amount: number; provision_amount: number }
 >();

 for (const loan of portfolioLoans) {
 const key = loan.risk_classification;
 const row = bucketMap.get(key) ?? { loan_count: 0, outstanding_amount: 0, provision_amount: 0 };
 row.loan_count += 1;
 row.outstanding_amount += loan.total_outstanding;
 row.provision_amount += loan.total_outstanding * (PROVISION_RATE[key] ?? 0.01);
 bucketMap.set(key, row);
 }

 const totalOutstanding = portfolioLoans.reduce((s, l) => s + l.total_outstanding, 0);
 const rows = AGING_ORDER.filter((k) => bucketMap.has(k)).map((classification) => {
 const row = bucketMap.get(classification)!;
 return {
 classification,
 loan_count: row.loan_count,
 outstanding_amount: row.outstanding_amount,
 provision_amount: row.provision_amount,
 percentage:
 totalOutstanding > 0 ? (row.outstanding_amount / totalOutstanding) * 100 : 0,
 };
 });

 const totalProvision = rows.reduce((s, r) => s + num(r.provision_amount), 0);

 return {
 rows,
 totals: {
 outstanding_amount: totalOutstanding,
 provision_amount: totalProvision,
 },
 };
}

export async function buildOfficerTimeseriesPayload(
 request: Request,
 branchId: string,
 officerId: string,
 metric: string,
 from: string,
 to: string
): Promise<{ points: TimeseriesPoint[] }> {
 const loans = await loadOfficerLoansForReports(request, branchId, officerId);
 const loanIds = new Set(loans.map((l) => l.id));
 const months = monthsBetween(from, to);
 const amountByMonth = new Map<string, number>();
 const countByMonth = new Map<string, number>();

 if (metric === "disbursements") {
 for (const loan of loans) {
 const key = monthKey(loan.disbursement_date);
 if (!key || !months.includes(key)) continue;
 amountByMonth.set(key, (amountByMonth.get(key) ?? 0) + loan.principal_amount);
 countByMonth.set(key, (countByMonth.get(key) ?? 0) + 1);
 }
 } else if (metric === "collections") {
 const res = await falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 branch_id: branchId,
 from,
 to,
 page: "1",
 page_size: "500",
 status: "completed",
 },
 });
 if (res.ok) {
 const payload = extractPaymentsPayload(res.data);
 for (const payment of payload.payments) {
 if (!loanIds.has(payment.loan_id)) continue;
 const key = monthKey(payment.payment_date);
 if (!key || !months.includes(key)) continue;
 amountByMonth.set(key, (amountByMonth.get(key) ?? 0) + payment.amount);
 countByMonth.set(key, (countByMonth.get(key) ?? 0) + 1);
 }
 }
 } else if (metric === "outstanding") {
 const total = loans.filter(isPortfolioLoan).reduce((s, l) => s + l.total_outstanding, 0);
 for (const key of months) {
 amountByMonth.set(key, total);
 }
 }

 const points: TimeseriesPoint[] = months.map((period) => ({
 period,
 label: new Date(`${period}-01`).toLocaleString("en-US", { month: "short" }),
 amount: amountByMonth.get(period) ?? 0,
 count: countByMonth.get(period) ?? 0,
 }));

 return { points };
}

export function officerPortfolioSummaryToCsv(
 payload: Record<string, unknown>,
 scopeLabel: string
): string {
 const metrics =
 typeof payload.metrics === "object" && payload.metrics !== null
 ? (payload.metrics as Record<string, unknown>)
 : {};
 const lines = [
 "Falco Portfolio Summary (Loan Officer)",
 `Scope,${scopeLabel}`,
 `As of,${String(payload.as_of ?? "")}`,
 "",
 "Metric,Value",
 `Total portfolio,${num(metrics.total_portfolio ?? metrics.outstanding_amount)}`,
 `Active loans,${num(metrics.active_loan_count)}`,
 `PAR amount,${num(metrics.par_amount)}`,
 `PAR rate %,${num(metrics.par_rate)}`,
 `NPL rate %,${num(metrics.npl_rate)}`,
 `Required provision,${num(metrics.required_provision)}`,
 ];
 return lines.join("\n");
}
