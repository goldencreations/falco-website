import {
 adaptCollectionQueueRow,
 extractPaginatedData,
} from "@/lib/collection-adapters";
import {
 extractDisbursementsApiPayload,
 type DisbursementKpis,
 type DisbursementViewRow,
} from "@/lib/disbursement-adapters";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import type { ManagerMetricsPayload } from "@/lib/manager-branch-load";
import {
 extractPaymentsPayload,
 extractReconciliationSummary,
 type ReconciliationSummary,
} from "@/lib/payment-adapters";
import { formatCurrency } from "@/lib/formatters";
import { translate } from "@/lib/i18n/translate";
import type { AppLanguage } from "@/lib/preferences";
import type { Payment } from "@/lib/types";

const ACTIVE_LOAN_STATUSES = new Set([
 "active",
 "in_arrears",
 "defaulted",
 "restructured",
 "pending_disbursement",
]);

export type AccountantFinanceSnapshot = {
 branchLabel: string;
 metrics: ManagerMetricsPayload | null;
 payments: Payment[];
 loans: LoanListRow[];
 reconciliation: ReconciliationSummary;
 disbursements: DisbursementViewRow[];
 disbursementKpis: DisbursementKpis | null;
 collectionsQueueCount: number;
 collectionsQueueOutstanding: number;
 timeseriesCollections: { month: string; amount: number }[];
 timeseriesDisbursements: { month: string; amount: number }[];
};

export type AccountantDashboardStats = {
 outstandingPortfolio: number;
 activeLoansCount: number;
 totalLoansCount: number;
 paymentsCollectedTotal: number;
 paymentsCollectedToday: number;
 paymentsPendingAmount: number;
 paymentsCompletedCount: number;
 paymentsPendingCount: number;
 reconciliation: ReconciliationSummary;
 reconciliationTotal: number;
 reconciliationMatchRate: number;
 anomaliesDetected: number;
 anomalyRate: number;
 collectionsAmount: number;
 collectionsQueueCount: number;
 collectionsQueueOutstanding: number;
 disbursementsMtdVolume: number;
 disbursementsPendingCount: number;
 disbursementsCompletedCount: number;
 parRate: number;
 nplRate: number;
 parAmount: number;
 insightText: string;
 monthlyPaymentTotals: { month: string; amount: number }[];
};

function branchQuery(branchId: string, pageSize = "500"): string {
 const p = new URLSearchParams();
 p.set("branch_id", branchId);
 p.set("page_size", pageSize);
 return p.toString();
}

function todayIso(): string {
 return new Date().toISOString().slice(0, 10);
}

function monthStartIso(monthsBack = 0): string {
 const d = new Date();
 d.setMonth(d.getMonth() + monthsBack);
 d.setDate(1);
 return d.toISOString().slice(0, 10);
}

function parseTimeseries(json: unknown): { month: string; amount: number }[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const points = Array.isArray(o.points) ? o.points : Array.isArray(o.data) ? o.data : [];
 return points.map((p) => {
 const row = p as Record<string, unknown>;
 const period = String(row.period ?? row.month ?? row.label ?? "");
 const amount = Number(row.amount ?? row.value ?? 0);
 return { month: period, amount: Number.isFinite(amount) ? amount : 0 };
 });
}

function paymentMonthKey(iso: string): string {
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return "Unknown";
 return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function sumCompletedPayments(payments: Payment[]): number {
 return payments
 .filter((p) => p.status === "completed")
 .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

function sumPaymentsToday(payments: Payment[], today: string): number {
 return payments
 .filter((p) => p.status === "completed" && (p.payment_date || p.created_at || "").slice(0, 10) === today)
 .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

export function buildAccountantDashboardStats(
 snapshot: AccountantFinanceSnapshot,
 language: AppLanguage = "en"
): AccountantDashboardStats {
 const t = (key: string, params?: Record<string, string | number>) =>
 translate(language, key, params);
 const payments = snapshot.payments;
 const completed = payments.filter((p) => p.status === "completed");
 const pending = payments.filter((p) => p.status === "pending");
 const today = todayIso();

 const paymentsCollectedTotal = sumCompletedPayments(payments);
 const paymentsCollectedToday = sumPaymentsToday(payments, today);
 const paymentsPendingAmount = pending.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

 const recon = snapshot.reconciliation;
 const reconciliationTotal =
 recon.matched + recon.underpaid + recon.overpaid + recon.manual_review + recon.unmatched || 0;
 const anomaliesDetected = recon.manual_review + recon.unmatched + recon.underpaid + recon.overpaid;
 const reconciliationMatchRate =
 reconciliationTotal > 0 ? Math.round((recon.matched / reconciliationTotal) * 1000) / 10 : 0;
 const anomalyRate =
 reconciliationTotal > 0 ? Math.round((anomaliesDetected / reconciliationTotal) * 1000) / 10 : 0;

 const m = snapshot.metrics?.metrics;
 const portfolio = m?.portfolio;
 const risk = m?.risk;
 const collectionsMetric = m?.collections;
 const disbursementsMetric = m?.disbursements as { amount?: number } | undefined;

 const loansOutstandingFallback = snapshot.loans.reduce(
 (sum, loan) => sum + Number(loan.total_outstanding ?? 0),
 0
 );
 const outstandingPortfolio =
 Number(portfolio?.outstanding_amount ?? 0) > 0
 ? Number(portfolio?.outstanding_amount ?? 0)
 : loansOutstandingFallback;

 const activeLoansFromList = snapshot.loans.filter((loan) =>
 ACTIVE_LOAN_STATUSES.has(String(loan.status ?? ""))
 ).length;
 const activeLoansCount =
 Number(portfolio?.active_loan_count ?? 0) > 0
 ? Number(portfolio?.active_loan_count ?? 0)
 : activeLoansFromList;

 const collectionsFromMetrics = Number(collectionsMetric?.amount ?? 0);
 const collectionsAmount =
 collectionsFromMetrics > 0 ? collectionsFromMetrics : paymentsCollectedTotal;

 const kpis = snapshot.disbursementKpis;
 const disbursementsMtdVolume =
 Number(kpis?.mtd_completed_volume ?? 0) > 0
 ? Number(kpis?.mtd_completed_volume ?? 0)
 : Number(disbursementsMetric?.amount ?? 0) > 0
 ? Number(disbursementsMetric?.amount ?? 0)
 : snapshot.disbursements
 .filter((d) => d.status === "completed")
 .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

 const disbursementsPendingCount =
 Number(kpis?.pending_approval ?? 0) + Number(kpis?.approved ?? 0) ||
 snapshot.disbursements.filter(
 (d) => d.status === "pending_approval" || d.status === "approved"
 ).length;

 const disbursementsCompletedCount =
 Number(kpis?.completed ?? 0) ||
 snapshot.disbursements.filter((d) => d.status === "completed").length;

 const monthlyMap = new Map<string, number>();
 for (const p of completed) {
 const key = paymentMonthKey(p.payment_date || p.created_at);
 monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(p.amount ?? 0));
 }
 const monthlyPaymentTotals = Array.from(monthlyMap.entries())
 .slice(-6)
 .map(([month, amount]) => ({ month, amount }));

 const parRate = Number(risk?.par_rate ?? 0);
 const nplRate = Number(risk?.npl_rate ?? 0);
 const parAmount = Number(risk?.par_amount ?? 0);

 let insightText = t("accountant.insightLead", {
 branch: snapshot.branchLabel,
 portfolio: formatCurrency(outstandingPortfolio),
 active: activeLoansCount,
 });
 insightText += t("accountant.insightCollected", {
 total: formatCurrency(paymentsCollectedTotal),
 count: completed.length,
 });
 if (paymentsCollectedToday > 0) {
 insightText += t("accountant.insightToday", {
 amount: formatCurrency(paymentsCollectedToday),
 });
 }
 insightText += t("accountant.insightRecon", {
 matched: recon.matched,
 review: anomaliesDetected,
 });
 if (disbursementsMtdVolume > 0) {
 insightText += t("accountant.insightDisburse", {
 amount: formatCurrency(disbursementsMtdVolume),
 });
 }
 if (disbursementsPendingCount > 0) {
 insightText += t("accountant.insightDisbursePending", {
 count: disbursementsPendingCount,
 });
 }

 return {
 outstandingPortfolio,
 activeLoansCount,
 totalLoansCount: snapshot.loans.length,
 paymentsCollectedTotal,
 paymentsCollectedToday,
 paymentsPendingAmount,
 paymentsCompletedCount: completed.length,
 paymentsPendingCount: pending.length,
 reconciliation: recon,
 reconciliationTotal,
 reconciliationMatchRate,
 anomaliesDetected,
 anomalyRate,
 collectionsAmount,
 collectionsQueueCount: snapshot.collectionsQueueCount,
 collectionsQueueOutstanding: snapshot.collectionsQueueOutstanding,
 disbursementsMtdVolume,
 disbursementsPendingCount,
 disbursementsCompletedCount,
 parRate,
 nplRate,
 parAmount,
 insightText,
 monthlyPaymentTotals,
 };
}

/** Fast first paint: metrics + reconciliation only (2 requests). */
export async function loadAccountantFinanceEssentials(
 branchId: string
): Promise<Pick<AccountantFinanceSnapshot, "metrics" | "reconciliation">> {
 const [metricsRes, reconRes] = await Promise.all([
 fetch(`/api/falco/dashboard/metrics?branch_id=${encodeURIComponent(branchId)}`, {
 credentials: "include",
 cache: "no-store",
 }),
 fetch(
 `/api/payments/reconciliation-summary?branch_id=${encodeURIComponent(branchId)}`,
 { credentials: "include", cache: "no-store" }
 ),
 ]);
 const metrics = metricsRes.ok ? ((await metricsRes.json()) as ManagerMetricsPayload) : null;
 const reconciliation = extractReconciliationSummary(reconRes.ok ? await reconRes.json() : null);
 return { metrics, reconciliation };
}

/** Heavier lists and charts — loaded after essentials (slow networks). */
export async function loadAccountantFinanceDetails(
 branchId: string
): Promise<
 Omit<
 AccountantFinanceSnapshot,
 "branchLabel" | "metrics" | "reconciliation"
 >
> {
 const q = branchQuery(branchId);
 const today = todayIso();
 const from3m = monthStartIso(-2);

 const [paymentsRes, loansRes, disburseRes, queueRes, tsCollRes, tsDisbRes] = await Promise.all([
 fetch(`/api/payments?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/loans?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/disbursements?branch_id=${encodeURIComponent(branchId)}&page_size=200`, {
 credentials: "include",
 cache: "no-store",
 }),
 fetch(`/api/collections/queue?branch_id=${encodeURIComponent(branchId)}&page_size=200`, {
 credentials: "include",
 cache: "no-store",
 }),
 fetch(
 `/api/falco/dashboard/timeseries?metric=collections&from=${from3m}&to=${today}&branch_id=${encodeURIComponent(branchId)}`,
 { credentials: "include", cache: "no-store" }
 ),
 fetch(
 `/api/falco/dashboard/timeseries?metric=disbursements&from=${from3m}&to=${today}&branch_id=${encodeURIComponent(branchId)}`,
 { credentials: "include", cache: "no-store" }
 ),
 ]);

 const payments = paymentsRes.ok
 ? extractPaymentsPayload(await paymentsRes.json()).payments
 : [];
 const loans = loansRes.ok ? extractLoansList(await loansRes.json()) : [];
 const disburseJson = disburseRes.ok ? await disburseRes.json() : null;
 const { disbursements, kpis: disbursementKpis } = extractDisbursementsApiPayload(disburseJson);

 let collectionsQueueCount = 0;
 let collectionsQueueOutstanding = 0;
 if (queueRes.ok) {
 const queueJson = await queueRes.json();
 const rows = extractPaginatedData<Record<string, unknown>>(queueJson).map(adaptCollectionQueueRow);
 collectionsQueueCount = rows.length;
 collectionsQueueOutstanding = rows.reduce(
 (sum, row) => sum + Number(row.total_outstanding ?? 0),
 0
 );
 }

 return {
 payments,
 loans,
 disbursements,
 disbursementKpis,
 collectionsQueueCount,
 collectionsQueueOutstanding,
 timeseriesCollections: tsCollRes.ok ? parseTimeseries(await tsCollRes.json()) : [],
 timeseriesDisbursements: tsDisbRes.ok ? parseTimeseries(await tsDisbRes.json()) : [],
 };
}

/** Load all branch finance data (use staged loaders on dashboard for slow networks). */
export async function loadAccountantFinanceSnapshot(branchId: string): Promise<AccountantFinanceSnapshot> {
 const q = branchQuery(branchId);
 const today = todayIso();
 const from3m = monthStartIso(-2);

 const [
 metricsRes,
 paymentsRes,
 reconRes,
 loansRes,
 disburseRes,
 queueRes,
 tsCollRes,
 tsDisbRes,
 ] = await Promise.all([
 fetch(`/api/falco/dashboard/metrics?branch_id=${encodeURIComponent(branchId)}`, {
 credentials: "include",
 cache: "no-store",
 }),
 fetch(`/api/payments?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(
 `/api/payments/reconciliation-summary?branch_id=${encodeURIComponent(branchId)}`,
 { credentials: "include", cache: "no-store" }
 ),
 fetch(`/api/loans?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/disbursements?branch_id=${encodeURIComponent(branchId)}&page_size=200`, {
 credentials: "include",
 cache: "no-store",
 }),
 fetch(`/api/collections/queue?branch_id=${encodeURIComponent(branchId)}&page_size=500`, {
 credentials: "include",
 cache: "no-store",
 }),
 fetch(
 `/api/falco/dashboard/timeseries?metric=collections&from=${from3m}&to=${today}&branch_id=${encodeURIComponent(branchId)}`,
 { credentials: "include", cache: "no-store" }
 ),
 fetch(
 `/api/falco/dashboard/timeseries?metric=disbursements&from=${from3m}&to=${today}&branch_id=${encodeURIComponent(branchId)}`,
 { credentials: "include", cache: "no-store" }
 ),
 ]);

 const metrics = metricsRes.ok ? ((await metricsRes.json()) as ManagerMetricsPayload) : null;

 const payments = paymentsRes.ok
 ? extractPaymentsPayload(await paymentsRes.json()).payments
 : [];

 const reconJson = reconRes.ok ? await reconRes.json() : null;
 const reconciliation = extractReconciliationSummary(reconJson);

 const loans = loansRes.ok ? extractLoansList(await loansRes.json()) : [];

 const disburseJson = disburseRes.ok ? await disburseRes.json() : null;
 const { disbursements, kpis: disbursementKpis } = extractDisbursementsApiPayload(disburseJson);

 let collectionsQueueCount = 0;
 let collectionsQueueOutstanding = 0;
 if (queueRes.ok) {
 const queueJson = await queueRes.json();
 const rows = extractPaginatedData<Record<string, unknown>>(queueJson).map(adaptCollectionQueueRow);
 collectionsQueueCount = rows.length;
 collectionsQueueOutstanding = rows.reduce(
 (sum, row) => sum + Number(row.total_outstanding ?? 0),
 0
 );
 }

 return {
 branchLabel: branchId,
 metrics,
 payments,
 loans,
 reconciliation,
 disbursements,
 disbursementKpis,
 collectionsQueueCount,
 collectionsQueueOutstanding,
 timeseriesCollections: tsCollRes.ok ? parseTimeseries(await tsCollRes.json()) : [],
 timeseriesDisbursements: tsDisbRes.ok ? parseTimeseries(await tsDisbRes.json()) : [],
 };
}
