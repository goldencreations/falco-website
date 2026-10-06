export const trialBalanceAccountTypes = ["asset", "liability", "equity", "income", "expense"] as const;

export type TrialBalanceAccountType = (typeof trialBalanceAccountTypes)[number];
export type TrialBalanceTypeFilter = "all" | TrialBalanceAccountType;
export type NormalBalance = "debit" | "credit";

export type TrialBalanceAmountFields = {
  opening_debit: string;
  opening_credit: string;
  period_debit: string;
  period_credit: string;
  closing_debit: string;
  closing_credit: string;
  debits: string;
  credits: string;
  debit_balance: string;
  credit_balance: string;
};

export type TrialBalanceRow = TrialBalanceAmountFields & {
  account_id: number;
  account_code: string;
  account_name: string;
  account_type: TrialBalanceAccountType;
  normal_balance: NormalBalance;
  is_contra: boolean;
};

export type TrialBalanceReport = {
  currency: "TZS";
  from: string;
  to: string;
  as_of: string;
  filters: {
    from: string;
    to: string;
    branch_id?: string | null;
    account_type?: TrialBalanceAccountType | null;
    include_zero_activity?: boolean;
  };
  rows: TrialBalanceRow[];
  totals: TrialBalanceAmountFields;
};

export type TrialBalanceResponse = { data: TrialBalanceReport };

export type TrialBalanceFilters = {
  from: string;
  to: string;
  type: TrialBalanceTypeFilter;
  includeZeroActivity: boolean;
};

export type TrialBalanceMinorTotals = {
  openingDebit: bigint;
  openingCredit: bigint;
  periodDebit: bigint;
  periodCredit: bigint;
  closingDebit: bigint;
  closingCredit: bigint;
};

export type TrialBalanceGroup = {
  type: TrialBalanceAccountType;
  label: string;
  rows: TrialBalanceRow[];
  totals: TrialBalanceMinorTotals;
};

const accountTypeLabels: Record<TrialBalanceAccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const conventionalNormalBalance: Record<TrialBalanceAccountType, NormalBalance> = {
  asset: "debit",
  liability: "credit",
  equity: "credit",
  income: "credit",
  expense: "debit",
};

export function decimalToMinorUnits(value: string): bigint {
  const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid accounting amount: ${value}`);
  }

  const [, sign, whole, rawFraction = ""] = match;
  const extraFraction = rawFraction.slice(2);
  if (/[^0]/.test(extraFraction)) {
    throw new Error(`Accounting amount has more than two decimal places: ${value}`);
  }

  const fraction = rawFraction.slice(0, 2).padEnd(2, "0");
  const minor = (BigInt(whole) * BigInt(100)) + BigInt(fraction);

  return sign === "-" ? -minor : minor;
}

export function emptyTrialBalanceTotals(): TrialBalanceMinorTotals {
  return {
    openingDebit: BigInt(0),
    openingCredit: BigInt(0),
    periodDebit: BigInt(0),
    periodCredit: BigInt(0),
    closingDebit: BigInt(0),
    closingCredit: BigInt(0),
  };
}

export function sumTrialBalanceRows(rows: TrialBalanceRow[]): TrialBalanceMinorTotals {
  return rows.reduce<TrialBalanceMinorTotals>((totals, row) => ({
    openingDebit: totals.openingDebit + decimalToMinorUnits(row.opening_debit),
    openingCredit: totals.openingCredit + decimalToMinorUnits(row.opening_credit),
    periodDebit: totals.periodDebit + decimalToMinorUnits(row.period_debit),
    periodCredit: totals.periodCredit + decimalToMinorUnits(row.period_credit),
    closingDebit: totals.closingDebit + decimalToMinorUnits(row.closing_debit),
    closingCredit: totals.closingCredit + decimalToMinorUnits(row.closing_credit),
  }), emptyTrialBalanceTotals());
}

export function isZeroActivityRow(row: TrialBalanceRow): boolean {
  return [
    row.opening_debit,
    row.opening_credit,
    row.period_debit,
    row.period_credit,
    row.closing_debit,
    row.closing_credit,
  ].every((amount) => decimalToMinorUnits(amount) === BigInt(0));
}

export function filterTrialBalanceRows(
  rows: TrialBalanceRow[],
  type: TrialBalanceTypeFilter,
  includeZeroActivity: boolean,
): TrialBalanceRow[] {
  return rows.filter((row) => {
    const matchesType = type === "all" || row.account_type === type;
    const matchesActivity = includeZeroActivity || !isZeroActivityRow(row);

    return matchesType && matchesActivity;
  });
}

export function isContraAccount(row: Pick<TrialBalanceRow, "account_type" | "normal_balance" | "is_contra">): boolean {
  return row.is_contra || conventionalNormalBalance[row.account_type] !== row.normal_balance;
}

export function groupTrialBalanceRows(rows: TrialBalanceRow[]): TrialBalanceGroup[] {
  return trialBalanceAccountTypes.flatMap((type) => {
    const groupRows = rows.filter((row) => row.account_type === type);
    if (groupRows.length === 0) {
      return [];
    }

    return [{
      type,
      label: accountTypeLabels[type],
      rows: groupRows,
      totals: sumTrialBalanceRows(groupRows),
    }];
  });
}

export function formatTzsFromMinorUnits(value: bigint): string {
  const zero = BigInt(0);
  const rounding = BigInt(50);
  const scale = BigInt(100);
  const roundedWhole = value >= zero ? (value + rounding) / scale : (value - rounding) / scale;
  const sign = roundedWhole < zero ? "-" : "";
  const digits = (roundedWhole < zero ? -roundedWhole : roundedWhole).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `${sign}TZS ${grouped}`;
}

export function calendarDateToDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function dateKeyToCalendarDate(dateKey: string): Date {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
}

export function eatDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Dar_es_Salaam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function defaultTrialBalanceDateRange(now: Date = new Date()): Pick<TrialBalanceFilters, "from" | "to"> {
  const today = eatDateKey(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();

  return {
    from: `${today.slice(0, 8)}01`,
    to: `${today.slice(0, 8)}${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildTrialBalanceUrl(filters: TrialBalanceFilters, format?: "csv"): string {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.type !== "all") {
    params.set("account_type", filters.type);
  }
  if (!filters.includeZeroActivity) {
    params.set("include_zero_activity", "0");
  }
  if (format) {
    params.set("format", format);
  }

  return `/api/general-ledger/reports/trial-balance?${params.toString()}`;
}
