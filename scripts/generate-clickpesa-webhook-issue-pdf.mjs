import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const BLUE = [30, 64, 175];
const RED = [185, 28, 28];
const AMBER = [180, 100, 0];
const GREEN = [21, 128, 61];
const GRAY = [90, 90, 90];
const LIGHT = [245, 247, 255];

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
const marginX = 16;
const contentW = pageW - marginX * 2;
const bottomLimit = pageH - 16;

const now = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

let y = 0;
let pageNum = 1;

function newPage() {
  doc.addPage();
  pageNum += 1;
  y = 20;
  drawFooter();
}

function ensureSpace(needed) {
  if (y + needed > bottomLimit) newPage();
}

function drawFooter() {
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(`Falco — ClickPesa Webhook Investigation Brief`, marginX, pageH - 8);
  doc.text(`Page ${pageNum}`, pageW - marginX, pageH - 8, { align: "right" });
}

function sectionHeading(title, num) {
  ensureSpace(14);
  doc.setFillColor(...BLUE);
  doc.rect(marginX, y, 4, 7, "F");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(`${num}. ${title}`, marginX + 7, y + 5.5);
  y += 12;
}

function subHeading(title) {
  ensureSpace(9);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE);
  doc.text(title, marginX, y);
  y += 6;
}

function paragraph(text, opts = {}) {
  const size = opts.size ?? 9.5;
  doc.setFontSize(size);
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setTextColor(...(opts.color ?? [40, 40, 40]));
  const lines = doc.splitTextToSize(text, contentW - (opts.indent ?? 0));
  for (const line of lines) {
    ensureSpace(size / 2 + 3.2);
    doc.text(line, marginX + (opts.indent ?? 0), y);
    y += size / 2 + 3.2;
  }
  y += opts.gapAfter ?? 1.5;
}

function bulletList(items, opts = {}) {
  const size = opts.size ?? 9.5;
  for (const item of items) {
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...(opts.markColor ?? BLUE));
    ensureSpace(size / 2 + 3);
    doc.text("•", marginX + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(item, contentW - 9);
    doc.text(lines[0], marginX + 7, y);
    y += size / 2 + 3;
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(size / 2 + 3);
      doc.text(lines[i], marginX + 7, y);
      y += size / 2 + 3;
    }
  }
  y += 2;
}

function numberedSteps(items) {
  items.forEach((item, i) => {
    const size = 9.5;
    doc.setFontSize(size);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLUE);
    ensureSpace(size / 2 + 3.5);
    doc.text(`${i + 1}.`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(item, contentW - 9);
    doc.text(lines[0], marginX + 7, y);
    y += size / 2 + 3.5;
    for (let k = 1; k < lines.length; k++) {
      ensureSpace(size / 2 + 3.5);
      doc.text(lines[k], marginX + 7, y);
      y += size / 2 + 3.5;
    }
  });
  y += 2;
}

function codeBlock(lines, opts = {}) {
  const size = 8;
  const lineH = 4.1;
  const padY = 3;
  const padX = 4;
  const height = lines.length * lineH + padY * 2;
  ensureSpace(height + 3);
  doc.setFillColor(...(opts.fill ?? [30, 30, 36]));
  doc.roundedRect(marginX, y, contentW, height, 1.5, 1.5, "F");
  doc.setFont("courier", "normal");
  doc.setFontSize(size);
  let cy = y + padY + 3;
  for (const line of lines) {
    doc.setTextColor(...(line.color ?? [214, 222, 235]));
    doc.text(typeof line === "string" ? line : line.text, marginX + padX, cy);
    cy += lineH;
  }
  y += height + 5;
}

function calloutBox(title, text, color) {
  const size = 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, contentW - 10);
  const height = 8 + lines.length * 4.6 + 4;
  ensureSpace(height + 3);
  doc.setFillColor(color[0], color[1], color[2], 0.08);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentW, height, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.setFontSize(9.5);
  doc.text(title, marginX + 5, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(size);
  let cy = y + 12;
  for (const line of lines) {
    doc.text(line, marginX + 5, cy);
    cy += 4.6;
  }
  y += height + 5;
}

// ---------------------------------------------------------------------------
// Cover / header
// ---------------------------------------------------------------------------
doc.setFillColor(...BLUE);
doc.rect(0, 0, pageW, 34, "F");
doc.setTextColor(255, 255, 255);
doc.setFontSize(18);
doc.setFont("helvetica", "bold");
doc.text("FALCO — ClickPesa Webhook Payment Not Recording", marginX, 15);
doc.setFontSize(10);
doc.setFont("helvetica", "normal");
doc.text("Investigation brief for the backend team", marginX, 22);
doc.setFontSize(8.5);
doc.text(`Prepared ${now}  •  Reported by: Frontend / Operations`, marginX, 28);

y = 42;

calloutBox(
  "Summary",
  "A real ClickPesa payment was received and marked SETTLED in the ClickPesa merchant dashboard, " +
    "but no matching payment exists anywhere in Falco (not in Payments, not in the Cashbook, not as an " +
    "unclassified/failed entry). This means the ClickPesa -> Falco webhook pipeline did not successfully " +
    "post the payment for at least this transaction. Given this was caught by chance while reviewing the " +
    "dashboard, it is possible other collections are silently missing too — this needs to be treated as a " +
    "data-integrity issue, not just a UI issue.",
  RED
);

// ---------------------------------------------------------------------------
// 1. Observed example
// ---------------------------------------------------------------------------
sectionHeading("Observed Example", 1);
paragraph(
  "The following transaction appears as SETTLED in ClickPesa's own \u201cRecent Activities -> Payments\u201d " +
    "view, but does not appear anywhere in Falco (Payments page, Cashbook, or reconciliation views) as of the " +
    "time this brief was written."
);

autoTable(doc, {
  startY: y,
  theme: "grid",
  styles: { fontSize: 9, cellPadding: 2.6 },
  headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
  columnStyles: {
    0: { cellWidth: 45, fontStyle: "bold" },
    1: { cellWidth: "auto" },
  },
  body: [
    ["Customer (per ClickPesa)", "HAWA HAMIS NDAYUWUNDI"],
    ["Amount received", "TZS 35,280.00"],
    ["ClickPesa settlement date/time", "3 Aug 2026, 14:04"],
    ["ClickPesa status", "SETTLED"],
    ["ClickPesa transaction ID (shown in dashboard)", "35213103LCP695807C9"],
    ["Falco Payments page \u2013 \u201cToday\u2019s Collections\u201d", "TZS 0 (before/around this time)"],
    ["Falco Payments / Cashbook search for this customer/amount", "No matching record found"],
  ],
  margin: { left: marginX, right: marginX },
});
y = doc.lastAutoTable.finalY + 8;

paragraph(
  "Note: the ID shown in the ClickPesa activity list (35213103LCP695807C9) is ClickPesa\u2019s own transaction " +
    "reference. It is not necessarily the same value as the `orderReference` field ClickPesa sends in the webhook " +
    "payload, which is the field Falco uses to match the payment to a customer (see Section 2). Please pull the " +
    "full webhook payload / delivery log for this exact transaction from ClickPesa\u2019s side to get the real " +
    "`orderReference` value used.", 
  { gapAfter: 2 }
);

// ---------------------------------------------------------------------------
// 2. Expected flow
// ---------------------------------------------------------------------------
sectionHeading("Expected Flow (per current backend docs)", 2);
paragraph(
  "Per `backend-documentation/webhooks-controller.md`, a ClickPesa payment should reach Falco automatically " +
    "through this pipeline \u2014 no frontend or manual step is involved:"
);
numberedSteps([
  "ClickPesa calls POST /webhooks/payment?gateway=clickpesa directly on the Falco backend the moment a payment settles. No staff bearer token is used; the request is authenticated by an HMAC-SHA256 checksum instead.",
  "Falco validates the checksum via the ClickPesa driver. If invalid or missing, the backend returns 403 immediately and the event is discarded \u2014 nothing is logged.",
  "If valid, Falco parses the payload into gateway-neutral fields and inserts a webhook_events row with status \u201cpending\u201d, storing the raw payload.",
  "If an event for the same gateway + reference was already processed, the new one is logged as \u201cduplicate\u201d and not dispatched again.",
  "Falco dispatches a queued job, ProcessWebhookEvent, to actually process the payment asynchronously.",
  "For a \u201cPAYMENT RECEIVED\u201d event, the handler resolves the customer via payment_references.reference, matching against data.orderReference from the webhook payload.",
  "Once the customer is resolved, the handler finds that customer\u2019s payable loan and posts the payment through the same PaymentService used by POST /payments (manual payment entry).",
]);

subHeading("Example webhook payload ClickPesa is expected to send");
codeBlock([
  "POST /webhooks/payment?gateway=clickpesa",
  "Content-Type: application/json",
  "",
  "{",
  '  "event": "PAYMENT RECEIVED",',
  '  "data": {',
  '    "paymentReference": "35213103LCP695807C9",',
  '    "orderReference": "CUS-000482",        // <-- must match a row in',
  '                                            //     payment_references.reference',
  '    "collectedAmount": "35280",',
  '    "channel": "AIRTEL MONEY"',
  "  },",
  '  "checksum": "<hmac-sha256 of the sorted, compact payload>",',
  '  "checksumMethod": "HMAC-SHA256"',
  "}",
]);

// ---------------------------------------------------------------------------
// 3. Where it can silently break
// ---------------------------------------------------------------------------
sectionHeading("Where This Can Silently Break", 3);
paragraph(
  "Any one of the following breaks the chain above, and each one has a different visibility (some leave no " +
    "trace at all, which is why this is hard to see from the frontend). Please check them in this order:"
);

subHeading("A. Webhook URL not configured to point at Falco (most likely)");
paragraph(
  "If the callback/webhook URL configured in ClickPesa's merchant dashboard is wrong, outdated (e.g. points at " +
    "a staging server), or was never set for this merchant account, ClickPesa never calls Falco at all. Falco " +
    "would have zero record of the event because it never arrived \u2014 exactly what we're observing.",
  { indent: 2 }
);
bulletList(
  [
    "Check ClickPesa merchant portal -> Webhook / Callback URL settings \u2014 confirm it points at the production Falco domain + /webhooks/payment?gateway=clickpesa.",
    "Check ClickPesa's own webhook delivery log for this transaction (most gateways show delivered/failed/retried per attempt, with the HTTP response code Falco returned).",
  ],
  { size: 9 }
);

subHeading("B. Checksum secret mismatch -> silent 403, nothing logged");
paragraph(
  "If CLICKPESA_CHECKSUM_SECRET on the Falco server does not match the secret configured in ClickPesa, every " +
    "webhook call is rejected with 403 before anything is written to webhook_events. This would also explain " +
    "zero trace in Falco while ClickPesa shows the delivery attempt on their side.",
  { indent: 2 }
);
bulletList(
  ["Confirm CLICKPESA_CHECKSUM_SECRET (and CLICKPESA_CLIENT_ID / CLICKPESA_API_KEY) in the backend .env match what's registered with ClickPesa for this merchant account."],
  { size: 9 }
);

subHeading("C. orderReference doesn't match any payment_references row");
paragraph(
  "If the webhook does arrive and passes checksum validation, but data.orderReference doesn't match any " +
    "customer's payment_references.reference, the handler cannot resolve a customer or loan. Per the docs, " +
    "\u201chandler exceptions do not escape the job; the event is marked failed with error_message\u201d \u2014 " +
    "so the event would exist in webhook_events with status = failed, but there is currently no admin-facing " +
    "endpoint to view that table (see Section 4), so it would look invisible from the frontend even though it " +
    "technically \u201cworked.\u201d",
  { indent: 2 }
);
bulletList(
  [
    "Query webhook_events directly for rows around 3 Aug 2026, 14:04, gateway = clickpesa, and inspect status + error_message.",
    "Cross-check the orderReference used by ClickPesa for this transaction against Hawa Hamis Ndayuwundi's payment_references.reference in Falco.",
  ],
  { size: 9 }
);

subHeading("D. Queue worker not running -> event stuck \u201cpending\u201d forever");
paragraph(
  "Falco returns 200 to ClickPesa as soon as the webhook_events row is persisted, then dispatches ProcessWebhookEvent " +
    "as a queued job. If the queue worker process isn't running on the server (or crashed), the event sits at " +
    "status = \u201cpending\u201d indefinitely and the payment is never posted \u2014 even though ClickPesa received a " +
    "successful 200 response and shows the transaction as fully settled on their side.",
  { indent: 2 }
);
bulletList(
  ["Confirm the Laravel queue worker (e.g. supervisor-managed `php artisan queue:work`) is running and healthy on production, and check its logs for stalled or failed jobs."],
  { size: 9 }
);

// ---------------------------------------------------------------------------
// 4. Requested follow-up
// ---------------------------------------------------------------------------
sectionHeading("Requested Follow-up", 4);
subHeading("Immediate (this incident)");
numberedSteps([
  "Pull ClickPesa's webhook delivery log / raw payload for the Hawa Hamis Ndayuwundi transaction (35213103LCP695807C9, TZS 35,280, 3 Aug 2026 14:04) and confirm whether it was ever sent to Falco, and if so, what HTTP status Falco returned.",
  "Query the webhook_events table for that time window and report status + error_message for any matching rows.",
  "If the event is missing entirely, verify the ClickPesa merchant portal's webhook URL and checksum secret configuration.",
  "If the event exists but failed, reconcile the orderReference used against this customer's payment_references, and manually re-post the payment for this specific transaction so the customer's loan balance is corrected.",
  "Audit for any other recent ClickPesa settlements with no matching Falco payment, since this may not be an isolated case.",
]);

subHeading("Longer-term (prevent this from being invisible again)");
paragraph(
  "There is currently no way for Falco staff to see webhook health from the app itself \u2014 the webhook_events " +
    "table exists but is not exposed through any API. Requesting a small admin-only endpoint so the frontend can " +
    "surface a \u201cPayment Sync Health\u201d page and staff can self-diagnose future gaps like this one without " +
    "needing server/DB access:"
);
codeBlock([
  "GET /webhook-events?status=failed&gateway=clickpesa&from=2026-08-01&to=2026-08-03",
  "",
  "200 OK",
  "{",
  '  "data": [',
  "    {",
  '      "id": 1042,',
  '      "gateway": "clickpesa",',
  '      "event": "PAYMENT RECEIVED",',
  '      "reference": "35213103LCP695807C9",',
  '      "order_reference": "CUS-000482",',
  '      "status": "failed",              // pending | processed | duplicate | failed',
  '      "error_message": "No payment_reference matched order_reference",',
  '      "amount": "35280",',
  '      "received_at": "2026-08-03T14:04:11Z",',
  '      "processed_at": null',
  "    }",
  "  ],",
  '  "meta": { "page": 1, "page_size": 50, "total": 1 }',
  "}",
]);

paragraph(
  "Once this endpoint exists, the frontend team can wire it into a diagnostics page immediately \u2014 no other " +
    "backend work is required for that follow-up.",
  { gapAfter: 0 }
);

drawFooter();

const outDir = resolve("docs");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "Falco-ClickPesa-Webhook-Issue.pdf");
writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("PDF written to", outPath);
