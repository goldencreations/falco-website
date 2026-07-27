import { Workbook } from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CalculatorResultView } from "@/lib/calculator-adapters";
import { formatCurrency, formatDate } from "@/lib/formatters";

const TEAL: [number, number, number] = [15, 118, 110];
const TEAL_LIGHT: [number, number, number] = [236, 253, 245];

const BRAND = {
  companyLegal: "Falco Financial Services Ltd",
  companyTrading: "Falco Financial Services",
  productLine: "Loan Management System",
  jurisdiction: "United Republic of Tanzania",
} as const;

export type LoanCalculatorExportMeta = {
  mode: "product" | "manual";
  productName?: string | null;
  startDate?: string | null;
  latePaymentPenaltyPercent?: number | null;
};

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function nextY(doc: jsPDF, gapMm = 6): number {
  const d = doc as DocWithTable;
  return (d.lastAutoTable?.finalY ?? 40) + gapMm;
}

function frequencyLabel(value: string): string {
  if (value === "weekly") return "Weekly";
  if (value === "daily") return "Daily";
  if (value === "bi_weekly") return "Bi-weekly";
  return "Monthly";
}

function interestTypeLabel(value: string): string {
  return value === "flat" || value === "flat_interest" ? "Flat interest" : "Declining balance";
}

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function money(value: number | undefined | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatCurrency(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function summaryRows(result: CalculatorResultView, meta: LoanCalculatorExportMeta): [string, string][] {
  const usesManualFormula =
    result.interestOnPrincipal != null || result.interestOnProcessingFee != null;
  const rows: [string, string][] = [
    ["Mode", meta.mode === "product" ? "Product-based" : "Manual"],
  ];
  if (meta.productName) rows.push(["Product", meta.productName]);
  if (meta.startDate) rows.push(["Start date", formatDate(meta.startDate)]);
  rows.push(
    ["Principal", money(result.principal)],
    [
      "Term",
      [
        result.termDays != null ? `${result.termDays} days` : null,
        result.loanPeriodMonths != null ? `${result.loanPeriodMonths} months` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
    ],
    ["Repayment frequency", frequencyLabel(result.repaymentFrequency)],
    ["Interest type", interestTypeLabel(result.interestType)],
    ["Interest rate / month", `${result.interestRate}%`],
    [
      usesManualFormula ? "Interest on principal" : "Interest",
      money(result.interestOnPrincipal ?? result.interestAmount),
    ]
  );
  if (usesManualFormula) {
    rows.push(["Interest on processing fee", money(result.interestOnProcessingFee ?? 0)]);
  }
  rows.push(
    ["Processing fee", money(result.processingFee)],
    ["Insurance fee", money(result.insuranceFee)],
    ["Total fees", money(result.totalFees)],
    ["Installments", String(result.repaymentCount)],
    ["Installment amount", money(result.installmentAmount)],
    [usesManualFormula ? "Total loan" : "Total repayment", money(result.totalRepayment)]
  );
  if (result.firstRepaymentDate) {
    rows.push(["First repayment", formatDate(result.firstRepaymentDate)]);
  }
  if (result.penaltyAmount != null && result.penaltyAmount > 0) {
    rows.push(["Penalty in preview", money(result.penaltyAmount)]);
  }
  if (meta.latePaymentPenaltyPercent != null && meta.latePaymentPenaltyPercent > 0) {
    rows.push(["Late payment penalty rate", `${meta.latePaymentPenaltyPercent}%`]);
  }
  return rows;
}

/** Download a branded PDF of the current loan calculator result + schedule. */
export function exportLoanCalculatorPdf(
  result: CalculatorResultView,
  meta: LoanCalculatorExportMeta = { mode: "manual" }
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(BRAND.companyLegal, margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${BRAND.companyTrading} · ${BRAND.productLine}`, margin, 17);
  doc.text(BRAND.jurisdiction, margin, 22);
  doc.setFontSize(7);
  doc.text("Loan calculator estimate", pageW - margin, 11, { align: "right" });

  let y = 34;
  doc.setTextColor(28, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LOAN CALCULATION RESULT", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text("Indicative schedule for planning — not a loan offer", pageW / 2, y, {
    align: "center",
  });
  y += 8;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 55, fillColor: TEAL_LIGHT, textColor: TEAL, fontStyle: "bold" },
      1: { cellWidth: pageW - margin * 2 - 55 },
    },
    body: summaryRows(result, meta),
  });

  y = nextY(doc, 8);

  if (result.schedulePreview.length > 0) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: TEAL,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 2 },
      head: [["#", "Due date", "Principal", "Interest", "Fees", "Total"]],
      body: result.schedulePreview.map((row) => [
        String(row.installmentNumber),
        row.dueDate ? formatDate(row.dueDate) : "—",
        money(row.principalDue),
        money(row.interestDue),
        money(row.feesDue),
        money(row.totalDue),
      ]),
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 32 },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right", fontStyle: "bold" },
      },
    });
  }

  const footY = pageH - 16;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.35);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text(BRAND.companyLegal, margin, footY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "Generated from Falco LMS loan calculator. Figures are estimates and may differ from final disbursement terms.",
    margin,
    footY + 4,
    { maxWidth: pageW - margin * 2 - 40 }
  );
  doc.text(`Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, pageW - margin, footY, {
    align: "right",
  });

  doc.save(`loan-calculation-${stamp()}.pdf`);
}

/** Download an Excel workbook of the current loan calculator result + schedule. */
export async function exportLoanCalculatorExcel(
  result: CalculatorResultView,
  meta: LoanCalculatorExportMeta = { mode: "manual" }
): Promise<void> {
  const workbook = new Workbook();
  workbook.creator = BRAND.companyLegal;
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  summary.columns = [{ width: 32 }, { width: 28 }];

  summary.mergeCells("A1:B1");
  summary.getCell("A1").value = BRAND.companyLegal;
  summary.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F766E" },
  };
  summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  summary.getRow(1).height = 24;

  summary.mergeCells("A2:B2");
  summary.getCell("A2").value = "Loan calculation result";
  summary.getCell("A2").font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  summary.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF14B8A6" },
  };
  summary.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
  summary.getRow(2).height = 20;

  let rowNumber = 4;
  for (const [label, value] of summaryRows(result, meta)) {
    const row = summary.getRow(rowNumber);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: "FF0F766E" } };
    row.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFECFDF5" },
    };
    row.getCell(2).value = value;
    rowNumber += 1;
  }

  rowNumber += 1;
  summary.getCell(`A${rowNumber}`).value =
    "Indicative schedule for planning — not a loan offer.";
  summary.getCell(`A${rowNumber}`).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  summary.mergeCells(`A${rowNumber}:B${rowNumber}`);

  if (result.schedulePreview.length > 0) {
    const schedule = workbook.addWorksheet("Schedule");
    schedule.columns = [
      { header: "#", width: 8 },
      { header: "Due date", width: 16 },
      { header: "Principal", width: 16 },
      { header: "Interest", width: 16 },
      { header: "Fees", width: 14 },
      { header: "Total", width: 16 },
    ];
    const header = schedule.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F766E" },
      };
      cell.alignment = { horizontal: "center" };
    });

    for (const item of result.schedulePreview) {
      schedule.addRow([
        item.installmentNumber,
        item.dueDate ? formatDate(item.dueDate) : "—",
        item.principalDue ?? null,
        item.interestDue ?? null,
        item.feesDue ?? null,
        item.totalDue,
      ]);
    }

    for (const col of [3, 4, 5, 6]) {
      schedule.getColumn(col).numFmt = '#,##0 "TZS"';
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `loan-calculation-${stamp()}.xlsx`);
}
