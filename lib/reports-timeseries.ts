/** Helpers for `GET /dashboard/timeseries` and monthly report charts. */

export type TimeseriesPoint = {
  period: string;
  label: string;
  amount: number;
  count: number;
};

export type MonthlyActivityRow = {
  /** Display label, e.g. "Jul" or "Jul '25" when the range spans years. */
  month: string;
  /** Stable sort key `YYYY-MM`. */
  monthKey: string;
  disbursements: number;
  collections: number;
  newLoans: number;
  /** Payment / collection transaction count from timeseries (when provided). */
  collectionCount: number;
  outstanding: number;
};

export type MonthlyActivitySummary = {
  /** Months with at least one non-zero metric (capped for display). */
  displayRows: MonthlyActivityRow[];
  periodTotals: {
    disbursements: number;
    collections: number;
    newLoans: number;
    collectionCount: number;
    netLoanGrowth: number;
  };
  activeMonths: number;
  hiddenEmptyMonths: number;
};

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalize API period strings to a monthly bucket (`YYYY-MM`). */
export function monthKeyFromPeriod(period: string): string {
  const trimmed = period.trim();
  if (!trimmed) return "";

  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);

  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function monthDisplayLabel(monthKey: string, includeYear = false): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const d = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return monthKey;
  return d.toLocaleString("en-US", {
    month: "short",
    ...(includeYear ? { year: "2-digit" } : {}),
  });
}

function periodLabel(period: string): string {
  const monthKey = monthKeyFromPeriod(period);
  return monthKey ? monthDisplayLabel(monthKey) : period;
}

function nonNegativeAmount(value: unknown): number {
  return Math.max(0, num(value));
}

export function normalizeTimeseries(payload: unknown): TimeseriesPoint[] {
  const root =
    typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};
  const items = Array.isArray(root.points)
    ? root.points
    : Array.isArray(root.items)
      ? root.items
      : Array.isArray(root.data)
        ? root.data
        : Array.isArray(payload)
          ? payload
          : [];

  return items.map((row) => {
    const item = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
    const period = String(item.period ?? item.period_start ?? item.month ?? item.date ?? "");
    return {
      period,
      label: String(item.label ?? periodLabel(period)),
      amount: nonNegativeAmount(item.amount ?? item.value ?? item.total),
      count: num(item.count ?? item.loan_count ?? item.new_loans),
    };
  });
}

export function mergeMonthlyActivity(input: {
  disbursements: TimeseriesPoint[];
  collections: TimeseriesPoint[];
  outstanding: TimeseriesPoint[];
}): MonthlyActivityRow[] {
  const monthKeys = new Set<string>();
  const disbursementsByMonth = new Map<string, { amount: number; count: number }>();
  const collectionsByMonth = new Map<string, { amount: number; count: number }>();
  const outstandingByMonth = new Map<string, { period: string; amount: number }>();

  for (const point of input.disbursements) {
    const monthKey = monthKeyFromPeriod(point.period);
    if (!monthKey) continue;
    monthKeys.add(monthKey);
    const current = disbursementsByMonth.get(monthKey) ?? { amount: 0, count: 0 };
    disbursementsByMonth.set(monthKey, {
      amount: current.amount + point.amount,
      count: current.count + point.count,
    });
  }

  for (const point of input.collections) {
    const monthKey = monthKeyFromPeriod(point.period);
    if (!monthKey) continue;
    monthKeys.add(monthKey);
    const current = collectionsByMonth.get(monthKey) ?? { amount: 0, count: 0 };
    collectionsByMonth.set(monthKey, {
      amount: current.amount + point.amount,
      count: current.count + point.count,
    });
  }

  for (const point of input.outstanding) {
    const monthKey = monthKeyFromPeriod(point.period);
    if (!monthKey) continue;
    monthKeys.add(monthKey);
    const current = outstandingByMonth.get(monthKey);
    if (!current || point.period >= current.period) {
      outstandingByMonth.set(monthKey, { period: point.period, amount: point.amount });
    }
  }

  const sortedMonthKeys = Array.from(monthKeys).sort();
  const includeYear = new Set(sortedMonthKeys.map((key) => key.slice(0, 4))).size > 1;

  return sortedMonthKeys.map((monthKey) => {
    const disb = disbursementsByMonth.get(monthKey);
    const coll = collectionsByMonth.get(monthKey);
    const out = outstandingByMonth.get(monthKey);

    return {
      month: monthDisplayLabel(monthKey, includeYear),
      monthKey,
      disbursements: disb?.amount ?? 0,
      collections: coll?.amount ?? 0,
      newLoans: disb?.count ?? 0,
      collectionCount: coll?.count ?? 0,
      outstanding: out?.amount ?? 0,
    };
  });
}

export function hasMonthlyActivity(row: MonthlyActivityRow): boolean {
 return (
 row.disbursements > 0 ||
 row.collections > 0 ||
 row.newLoans > 0 ||
 row.collectionCount > 0
 );
}

/** Drop zero-only months and compute period totals for summary tables. */
export function buildMonthlyActivityView(
 rows: MonthlyActivityRow[],
 maxDisplayMonths = 12
): MonthlyActivitySummary {
 const active = rows.filter(hasMonthlyActivity);
 const hiddenEmptyMonths = Math.max(0, rows.length - active.length);
 const displayRows = active.slice(-maxDisplayMonths);

 const periodTotals = rows.reduce(
 (acc, row) => ({
 disbursements: acc.disbursements + row.disbursements,
 collections: acc.collections + row.collections,
 newLoans: acc.newLoans + row.newLoans,
 collectionCount: acc.collectionCount + row.collectionCount,
 netLoanGrowth: 0,
 }),
 {
 disbursements: 0,
 collections: 0,
 newLoans: 0,
 collectionCount: 0,
 netLoanGrowth: 0,
 }
 );
 periodTotals.netLoanGrowth = periodTotals.newLoans - periodTotals.collectionCount;

 return {
 displayRows,
 periodTotals,
 activeMonths: active.length,
 hiddenEmptyMonths,
 };
}

export function getPeriodRange(
 period: string,
 startDateFilter?: string,
 endDateFilter?: string
): { from: string; to: string; label: string } {
 const now = new Date();
 const end = endDateFilter ? new Date(`${endDateFilter}T23:59:59`) : now;
 const start = startDateFilter
 ? new Date(`${startDateFilter}T00:00:00`)
 : (() => {
 const s = new Date(end);
 if (period === "1m") s.setMonth(end.getMonth() - 1);
 else if (period === "3m") s.setMonth(end.getMonth() - 3);
 else if (period === "6m") s.setMonth(end.getMonth() - 6);
 else if (period === "1y") s.setFullYear(end.getFullYear() - 1);
 else s.setMonth(end.getMonth() - 6);
 return s;
 })();

 const toIso = (d: Date) => d.toISOString().slice(0, 10);
 const labels: Record<string, string> = {
 "1m": "Last Month",
 "3m": "Last 3 Months",
 "6m": "Last 6 Months",
 "1y": "Last Year",
 };

 return {
 from: toIso(start),
 to: toIso(end),
 label:
 startDateFilter || endDateFilter
 ? `Custom (${toIso(start)} to ${toIso(end)})`
 : labels[period] ?? "Selected Period",
 };
}
