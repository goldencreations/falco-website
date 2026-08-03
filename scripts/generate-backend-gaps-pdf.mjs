import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const ITEMS = [
  // Leads
  {
    id: "L3",
    section: "Leads",
    requirement: "Officer ranking: individual vs branch performance",
    status: "Partial",
    backend: "Yes",
    notes:
      "Frontend already shows a peer ranking widget on the officer dashboard. What is missing is a dedicated ranking API that returns each officer's lead metrics (created, contacted, converted) compared against branch averages and other officers in the same branch. Need endpoints that accept branch_id + date range and return per-officer ranks with individual vs branch score.",
  },
  {
    id: "L4",
    section: "Leads",
    requirement: "Lead conversion rate and percentage",
    status: "Not done",
    backend: "Yes",
    notes:
      "No conversion KPI exists yet. Backend should expose aggregated conversion metrics: total leads, contacted count, applied/converted count, and conversion % (converted ÷ total). Prefer a summary endpoint filterable by branch, officer, and date range so the UI can show rate cards without scanning every lead.",
  },
  {
    id: "L5",
    section: "Leads",
    requirement: "Lead conversion funnel (New → Contacted → Applied → Approved)",
    status: "Not done",
    backend: "Yes",
    notes:
      "Current lead statuses are new / follow_up / contacted / converted — they do not map 1:1 to the requested funnel (New → Contacted → Applied → Approved). Backend needs either status alignment with application/approval stages, or a funnel report that joins leads → applications → approvals and returns stage counts for a funnel chart.",
  },
  {
    id: "L6",
    section: "Leads",
    requirement: "Officer productivity & sourcing leaderboard",
    status: "Partial",
    backend: "Yes",
    notes:
      "A light peer-scoring widget exists, but there is no dedicated sourcing leaderboard. Need an API ranked by leads sourced, follow-ups completed, conversions, and optionally time-to-first-contact. Should support period filters (daily/weekly/monthly) and branch scope for management views.",
  },
  {
    id: "L7",
    section: "Leads",
    requirement: "Geographical concentration report / map density",
    status: "Partial",
    backend: "Yes",
    notes:
      "Individual leads already have map pins. Missing is an aggregation endpoint returning lead density by region/district/ward (or lat/lng clusters) for a heatmap/concentration report. Include counts per area and optional conversion rate per geography.",
  },
  {
    id: "L8",
    section: "Leads",
    requirement: "Lead age & stagnation (>48h untouched)",
    status: "Not done",
    backend: "Yes",
    notes:
      "Requires reliable last_touched_at / last_activity_at on every lead (create, status change, note, call). Backend should support filtering leads idle >48h (and preferably configurable thresholds) plus returning age in hours so the UI can flag stagnant leads.",
  },
  {
    id: "L9",
    section: "Leads",
    requirement: "Metric cards: Total / Contact / Application / Final conversion",
    status: "Not done",
    backend: "Yes",
    notes:
      "Leads page today is list + Excel export only. Need a summary endpoint returning four KPI numbers for the selected filters: Total leads, Contacted, Reached application stage, Final conversion. Frontend can then render metric cards without client-side aggregation of large lists.",
  },
  {
    id: "L10",
    section: "Leads",
    requirement: "Lost/Archived reason required + drop-off bar chart",
    status: "Not done",
    backend: "Yes",
    notes:
      "No lost/archived status or reason codes on the lead model. Backend must add statuses (e.g. lost/archived), a required reason field (enum + optional note), and an analytics endpoint grouping drop-offs by reason for a bar chart. Closing a lead without a reason should be rejected.",
  },

  // Customers
  {
    id: "C1",
    section: "Customers",
    requirement: "Customer reports by sex, age, economic activity, region/district",
    status: "Not done",
    backend: "Yes",
    notes:
      "Customer records already store sex, DOB/age, economic activity, and location fields, but there is no demographic reporting API. Need aggregated breakdowns: counts (and optionally %) by sex, age bands (18–35 / 35–60 / 60+), economic activity, and region/district. Support branch + date filters and export-friendly payloads.",
  },
  {
    id: "C6",
    section: "Customers",
    requirement: "Manager/Admin reset & approve location changes",
    status: "Not done",
    backend: "Yes",
    notes:
      "Officers can set/view map locations today, but there is no approval workflow. Backend needs: pending location-change requests, manager/admin approve or reject, and a reset-to-previous/approved location action. Audit who changed what and when. Until this exists, FE cannot implement the 3-button show/hide + approve/reset flow from the PDF.",
  },

  // Loan Application / Branch / Control
  {
    id: "A1",
    section: "Loan Application",
    requirement: "Group application: assign members with different loan amounts",
    status: "Partial",
    backend: "Confirm",
    notes:
      "Frontend already supports applying per group member with different amounts. Please confirm the API fully supports: multiple applications under one group, different principal per member, and correct linkage of each application to customer + group. Clarify whether legacy single group-loan create should be deprecated so FE can remove it.",
  },
  {
    id: "A2",
    section: "Branch Analytics",
    requirement: "Disbursement vs Collection monthly timeline chart",
    status: "Not done",
    backend: "Yes",
    notes:
      "Branch analytics page is still largely mock. Need a timeseries endpoint: for each month (or week), total disbursed amount vs total collections for a given branch. Response shape should be chart-ready (period, disbursed, collected) with optional product/officer filters.",
  },
  {
    id: "A3",
    section: "Branch Analytics",
    requirement: "Officer portfolio leaderboard on branch",
    status: "Partial",
    backend: "Partial",
    notes:
      "Officer dashboard has peer rankings, but branch managers need the same (or richer) leaderboard scoped to a branch: portfolio size, PAR, collections, disbursements. Extend existing peer APIs with branch_id filter or add a branch-scoped portfolio leaderboard endpoint.",
  },
  {
    id: "A4",
    section: "Branch Analytics",
    requirement: "Target vs Actual matrix for branch KPIs",
    status: "Not done",
    backend: "Yes",
    notes:
      "No targets/quotas model exists. Backend needs: define branch (and optionally officer) targets for KPIs such as disbursement volume, collection rate, new customers, PAR; store period targets; and return target vs actual matrix for reporting. Without this, the UI cannot show a target/actual matrix.",
  },
  {
    id: "A5",
    section: "Branch Analytics",
    requirement: "Branch cash flow / vault balance log",
    status: "Not done",
    backend: "Yes",
    notes:
      "Entirely missing module. Need vault/cash book: opening balance, cash in (disbursements reverse? collections, deposits), cash out (disbursements, expenses), running balance, and dated log entries per branch. CRUD + report endpoints required before any UI can be built.",
  },
  {
    id: "A6",
    section: "Application Control",
    requirement: "Disbursement bottleneck & TAT report",
    status: "Not done",
    backend: "Yes",
    notes:
      "Current disbursement KPIs are counts and volume only. Need turnaround-time analytics: time from application create → approval → ready for disbursement → disbursed. Report bottlenecks by stage (avg/median hours, % over SLA). Requires reliable stage timestamps on applications/disbursements.",
  },
  {
    id: "A7",
    section: "Application Control",
    requirement: "Application rejection analytics (reasons)",
    status: "Partial",
    backend: "Yes",
    notes:
      "Rejected application counts exist, but there is no reason breakdown. Ensure rejection_reason (structured codes) is mandatory on reject, and expose an analytics endpoint grouping rejections by reason (and branch/period) for charts/tables.",
  },
  {
    id: "A8",
    section: "Application Control",
    requirement: "Pipeline drop-off / abandonment rate",
    status: "Not done",
    backend: "Yes",
    notes:
      "No funnel abandonment metrics. Backend should compute how many applications stall or exit between stages (draft → submitted → under review → approved → disbursed), plus abandonment rate and average idle time per stage. Needs clear definitions of abandoned vs still-in-progress.",
  },
  {
    id: "A9",
    section: "Application Control",
    requirement: "Aging badges for pending disbursement >24–48h",
    status: "Not done",
    backend: "Yes",
    notes:
      "UI needs approved_at or pending_disbursement_since (ISO timestamps) on applications waiting for disbursement. Prefer also returning age_hours or an aging_bucket so FE can badge items older than 24h / 48h without clock skew issues. Filter by aging bucket would help queue management.",
  },
  {
    id: "A10",
    section: "Application Control",
    requirement: "Quick filter tabs: Awaiting Treasury / Ready for Disbursement",
    status: "Partial",
    backend: "Partial",
    notes:
      "Generic status filters exist, but not the exact treasury workflow states. Confirm or add statuses/filters for Awaiting Treasury and Ready for Disbursement (or equivalent) so FE can offer one-click tabs that match operations language, not only technical status codes.",
  },
  {
    id: "A11",
    section: "Application Control",
    requirement: "Summary cards show count AND total value",
    status: "Partial",
    backend: "Partial",
    notes:
      "Disbursement summaries often include volume; many application summaries return count only. Extend list/summary endpoints to always return both count and sum(principal/approved amount) for each status bucket used by dashboard cards.",
  },

  // Active Loans
  {
    id: "LN1",
    section: "Active Loans",
    requirement: "Fix negative recovery rate (clamp 0–100%)",
    status: "Not done",
    backend: "Partial",
    notes:
      "Recovery % can go negative when outstanding includes interest/fees while paid is principal-only (or inconsistent denominators). Prefer backend to return a clamped recovery_rate (0–100) with a documented formula. FE can clamp as a temporary fix, but source-of-truth should be API.",
  },
  {
    id: "LN2",
    section: "Active Loans",
    requirement: "Fix epoch / 01 Jan 1970 maturity dates",
    status: "Partial",
    backend: "Yes",
    notes:
      "Some loans still surface maturity/due dates as 1970-01-01 (unix epoch / null coerced). Backend must stop returning invalid dates: use null when unknown, ensure schedule generation always sets a real maturity, and fix any historical bad rows. FE already guards some displays but cannot invent correct maturity.",
  },
  {
    id: "LN4",
    section: "Active Loans",
    requirement: "Split outstanding into principal vs interest/fees",
    status: "Partial",
    backend: "Confirm",
    notes:
      "Adapters sometimes expose principal/interest/fee fields, but list and detail UIs often only get a single outstanding total. Confirm API always returns outstanding_principal, outstanding_interest, outstanding_fees (and total). If fields are missing on list endpoints, add them so FE can show the split without extra calls.",
  },
  {
    id: "LN6",
    section: "Active Loans",
    requirement: "Expected collections calendar / repayment report",
    status: "Partial",
    backend: "Yes",
    notes:
      "A collections report API exists in part, but a calendar-ready expected-repayments feed is incomplete. Need installments due by date (day/week/month) with amount expected, amount paid, and status — filterable by branch/officer — so FE can render a real collections calendar (not mock data).",
  },
  {
    id: "LN8",
    section: "Active Loans",
    requirement: "Loan product performance: group vs individual",
    status: "Partial",
    backend: "Yes",
    notes:
      "Product performance reporting exists at a high level, but lacks group vs individual product/loan-type breakdown. Extend performance endpoints to segment by loan_type (group/individual): disbursed volume, outstanding, PAR, recovery — per product and overall.",
  },

  // Groups
  {
    id: "G1",
    section: "Groups / Vikundi",
    requirement: "Meeting attendance & collection status indicator",
    status: "Not done",
    backend: "Yes",
    notes:
      "Groups only store meeting day/location today. Need attendance recording per meeting (member present/absent/late) plus collection status for that meeting (collected / partial / not collected). Without attendance APIs and models, FE cannot show meeting indicators.",
  },
  {
    id: "G2",
    section: "Groups / Vikundi",
    requirement: "Group risk grading / Group PAR badge",
    status: "Not done",
    backend: "Yes",
    notes:
      "Member-level risk exists in collections, but groups need an aggregated Group PAR / risk grade (e.g. green/amber/red or PAR %). Backend should compute from member loans (PAR30 etc.) and return on group list + detail for badges.",
  },
  {
    id: "G4",
    section: "Groups / Vikundi",
    requirement: "Center meeting attendance & repayment report",
    status: "Not done",
    backend: "Yes",
    notes:
      "No center-level attendance/repayment report. After attendance data exists, add a report aggregating attendance rate and repayment performance by center/meeting date/group — exportable for branch managers.",
  },
  {
    id: "G5",
    section: "Groups / Vikundi",
    requirement: "Group vs member exposure matrix",
    status: "Partial",
    backend: "Partial",
    notes:
      "Per-member outstanding is partly available on the group panel. Missing is a full exposure matrix: group total exposure, each member's share, guarantees/collateral coverage, and concentration risk. Prefer one endpoint returning matrix rows for the group detail screen.",
  },
  {
    id: "G6",
    section: "Groups / Vikundi",
    requirement: "LO group rotation / productivity leaderboard",
    status: "Not done",
    backend: "Yes",
    notes:
      "No tracking of loan-officer group capacity, rotation, or reassignment history. Need models/APIs for which LO owns which groups over time, max groups per LO, and a productivity leaderboard (groups managed, portfolio, collections). Required before rotation UI can be built.",
  },

  // Reports
  {
    id: "R1",
    section: "Reports",
    requirement: "Financial & disbursement reports (full suite)",
    status: "Partial",
    backend: "Partial",
    notes:
      "Portfolio and disbursement timeseries cover part of the need. Still missing a fuller financial suite: P&L-style income vs expenses, fee income, write-offs, and management disbursement packs. Clarify which financial reports are required next and expose dedicated report endpoints (not only raw lists).",
  },
  {
    id: "R3",
    section: "Reports",
    requirement: "Loan officer performance reports",
    status: "Partial",
    backend: "Yes",
    notes:
      "Dashboard peer widgets are not a full LO performance report. Need a report endpoint/page data: per officer — leads, applications, disbursements, portfolio outstanding, collections, PAR, conversion — with date/branch filters and Excel/PDF-friendly rows.",
  },
  {
    id: "R4",
    section: "Reports",
    requirement: "Branch comparison reports",
    status: "Partial",
    backend: "Partial",
    notes:
      "A basic branch performance table appears when unscoped, but comparison metrics are limited. Extend so HQ can compare branches side-by-side on disbursement, collection, PAR, growth, and officer productivity for the same period.",
  },

  // Disbursement
  {
    id: "D1",
    section: "Disbursement",
    requirement: "Management disbursement report components",
    status: "Partial",
    backend: "Yes",
    notes:
      "Console has KPIs and per-row PDF vouchers, but not a management report pack (daily/weekly disbursement summary by branch/product/officer, pending vs completed, failures). Need report endpoints aggregating disbursement activity for management download/print.",
  },

  // Payments
  {
    id: "P1",
    section: "Payments",
    requirement: "All ClickPesa payments reflect (app fees + other income)",
    status: "Partial",
    backend: "Yes",
    notes:
      "Loan repayments and some registration fees are wired. Other ClickPesa inflows (app fees, miscellaneous income) do not fully land in a ledger the UI can show. Backend should ingest/classify all payment types and expose them in payments/income reports — not only loan allocations.",
  },
  {
    id: "P4",
    section: "Payments",
    requirement: "Import ClickPesa + bank statements for reconciliation",
    status: "Not done",
    backend: "Yes",
    notes:
      "No statement import flow. Need upload/parse endpoints for ClickPesa exports and bank statements (CSV/XLS), create pending payment rows, and match against loans/customers. Include duplicate detection and import status/errors for the UI.",
  },
  {
    id: "P5",
    section: "Payments",
    requirement: "Batch reconciliation (multi-select bulk actions)",
    status: "Not done",
    backend: "Yes",
    notes:
      "Reconciliation is single-item today. Need bulk APIs: accept an array of payment IDs + action (match/unmatch/mark reviewed) with per-item results. Without batch endpoints, FE cannot safely offer multi-select reconcile.",
  },

  // Additional Modules
  {
    id: "X1",
    section: "Additional Modules",
    requirement: "Other non-interest income: create, record, report",
    status: "Not done",
    backend: "Yes",
    notes:
      "No other-income module beyond customer cash-flow fields. Need full CRUD for non-interest income (category, amount, branch, date, reference, attachments) plus list/filter and summary reports. FE cannot start this until the API exists.",
  },
  {
    id: "X2",
    section: "Additional Modules",
    requirement: "Expenses: create, record, reports",
    status: "Not done",
    backend: "Yes",
    notes:
      "No expenses module. Need expense categories, create/update/void expense records (branch, amount, date, payee, proof), approval if required, and expense reports by category/period/branch. Blocked entirely on backend.",
  },
  {
    id: "X3",
    section: "Additional Modules",
    requirement: "Other non-client payment windows: create, record, reports",
    status: "Not done",
    backend: "Yes",
    notes:
      "No payment-window / non-client payment module. Need APIs to open payment windows (purpose, dates, expected amounts), record receipts that are not client loan repayments, close windows, and report totals. Required before any UI for this PDF item.",
  },
];

const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();

const BLUE = [30, 64, 175];
const now = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

// Title
doc.setFillColor(...BLUE);
doc.rect(0, 0, pageW, 28, "F");
doc.setTextColor(255, 255, 255);
doc.setFontSize(18);
doc.setFont("helvetica", "bold");
doc.text("FALCO — Backend Gaps & Pending Items", 14, 12);
doc.setFontSize(9.5);
doc.setFont("helvetica", "normal");
doc.text(
  `Prepared ${now}  •  For backend developer  •  Notes explain current FE state + what API/model work is still needed`,
  14,
  20
);

// Summary
const notDone = ITEMS.filter((i) => i.status === "Not done").length;
const partial = ITEMS.filter((i) => i.status === "Partial").length;
doc.setTextColor(60, 60, 60);
doc.setFontSize(10);
doc.setFont("helvetica", "bold");
doc.text(
  `Total items: ${ITEMS.length}   |   Not started: ${notDone}   |   Partially done: ${partial}`,
  14,
  36
);

doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.text(
  'Backend column:  "Yes" = new endpoint/model needed  |  "Partial" = existing endpoint needs extension  |  "Confirm" = verify current API coverage',
  14,
  42
);

autoTable(doc, {
  startY: 46,
  head: [["#", "Section", "Requirement", "Status", "Backend", "Notes / What's Needed"]],
  body: ITEMS.map((r, i) => [
    i + 1,
    r.section,
    r.requirement,
    r.status,
    r.backend,
    r.notes,
  ]),
  styles: {
    fontSize: 7,
    cellPadding: 2.2,
    valign: "top",
    overflow: "linebreak",
  },
  headStyles: {
    fillColor: BLUE,
    textColor: 255,
    fontStyle: "bold",
    fontSize: 7.5,
    valign: "middle",
  },
  columnStyles: {
    0: { cellWidth: 7, halign: "center", valign: "top" },
    1: { cellWidth: 24 },
    2: { cellWidth: 44 },
    3: { cellWidth: 15, halign: "center" },
    4: { cellWidth: 15, halign: "center" },
    5: { cellWidth: "auto" },
  },
  alternateRowStyles: { fillColor: [245, 247, 255] },
  didParseCell: (data) => {
    if (data.section === "body" && data.column.index === 3) {
      if (data.cell.raw === "Not done") data.cell.styles.textColor = [185, 28, 28];
      else if (data.cell.raw === "Partial") data.cell.styles.textColor = [180, 100, 0];
    }
  },
  didDrawPage: (data) => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Page ${data.pageNumber} of ${pageCount}`,
      pageW - 14,
      pageH - 6,
      { align: "right" }
    );
  },
  margin: { left: 14, right: 14, bottom: 12 },
});

const outDir = resolve("docs");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "Falco-Backend-Gaps.pdf");
writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("PDF written to", outPath);
