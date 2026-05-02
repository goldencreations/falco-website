/**
 * Dashboard analytics helpers — mock-backed today, structured for API replacement.
 * Scope: "all" or a branch id filters loan-derived aggregates; time series scale from base curves.
 */

import { agingReport as baseAgingReport, dashboardMetrics, loans } from "@/lib/mock-data";

export type DashboardBranchScope = "all" | string;

/** Baseline platform series (aggregated); branch view scales by outstanding share. */
const BASE_DISBURSEMENTS_VS_COLLECTIONS = [
  { month: "Aug", disbursements: 12_500_000, collections: 8_200_000, expected: 9_000_000 },
  { month: "Sep", disbursements: 15_800_000, collections: 11_500_000, expected: 12_000_000 },
  { month: "Oct", disbursements: 18_200_000, collections: 14_800_000, expected: 15_500_000 },
  { month: "Nov", disbursements: 14_500_000, collections: 13_200_000, expected: 14_000_000 },
  { month: "Dec", disbursements: 11_200_000, collections: 12_800_000, expected: 13_000_000 },
  { month: "Jan", disbursements: 800_000, collections: 2_915_556, expected: 3_100_000 },
];

const BASE_PORTFOLIO_TREND = [
  { month: "Aug", outstanding: 45_000_000, atRisk: 3_200_000 },
  { month: "Sep", outstanding: 52_000_000, atRisk: 4_100_000 },
  { month: "Oct", outstanding: 58_000_000, atRisk: 3_800_000 },
  { month: "Nov", outstanding: 54_000_000, atRisk: 4_500_000 },
  { month: "Dec", outstanding: 48_000_000, atRisk: 3_952_000 },
  { month: "Jan", outstanding: dashboardMetrics.total_portfolio, atRisk: dashboardMetrics.total_par },
];

function activeBookLoans(scope: DashboardBranchScope) {
  return loans.filter(
    (l) =>
      (l.status === "active" || l.status === "in_arrears") &&
      (scope === "all" || l.branch_id === scope)
  );
}

/** Outstanding book for scope (sum of total_outstanding). */
export function getOutstandingBookForScope(scope: DashboardBranchScope): number {
  return activeBookLoans(scope).reduce((s, l) => s + l.total_outstanding, 0);
}

export function getOutstandingShare(scope: DashboardBranchScope): number {
  const total = getOutstandingBookForScope("all");
  if (total <= 0) return 1;
  if (scope === "all") return 1;
  return getOutstandingBookForScope(scope) / total;
}

export function getDisbursementsVsCollectionsSeries(scope: DashboardBranchScope) {
  const k = scope === "all" ? 1 : Math.max(0.12, getOutstandingShare(scope));
  return BASE_DISBURSEMENTS_VS_COLLECTIONS.map((row) => ({
    month: row.month,
    disbursements: Math.round(row.disbursements * k),
    collections: Math.round(row.collections * k),
    expected: Math.round(row.expected * k),
  }));
}

export function getPortfolioTrendSeries(scope: DashboardBranchScope) {
  const k = scope === "all" ? 1 : Math.max(0.12, getOutstandingShare(scope));
  return BASE_PORTFOLIO_TREND.map((row) => ({
    month: row.month,
    outstanding: Math.round(row.outstanding * k),
    atRisk: Math.round(row.atRisk * k),
  }));
}

const CLASSIFICATION_ORDER = [
  "current",
  "especially_mentioned",
  "substandard",
  "doubtful",
  "loss",
] as const;

const CLASS_LABELS: Record<(typeof CLASSIFICATION_ORDER)[number], string> = {
  current: "Current",
  especially_mentioned: "Watch (1–30)",
  substandard: "Substandard (31–90)",
  doubtful: "Doubtful (91–180)",
  loss: "Loss (>180)",
};

/** Loan-derived aging buckets; aligns charts with branch filter. Falls back to report when no loans in scope. */
export function getAgingBucketsForScope(scope: DashboardBranchScope): {
  classification: (typeof CLASSIFICATION_ORDER)[number];
  label: string;
  outstanding_amount: number;
  loan_count: number;
  percentage: number;
}[] {
  const list = activeBookLoans(scope).filter((l) => l.total_outstanding > 0);
  const buckets: Record<(typeof CLASSIFICATION_ORDER)[number], { amount: number; count: number }> = {
    current: { amount: 0, count: 0 },
    especially_mentioned: { amount: 0, count: 0 },
    substandard: { amount: 0, count: 0 },
    doubtful: { amount: 0, count: 0 },
    loss: { amount: 0, count: 0 },
  };

  for (const loan of list) {
    const key = loan.risk_classification as keyof typeof buckets;
    if (key in buckets) {
      buckets[key].amount += loan.total_outstanding;
      buckets[key].count += 1;
    }
  }

  const total = Object.values(buckets).reduce((s, b) => s + b.amount, 0);

  if (total === 0 && scope === "all") {
    return baseAgingReport.map((row) => ({
      classification: row.classification as (typeof CLASSIFICATION_ORDER)[number],
      label: CLASS_LABELS[row.classification as keyof typeof CLASS_LABELS] ?? row.classification,
      outstanding_amount: row.outstanding_amount,
      loan_count: row.loan_count,
      percentage: row.percentage,
    }));
  }

  if (total === 0) {
    return CLASSIFICATION_ORDER.map((classification) => ({
      classification,
      label: CLASS_LABELS[classification],
      outstanding_amount: 0,
      loan_count: 0,
      percentage: 0,
    }));
  }

  return CLASSIFICATION_ORDER.map((classification) => {
    const b = buckets[classification];
    return {
      classification,
      label: CLASS_LABELS[classification],
      outstanding_amount: b.amount,
      loan_count: b.count,
      percentage: Math.round((b.amount / total) * 1000) / 10,
    };
  });
}
