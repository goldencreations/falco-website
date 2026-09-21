import type { ExportBranchReportInput } from "@/lib/branch-report-pdf";

export type ReportExportValue = string | number | null | undefined;

export const REPORT_EXPORT_COLUMNS = [
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

export type ReportExportColumn = (typeof REPORT_EXPORT_COLUMNS)[number];
export type ReportExportRow = Partial<Record<ReportExportColumn, ReportExportValue>>;
export type ReportExportSection = {
  title: string;
  rows: ReportExportRow[];
};

function escapeCsvValue(value: ReportExportValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

  let text = value;
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function rowToCsv(row: ReportExportRow): string {
  return REPORT_EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column])).join(",");
}

export function buildBranchReportSections(input: ExportBranchReportInput): ReportExportSection[] {
  return [
    {
      title: "Report Details",
      rows: [
        {
          "Record Type": "Metadata",
          Name: "Scope",
          Value: input.branchName,
          Notes: "Branch or portfolio included in this report.",
        },
        {
          "Record Type": "Metadata",
          Name: "Reporting period",
          Value: input.periodLabel,
          "Date / Period":
            input.fromDate && input.toDate
              ? `${input.fromDate} to ${input.toDate}`
              : input.periodLabel,
          Notes: "Date range used for period-based report rows.",
        },
        {
          "Record Type": "Metadata",
          Name: "Generated at",
          Value: input.generatedAt,
          Notes: "Time this file was generated.",
        },
      ],
    },
    {
      title: "Portfolio Summary",
      rows: [
        {
          "Record Type": "Metric",
          Name: "Total portfolio",
          Description: "Outstanding balance across loans in scope.",
          Value: input.summary.totalPortfolio,
          Unit: "TZS",
        },
        {
          "Record Type": "Metric",
          Name: "Portfolio at risk over 30 days",
          Description: "Outstanding balance on loans more than 30 days overdue.",
          Value: input.summary.totalPar,
          Unit: "TZS",
        },
        {
          "Record Type": "Metric",
          Name: "PAR ratio",
          Description: "Portfolio at risk over 30 days as a percentage of total portfolio.",
          Value: input.summary.parRatio,
          Unit: "%",
          "Rate (%)": input.summary.parRatio,
        },
        {
          "Record Type": "Metric",
          Name: "NPL ratio",
          Description: "Non-performing loan balance as a percentage of total portfolio.",
          Value: input.summary.nplRatio,
          Unit: "%",
          "Rate (%)": input.summary.nplRatio,
        },
        {
          "Record Type": "Metric",
          Name: "Required provision",
          Description: "Estimated provision required for portfolio credit risk.",
          Value: input.summary.requiredProvision,
          Unit: "TZS",
        },
      ],
    },
    {
      title: "Product Performance",
      rows: input.productPerformance.map((row) => ({
        "Record Type": "Loan Product",
        Name: row.name,
        Count: row.loanCount,
        "Outstanding (TZS)": row.outstanding,
        "PAR / Provision (TZS)": row.par,
        "Rate (%)": row.parRate,
        Notes: "Rate is the product's portfolio-at-risk percentage.",
      })),
    },
    {
      title: "Portfolio Aging",
      rows: input.agingReport.map((row) => ({
        "Record Type": "Aging Classification",
        Name: row.classificationLabel,
        "Outstanding (TZS)": row.outstanding,
        "PAR / Provision (TZS)": row.provision,
        "Rate (%)": row.rate,
        Notes: "Provision is the estimated amount required for this aging classification.",
      })),
    },
    {
      title: "Branch Performance",
      rows: input.branchPerformance.map((row) => ({
        "Record Type": "Branch",
        Name: row.name,
        Count: row.loanCount,
        "Disbursed (TZS)": row.disbursed,
        "Collected (TZS)": row.collected,
        "Outstanding (TZS)": row.outstanding,
        "Rate (%)": row.collectionRate,
        Notes: "Rate is the branch collection rate.",
      })),
    },
    {
      title: "Loan Applications",
      rows: input.applications.map((row) => ({
        "Record Type": "Application",
        Reference: row.application_number,
        Name: row.customer_name,
        Status: row.status.replaceAll("_", " "),
        "Date / Period": row.created_at,
        Value: row.amount,
        Unit: "TZS requested",
      })),
    },
    {
      title: "Customers",
      rows: input.customers.map((row) => ({
        "Record Type": "Customer",
        Reference: row.customer_number,
        Name: row.customer_name,
        Description: row.phone,
        Notes: [row.district, row.region].filter((part) => part && part !== "—").join(", "),
      })),
    },
    {
      title: "Loans",
      rows: input.loans.map((row) => ({
        "Record Type": "Loan",
        Reference: row.loan_number,
        Name: row.customer_name,
        Description: row.product_name,
        Status: row.status.replaceAll("_", " "),
        "Principal (TZS)": row.principal,
        "Outstanding (TZS)": row.outstanding,
      })),
    },
    {
      title: "Collection Activities",
      rows: input.collections.map((row) => ({
        "Record Type": "Collection Activity",
        Name: row.customer_name,
        Description: row.action.replaceAll("_", " "),
        "Date / Period": row.performed_at,
        Notes: row.notes,
      })),
    },
  ];
}

/** Build a sectioned CSV report without nested JSON or repeated section labels. */
export function buildBranchReportCsv(input: ExportBranchReportInput): string {
  const lines = [REPORT_EXPORT_COLUMNS.map(escapeCsvValue).join(",")];

  buildBranchReportSections(input).forEach((section, index) => {
    if (index > 0) lines.push(rowToCsv({}));
    lines.push(rowToCsv({ Section: section.title.toUpperCase(), "Record Type": "Section Header" }));
    lines.push(...section.rows.map(rowToCsv));
  });

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
