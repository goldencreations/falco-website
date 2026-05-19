import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PortfolioSummaryView } from "@/lib/portfolio-summary";

function fmtMoney(value: number): string {
 return new Intl.NumberFormat("en-TZ", {
 style: "currency",
 currency: "TZS",
 maximumFractionDigits: 0,
 }).format(value);
}

export function exportPortfolioSummaryPdf(
 data: PortfolioSummaryView,
 scopeLabel: string
): void {
 const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
 const generatedAt = new Date().toLocaleString("en-TZ");

 doc.setFontSize(16);
 doc.text("Falco Financial Services", 14, 16);
 doc.setFontSize(11);
 doc.text("Portfolio Summary Report", 14, 24);
 doc.setFontSize(9);
 doc.text(`Scope: ${scopeLabel}`, 14, 30);
 doc.text(`As of: ${data.asOf}`, 14, 35);
 doc.text(`Generated: ${generatedAt}`, 14, 40);

 const { metrics } = data;
 autoTable(doc, {
 startY: 46,
 head: [["Metric", "Value"]],
 body: [
 ["Total portfolio", fmtMoney(metrics.totalPortfolio)],
 ["Active loans", String(metrics.activeLoans)],
 ["PAR amount", fmtMoney(metrics.parAmount)],
 ["PAR rate", `${metrics.parRate.toFixed(1)}%`],
 ["NPL rate", `${metrics.nplRate.toFixed(1)}%`],
 ["Required provision", fmtMoney(metrics.requiredProvision)],
 ],
 styles: { fontSize: 9 },
 headStyles: { fillColor: [16, 120, 100] },
 });

 if (data.byProduct.length) {
 autoTable(doc, {
 startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
 ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
 : 120,
 head: [["Product", "Loans", "Outstanding", "PAR", "PAR %"]],
 body: data.byProduct.map((row) => [
 row.name,
 String(row.loanCount),
 fmtMoney(row.outstanding),
 fmtMoney(row.par),
 `${row.parRate.toFixed(1)}%`,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [16, 120, 100] },
 });
 }

 if (data.byBranch.length) {
 autoTable(doc, {
 startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
 ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
 : 120,
 head: [["Branch", "Loans", "Outstanding", "Collected", "Collection %"]],
 body: data.byBranch.map((row) => [
 row.name,
 String(row.loanCount),
 fmtMoney(row.outstanding),
 fmtMoney(row.collected),
 `${row.collectionRate.toFixed(1)}%`,
 ]),
 styles: { fontSize: 8 },
 headStyles: { fillColor: [16, 120, 100] },
 });
 }

 doc.save(`portfolio-summary-${data.asOf}.pdf`);
}
