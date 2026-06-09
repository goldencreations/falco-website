import type { LoanListRow } from "@/lib/loan-adapters";

export type OfficerBranchProgress = {
  branchId: string;
  branchName: string;
  zoneName: string;
  totalDisbursed: number;
  totalCollected: number;
  expectedCollection: number;
  collectionPercentage: number;
  defaultedAmount: number;
};

export type OfficerMonthlyPoint = {
  month: string;
  label: string;
  amount: number;
};

export type OfficerTrendPoint = {
  month: string;
  label: string;
  disbursements: number;
  collections: number;
};

export type OfficerDefaultComparison = {
  currentMonth: number;
  previousMonth: number;
  currentLabel: string;
  previousLabel: string;
  changeAmount: number;
  changePercent: number;
};

export type OfficerDashboardMetrics = {
  branch: OfficerBranchProgress;
  trend: OfficerTrendPoint[];
  disbursementByMonth: OfficerMonthlyPoint[];
  defaultedByMonth: OfficerMonthlyPoint[];
  defaultComparison: OfficerDefaultComparison;
  usingFallback: boolean;
};

function monthKey(iso: string): string {
  const d = iso.trim();
  if (d.length >= 7) return d.slice(0, 7);
  return "";
}

function monthLabel(key: string): string {
  const d = new Date(`${key}-01`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleString("en", { month: "short", year: "2-digit" });
}

export function lastSixMonthKeys(): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

export function lastSixMonthRange(): { from: string; to: string } {
  const keys = lastSixMonthKeys();
  return { from: keys[0], to: keys[keys.length - 1] };
}

function isDefaultedLoan(loan: LoanListRow): boolean {
  return (
    loan.status === "defaulted" ||
    loan.status === "written_off" ||
    loan.risk_classification === "doubtful" ||
    loan.risk_classification === "loss"
  );
}

export function computeExpectedCollection(loans: LoanListRow[]): number {
  return loans
    .filter((l) => l.status === "active" || l.status === "in_arrears")
    .reduce((sum, l) => sum + (l.installment_amount ?? 0), 0);
}

export function computeDefaultedByMonth(loans: LoanListRow[], months = lastSixMonthKeys()): OfficerMonthlyPoint[] {
  const map = new Map<string, number>();
  for (const key of months) map.set(key, 0);

  for (const loan of loans) {
    if (!isDefaultedLoan(loan)) continue;
    const key = monthKey(loan.updated_at || loan.disbursement_date || "");
    if (!key || !map.has(key)) {
      const fallbackKey = months[months.length - 1];
      map.set(fallbackKey, (map.get(fallbackKey) ?? 0) + loan.total_outstanding);
      continue;
    }
    map.set(key, (map.get(key) ?? 0) + loan.total_outstanding);
  }

  return months.map((month) => ({
    month,
    label: monthLabel(month),
    amount: map.get(month) ?? 0,
  }));
}

export function computeDefaultComparison(loans: LoanListRow[]): OfficerDefaultComparison {
  const months = lastSixMonthKeys();
  const currentKey = months[months.length - 1];
  const previousKey = months[months.length - 2];
  const byMonth = computeDefaultedByMonth(loans, months);
  const currentMonth = byMonth.find((p) => p.month === currentKey)?.amount ?? 0;
  const previousMonth = byMonth.find((p) => p.month === previousKey)?.amount ?? 0;
  const changeAmount = currentMonth - previousMonth;
  const changePercent = previousMonth > 0 ? (changeAmount / previousMonth) * 100 : currentMonth > 0 ? 100 : 0;

  return {
    currentMonth,
    previousMonth,
    currentLabel: monthLabel(currentKey),
    previousLabel: monthLabel(previousKey),
    changeAmount,
    changePercent,
  };
}

export function mergeTrendPoints(
  disbursements: OfficerMonthlyPoint[],
  collections: OfficerMonthlyPoint[]
): OfficerTrendPoint[] {
  const months = lastSixMonthKeys();
  const disbMap = new Map(disbursements.map((p) => [p.month, p.amount]));
  const collMap = new Map(collections.map((p) => [p.month, p.amount]));
  return months.map((month) => ({
    month,
    label: monthLabel(month),
    disbursements: disbMap.get(month) ?? 0,
    collections: collMap.get(month) ?? 0,
  }));
}

export function mapTimeseriesPoints(
  points: Array<{ period?: string; label?: string; amount?: number }> | undefined
): OfficerMonthlyPoint[] {
  const months = lastSixMonthKeys();
  const map = new Map<string, number>();
  for (const p of points ?? []) {
    const key = String(p.period ?? "");
    if (key) map.set(key, Number(p.amount ?? 0));
  }
  return months.map((month) => ({
    month,
    label: monthLabel(month),
    amount: map.get(month) ?? 0,
  }));
}

export function buildOfficerDashboardMetrics(input: {
  branchId: string;
  branchName: string;
  zoneName: string;
  portfolioSummary?: Record<string, unknown> | null;
  disbursementSeries?: OfficerMonthlyPoint[];
  collectionSeries?: OfficerMonthlyPoint[];
  loans: LoanListRow[];
  usingFallback?: boolean;
}): OfficerDashboardMetrics {
  const byBranch = Array.isArray(input.portfolioSummary?.by_branch)
    ? (input.portfolioSummary!.by_branch as Record<string, unknown>[])
    : [];
  const branchRow = byBranch[0] ?? {};

  const totalDisbursed = Number(branchRow.disbursed_amount ?? 0);
  const totalCollected = Number(branchRow.collected_amount ?? 0);
  const expectedFromLoans = computeExpectedCollection(input.loans);
  const expectedCollection =
    expectedFromLoans > 0
      ? expectedFromLoans
      : totalDisbursed > 0
        ? Math.round(totalDisbursed * 0.12)
        : 0;
  const collectionPercentage =
    expectedCollection > 0
      ? Math.min(100, (totalCollected / expectedCollection) * 100)
      : Number(branchRow.collection_rate ?? 0);

  const defaultedAmount = input.loans
    .filter(isDefaultedLoan)
    .reduce((sum, l) => sum + l.total_outstanding, 0);

  const disbursementByMonth = input.disbursementSeries ?? mapTimeseriesPoints([]);
  const collectionByMonth = input.collectionSeries ?? mapTimeseriesPoints([]);

  return {
    branch: {
      branchId: input.branchId,
      branchName: input.branchName,
      zoneName: input.zoneName,
      totalDisbursed,
      totalCollected,
      expectedCollection,
      collectionPercentage,
      defaultedAmount,
    },
    trend: mergeTrendPoints(disbursementByMonth, collectionByMonth),
    disbursementByMonth,
    defaultedByMonth: computeDefaultedByMonth(input.loans),
    defaultComparison: computeDefaultComparison(input.loans),
    usingFallback: Boolean(input.usingFallback),
  };
}

/** Safe placeholder when APIs are unavailable — keeps layout stable for officers. */
export function officerDashboardFallback(
  branchId: string,
  branchName: string,
  zoneName: string
): OfficerDashboardMetrics {
  const months = lastSixMonthKeys();
  const disbursementByMonth = months.map((month, i) => ({
    month,
    label: monthLabel(month),
    amount: 4_200_000 + i * 850_000,
  }));
  const collectionByMonth = months.map((month, i) => ({
    month,
    label: monthLabel(month),
    amount: 3_100_000 + i * 720_000,
  }));
  const trend = mergeTrendPoints(disbursementByMonth, collectionByMonth);
  const defaultedByMonth = months.map((month, i) => ({
    month,
    label: monthLabel(month),
    amount: i === months.length - 1 ? 1_250_000 : 900_000 + i * 120_000,
  }));
  const currentMonth = defaultedByMonth[defaultedByMonth.length - 1].amount;
  const previousMonth = defaultedByMonth[defaultedByMonth.length - 2].amount;

  return {
    branch: {
      branchId,
      branchName,
      zoneName,
      totalDisbursed: 28_500_000,
      totalCollected: 19_200_000,
      expectedCollection: 24_000_000,
      collectionPercentage: 80,
      defaultedAmount: currentMonth,
    },
    trend,
    disbursementByMonth,
    defaultedByMonth,
    defaultComparison: {
      currentMonth,
      previousMonth,
      currentLabel: monthLabel(months[months.length - 1]),
      previousLabel: monthLabel(months[months.length - 2]),
      changeAmount: currentMonth - previousMonth,
      changePercent: previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0,
    },
    usingFallback: true,
  };
}
