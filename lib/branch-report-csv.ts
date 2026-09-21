import type { ExportBranchReportInput } from "@/lib/branch-report-pdf";

type CsvValue = string | number | null | undefined;

const CSV_COLUMNS = [
  "Section",
  "Record Type",
  "Reference",
  "Name",
  "Description",
  "Status",
  "Date / Period",
  "Count",
  "Value",
  "Unit",
  "Principal (TZS)",
  "Disbursed (TZS)",
  "Collected (TZS)",
  "Outstanding (TZS)",
  "PAR / Provision (TZS)",
  "Rate (%)",
  "Notes",
] as const;

type ReportCsvRow = Partial<Record<(typeof CSV_COLUMNS)[number], CsvValue>>;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

  let text = value;
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function rowToCsv(row: ReportCsvRow): string {
  return CSV_COLUMNS.map((column) => escapeCsvValue(row[column])).join(",");
}

function summaryRows(input: ExportBranchReportInput): ReportCsvRow[] {
  return [
    {
      Section: "Report Details",
      "Record Type": "Metadata",
      Name: "Scope",
      Value: input.branchName,
      Notes: "Branch or portfolio included in this report.",
    },
    {
      Section: "Report Details",
      "Record Type": "Metadata",
      Name: "Reporting period",
      Value: input.periodLabel,
      "Date / Period":
        input.fromDate && input.toDate ? `${input.fromDate} to ${input.toDate}` : input.periodLabel,
      Notes: "Date range used for period-based report rows.",
    },
    {
      Section: "Report Details",
      "Record Type": "Metadata",
      Name: "Generated at",
      Value: input.generatedAt,
      Notes: "Time this file was generated.",
    },
    {
      Section: "Portfolio Summary",
      "Record Type": "Metric",
      Name: "Total portfolio",
      Description: "Outstanding balance across loans in scope.",
      Value: input.summary.totalPortfolio,
      Unit: "TZS",
    },
    {
      Section: "Portfolio Summary",
      "Record Type": "Metric",
      Name: "Portfolio at risk over 30 days",
      Description: "Outstanding balance on loans more than 30 days overdue.",
      Value: input.summary.totalPar,
      Unit: "TZS",
    },
    {
      Section: "Portfolio Summary",
      "Record Type": "Metric",
      Name: "PAR ratio",
      Description: "Portfolio at risk over 30 days as a percentage of total portfolio.",
      Value: input.summary.parRatio,
      Unit: "%",
      "Rate (%)": input.summary.parRatio,
    },
    {
      Section: "Portfolio Summary",
      "Record Type": "Metric",
      Name: "NPL ratio",
      Description: "Non-performing loan balance as a percentage of total portfolio.",
      Value: input.summary.nplRatio,
      Unit: "%",
      "Rate (%)": input.summary.nplRatio,
    },
    {
      Section: "Portfolio Summary",
      "Record Type": "Metric",
      Name: "Required provision",
      Description: "Estimated provision required for portfolio credit risk.",
      Value: input.summary.requiredProvision,
      Unit: "TZS",
    },
  ];
}

/** Build a flat, filterable CSV report without nested JSON cells. */
export function buildBranchReportCsv(input: ExportBranchReportInput): string {
  const rows: ReportCsvRow[] = [
    ...summaryRows(input),
    ...input.productPerformance.map((row) => ({
      Section: "Product Performance",
      "Record Type": "Loan Product",
      Name: row.name,
      Count: row.loanCount,
      "Outstanding (TZS)": row.outstanding,
      "PAR / Provision (TZS)": row.par,
      "Rate (%)": row.parRate,
      Notes: "Rate is the product's portfolio-at-risk percentage.",
    })),
    ...input.agingReport.map((row) => ({
      Section: "Portfolio Aging",
      "Record Type": "Aging Classification",
      Name: row.classificationLabel,
      "Outstanding (TZS)": row.outstanding,
      "PAR / Provision (TZS)": row.provision,
      "Rate (%)": row.rate,
      Notes: "Provision is the estimated amount required for this aging classification.",
    })),
    ...input.branchPerformance.map((row) => ({
      Section: "Branch Performance",
      "Record Type": "Branch",
      Name: row.name,
      Count: row.loanCount,
      "Disbursed (TZS)": row.disbursed,
      "Collected (TZS)": row.collected,
      "Outstanding (TZS)": row.outstanding,
      "Rate (%)": row.collectionRate,
      Notes: "Rate is the branch collection rate.",
    })),
    ...input.applications.map((row) => ({
      Section: "Loan Applications",
      "Record Type": "Application",
      Reference: row.application_number,
      Name: row.customer_name,
      Status: row.status.replaceAll("_", " "),
      "Date / Period": row.created_at,
      Value: row.amount,
      Unit: "TZS requested",
    })),
    ...input.customers.map((row) => ({
      Section: "Customers",
      "Record Type": "Customer",
      Reference: row.customer_number,
      Name: row.customer_name,
      Description: row.phone,
      Notes: [row.district, row.region].filter((part) => part && part !== "—").join(", "),
    })),
    ...input.loans.map((row) => ({
      Section: "Loans",
      "Record Type": "Loan",
      Reference: row.loan_number,
      Name: row.customer_name,
      Description: row.product_name,
      Status: row.status.replaceAll("_", " "),
      "Principal (TZS)": row.principal,
      "Outstanding (TZS)": row.outstanding,
    })),
    ...input.collections.map((row) => ({
      Section: "Collection Activities",
      "Record Type": "Collection Activity",
      Name: row.customer_name,
      Description: row.action.replaceAll("_", " "),
      "Date / Period": row.performed_at,
      Notes: row.notes,
    })),
  ];

  return `\uFEFF${[CSV_COLUMNS.map(escapeCsvValue).join(","), ...rows.map(rowToCsv)].join("\r\n")}\r\n`;
}
