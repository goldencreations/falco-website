from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)

OUT = "output/pdf/falco-report-problem-explained.pdf"

GREEN = colors.HexColor("#08765F")
DARK = colors.HexColor("#15372F")
MINT = colors.HexColor("#EAF7F2")
PALE = colors.HexColor("#F5F8F7")
GOLD = colors.HexColor("#DDAA35")
RED = colors.HexColor("#C94C4C")
SLATE = colors.HexColor("#4B5E59")
LINE = colors.HexColor("#CBD8D4")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=25, leading=29, textColor=colors.white, alignment=TA_CENTER, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=11, leading=16, textColor=colors.white, alignment=TA_CENTER))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=18, leading=22, textColor=DARK, spaceAfter=10))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=12, leading=15, textColor=GREEN, spaceBefore=7, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.2, leading=13.1, textColor=DARK, spaceAfter=6))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.4, leading=11.2, textColor=DARK))
styles.add(ParagraphStyle(name="TableHeader", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=8.1, leading=10.8, textColor=colors.white))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=10.5, leading=15, textColor=DARK, spaceAfter=3))
styles.add(ParagraphStyle(name="Bulletx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9, leading=12.6, leftIndent=10, firstLineIndent=-6, bulletIndent=2,
    textColor=DARK, spaceAfter=4))

def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])

def bullet(text):
    return Paragraph("• " + text, styles["Bulletx"])

def table(data, widths, header=True, font=7.6):
    formatted = []
    for row_index, row in enumerate(data):
        style_name = "TableHeader" if header and row_index == 0 else "Smallx"
        formatted.append([p(str(c), style_name) for c in row])
    t = Table(formatted, colWidths=widths, repeatRows=1 if header else 0)
    commands = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("GRID", (0,0), (-1,-1), 0.45, LINE),
        ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("ROWBACKGROUNDS", (0,1 if header else 0), (-1,-1), [colors.white, PALE]),
    ]
    if header:
        commands += [("BACKGROUND", (0,0), (-1,0), GREEN), ("TEXTCOLOR", (0,0), (-1,0), colors.white)]
    t.setStyle(TableStyle(commands))
    return t

def callout(title, body, color=MINT):
    content = [p(title, "Callout"), p(body, "Bodyx")]
    t = Table([[content]], colWidths=[172*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), color), ("BOX", (0,0), (-1,-1), 0.7, GREEN),
        ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 9), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(GREEN)
    canvas.rect(0, h-13*mm, w, 13*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(19*mm, h-8.3*mm, "FALCO FINANCIAL SERVICES")
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(w-19*mm, h-8.3*mm, "REPORT PROBLEM EXPLAINER")
    canvas.setStrokeColor(LINE)
    canvas.line(19*mm, 14*mm, w-19*mm, 14*mm)
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(19*mm, 9*mm, "Prepared from the uploaded change request and a static review of the Falco web project")
    canvas.drawRightString(w-19*mm, 9*mm, f"Page {doc.page}")
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=19*mm, rightMargin=19*mm,
    topMargin=20*mm, bottomMargin=18*mm, title="Falco Report Problem Explained")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates(PageTemplate(id="main", frames=frame, onPage=header_footer))

story = []
story += [Spacer(1, 34*mm)]
cover = Table([[
    [p("FALCO REPORT PROBLEM", "CoverTitle"),
     p("A clear explanation of the reporting request, the backend gaps behind it, and exactly what should be implemented.", "CoverSub")]
]], colWidths=[172*mm], rowHeights=[90*mm])
cover.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), GREEN), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
    ("LEFTPADDING", (0,0), (-1,-1), 16*mm), ("RIGHTPADDING", (0,0), (-1,-1), 16*mm)]))
story += [cover, Spacer(1, 12*mm), callout("The short answer", "The core problem is fragmented reporting. Falco has useful portfolio reports and exports, but the uploaded request expects one complete reporting layer that also measures lead conversion, staff productivity, customer demographics, application delays, repayment risk, group performance, branch comparison, disbursement, payments, income, and expenses."), Spacer(1, 7*mm)]
story += [p("Prepared 4 August 2026", "H2x"), p("Scope note: this document is an implementation explainer, not a claim that every backend endpoint was tested live. Current-state observations come from a static review of the local Falco web code.", "Smallx"), PageBreak()]

story += [p("1. What is the report problem?", "H1x")]
story += [callout("It is a coverage and data-quality problem", "The uploaded PDF uses the word 'report' for several different management needs. Some are downloadable documents; others are dashboards, charts, operational queues, or required data fields. Treating all of them as a single export button would not solve the request.")]
story += [Spacer(1, 5*mm), p("The request has four layers", "H2x")]
layers = [
    ["Layer", "Meaning", "Example from the request"],
    ["Capture", "Store the facts needed for reporting at the moment an event happens.", "Lead gender and creating staff; lost-lead reason; payment allocation; application status timestamps."],
    ["Calculate", "Apply consistent business formulas to raw records.", "Conversion rate, collection rate, PAR/NPL aging, turnaround time, officer productivity."],
    ["Present", "Show managers the result in a useful dashboard or operational list.", "Officer leaderboard, funnel, aging buckets, branch comparison, due collections calendar."],
    ["Export", "Produce controlled PDF/Excel/CSV outputs for review, printing, or audit.", "Management disbursement report, leads report, portfolio report, loan-calculator result."],
]
story += [table(layers, [28*mm, 62*mm, 82*mm]), Spacer(1, 6*mm)]
story += [p("Why this matters", "H2x"), bullet("A report cannot be accurate if the source event was never stored. For example, drop-off analysis needs a required loss reason; turnaround-time reporting needs status-change timestamps."), bullet("Several requested metrics share the same data. Creator identity supports both the leads register and officer performance. Branch assignment supports branch filtering and comparison."), bullet("Permissions are part of the requirement. The uploaded document says the detailed disbursement report should be management-only."), bullet("Definitions must be agreed before coding. 'Conversion' could mean application created, application approved, or loan disbursed; each gives a different percentage.")]
story += [PageBreak()]

story += [p("2. What the uploaded PDF asks reporting to cover", "H1x")]
req = [
 ["Area", "Required report or insight", "Data that must exist"],
 ["Leads", "Gender and creator; officer vs branch ranking; contact/application/final conversion rates; geographic concentration; stale leads; loss reasons.", "Gender, creator user/role, branch, status history, conversion links, coordinates/location, last activity, loss reason."],
 ["Customers", "Periodic counts by sex, age group, economic activity, region and district.", "DOB/age, gender, activity, geography, customer-created date."],
 ["Applications", "Approval-to-disbursement turnaround, rejection reasons, abandonment, queue aging and total value by status.", "Status history timestamps, rejection reason, draft activity, requested/approved amount."],
 ["Active loans", "Expected collections calendar, PAR aging, product performance, principal vs interest/fees outstanding.", "Repayment schedule, payment allocations, days past due, product, balance components."],
 ["Groups", "Meeting attendance/repayment, group vs member exposure, officer capacity/productivity.", "Attendance, meeting collections, member loan balances, assigned officer, risk roll-up."],
 ["Branches", "Disbursement vs collection timeline, officer leaderboard, target vs actual, cash-flow summary, branch comparison.", "Branch-scoped transactions, targets, cash balances, officer assignments."],
 ["Finance", "Management disbursement report; ClickPesa receipts; other income, expenses and non-client payments.", "Reconciled payment events, allocation, fee/income/expense ledger entries, approval trail."],
]
story += [table(req, [25*mm, 77*mm, 70*mm]), Spacer(1, 5*mm)]
story += [callout("Important interpretation", "The PDF is a requirements list, not a finished specification. Before implementation, Falco needs exact formulas, date rules, permissions, and definitions for each report. The cleanest approach is to create a report catalogue and implement it in priority order.", colors.HexColor("#FFF7E4"))]
story += [PageBreak()]

story += [p("3. What the current Falco project already provides", "H1x")]
story += [p("Static code review found meaningful reporting work already in place. This should be extended rather than replaced.", "Bodyx")]
current = [
 ["Observed capability", "Status", "Evidence in the local project"],
 ["Central Reports page with date period and branch scope", "Present", "app/(dashboard)/reports/page.tsx"],
 ["Portfolio summary, PAR/NPL measures, required provision and aging buckets", "Present", "Reports page plus /api/reports/portfolio-summary and /api/reports/aging"],
 ["Product and branch performance sections", "Present", "Reports page normalized portfolio data"],
 ["PDF, CSV and JSON report exports", "Present", "Reports page and lib/branch-report-pdf.ts"],
 ["Detailed PDF sections for applications, customers, loans and collection activities", "Present", "lib/branch-report-pdf.ts"],
 ["Leads Excel report by date range", "Present", "app/api/leads/report/route.ts and lib/leads-report.ts"],
 ["Gender, creator name and creator role in the leads export", "Present in frontend/export model", "lib/leads-report.ts and lib/lead-adapters.ts"],
 ["Backend creator attribution on every newly created lead", "Needs confirmation", "The web POST forwards the lead but does not explicitly set created_by; the API must derive it from the authenticated user."],
]
story += [table(current, [60*mm, 27*mm, 85*mm]), Spacer(1, 6*mm)]
story += [p("What is not visibly covered by the reviewed report implementation", "H2x"), bullet("Lead funnel conversion percentages, stale-lead monitoring, geographic density, officer leaderboard and structured drop-off reasons."), bullet("Customer demographic reports by age band, sex, economic activity, region and district."), bullet("Application turnaround/rejection/abandonment analytics and group-lending reports."), bullet("Expected-collections calendar, finance ledger reports for other income and expenses, and the requested management disbursement report."), bullet("A single, documented definition catalogue ensuring every displayed figure and every export uses the same calculation.")]
story += [callout("Key risk to check first", "The leads workbook can display creator data only when the upstream API stores and returns it. Confirm that POST /leads always records the authenticated user and that historical lead records are backfilled where possible.", colors.HexColor("#FDEEEE")), PageBreak()]

story += [p("4. Backend gap: what is missing or unverified", "H1x")]
story += [callout("The frontend is ahead of the reporting backend", "The Falco web project can display and export several fields, but a reliable report must be computed from authoritative backend records. The main gap is not PDF design: it is complete event capture, stable report APIs, shared formulas, server-side authorization, and export generation from the same query results.")]
backend_gap = [
 ["Backend area", "Observed state", "Gap or risk"],
 ["Lead creator", "Frontend adapters and Excel export accept creator ID, name and role.", "Lead creation does not explicitly send created_by. The backend must derive the creator from the authenticated token, persist it, and return creator details."],
 ["Lead lifecycle", "Lead status values include new, follow_up, contacted and converted.", "A current status alone cannot calculate time between stages or reconstruct the funnel. No verified immutable lead status-event history is visible."],
 ["Drop-off", "The uploaded request needs loss/archive reasons.", "Current lead status model reviewed here has no lost/archived state or structured drop-off reason."],
 ["Report endpoints", "Backend documentation defines portfolio-summary, aging, disbursements and collections.", "The requested lead, customer demographic, application TAT/rejection, group, finance-income and expense reports are not defined in the report controller documentation."],
 ["Exports", "The frontend generates portfolio PDF locally and leads XLSX in a Next.js route.", "Backend documentation says report XLSX/PDF export returns 422 until a binary exporter is approved. Server exports are therefore incomplete."],
 ["Officer reports", "Web server code locally derives officer portfolio and aging from up to 500 loans.", "Application-side pagination caps can produce incomplete totals at scale. Reporting aggregation should run in the backend/database over the entire authorized dataset."],
 ["Timeseries", "Officer outstanding timeseries repeats the current outstanding total across requested months.", "It is not a historical month-end balance. True trends require dated balance snapshots or event-based reconstruction."],
 ["Formula consistency", "Portfolio/PAR calculations exist in web-server fallback code and backend report APIs.", "Two calculation locations can drift. The backend must own canonical formulas and return both summary and drill-down rows."],
]
story += [Spacer(1, 5*mm), table(backend_gap, [31*mm, 61*mm, 80*mm]), Spacer(1, 5*mm)]
story += [callout("Backend conclusion", "Do not solve this by adding more frontend charts alone. First make the backend the single source of truth for attribution, lifecycle events, balances, calculations, permissions and exports.", colors.HexColor("#FFF7E4")), PageBreak()]

story += [p("5. Backend implementation required", "H1x")]
story += [p("A. Add authoritative data and audit records", "H2x")]
data_impl = [
 ["Record or field", "Minimum backend requirement"],
 ["lead.created_by_user_id", "Required, server assigned from the authenticated user; never accepted as an arbitrary browser-controlled identity."],
 ["lead.branch_id", "Required and validated against the authenticated user's permitted branch scope."],
 ["lead_status_events", "lead_id, from_status, to_status, occurred_at, actor_user_id, branch_id and optional reason_id/notes."],
 ["dropoff_reasons", "Controlled reason code and label; required when moving a lead to lost or archived."],
 ["application_status_events", "Application ID, status transition, actor, timestamp and structured rejection reason where applicable."],
 ["payment allocations", "Payment ID, principal, interest, fee and penalty components, channel, external reference, verification and reversal audit."],
 ["reporting snapshots/events", "Enough dated information to reproduce month-end outstanding, PAR and historical trends rather than repeating today's balance."],
 ["targets and group operations", "Branch/officer period targets; group meeting attendance, expected collection, actual collection and member exposure."],
]
story += [table(data_impl, [52*mm, 120*mm]), Spacer(1, 5*mm)]
story += [p("B. Make formulas canonical on the backend", "H2x"), bullet("Publish one definition for contact rate, application rate, final conversion, collection rate, PAR, NPL, aging, turnaround time and stagnation."), bullet("Use explicit numerator, denominator, qualifying statuses, event date, timezone and rounding rule for every metric."), bullet("Return metric metadata in APIs where useful, including as_of/from/to, applied scope and record counts."), bullet("Use the same backend service/query for screen summaries, drill-down rows and downloaded exports.")]
story += [p("C. Enforce access before querying", "H2x"), bullet("Loan officers: only their assigned customers/portfolio and permitted branch."), bullet("Branch managers: their branch only. Super administrators: allowed cross-branch/global scope."), bullet("Management disbursement and financial reports: explicit permissions such as reports.view and reports.export plus report-type access."), bullet("Reject unauthorized branch IDs with 403; never fetch global rows and filter them only in the browser.")]
story += [PageBreak()]

story += [p("6. Backend APIs and delivery contract", "H1x")]
api_rows = [
 ["Endpoint to implement or complete", "Purpose and expected output"],
 ["GET /reports/leads-performance", "Totals and rates, funnel by stage, officer/branch ranking, stale counts, geography and drop-off reasons. Filters: from, to, branch_id, officer_id."],
 ["GET /reports/leads-performance/details", "Paginated source leads behind any metric, including creator, branch, current status, stage timestamps and conversion link."],
 ["GET /reports/customer-demographics", "Counts by gender, agreed age bands, economic activity, region and district for a specified period and branch scope."],
 ["GET /reports/applications", "TAT distribution, status aging, rejection reasons, abandonment and value/count by status, with drill-down."],
 ["GET /reports/expected-collections", "Schedule items due today/week/month with expected, collected, shortfall, days overdue, officer and branch."],
 ["GET /reports/groups-performance", "Attendance, expected/actual collection, group PAR, member exposure concentration and officer capacity."],
 ["GET /reports/disbursements", "Complete the documented endpoint and management detail fields, including approval/disbursement actors and timestamps."],
 ["GET /reports/financial-ledger", "Other income, expenses and non-client receipts by period, category, branch, channel and approval state."],
 ["GET /reports/{type}/export", "Implement true CSV, XLSX and PDF binaries for supported types. The export must use identical filters, permissions and formulas as the JSON report."],
]
story += [table(api_rows, [64*mm, 108*mm]), Spacer(1, 5*mm)]
story += [p("Response contract for every report", "H2x"), bullet("scope: applied branch/officer/product/status filters and effective permissions."), bullet("period: from, to, as_of and timezone."), bullet("summary: canonical metrics with unrounded raw values where needed."), bullet("breakdowns: grouped report rows."), bullet("meta: page, page_size, total, generated_at and data freshness."), bullet("details endpoint or stable drill-down identifiers so every total can be traced to its records.")]
story += [callout("Migration requirement", "Historical data will not automatically gain creator, status timestamps or reason codes. Run a controlled backfill where evidence exists; otherwise label legacy values as 'Unknown / not recorded'. Never invent historical attribution.", colors.HexColor("#FDEEEE")), PageBreak()]

story += [p("7. Gap analysis and priority", "H1x")]
gaps = [
 ["Priority", "Work item", "Why it comes here", "Definition of done"],
 ["P0", "Reporting definitions and source-data audit", "All later reports depend on trusted fields and formulas.", "Approved catalogue for conversion, PAR, NPL, collection rate, TAT, age bands, date/timezone and branch ownership."],
 ["P0", "Event/audit fields", "Missing history cannot be reconstructed reliably.", "Creator and branch IDs, lead/application status history, required loss/rejection reason, payment allocation and actor/timestamps are persisted."],
 ["P1", "Lead performance pack", "It is the first explicit issue in the PDF and much of the basic lead data already exists.", "Register plus funnel, conversion, creator/officer ranking, stale leads, geography and drop-off; branch/date/officer filters; export."],
 ["P1", "Repayment risk and expected collections", "Direct operational and financial value.", "Due calendar; PAR aging; product/branch/officer views; drill-down to source loans; reconciled totals."],
 ["P1", "Application and management disbursement", "Exposes approval bottlenecks and cash-out control.", "TAT, aging queue, rejection analysis, exposure by status; management-only disbursement export."],
 ["P2", "Customer, branch and group packs", "Important management analysis after core event tracking is stable.", "Demographics, branch comparison/targets and group attendance/exposure/officer capacity."],
 ["P2", "Income, expense and non-client payment reporting", "Requires a coherent finance ledger and reconciliation model.", "Create/approve/reverse/audit workflow plus period, branch, category and payment-channel reports."],
]
story += [table(gaps, [14*mm, 40*mm, 55*mm, 63*mm]), Spacer(1, 5*mm)]
story += [p("Suggested navigation", "H2x"), bullet("Reports Overview: headline portfolio, collections, PAR/NPL, branch comparison."), bullet("Operational Reports: leads, applications, expected collections, groups."), bullet("Financial Reports: disbursement, payments, income, expenses and reconciliation."), bullet("Each report should support a common filter bar: date range, branch, officer, product and status, with role-based restrictions."), bullet("Every summary card or chart should drill down to the records used to calculate it. This is essential for trust and troubleshooting.")]
story += [PageBreak()]

story += [p("8. A practical implementation blueprint", "H1x")]
story += [p("Phase 1 - make the data trustworthy", "H2x"), bullet("Create a report dictionary with formula, source tables/endpoints, date basis, timezone, filters, owner and allowed roles."), bullet("Add immutable status/event history for leads, applications, loans and payments. Keep who, what, when, previous state, new state and reason."), bullet("Require structured reasons when a lead is lost/archived or an application is rejected. Permit optional notes in addition to the controlled reason list."), bullet("Confirm creator and branch attribution are derived server-side from the authenticated account, not trusted from browser input."), bullet("Add automated reconciliation tests between summary totals, detail rows and exports.")]
story += [p("Phase 2 - deliver the highest-value reports", "H2x"), bullet("Build the Lead Performance report first: total leads, contact rate, application rate, final conversion, funnel, officer ranking, stale leads, geography and drop-off reasons."), bullet("Build Expected Collections and PAR Aging with loan-level drill-down."), bullet("Build Application TAT and management-only Disbursement reporting."), bullet("Reuse Falco's existing report filters and PDF/CSV/JSON export approach, but ensure exports apply the same scope and formulas as the screen.")]
story += [p("Phase 3 - broaden management coverage", "H2x"), bullet("Add customer demographics, group lending, target-vs-actual, cash flow, income and expense packs."), bullet("Add scheduled delivery and saved report presets only after live reports reconcile correctly."), Spacer(1, 4*mm)]
accept = [
 ["Acceptance check", "Pass condition"],
 ["Creator attribution", "Every new lead shows the authenticated staff member in UI, API response and export; staff cannot impersonate another creator."],
 ["Metric traceability", "Clicking a number shows exactly the records included; detail sum matches summary and exported total."],
 ["Scope and permissions", "Officer sees only assigned portfolio; manager sees allowed branch; management-only disbursement data is blocked for other roles."],
 ["Date consistency", "Screen and exports use the same timezone, start/end inclusivity and event date."],
 ["Empty and legacy data", "Missing historic creator/reason is labelled 'Unknown/Not recorded', not silently guessed or excluded."],
 ["Performance", "Typical filtered reports load and export without duplicate or missing rows across pagination."],
]
story += [table(accept, [53*mm, 119*mm]), Spacer(1, 5*mm)]
story += [callout("Recommended next action", "Start with a short data audit and the Lead Performance report specification. That will confirm whether existing records contain reliable creator, gender, branch, status, conversion and location data. Once those fields reconcile, implement the lead dashboard and export as the first complete reporting slice.")]

doc.build(story)
print(OUT)
