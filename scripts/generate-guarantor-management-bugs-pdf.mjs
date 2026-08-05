import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const BLUE = [30, 64, 175];
const DARK = [30, 30, 30];
const GRAY = [110, 110, 110];
const RED = [185, 28, 28];
const GREEN = [21, 128, 61];
const CODE_BG = [244, 246, 251];

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
const marginX = 16;
const contentW = pageW - marginX * 2;
let y = 0;
let page = 1;

const now = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function footer() {
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(`Falco Financial Services — Guarantor Management Backend Bugs`, marginX, pageH - 8);
  doc.text(`Page ${page}`, pageW - marginX, pageH - 8, { align: "right" });
}

function newPage() {
  footer();
  doc.addPage();
  page += 1;
  y = 20;
}

function ensureSpace(h) {
  if (y + h > pageH - 16) newPage();
}

function heading1(text) {
  ensureSpace(14);
  doc.setFillColor(...BLUE);
  doc.rect(0, y - 8, pageW, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(text, marginX, y + 1);
  y += 14;
}

function heading2(text, color = DARK) {
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...color);
  doc.text(text, marginX, y);
  y += 6;
}

function paragraph(text, opts = {}) {
  const size = opts.size ?? 9.5;
  const color = opts.color ?? DARK;
  const bold = opts.bold ?? false;
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, contentW);
  for (const line of lines) {
    ensureSpace(5.2);
    doc.text(line, marginX, y);
    y += 5.2;
  }
  y += 1.5;
}

function bulletList(items, opts = {}) {
  const size = opts.size ?? 9.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  doc.setTextColor(...DARK);
  for (const item of items) {
    const lines = doc.splitTextToSize(item, contentW - 6);
    lines.forEach((line, i) => {
      ensureSpace(5.2);
      doc.text(i === 0 ? "•" : " ", marginX, y);
      doc.text(line, marginX + 5, y);
      y += 5.2;
    });
  }
  y += 1.5;
}

function codeBlock(lines, opts = {}) {
  const size = opts.size ?? 7.6;
  doc.setFont("courier", "normal");
  doc.setFontSize(size);
  const wrapped = [];
  for (const raw of lines) {
    const wl = doc.splitTextToSize(raw, contentW - 8);
    wrapped.push(...(wl.length ? wl : [""]));
  }
  const blockH = wrapped.length * 4.2 + 6;
  ensureSpace(blockH);
  doc.setFillColor(...CODE_BG);
  doc.setDrawColor(215, 220, 232);
  doc.roundedRect(marginX, y - 4, contentW, blockH, 1.5, 1.5, "FD");
  doc.setTextColor(40, 40, 60);
  let cy = y + 1;
  for (const line of wrapped) {
    doc.text(line, marginX + 4, cy);
    cy += 4.2;
  }
  y += blockH + 3;
}

function statusBadge(label, color) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const padX = 3;
  const w = doc.getTextWidth(label) + padX * 2;
  ensureSpace(9);
  doc.setFillColor(...color);
  doc.roundedRect(marginX, y - 4.5, w, 6.5, 1.2, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(label, marginX + padX, y);
  y += 9;
}

function divider() {
  ensureSpace(6);
  doc.setDrawColor(225, 228, 236);
  doc.line(marginX, y, pageW - marginX, y);
  y += 6;
}

// ---------------------------------------------------------------------------
// Cover / title
// ---------------------------------------------------------------------------
doc.setFillColor(...BLUE);
doc.rect(0, 0, pageW, 40, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(19);
doc.text("Guarantor Management", marginX, 18);
doc.text("Backend Bug Report", marginX, 28);
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.text(`Prepared ${now}  •  Customer Edit — Guarantors  •  For backend developer`, marginX, 35);

y = 52;
paragraph(
  "This report documents two confirmed backend bugs found while testing guarantor add/remove and " +
    "ID-document workflows on the Customer Edit screen. Both were reproduced live against " +
    "https://falco.goldencreations.online using customer #49 (two guarantors: id 172 \u2018Amina Nguyu\u2019 " +
    "and id 177 \u2018test\u2019). The frontend behavior was verified correct in both cases by logging the exact " +
    "outgoing request body and the raw backend response.",
  { size: 9.7 }
);

divider();

// ---------------------------------------------------------------------------
// Bug 1
// ---------------------------------------------------------------------------
heading1("Bug 1 — Removing a guarantor does not persist");
y += 2;
statusBadge("CONFIRMED BACKEND BUG", RED);

heading2("Summary");
paragraph(
  "Staff can click \u2018Remove guarantor\u2019 on the Customer Edit form and save successfully " +
    "(PATCH /customers/{id} returns 200 OK), but the removed guarantor reappears on the customer " +
    "profile immediately after. The backend silently re-adds the guarantor that the frontend " +
    "omitted from the request."
);

heading2("Steps to reproduce");
bulletList([
  "Open Customer #49, then Edit. The record has two guarantors: 172 (Amina Nguyu) and 177 (test).",
  "Click the trash-can \u2018Remove guarantor\u2019 button next to guarantor 2 (id 177).",
  "Click Save. The request succeeds (200 OK) with no error shown.",
  "Reopen the customer profile or the edit form \u2014 guarantor 177 is still present, unchanged.",
]);

heading2("Evidence — outgoing PATCH body (guarantors array)");
codeBlock([
  "PATCH /customers/49",
  "guarantors: [",
  '  { "id": "172", "full_name": "Amina Nguyu", "phone": "0753979757",',
  '    "relationship": "sibling", "national_id": "19861216-15129-00001-16",',
  '    "id_type": "NIDA", "sex": "female",',
  '    "id_front_document_id": "505", "id_back_document_id": "507" }',
  "]",
  "// Note: only ONE guarantor sent \u2014 guarantor 177 correctly omitted by the frontend.",
]);

heading2("Evidence — backend response immediately after (200 OK)");
codeBlock([
  "guarantors: [",
  '  { "id": "172", "full_name": "Amina Nguyu", ... },',
  '  { "id": "177", "full_name": "test", "phone": "1276347862",',
  '    "relationship": "spouse", ... }   // <-- reappeared, was not sent',
  "]",
]);

heading2("Root cause");
paragraph(
  "The PATCH handler for /customers/{id} appears to treat the guarantors array as an upsert-only " +
    "operation: it creates/updates any guarantor object present by id, but never deletes a guarantor " +
    "row that is missing from the submitted array. There is also no dedicated endpoint to remove a " +
    "single guarantor (unlike documents, which have DELETE /customers/{id}/documents/{documentId})."
);

heading2("What's needed (either option)");
bulletList([
  "Option A \u2014 Full-array replace: make PATCH /customers/{id} treat guarantors (and ideally " +
    "collateral/references) as a full replacement of the child collection, deleting rows whose id is " +
    "no longer present in the submitted array. This already appears to be the documented behavior for " +
    "PATCH /applications/{id} (\u2018Child arrays use full replacement when included\u2019) \u2014 " +
    "guarantors should behave the same way on the customer endpoint.",
  "Option B \u2014 Dedicated delete endpoint: add DELETE /customers/{customerId}/guarantors/{guarantorId} " +
    "so the frontend can explicitly remove a guarantor without depending on array-diff semantics.",
]);

divider();

// ---------------------------------------------------------------------------
// Bug 2
// ---------------------------------------------------------------------------
heading1("Bug 2 — Guarantor ownership validation rejects a guarantor the API itself returned");
y += 2;
statusBadge("CONFIRMED BACKEND BUG", RED);

heading2("Summary");
paragraph(
  "Saving the customer with both existing guarantors unchanged (i.e. not adding, removing, or " +
    "editing anything) fails with a 422 validation error claiming guarantor 177 \u2018does not belong to " +
    "this customer\u2019 \u2014 even though GET /customers/49 itself returns guarantor 177 embedded in " +
    "customer 49's own guarantors array moments earlier."
);

heading2("Steps to reproduce");
bulletList([
  "Open Customer #49, then Edit (guarantors 172 and 177 both present, loaded straight from GET /customers/49).",
  "Make no changes to the guarantors, or only change an unrelated field.",
  "Click Save.",
]);

heading2("Evidence — outgoing PATCH body (unchanged, both guarantors present)");
codeBlock([
  "guarantors: [",
  '  { "id": "172", "full_name": "Amina Nguyu", ... },',
  '  { "id": "177", "full_name": "test", "phone": "1276347862",',
  '    "relationship": "spouse", "national_id": "32978426-04132-08746-83",',
  '    "id_type": "NIDA", "sex": "male" }',
  "]",
]);

heading2("Evidence — backend response");
codeBlock([
  "HTTP 422",
  "{",
  '  "message": "The given data was invalid.",',
  '  "errors": {',
  '    "guarantors.1.id": ["The selected record does not belong to this customer"]',
  "  }",
  "}",
]);

heading2("Root cause");
paragraph(
  "The value being rejected (guarantor id 177) is the exact id the backend returned inline on " +
    "GET /customers/49's own guarantors array. This indicates one of two backend-side issues: " +
    "either guarantor row 177 is mis-linked to a customer_id other than 49 in the database (a data " +
    "integrity problem), or the ownership-check query used by the guarantors validation rule does not " +
    "match the same relation used to embed guarantors on the customer detail response. Either way, this " +
    "is a backend data/validation consistency bug \u2014 the frontend is only relaying the id the API itself supplied."
);

heading2("What's needed");
bulletList([
  "Audit guarantor row 177 (and any other guarantors created around the same time/flow) for the " +
    "correct customer_id foreign key.",
  "Align the PATCH validation rule for guarantors.*.id with the same customer-guarantor relation used " +
    "by GET /customers/{id}, so any guarantor the API returns for a customer is always accepted back " +
    "on update for that same customer.",
  "Add a regression test: GET a customer, PATCH it back unchanged, and assert 200 (no validation errors) " +
    "for every guarantor the GET response included.",
]);

divider();

// ---------------------------------------------------------------------------
// Impact & recommendation
// ---------------------------------------------------------------------------
heading1("Impact");
paragraph(
  "Together, these two bugs mean staff currently cannot manage guarantors on an existing customer " +
    "at all beyond the very first save: guarantors can never be removed (Bug 1), and in some cases " +
    "even an unchanged save of an existing customer with multiple guarantors fails outright (Bug 2). " +
    "This blocks the \u2018Guarantor ID photo\u2019 frontend work from being fully exercised end-to-end for " +
    "customers with more than one guarantor, since every save attempt round-trips the full guarantors array."
);

heading2("Suggested priority");
statusBadge("HIGH \u2014 blocks guarantor editing entirely", RED);
paragraph(
  "Recommend fixing Bug 2 (ownership validation) first, since it can block saving unrelated changes " +
    "(e.g. a phone number or address edit) on any customer with more than one existing guarantor. " +
    "Bug 1 (removal not persisting) can then be addressed via Option A or B above.",
  { size: 9.5 }
);

footer();

// ---------------------------------------------------------------------------
// Write file
// ---------------------------------------------------------------------------
const outDir = resolve(homedir(), "Downloads");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "Falco-Guarantor-Management-Backend-Bugs.pdf");
writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("PDF written to", outPath);
