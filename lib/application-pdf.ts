import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { LoanApplication } from "@/lib/types";

const TEAL: [number, number, number] = [15, 118, 110];
const TEAL_LIGHT: [number, number, number] = [236, 253, 245];

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

function nextY(doc: jsPDF, gap = 6): number {
  const data = doc as DocWithTable;
  return (data.lastAutoTable?.finalY ?? 40) + gap;
}

export function exportApplicationToPdf(input: {
  application: LoanApplication;
  customerName: string;
  customerNumber: string;
  productName: string;
  branchName: string;
  createdByName: string;
}): void {
  const { application } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 26, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(0, 26, pageW, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Falco Financial Services Ltd", margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Falco Financial Services · Loan Management System", margin, 17);
  doc.text("United Republic of Tanzania", margin, 22);
  doc.text("Official application record extract", pageW - margin, 11, { align: "right" });

  let y = 34;
  doc.setTextColor(28, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("LOAN APPLICATION RECORD", pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Application: ${application.application_number}`, pageW / 2, y, { align: "center" });
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
    styles: { fontSize: 9, cellPadding: 2.8 },
    columnStyles: {
      0: { cellWidth: 56, fontStyle: "bold", textColor: [55, 65, 60] },
      1: { cellWidth: pageW - margin * 2 - 56 },
    },
    head: [["1. Applicant & product", ""]],
    body: [
      ["Customer", `${input.customerName} (${input.customerNumber})`],
      ["Loan product", input.productName],
      ["Branch", input.branchName],
      ["Requested amount", application.requested_amount.toLocaleString("en-TZ", { minimumFractionDigits: 2 })],
      ["Term (days)", String(application.term_days)],
      ["Purpose", application.purpose],
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) data.cell.styles.fillColor = TEAL_LIGHT;
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
      0: { cellWidth: 56, fontStyle: "bold", textColor: [55, 65, 60] },
      1: { cellWidth: pageW - margin * 2 - 56 },
    },
    head: [["2. Workflow status", ""]],
    body: [
      ["Status", application.status.replace(/_/g, " ").toUpperCase()],
      ["Submitted at", application.submitted_at ?? "—"],
      ["Reviewed by", application.reviewed_by ?? "—"],
      ["Reviewed at", application.reviewed_at ?? "—"],
      ["Approved by", application.approved_by ?? "—"],
      ["Approved at", application.approved_at ?? "—"],
      ["Created by", input.createdByName],
      ["Created at", application.created_at],
      ["Updated at", application.updated_at],
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) data.cell.styles.fillColor = TEAL_LIGHT;
    },
  });

  y = nextY(doc, 8);
  if (application.review_notes) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: TEAL, textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: pageW - margin * 2 } },
      head: [["3. Review notes"]],
      body: [[application.review_notes]],
    });
    y = nextY(doc, 6);
  }

  if (application.rejection_reason) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: pageW - margin * 2 } },
      head: [["Rejection reason"]],
      body: [[application.rejection_reason]],
    });
  }

  const footY = pageH - 16;
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.35);
  doc.line(margin, footY - 4, pageW - margin, footY - 4);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEAL);
  doc.text("Falco Financial Services Ltd", margin, footY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text("Generated from the application register for operational review.", margin, footY + 4);
  doc.text(`Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, pageW - margin, footY, {
    align: "right",
  });

  doc.save(`application-${application.application_number}.pdf`);
}
