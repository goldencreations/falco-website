import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Disbursement } from "@/lib/disbursement-types";

/** Branding aligned with app shell — visible on every PDF export. */
export const DISBURSEMENT_PDF_BRAND = {
  companyLegal: "Falco Financial Services Ltd",
  companyTrading: "Falco Financial Services",
  productLine: "Loan Management System",
  jurisdiction: "United Republic of Tanzania",
} as const;

const TEAL: [number, number, number] = [15, 118, 110];
const TEAL_LIGHT: [number, number, number] = [236, 253, 245];

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function nextY(doc: jsPDF, gapMm = 6): number {
  const d = doc as DocWithTable;
  return (d.lastAutoTable?.finalY ?? 40) + gapMm;
}

/**
 * Branded disbursement PDF — matches operational record fields for future API parity.
 */
export function exportDisbursementToPdf(input: {
  disbursement: Disbursement;
  loanNumber: string;
  customerName: string;
  channelLabel: string;
  preparedByName: string;
  approvedByName: string | null;
  rejectedByName: string | null;
}): void {
  const d = input.disbursement;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // —— Branded header band ——
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(0, 26, pageW, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(DISBURSEMENT_PDF_BRAND.companyLegal, margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${DISBURSEMENT_PDF_BRAND.companyTrading} · ${DISBURSEMENT_PDF_BRAND.productLine}`,
    margin,
    17
  );
  doc.text(DISBURSEMENT_PDF_BRAND.jurisdiction, margin, 22);

  doc.setFontSize(7);
  doc.text("Official disbursement register extract", pageW - margin, 11, { align: "right" });

  // —— Document title ——
  let y = 34;
  doc.setTextColor(28, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DISBURSEMENT RECORD", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Control reference: ${d.id}`, pageW / 2, y, { align: "center" });
  y += 8;

  const statusLabel = d.status.replace(/_/g, " ").toUpperCase();

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: [220, 230, 226],
      lineWidth: 0.1,
    },
    body: [
      [
        {
          content: "CURRENT STATUS",
          styles: {
            fillColor: TEAL_LIGHT,
            textColor: TEAL,
            fontStyle: "bold",
            fontSize: 8,
          },
        },
        {
          content: statusLabel,
          styles: { fontStyle: "bold", halign: "right", fontSize: 10 },
        },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: pageW - margin * 2 - 55 },
    },
  });

  y = nextY(doc, 8);

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 2.8 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", textColor: [55, 65, 60] },
      1: { cellWidth: pageW - margin * 2 - 52 },
    },
    head: [["1. Transaction summary", ""]],
    body: [
      ["Loan number", input.loanNumber],
      ["Customer", input.customerName],
      ["Amount (TZS)", d.amount.toLocaleString("en-TZ", { minimumFractionDigits: 2 })],
      ["Payment channel", input.channelLabel],
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        data.cell.styles.fillColor = TEAL_LIGHT;
      }
    },
  });

  y = nextY(doc, 8);

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 2.8 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", textColor: [55, 65, 60] },
      1: { cellWidth: pageW - margin * 2 - 52 },
    },
    head: [["2. Destination & banking reference", ""]],
    body: [
      ["Account name", d.account_name ?? "—"],
      ["Account number", d.account_number ?? "—"],
      ["Bank / institution", d.bank_name ?? "—"],
      ["Transaction reference", d.transaction_reference ?? "—"],
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        data.cell.styles.fillColor = TEAL_LIGHT;
      }
    },
  });

  y = nextY(doc, 8);

  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: {
      fillColor: TEAL,
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    styles: { fontSize: 9, cellPadding: 2.8 },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", textColor: [55, 65, 60] },
      1: { cellWidth: pageW - margin * 2 - 52 },
    },
    head: [["3. Workflow & timestamps", ""]],
    body: [
      ["Prepared by", input.preparedByName],
      ["Approved by", input.approvedByName ?? "—"],
      ["Approved at", d.approved_at ?? "—"],
      ["Rejected by", input.rejectedByName ?? "—"],
      ["Rejected at", d.rejected_at ?? "—"],
      ["Disbursed at", d.disbursed_at ?? "—"],
      ["Record created", d.created_at ?? "—"],
      ["Last updated", d.updated_at ?? "—"],
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        data.cell.styles.fillColor = TEAL_LIGHT;
      }
    },
  });

  y = nextY(doc, 6);

  if (d.rejection_reason) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 9, cellPadding: 2.8 },
      columnStyles: { 0: { cellWidth: pageW - margin * 2 } },
      head: [["Rejection reason"]],
      body: [[d.rejection_reason]],
    });
    y = nextY(doc, 6);
  }

  if (d.notes) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: {
        fillColor: TEAL,
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: pageW - margin * 2 } },
      head: [["4. Notes"]],
      body: [[d.notes]],
    });
    y = nextY(doc, 6);
  }

  // —— Footer ——
  const footY = pageH - 16;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.35);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text(DISBURSEMENT_PDF_BRAND.companyLegal, margin, footY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text(
    "This document is generated from the disbursement register for operational control. Replace with API-backed PDF when connected.",
    margin,
    footY + 4,
    { maxWidth: pageW - margin * 2 }
  );

  doc.text(
    `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    pageW - margin,
    footY,
    { align: "right" }
  );

  doc.save(`disbursement-${d.id}.pdf`);
}
