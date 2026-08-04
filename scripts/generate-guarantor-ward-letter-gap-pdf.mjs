import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const BLUE = [30, 64, 175];
const DARK = [30, 30, 30];
const GRAY = [110, 110, 110];
const RED = [185, 28, 28];
const GREEN = [21, 128, 61];
const AMBER = [180, 83, 9];
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
  doc.text("Falco — Customer Guarantor Ward Letter API Gap", marginX, pageH - 8);
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

function bullet(text, opts = {}) {
  const indent = opts.indent ?? 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...(opts.color ?? DARK));
  const lines = doc.splitTextToSize(text, contentW - indent - 4);
  for (let i = 0; i < lines.length; i++) {
    ensureSpace(5.2);
    if (i === 0) doc.text("•", marginX + indent, y);
    doc.text(lines[i], marginX + indent + 4, y);
    y += 5.2;
  }
  y += 0.8;
}

function codeBlock(lines) {
  const lineH = 4.4;
  const pad = 3;
  const h = lines.length * lineH + pad * 2;
  ensureSpace(h + 2);
  doc.setFillColor(...CODE_BG);
  doc.roundedRect(marginX, y, contentW, h, 1.5, 1.5, "F");
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  let cy = y + pad + 3.2;
  for (const line of lines) {
    doc.text(line, marginX + 3, cy);
    cy += lineH;
  }
  y += h + 3;
}

function callout(title, body, color = AMBER) {
  const lines = doc.splitTextToSize(body, contentW - 8);
  const h = 8 + lines.length * 5 + 4;
  ensureSpace(h + 2);
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentW, h, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...color);
  doc.text(title, marginX + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  let cy = y + 12;
  for (const line of lines) {
    doc.text(line, marginX + 4, cy);
    cy += 5;
  }
  y += h + 4;
}

// ── Cover ──────────────────────────────────────────────────────────
doc.setFillColor(...BLUE);
doc.rect(0, 0, pageW, 42, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(18);
doc.text("Backend Gap: Guarantor Ward Letter", marginX, 18);
doc.setFontSize(11);
doc.setFont("helvetica", "normal");
doc.text("Customer API does not persist or return ward-letter documents", marginX, 27);
doc.setFontSize(9);
doc.text(`Prepared for backend team  ·  ${now}`, marginX, 35);
y = 52;

paragraph(
  "The frontend Customer Create / Edit form has a dedicated “Ward letter” upload on each guarantor. After create/save, GET /customers/{id} does not expose a ward-letter field (or a linked document) on the guarantor, so the file cannot be shown again and appears “not saved”.",
  { size: 10 }
);

callout(
  "Ask for backend",
  "Add first-class support for guarantor ward letters: accept the upload, link it to the guarantor, and return it on GET /customers/{id} (and PATCH flows) the same way ID front/back or passport photo are returned."
);

heading1("1. Current frontend behaviour");
heading2("UI");
bullet("Field: Guarantors → Ward letter (image or PDF).");
bullet("On create/save, frontend uploads via POST /customers/{customerId}/documents with guarantor_id set.");
bullet("Because the backend has no dedicated ward-letter type/field, the frontend currently falls back to type guarantor_document and names the file “Ward letter — {originalFilename}” so it can try to re-detect it later.");
bullet("That workaround is fragile: GET responses often still do not surface the file on the guarantor, so the Ward letter preview stays empty.");

heading2("Related uploads that already work (for comparison)");
bullet("Guarantor ID front / back → dedicated routes POST /customers/{id}/guarantors/{guarantorId}/id-front|id-back, returned as id_front_document_id / urls.");
bullet("Guarantor photo → type guarantor_photo (linked via guarantor_id).");
bullet("Guarantor passport photo → type guarantor_passport_photo.");
bullet("Guarantor collateral photos → type guarantor_collateral_photo.");
bullet("Generic attachments → type guarantor_document.");

heading1("2. What is missing in the API");
heading2("Observed gap", RED);
bullet("GET /customers/{id} guarantors[] has no ward_letter_url / ward_letter_preview_url / ward_letter_document / ward_letter_document_id (or equivalent).");
bullet("No documented document type such as guarantor_ward_letter (or street_letter / guarantor_letter) that the documents endpoint accepts and links onto the guarantor for later GET.");
bullet("No dedicated upload route analogous to id-front / id-back for ward letters.");
bullet("attachment_documents / attachments on the guarantor either omit the uploaded ward letter or return it only as an untyped generic file with no stable link back to “ward letter”.");

heading2("Expected contract (proposed)");
paragraph("Please implement one of the following (preferred order):", { bold: true });

heading2("Option A — Dedicated fields on guarantor (preferred)");
codeBlock([
  "GET /customers/{id}  →  guarantors[] includes:",
  "  ward_letter_document_id: string | null",
  "  ward_letter_url: string | null",
  "  ward_letter_preview_url: string | null",
  "  // or nested:",
  "  ward_letter_document: { id, type, name, url, preview_url }",
]);
codeBlock([
  "POST /customers/{id}/guarantors/{guarantorId}/ward-letter",
  "  multipart: file (+ optional name)",
  "  → links document to guarantor and returns the document object",
]);

heading2("Option B — Typed document on documents endpoint");
codeBlock([
  "POST /customers/{id}/documents",
  "  type: \"guarantor_ward_letter\"   // or agreed slug",
  "  guarantor_id: \"{guarantorId}\"",
  "  files[]: <file>",
  "",
  "GET /customers/{id} must then return that document on the guarantor,",
  "e.g. in attachment_documents with type guarantor_ward_letter,",
  "or via the dedicated ward_letter_* fields above.",
]);

heading1("3. Acceptance criteria");
bullet("Upload a ward letter on create or edit for a guarantor.");
bullet("Subsequent GET /customers/{id} returns that ward letter linked to the same guarantor (id + url/preview_url).");
bullet("Edit form can show preview and allow replace/delete by document id.");
bullet("Deleting the document removes it from the guarantor payload.");
bullet("Type/field names are documented in the customers / documents controller docs.");
bullet("Invalid type or missing guarantor_id returns a clear 422 (not a silent drop).");

heading1("4. Frontend impact once backend ships");
paragraph(
  "Once Option A or B is live, the frontend will stop the “Ward letter — filename” naming workaround and map the dedicated field/type directly onto Guarantors → Ward letter (preview + delete), matching ID front/back behaviour.",
  { size: 9.5 }
);

heading2("Temporary frontend workaround (today)", AMBER);
bullet("Uploads as type guarantor_document with name prefixed “Ward letter — …”.");
bullet("On read, tries to infer ward letters by name/type heuristics.");
bullet("This is not reliable and must not be treated as the long-term contract.");

heading1("5. Priority / ask");
paragraph(
  "Please add first-class ward-letter persistence for customer guarantors and confirm the agreed type slug + response shape so frontend can wire a stable mapping.",
  { bold: true }
);
bullet("Owner: Backend (Customers / Documents / Guarantors).");
bullet("Blocked UI: Customer Create & Edit → Guarantor → Ward letter.");
bullet("Related prior work: dedicated guarantor ID front/back upload routes.");

y += 4;
paragraph(`Document generated ${now}.`, { size: 8, color: GRAY });

footer();

const outDir = resolve(process.cwd(), "docs");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "Falco-Guarantor-Ward-Letter-API-Gap.pdf");
writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log(`Wrote ${outPath}`);
