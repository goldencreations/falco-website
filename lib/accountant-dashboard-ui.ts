import type { AccountantDashboardStats, AccountantFinanceSnapshot } from "@/lib/accountant-dashboard-metrics";
import type { DisbursementViewRow } from "@/lib/disbursement-adapters";
import type { LoanListRow } from "@/lib/loan-adapters";
import type { Payment } from "@/lib/types";

export type TrendDelta = {
 pct: number;
 up: boolean;
 label: string;
};

export type AccountantStatCard = {
 key: string;
 title: string;
 value: string;
 subValue?: string;
 trend: TrendDelta;
 icon: "wallet" | "payments" | "reconciliation" | "disbursements";
 accent: string;
 iconBg: string;
 iconColor: string;
};

export type DonutSegment = {
 key: string;
 label: string;
 value: number;
 color: string;
 pct: number;
};

export type FinanceActivityRow = {
 id: string;
 name: string;
 category: "payment" | "disbursement" | "collection" | "loan";
 amount: number;
 date: string;
 status: string;
 statusTone: "success" | "warning" | "danger" | "info" | "muted";
 href: string;
};

export function computeTrend(current: number, previous: number): TrendDelta {
 if (previous <= 0) {
 const up = current >= 0;
 return {
 pct: current > 0 ? 100 : 0,
 up,
 label: previous <= 0 && current > 0 ? "new" : "0%",
 };
 }
 const raw = ((current - previous) / previous) * 100;
 return {
 pct: Math.round(Math.abs(raw) * 10) / 10,
 up: raw >= 0,
 label: `${Math.round(Math.abs(raw) * 10) / 10}%`,
 };
}

function lastTwoMonths(
 series: { month: string; amount: number }[]
): { current: number; previous: number } {
 if (series.length === 0) return { current: 0, previous: 0 };
 const sorted = [...series].sort((a, b) => a.month.localeCompare(b.month));
 const current = sorted[sorted.length - 1]?.amount ?? 0;
 const previous = sorted.length > 1 ? (sorted[sorted.length - 2]?.amount ?? 0) : 0;
 return { current, previous };
}

function paymentsInMonth(payments: Payment[], monthOffset: number): number {
 const d = new Date();
 d.setMonth(d.getMonth() + monthOffset);
 const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
 return payments
 .filter((p) => p.status === "completed")
 .filter((p) => (p.payment_date || p.created_at || "").slice(0, 7) === ym)
 .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

export function buildAccountantStatCards(
 stats: AccountantDashboardStats,
 snapshot: AccountantFinanceSnapshot,
 formatMoney: (n: number) => string
): AccountantStatCard[] {
 const collTrend = lastTwoMonths(snapshot.timeseriesCollections);
 const disbTrend = lastTwoMonths(snapshot.timeseriesDisbursements);
 const payThisMonth = paymentsInMonth(snapshot.payments, 0);
 const payLastMonth = paymentsInMonth(snapshot.payments, -1);

 return [
 {
 key: "collected",
 title: "Payments collected",
 value: formatMoney(stats.paymentsCollectedTotal),
 subValue: `${stats.paymentsCompletedCount} completed`,
 trend: computeTrend(payThisMonth, payLastMonth),
 icon: "payments",
 accent: "border-blue-200/70 bg-blue-50/50",
 iconBg: "bg-blue-100",
 iconColor: "text-blue-700",
 },
 {
 key: "reconciliation",
 title: "Reconciliation matched",
 value: String(stats.reconciliation.matched),
 subValue: `${stats.anomaliesDetected} need review`,
 trend: computeTrend(stats.reconciliationMatchRate, Math.max(0, stats.reconciliationMatchRate - 5)),
 icon: "reconciliation",
 accent: "border-violet-200/70 bg-violet-50/50",
 iconBg: "bg-violet-100",
 iconColor: "text-violet-700",
 },
 {
 key: "disbursements",
 title: "Disbursements (MTD)",
 value: formatMoney(stats.disbursementsMtdVolume),
 subValue: `${stats.disbursementsPendingCount} pending`,
 trend: computeTrend(disbTrend.current, disbTrend.previous),
 icon: "disbursements",
 accent: "border-emerald-200/70 bg-emerald-50/50",
 iconBg: "bg-emerald-100",
 iconColor: "text-emerald-700",
 },
 {
 key: "portfolio",
 title: "Portfolio outstanding",
 value: formatMoney(stats.outstandingPortfolio),
 subValue: `${stats.activeLoansCount} active loans · PAR ${stats.parRate.toFixed(1)}%`,
 trend: computeTrend(collTrend.current, collTrend.previous),
 icon: "wallet",
 accent: "border-amber-200/70 bg-amber-50/50",
 iconBg: "bg-amber-100",
 iconColor: "text-amber-700",
 },
 ];
}

const DONUT_COLORS = {
 matched: "#22c55e",
 manual: "#a855f7",
 unmatched: "#f97316",
 underpaid: "#3b82f6",
 overpaid: "#06b6d4",
 pending: "#94a3b8",
};

export function buildReconciliationDonut(stats: AccountantDashboardStats): DonutSegment[] {
 const recon = stats.reconciliation;
 const segments: DonutSegment[] = [
 { key: "matched", label: "Matched", value: recon.matched, color: DONUT_COLORS.matched, pct: 0 },
 { key: "manual", label: "Manual review", value: recon.manual_review, color: DONUT_COLORS.manual, pct: 0 },
 { key: "unmatched", label: "Unmatched", value: recon.unmatched, color: DONUT_COLORS.unmatched, pct: 0 },
 { key: "underpaid", label: "Underpaid", value: recon.underpaid, color: DONUT_COLORS.underpaid, pct: 0 },
 { key: "overpaid", label: "Overpaid", value: recon.overpaid, color: DONUT_COLORS.overpaid, pct: 0 },
 ].filter((s) => s.value > 0);

 const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
 return segments.map((s) => ({
 ...s,
 pct: Math.round((s.value / total) * 1000) / 10,
 }));
}

function parseDate(iso?: string): number {
 if (!iso) return 0;
 const t = new Date(iso).getTime();
 return Number.isNaN(t) ? 0 : t;
}

function paymentStatusTone(status: string): FinanceActivityRow["statusTone"] {
 if (status === "completed") return "success";
 if (status === "pending") return "warning";
 if (status === "failed" || status === "reversed") return "danger";
 return "muted";
}

function disbursementStatusTone(status: string): FinanceActivityRow["statusTone"] {
 const s = status.toLowerCase();
 if (s === "completed") return "success";
 if (s === "pending_approval" || s === "approved") return "warning";
 if (s === "rejected" || s === "failed") return "danger";
 return "info";
}

export function buildFinanceActivityRows(snapshot: AccountantFinanceSnapshot): FinanceActivityRow[] {
 const rows: FinanceActivityRow[] = [];

 for (const p of snapshot.payments.slice(0, 40)) {
 const name =
 (p as Payment & { customer_display_name?: string }).customer_display_name ||
 (p as Payment & { loan_number?: string }).loan_number ||
 `Payment ${p.id.slice(0, 8)}`;
 rows.push({
 id: `pay-${p.id}`,
 name,
 category: "payment",
 amount: Number(p.amount ?? 0),
 date: p.payment_date || p.created_at || "",
 status: p.status,
 statusTone: paymentStatusTone(p.status),
 href: "/accountant/payments",
 });
 }

 for (const d of snapshot.disbursements.slice(0, 25)) {
 const row = d as DisbursementViewRow;
 rows.push({
 id: `disb-${d.id}`,
 name: row.customer_display_name || row.application_number || `Disbursement ${d.id.slice(0, 8)}`,
 category: "disbursement",
 amount: Number(d.amount ?? 0),
 date: (d as DisbursementViewRow & { disbursement_date?: string }).disbursement_date || d.created_at || "",
 status: String(d.status ?? "pending").replace(/_/g, " "),
 statusTone: disbursementStatusTone(String(d.status ?? "")),
 href: "/accountant/disbursements",
 });
 }

 for (const loan of snapshot.loans.filter((l) => l.days_in_arrears > 0).slice(0, 20)) {
 const l = loan as LoanListRow;
 rows.push({
 id: `loan-${loan.id}`,
 name: l.customerDisplayName || l.loan_number || `Loan ${loan.id.slice(0, 8)}`,
 category: "collection",
 amount: Number(l.total_outstanding ?? 0),
 date: l.updated_at || l.disbursement_date || "",
 status: `${l.days_in_arrears}d overdue`,
 statusTone: l.days_in_arrears > 30 ? "danger" : "warning",
 href: "/accountant/collections",
 });
 }

 return rows
 .sort((a, b) => parseDate(b.date) - parseDate(a.date))
 .slice(0, 12);
}
