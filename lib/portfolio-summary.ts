/** Normalized portfolio summary from `GET /reports/portfolio-summary` (see `backend-documentation/reports-controller.md`). */

export type PortfolioSummaryMetrics = {
 totalPortfolio: number;
 activeLoans: number;
 parAmount: number;
 parRate: number;
 nplRate: number;
 requiredProvision: number;
};

export type PortfolioProductRow = {
 productId: string;
 name: string;
 code: string;
 loanCount: number;
 outstanding: number;
 par: number;
 parRate: number;
};

export type PortfolioBranchRow = {
 branchId: string;
 name: string;
 code: string;
 loanCount: number;
 outstanding: number;
 disbursed: number;
 collected: number;
 collectionRate: number;
};

export type PortfolioSummaryView = {
 asOf: string;
 metrics: PortfolioSummaryMetrics;
 byProduct: PortfolioProductRow[];
 byBranch: PortfolioBranchRow[];
};

function num(value: unknown, fallback = 0): number {
 const n = Number(value);
 return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = ""): string {
 if (value === null || value === undefined) return fallback;
 return String(value);
}

function extractMetrics(raw: Record<string, unknown>): PortfolioSummaryMetrics {
 const portfolio =
 (typeof raw.portfolio === "object" && raw.portfolio !== null
 ? (raw.portfolio as Record<string, unknown>)
 : raw) ?? {};
 const risk =
 (typeof raw.risk === "object" && raw.risk !== null ? (raw.risk as Record<string, unknown>) : raw) ??
 {};

 const totalPortfolio = num(
 portfolio.outstanding_amount ?? raw.outstanding_amount ?? raw.total_portfolio ?? raw.total_outstanding
 );
 const activeLoans = num(
 portfolio.active_loan_count ?? portfolio.loan_count ?? raw.active_loan_count ?? raw.loan_count
 );
 const parAmount = num(risk.par_amount ?? raw.par_amount ?? raw.total_par);
 const parRate = num(risk.par_rate ?? raw.par_rate ?? raw.par_ratio);
 const nplRate = num(risk.npl_rate ?? raw.npl_rate ?? raw.npl_ratio);
 const requiredProvision = num(
 raw.required_provision ?? raw.provision_amount ?? risk.required_provision ?? risk.provision_amount
 );

 return {
 totalPortfolio,
 activeLoans,
 parAmount,
 parRate: parRate || (totalPortfolio > 0 ? (parAmount / totalPortfolio) * 100 : 0),
 nplRate,
 requiredProvision,
 };
}

function unwrapReportRoot(payload: unknown): Record<string, unknown> {
 if (!payload || typeof payload !== "object") return {};
 const o = payload as Record<string, unknown>;
 if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
 return o.data as Record<string, unknown>;
 }
 if (o.report && typeof o.report === "object" && !Array.isArray(o.report)) {
 return o.report as Record<string, unknown>;
 }
 return o;
}

export function normalizePortfolioSummary(payload: unknown): PortfolioSummaryView {
 const root = unwrapReportRoot(payload);
 const metricsRaw =
 typeof root.metrics === "object" && root.metrics !== null
 ? (root.metrics as Record<string, unknown>)
 : root;

 const byProductRaw = Array.isArray(root.by_product)
 ? root.by_product
 : Array.isArray(root.byProduct)
 ? root.byProduct
 : Array.isArray(root.items)
 ? root.items
 : [];

 const byBranchRaw = Array.isArray(root.by_branch)
 ? root.by_branch
 : Array.isArray(root.byBranch)
 ? root.byBranch
 : [];

 const byProduct: PortfolioProductRow[] = byProductRaw.map((row) => {
 const item = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
 const outstanding = num(item.outstanding_amount);
 const par = num(item.par_amount ?? item.par);
 const parRate = num(item.par_rate) || (outstanding > 0 ? (par / outstanding) * 100 : 0);
 return {
 productId: str(item.product_id ?? item.id),
 name: str(item.product_name ?? item.name, "Product"),
 code: str(item.product_code ?? item.code),
 loanCount: num(item.loan_count ?? item.active_loan_count),
 outstanding,
 par,
 parRate,
 };
 });

 const byBranch: PortfolioBranchRow[] = byBranchRaw.map((row) => {
 const item = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
 return {
 branchId: str(item.branch_id ?? item.id),
 name: str(item.branch_name ?? item.name, "Branch"),
 code: str(item.branch_code ?? item.code),
 loanCount: num(item.loan_count),
 outstanding: num(item.outstanding_amount),
 disbursed: num(item.disbursed_amount ?? item.principal_amount ?? item.disbursed),
 collected: num(item.collected_amount ?? item.collected),
 collectionRate: num(item.collection_rate),
 };
 });

 const asOf = str(root.as_of ?? metricsRaw.as_of, new Date().toISOString().slice(0, 10));

 return {
 asOf,
 metrics: extractMetrics(metricsRaw),
 byProduct,
 byBranch,
 };
}
