import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const BLUE = [30, 64, 175];
const RED = [185, 28, 28];
const GREEN = [21, 128, 61];

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
const marginX = 14;
let y = 0;

const now = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function ensureSpace(needed) {
  if (y + needed > pageH - 14) {
    doc.addPage();
    y = 16;
  }
}

function heading(text) {
  ensureSpace(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...BLUE);
  doc.text(text, marginX, y);
  y += 6.5;
}

function paragraph(text, opts = {}) {
  const width = pageW - marginX * 2;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.size ?? 10);
  doc.setTextColor(...(opts.color ?? [40, 40, 40]));
  const lines = doc.splitTextToSize(text, width);
  ensureSpace(lines.length * 5 + 2);
  doc.text(lines, marginX, y);
  y += lines.length * 5 + 2;
}

function bullet(text) {
  const width = pageW - marginX * 2 - 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const lines = doc.splitTextToSize(text, width);
  ensureSpace(lines.length * 5 + 1);
  doc.text("•", marginX, y);
  doc.text(lines, marginX + 5, y);
  y += lines.length * 5 + 1;
}

// ---- Header banner ----
doc.setFillColor(...BLUE);
doc.rect(0, 0, pageW, 26, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(16);
doc.text("FALCO — Backend Gap Report", marginX, 12);
doc.setFontSize(9.5);
doc.setFont("helvetica", "normal");
doc.text(
  `Prepared ${now}  •  For: Backend developer  •  Topic: Guarantor ID-document retrieval`,
  marginX,
  19
);
y = 34;

// ---- Title / summary ----
heading("Issue: Guarantor ID front/back scans cannot be retrieved after upload");
paragraph(
  "The guarantor ID-scan upload endpoints work correctly and link a document id onto the guarantor " +
    "record, but there is no working API route that returns that document's URL or file contents " +
    "afterward. As a result, the frontend cannot show a preview, or offer View/Download, for these " +
    "two files once uploaded — the only operation that currently works on that document id is DELETE."
);

y += 2;
heading("Reproduction (live test against dev environment)");
paragraph("customer_id = 49, guarantor_id = 172, id_front_document_id = 505, id_back_document_id = 507", {
  bold: true,
  size: 9.5,
  color: [80, 80, 80],
});
y += 1;

autoTable(doc, {
  startY: y,
  head: [["Request", "Result", "Meaning"]],
  body: [
    [
      "POST /customers/49/guarantors/172/id-front\n(and /id-back)",
      "200 OK",
      "Works. File is accepted; id_front_document_id / id_back_document_id are correctly linked onto the guarantor record.",
    ],
    [
      "GET /customers/49/documents/505",
      "405 Method Not Allowed",
      "This route only implements DELETE, not GET.",
    ],
    [
      "GET /documents/505",
      "404 Not Found",
      "This route does not exist at all.",
    ],
    [
      "GET /customers/49\n(customer detail)",
      "200 OK, but\ndocuments: []",
      "The linked id-front/id-back documents are not embedded anywhere in this response — not on the guarantor object, not in a top-level documents[] list, not in metadata.",
    ],
    [
      "GET /customers/49/portfolio\n+ GET /applications/{id}\n(loan applications)",
      "200 OK, but\nno match",
      "Also checked whether this guarantor's ID scan is embedded on any of the customer's loan applications (a pattern that does work for other guarantors/documents on this same customer — dozens of other files resolved successfully this way). No match was found for this guarantor's id-front/id-back.",
    ],
  ],
  styles: { fontSize: 9, cellPadding: 3, valign: "top", overflow: "linebreak" },
  headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", fontSize: 9.5 },
  columnStyles: {
    0: { cellWidth: 52 },
    1: { cellWidth: 32 },
    2: { cellWidth: "auto" },
  },
  alternateRowStyles: { fillColor: [245, 247, 255] },
  didParseCell: (data) => {
    if (data.section === "body" && data.column.index === 1) {
      if (String(data.cell.raw).includes("405") || String(data.cell.raw).includes("404")) {
        data.cell.styles.textColor = RED;
        data.cell.styles.fontStyle = "bold";
      } else if (String(data.cell.raw).includes("200")) {
        data.cell.styles.textColor = GREEN;
      }
    }
  },
  margin: { left: marginX, right: marginX },
});
y = doc.lastAutoTable.finalY + 8;

heading("Net effect");
paragraph(
  "Once a guarantor's ID front/back scan is uploaded, the frontend has no way to display a preview " +
    "or provide a View/Download link for it. The only working operation on that document id is DELETE. " +
    "This was verified with every data source the frontend has access to for this customer, including " +
    "a working fallback path (cross-referencing the customer's loan applications) that does " +
    "successfully resolve other documents for the same customer — just not this guarantor's ID scan."
);

y += 1;
heading("Requested fix — implement ONE of the following");
bullet(
  "Option A (preferred): Implement GET /customers/{customerId}/documents/{documentId} " +
    "(currently returns 405) to stream or redirect to the actual file, using the same " +
    "auth/branch-scoping already implemented for DELETE on that same route."
);
bullet(
  "Option B: Embed the resolved document info directly on the guarantor object returned by " +
    'GET /customers/{customerId}, e.g.: id_front_document: { "id": "505", "url": "...", ' +
    '"preview_url": "..." } and the equivalent id_back_document.'
);
bullet(
  "Option C: Include these documents in the customer's top-level documents[] array — the same " +
    "place/shape passport photo and supporting documents already use today, e.g. " +
    '{ "id": "505", "url": "...", "preview_url": "...", "type": "guarantor_id_front" }.'
);

y += 1;
heading("Secondary item to verify while in this area");
paragraph(
  "Please also confirm whether each entry in a guarantor's attachments[] / " +
    "collateral_image_attachments[] array includes its own id field. If those arrays are just plain " +
    "URL strings with no id, the frontend cannot delete individual attachments one at a time — the " +
    "same fix (embedding an id per item) would be needed there as well."
);

y += 1;
heading("Frontend readiness");
paragraph(
  "No further frontend work is required once either fix ships — the UI already prefers a real " +
    "embedded URL (via id_front_document/id_back_document, or a documents[] match) the moment the " +
    "backend starts returning one, and the delete flow already works today since DELETE is supported."
);

// Footer page numbers
const pageCount = doc.internal.getNumberOfPages();
for (let p = 1; p <= pageCount; p++) {
  doc.setPage(p);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Page ${p} of ${pageCount}`, pageW - marginX, pageH - 8, { align: "right" });
}

const outDir = resolve(homedir(), "Downloads");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "Falco-Guarantor-Document-Retrieval-Gap.pdf");
writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("PDF written to", outPath);
