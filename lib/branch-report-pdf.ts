import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportApplicationRow = {
 application_number: string;
 customer_name: string;
 status: string;
 amount: number;
 created_at: string;
};

export type ReportCustomerRow = {
 customer_number: string;
 customer_name: string;
 phone: string;
 region: string;
 district: string;
};

export type ReportLoanRow = {
 loan_number: string;
 customer_name: string;
 product_name: string;
 principal: number;
 outstanding: number;
 status: string;
};

export type ReportCollectionRow = {
 action: string;
 customer_name: string;
 notes: string;
 performed_at: string;
};

export type ExportBranchReportInput = {
 branchName: string;
 periodLabel: string;
 generatedAt: string;
 summary: {
 totalPortfolio: number;
 totalPar: number;
 parRatio: number;
 nplRatio: number;
 requiredProvision: number;
 };
 productPerformance: Array<{
 name: string;
 loanCount: number;
 outstanding: number;
 par: number;
 parRate: number;
 }>;
 agingReport: Array<{
 classificationLabel: string;
 outstanding: number;
 provision: number;
 rate: number;
 }>;
 branchPerformance: Array<{
 name: string;
 loanCount: number;
 disbursed: number;
 collected: number;
 outstanding: number;
 collectionRate: number;
 }>;
 applications: ReportApplicationRow[];
 customers: ReportCustomerRow[];
 loans: ReportLoanRow[];
 collections: ReportCollectionRow[];
};

function fmtMoney(value: number): string {
 return new Intl.NumberFormat("en-TZ", {
 style: "currency",
 currency: "TZS",
 maximumFractionDigits: 0,
 }).format(value);
}

function nextY(doc: jsPDF, gap = 6): number {
 const tableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
 return (tableDoc.lastAutoTable?.finalY ?? 24) + gap;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
 doc.setFont("helvetica", "bold");
 doc.setFontSize(10);
 doc.setTextColor(15, 118, 110);
 doc.text(title, 12, y);
 doc.setFont("helvetica", "normal");
 doc.setTextColor(20, 20, 20);
 return y + 4;
}

function tableBody<T>(rows: T[], emptyCols: number, emptyMessage: string): T[] | string[][] {
 if (rows.length > 0) return rows;
 return [Array.from({ length: emptyCols }, (_, i) => (i === 0 ? emptyMessage : "—"))];
}

const tableDefaults = {
 styles: { fontSize: 7, cellPadding: 1.8, overflow: "linebreak" as const },
 headStyles: { fillColor: [15, 118, 110] as [number, number, number], fontSize: 7 },
 showHead: "everyPage" as const,
 margin: { left: 12, right: 12 },
};

export function exportBranchReportPdf(input: ExportBranchReportInput): void {
 const doc = new jsPDF({ unit: "mm", format: "a4" });
 const pageWidth = doc.internal.pageSize.getWidth();
 const margin = 12;

 doc.setFillColor(15, 118, 110);
 doc.rect(0, 0, pageWidth, 28, "F");
 doc.setTextColor(255, 255, 255);
 doc.setFontSize(14);
 doc.text("Falco Financial Portfolio Report", margin, 12);
 doc.setFontSize(10);
 doc.text(`${input.branchName} • ${input.periodLabel}`, margin, 19);
 doc.text(`Generated: ${input.generatedAt}`, margin, 24);

 doc.setTextColor(20, 20, 20);
 autoTable(doc, {
 ...tableDefaults,
 startY: 34,
 head: [["Metric", "Value"]],
 body: [
 ["Total Portfolio", fmtMoney(input.summary.totalPortfolio)],
 ["PAR >30 Days", fmtMoney(input.summary.totalPar)],
 ["PAR Ratio", `${input.summary.parRatio.toFixed(1)}%`],
 ["NPL Ratio", `${input.summary.nplRatio.toFixed(1)}%`],
 ["Required Provision", fmtMoney(input.summary.requiredProvision)],
 ["Applications (period)", String(input.applications.length)],
 ["Customers (branch)", String(input.customers.length)],
 ["Loans (branch)", String(input.loans.length)],
 ["Collection activities (period)", String(input.collections.length)],
 ],
 columnStyles: { 0: { cellWidth: 62 } },
 });

 let y = sectionTitle(doc, "Product performance", nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Product", "Loans", "Outstanding", "PAR", "PAR Rate"]],
 body: tableBody(
 input.productPerformance.map((row) => [
 row.name,
 String(row.loanCount),
 fmtMoney(row.outstanding),
 fmtMoney(row.par),
 `${row.parRate.toFixed(1)}%`,
 ]),
 5,
 "No product breakdown"
 ),
 });

 y = sectionTitle(doc, "Portfolio aging (BOT)", nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Aging Class", "Outstanding", "Rate", "Provision"]],
 body: tableBody(
 input.agingReport.map((row) => [
 row.classificationLabel,
 fmtMoney(row.outstanding),
 `${row.rate}%`,
 fmtMoney(row.provision),
 ]),
 4,
 "No aging data"
 ),
 });

 y = sectionTitle(doc, "Branch performance", nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Branch", "Loans", "Disbursed", "Collected", "Outstanding", "Collection Rate"]],
 body: tableBody(
 input.branchPerformance.map((row) => [
 row.name,
 String(row.loanCount),
 fmtMoney(row.disbursed),
 fmtMoney(row.collected),
 fmtMoney(row.outstanding),
 `${row.collectionRate.toFixed(1)}%`,
 ]),
 6,
 "No branch performance rows"
 ),
 });

 y = sectionTitle(doc, `Loan applications (${input.applications.length})`, nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Application #", "Customer", "Status", "Amount", "Created"]],
 body: tableBody(
 input.applications.map((row) => [
 row.application_number,
 row.customer_name,
 row.status.replace(/_/g, " "),
 fmtMoney(row.amount),
 row.created_at,
 ]),
 5,
 "No applications in this period"
 ),
 });

 y = sectionTitle(doc, `Customers (${input.customers.length})`, nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Customer #", "Name", "Phone", "Region", "District"]],
 body: tableBody(
 input.customers.map((row) => [
 row.customer_number,
 row.customer_name,
 row.phone,
 row.region,
 row.district,
 ]),
 5,
 "No customers in scope"
 ),
 });

 y = sectionTitle(doc, `Loans (${input.loans.length})`, nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Loan #", "Customer", "Product", "Principal", "Outstanding", "Status"]],
 body: tableBody(
 input.loans.map((row) => [
 row.loan_number,
 row.customer_name,
 row.product_name,
 fmtMoney(row.principal),
 fmtMoney(row.outstanding),
 row.status.replace(/_/g, " "),
 ]),
 6,
 "No loans in scope"
 ),
 });

 y = sectionTitle(doc, `Collection activities (${input.collections.length})`, nextY(doc));
 autoTable(doc, {
 ...tableDefaults,
 startY: y,
 head: [["Action", "Customer", "Notes", "Performed At"]],
 body: tableBody(
 input.collections.map((row) => [
 row.action.replace(/_/g, " "),
 row.customer_name,
 row.notes,
 row.performed_at,
 ]),
 4,
 "No collection activities in this period"
 ),
 });

 const pageCount = doc.getNumberOfPages();
 for (let i = 1; i <= pageCount; i++) {
 doc.setPage(i);
 doc.setFontSize(8);
 doc.setTextColor(120, 120, 120);
 doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 6, {
 align: "right",
 });
 }

 doc.save(`portfolio-report-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
