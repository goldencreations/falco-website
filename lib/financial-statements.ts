export type StatementAccount = {
  id: number;
  code: string;
  name: string;
  amount: string;
};

export type StatementRow = {
  code: string;
  label: string;
  depth: number;
  kind: "detail" | "subtotal" | "heading" | "total";
  amount?: string;
  quarter_amount?: string;
  ytd_amount?: string;
  formula?: string | string[] | null;
  formula_components?: Array<{ code: string; sign: 1 | -1 }>;
  accounts: StatementAccount[];
  ytd_accounts?: StatementAccount[];
  calculation?: string;
};

export type StatementCheck = {
  code?: string;
  label?: string;
  passed?: boolean;
  difference?: string;
  actual?: string;
  message?: string;
};

export type UnmappedAccount = {
  id: number;
  code: string;
  name: string;
  type?: string;
  balance?: string;
  amount?: string;
  reason: string;
};

export type FinancialStatementsReport = {
  metadata?: { institution_name?: string | null; institution_code?: string | null; msp_code?: string | null };
  period: {
    year: number;
    quarter: number;
    from: string;
    to: string;
    ytd_from: string;
    financial_year_start: string;
    currency: string;
    generated_at?: string;
  };
  balance_sheet: { code: "MSP2_01"; rows: StatementRow[]; checks?: StatementCheck[] };
  income_statement: { code: "MSP2_02"; rows: StatementRow[]; checks?: StatementCheck[] };
  checks?: StatementCheck[];
  warnings: Array<string | { code?: string; message: string }>;
  unmapped_accounts: UnmappedAccount[];
  completeness: {
    status: "complete" | "incomplete";
    mapped_accounts: number;
    total_accounts: number;
    ratio: number | string;
    mapping_complete?: boolean;
    data_ready?: boolean;
  };
};

export type ReportCategory = { value: string; label: string; statement?: string; code?: string };

// Keep report-page editing paused without removing the tools or changing other ledger screens.
export const FINANCIAL_STATEMENT_EDITING_ENABLED = false;

export function statementWorkspaceActions(user?: { role?: string; permissions?: string[] } | null) {
  const hasPermission = (permission: string) => user?.role === "super_admin"
    || Boolean(user?.permissions?.includes("all") || user?.permissions?.includes(permission));
  return {
    canExport: hasPermission("gl.export"),
    canConfigure: FINANCIAL_STATEMENT_EDITING_ENABLED && hasPermission("gl.configure"),
    canPost: FINANCIAL_STATEMENT_EDITING_ENABLED && hasPermission("gl.post"),
  };
}

export function statementUrl(year: number, quarter: number, exportData = false): string {
  const params = new URLSearchParams({ year: String(year), quarter: String(quarter) });
  if (exportData) params.set("format", "xlsx_data");
  return `/api/general-ledger/reports/financial-statements?${params.toString()}`;
}

export function parseFinancialStatements(payload: unknown): FinancialStatementsReport {
  if (!payload || typeof payload !== "object") throw new Error("The server returned an invalid financial statement response.");
  const data = "data" in payload ? (payload as { data: unknown }).data : payload;
  if (!data || typeof data !== "object") throw new Error("The financial statement response has no data.");
  const report = data as Partial<FinancialStatementsReport>;
  if (!report.period || !report.balance_sheet || !Array.isArray(report.balance_sheet.rows)
    || !report.income_statement || !Array.isArray(report.income_statement.rows)
    || !Array.isArray(report.warnings) || !Array.isArray(report.unmapped_accounts) || !report.completeness) {
    throw new Error("The financial statement response is incomplete. Refresh the report or contact support.");
  }
  return report as FinancialStatementsReport;
}

export function formatStatementAmount(value?: string): string {
  if (value === undefined || value === null || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
