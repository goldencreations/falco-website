import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type ReportApplicationRow = {
 application_number: string;
 customer_name: string;
 status: string;
 amount: number;
 created_at: string;
};

type ReportCustomerRow = {
 customer_number: string;
 customer_name: string;
 phone: string;
 region: string;
 district: string;
};

type ReportLoanRow = {
 loan_number: string;
 customer_name: string;
 product_name: string;
 principal: number;
 outstanding: number;
 status: string;
};

type ReportCollectionRow = {
 action: string;
 customer_name: string;
 notes: string;
 performed_at: string;
};

type ExportBranchReportInput = {
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

export function exportBranchReportPdf(input: ExportBranchReportInput): void {
 const doc = new jsPDF({ unit: "mm", format: "a4" });
 const pageWidth = doc.internal.pageSize.getWidth();
 const margin = 12;

 doc.setFillColor(15, 118, 110);
 doc.rect(0, 0, pageWidth, 28, "F");
 doc.setTextColor(255, 255, 255);
 doc.setFontSize(14);
 doc.text("Falco Financial Branch Report", margin, 12);
 doc.setFontSize(10);
 doc.text(`${input.branchName} • ${input.periodLabel}`, margin, 19);
 doc.text(`Generated: ${input.generatedAt}`, margin, 24);

 doc.setTextColor(20, 20, 20);
 autoTable(doc, {
 startY: 34,
 head: [["Metric", "Value"]],
 body: [
 ["Total Portfolio", fmtMoney(input.summary.totalPortfolio)],
 ["PAR >30 Days", fmtMoney(input.summary.totalPar)],
 ["PAR Ratio", `${input.summary.parRatio.toFixed(1)}%`],
 ["NPL Ratio", `${input.summary.nplRatio.toFixed(1)}%`],
 ["Required Provision", fmtMoney(input.summary.requiredProvision)],
 ["Applications", String(input.applications.length)],
 ["Customers", String(input.customers.length)],
 ["Loans", String(input.loans.length)],
 ["Collections", String(input.collections.length)],
 ],
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 columnStyles: { 0: { cellWidth: 60 } },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Product", "Loans", "Outstanding", "PAR", "PAR Rate"]],
 body: input.productPerformance.map((row) => [
 row.name,
 String(row.loanCount),
 fmtMoney(row.outstanding),
 fmtMoney(row.par),
 `${row.parRate.toFixed(1)}%`,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Aging Class", "Outstanding", "Rate", "Provision"]],
 body: input.agingReport.map((row) => [
 row.classificationLabel,
 fmtMoney(row.outstanding),
 `${row.rate}%`,
 fmtMoney(row.provision),
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Branch", "Loans", "Disbursed", "Collected", "Outstanding", "Collection Rate"]],
 body: input.branchPerformance.map((row) => [
 row.name,
 String(row.loanCount),
 fmtMoney(row.disbursed),
 fmtMoney(row.collected),
 fmtMoney(row.outstanding),
 `${row.collectionRate.toFixed(1)}%`,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Application #", "Customer", "Status", "Amount", "Created"]],
 body: input.applications.map((row) => [
 row.application_number,
 row.customer_name,
 row.status.replace(/_/g, " "),
 fmtMoney(row.amount),
 row.created_at,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Customer #", "Name", "Phone", "Region", "District"]],
 body: input.customers.map((row) => [
 row.customer_number,
 row.customer_name,
 row.phone,
 row.region,
 row.district,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Loan #", "Customer", "Product", "Principal", "Outstanding", "Status"]],
 body: input.loans.map((row) => [
 row.loan_number,
 row.customer_name,
 row.product_name,
 fmtMoney(row.principal),
 fmtMoney(row.outstanding),
 row.status.replace(/_/g, " "),
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 autoTable(doc, {
 startY: nextY(doc),
 head: [["Action", "Customer", "Notes", "Performed At"]],
 body: input.collections.map((row) => [
 row.action.replace(/_/g, " "),
 row.customer_name,
 row.notes,
 row.performed_at,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [15, 118, 110] },
 });

 doc.save(`branch-report-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
