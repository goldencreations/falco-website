import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const TEAL: [number, number, number] = [15, 118, 110];
const TEAL_LIGHT: [number, number, number] = [236, 253, 245];
const STRIPE: [number, number, number] = [248, 250, 252];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return null;
}

function asText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/_/g, " ");
}

function asMoney(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(n);
}

function asDate(value: unknown): string {
  const raw = asText(value);
  if (raw === "—") return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Pull tabular rows from typical report API envelopes. */
export function extractExpectedCollectionRows(payload: unknown): Record<string, unknown>[] {
  const root = isRecord(payload)
    ? isRecord(payload.data)
      ? payload.data
      : isRecord(payload.report)
        ? payload.report
        : payload
    : {};

  const candidates = [
    root.items,
    root.rows,
    root.schedules,
    root.collections,
    root.expected_collections,
    root.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  // Flatten first nested array of objects found on the payload.
  for (const value of Object.values(root)) {
    if (Array.isArray(value) && value.some(isRecord)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

export function exportExpectedCollectionsPdf(options: {
  rows: Record<string, unknown>[];
  scopeLabel: string;
  from: string;
  to: string;
}): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const generatedAt = new Date().toLocaleString("en-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Header band
  doc.setFillColor(...TEAL);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Falco Financial Services Ltd", margin, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Loan Management System · Expected Collections Report", margin, 15);
  doc.setFontSize(7);
  doc.text(generatedAt, pageW - margin, 9, { align: "right" });
  doc.text(options.scopeLabel, pageW - margin, 15, { align: "right" });

  doc.setTextColor(28, 28, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Expected Collections", margin, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Period: ${options.from} to ${options.to}`, margin, 36);
  doc.text(`${options.rows.length.toLocaleString()} installment${options.rows.length === 1 ? "" : "s"}`, pageW - margin, 36, {
    align: "right",
  });

  const totalDue = options.rows.reduce((sum, row) => {
    const amount = Number(pick(row, ["amount_due", "amountDue", "due_amount", "expected_amount"]) ?? 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  autoTable(doc, {
    startY: 40,
    theme: "plain",
    styles: { fontSize: 8, cellPadding: 2 },
    body: [
      [
        {
          content: "TOTAL AMOUNT DUE",
          styles: { fillColor: TEAL_LIGHT, textColor: TEAL, fontStyle: "bold", fontSize: 8 },
        },
        {
          content: asMoney(totalDue),
          styles: { fillColor: TEAL_LIGHT, textColor: TEAL, fontStyle: "bold", halign: "right", fontSize: 9 },
        },
        {
          content: "SCOPE",
          styles: { fillColor: TEAL_LIGHT, textColor: TEAL, fontStyle: "bold", fontSize: 8 },
        },
        {
          content: options.scopeLabel,
          styles: { fillColor: TEAL_LIGHT, textColor: [40, 40, 40], fontStyle: "bold", fontSize: 8 },
        },
      ],
    ],
  });

  const body = options.rows.map((row, index) => [
    String(index + 1),
    asText(pick(row, ["loan_number", "loanNumber", "loan_no"])),
    asText(pick(row, ["customer_name", "customerName", "full_name", "name"])),
    asText(pick(row, ["phone_number", "phoneNumber", "phone", "mobile"])),
    asDate(pick(row, ["due_date", "dueDate", "repayment_date"])),
    asMoney(pick(row, ["amount_due", "amountDue", "due_amount", "expected_amount"])),
    asText(pick(row, ["status", "collection_status"])),
    asText(pick(row, ["period_bucket", "periodBucket", "bucket", "period"])),
  ]);

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
      : 52,
    head: [["#", "Loan number", "Customer", "Phone", "Due date", "Amount due", "Status", "Period"]],
    body: body.length
      ? body
      : [["—", "No expected collections for this period", "", "", "", "", "", ""]],
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "middle",
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    alternateRowStyles: {
      fillColor: STRIPE,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 42 },
      2: { cellWidth: 48 },
      3: { cellWidth: 28 },
      4: { cellWidth: 24 },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 22 },
      7: { cellWidth: 26 },
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      const page = data.pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(
        "Confidential · Falco Financial Services Ltd",
        margin,
        pageH - 6
      );
      doc.text(`Page ${page}`, pageW - margin, pageH - 6, { align: "right" });
    },
  });

  const stamp = options.to.replace(/-/g, "");
  doc.save(`expected-collections-${stamp}.pdf`);
}
