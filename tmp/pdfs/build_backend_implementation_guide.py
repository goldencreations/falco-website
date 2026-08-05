from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

OUT = "output/pdf/falco-backend-reporting-implementation-guide.pdf"
GREEN = colors.HexColor("#08765F")
DARK = colors.HexColor("#15372F")
MINT = colors.HexColor("#EAF7F2")
PALE = colors.HexColor("#F5F8F7")
AMBER = colors.HexColor("#FFF7E4")
REDPALE = colors.HexColor("#FDEEEE")
SLATE = colors.HexColor("#4B5E59")
LINE = colors.HexColor("#CBD8D4")

s = getSampleStyleSheet()
s.add(ParagraphStyle(name="Cover", parent=s["Title"], fontName="Helvetica-Bold", fontSize=25, leading=30, textColor=colors.white, alignment=TA_CENTER))
s.add(ParagraphStyle(name="CoverSub", parent=s["BodyText"], fontName="Helvetica", fontSize=11, leading=16, textColor=colors.white, alignment=TA_CENTER))
s.add(ParagraphStyle(name="H1x", parent=s["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=DARK, spaceAfter=10))
s.add(ParagraphStyle(name="H2x", parent=s["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=GREEN, spaceBefore=7, spaceAfter=5))
s.add(ParagraphStyle(name="Bodyx", parent=s["BodyText"], fontName="Helvetica", fontSize=9.3, leading=13.2, textColor=DARK, spaceAfter=6))
s.add(ParagraphStyle(name="Smallx", parent=s["BodyText"], fontName="Helvetica", fontSize=8.4, leading=11.2, textColor=DARK))
s.add(ParagraphStyle(name="TH", parent=s["BodyText"], fontName="Helvetica-Bold", fontSize=8.1, leading=10.8, textColor=colors.white))
s.add(ParagraphStyle(name="Bulletx", parent=s["BodyText"], fontName="Helvetica", fontSize=9.1, leading=12.7, leftIndent=10, firstLineIndent=-6, textColor=DARK, spaceAfter=4))
s.add(ParagraphStyle(name="CallTitle", parent=s["BodyText"], fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=DARK, spaceAfter=3))

def p(t, st="Bodyx"): return Paragraph(t, s[st])
def b(t): return Paragraph("• " + t, s["Bulletx"])

def tbl(rows, widths):
    vals=[]
    for i,row in enumerate(rows): vals.append([p(str(x), "TH" if i==0 else "Smallx") for x in row])
    t=Table(vals, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),GREEN), ("GRID",(0,0),(-1,-1),.45,LINE),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,PALE]), ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
    ])); return t

def call(title, body, bg=MINT):
    t=Table([[[p(title,"CallTitle"),p(body)]]], colWidths=[172*mm])
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),bg),("BOX",(0,0),(-1,-1),.7,GREEN),
        ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
        ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),6)])); return t

def chrome(c,doc):
    c.saveState(); w,h=A4
    c.setFillColor(GREEN); c.rect(0,h-13*mm,w,13*mm,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold",8.5); c.drawString(19*mm,h-8.3*mm,"FALCO FINANCIAL SERVICES")
    c.setFont("Helvetica",7.5); c.drawRightString(w-19*mm,h-8.3*mm,"BACKEND REPORTING GUIDE")
    c.setStrokeColor(LINE); c.line(19*mm,14*mm,w-19*mm,14*mm)
    c.setFillColor(SLATE); c.setFont("Helvetica",7.5); c.drawString(19*mm,9*mm,"Backend implementation specification - reporting capability")
    c.drawRightString(w-19*mm,9*mm,f"Page {doc.page}"); c.restoreState()

doc=BaseDocTemplate(OUT,pagesize=A4,leftMargin=19*mm,rightMargin=19*mm,topMargin=20*mm,bottomMargin=18*mm,title="Falco Backend Reporting Implementation Guide")
doc.addPageTemplates(PageTemplate(id="main",frames=Frame(doc.leftMargin,doc.bottomMargin,doc.width,doc.height,id="f"),onPage=chrome))
st=[]

st += [Spacer(1,35*mm)]
cover=Table([[[p("WHAT THE BACKEND SHOULD DO","Cover"),Spacer(1,5*mm),p("A practical implementation guide for reliable Falco reports, calculations, permissions and exports.","CoverSub")]]],colWidths=[172*mm],rowHeights=[90*mm])
cover.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),GREEN),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),16*mm),("RIGHTPADDING",(0,0),(-1,-1),16*mm)]))
st += [cover,Spacer(1,12*mm),call("Backend objective","Make the backend the single source of truth. It must capture every reportable event, calculate metrics consistently, enforce role and branch access, return traceable report data, and generate exports from exactly the same authorized dataset."),Spacer(1,7*mm),p("Prepared 5 August 2026","H2x"),p("Based on the uploaded Falco change request, the local web implementation, and the repository backend controller documentation.","Smallx"),PageBreak()]

st += [p("1. Backend responsibilities","H1x"),call("The backend owns reporting correctness","Frontend cards and charts should only present results. The backend must decide which records qualify, apply the date and branch scope, calculate the figures, enforce access, and provide the rows behind every total.")]
resp=[
 ["Responsibility","What the backend must do"],
 ["Capture","Persist creator, branch, status changes, reasons, dates, payment allocations and other report source facts when events occur."],
 ["Validate","Reject invalid transitions, missing required reasons, unauthorized branch assignments and inconsistent financial allocations."],
 ["Calculate","Own canonical formulas for lead conversion, application turnaround, collection rate, PAR, NPL, aging and officer/branch performance."],
 ["Authorize","Apply report-type permissions and row-level branch/officer scope before the database query runs."],
 ["Explain","Return period, scope, data freshness, record counts and drill-down identifiers with report results."],
 ["Export","Create CSV, XLSX and PDF from the same query/service used by the JSON report response."],
 ["Audit","Record who created, approved, changed, reversed or exported sensitive financial information."],
]
st += [Spacer(1,5*mm),tbl(resp,[42*mm,130*mm]),Spacer(1,6*mm),p("Rules that should never be delegated to the browser","H2x"),b("Creator identity: derive it from the authenticated token; do not trust a created_by value supplied by the browser."),b("Branch scope and role permissions: reject unauthorized scope with HTTP 403."),b("Financial calculations and aging: compute them using authoritative loan schedules, balances and verified payments."),b("Export scope: never let a client-provided filename or filter bypass report permissions."),PageBreak()]

st += [p("2. Frontend Reports menu to backend map","H1x"),p("The sidebar now exposes the planned report destinations. The query parameter selects the frontend view; the backend endpoint supplies its authorized data. Until an endpoint is ready, the frontend should show a clear 'Backend report not available yet' state rather than invented or partial figures.")]
menu_map=[
 ["Frontend dropdown item","view value","Backend dependency"],
 ["Reports Overview","default","Existing portfolio-summary, aging and timeseries, later combined through an overview service."],
 ["Lead Performance","leads-performance","GET /reports/leads-performance and /details; lead creator and lifecycle events."],
 ["Customer Demographics","customer-demographics","GET /reports/customer-demographics; DOB, gender, economic activity and geography."],
 ["Application Analytics","applications","GET /reports/applications; application status history and rejection reasons."],
 ["Expected Collections","expected-collections","GET /reports/expected-collections; schedules, verified payments and allocations."],
 ["Portfolio & Aging","portfolio-aging","GET /reports/portfolio-summary and /reports/aging with canonical risk formulas."],
 ["Disbursements","disbursements","GET /reports/disbursements with management fields and permissions."],
 ["Group Performance","groups-performance","GET /reports/groups-performance; attendance, collection and member exposure."],
 ["Financial Ledger","financial-ledger","GET /reports/financial-ledger; income, expense and non-client payment ledger."],
]
st += [tbl(menu_map,[48*mm,41*mm,83*mm]),Spacer(1,6*mm),p("Frontend/backend agreement","H2x"),b("The frontend sends only allowed filters and never calculates official totals from downloaded detail pages."),b("The backend returns scope, period, summary, breakdowns, meta and traceability information in a consistent envelope."),b("Every submenu supports the same date/branch/officer filter language where relevant."),b("Exports receive the same filter set and report type, then the backend re-authorizes and recalculates; it must not reuse untrusted browser totals."),PageBreak()]

st += [p("3. Data model and event history","H1x"),p("Current-state fields are not enough for trend and turnaround reports. The backend needs immutable event history so it can reconstruct what happened and when.")]
data=[
 ["Backend record","Required fields and behavior"],
 ["leads","created_by_user_id, branch_id, gender, location/coordinates, current_status, created_at, converted_customer_id. Creator and branch are server assigned/validated."],
 ["lead_status_events","lead_id, from_status, to_status, occurred_at, actor_user_id, branch_id, reason_id and notes. Insert on every transition."],
 ["dropoff_reasons","Stable code, label, active flag and display order. Require a reason when a lead becomes lost or archived."],
 ["application_status_events","application_id, from/to status, actor, timestamp and rejection_reason_id. Needed for TAT, aging, rejection and abandonment."],
 ["loan schedules and balances","Installment due dates and components; principal, interest, fee and penalty balances; days past due and classification as of a specified date."],
 ["payment allocations","Payment and external reference; principal/interest/fee/penalty amounts; channel; verification, reconciliation and reversal audit."],
 ["group operations","Meeting date, attendance, expected collection, received collection, member balances, group risk and assigned officer."],
 ["branch/officer targets","Period, metric, target amount/count, branch, officer, approver and effective dates."],
 ["finance ledger","Other income, expense and non-client receipt entries with category, amount, branch, channel, approval and reversal history."],
]
st += [tbl(data,[48*mm,124*mm]),Spacer(1,5*mm),call("Historical migration","Backfill creator, timestamps and reasons only where reliable evidence exists. Keep unknown legacy values as 'Unknown / not recorded'; do not guess attribution or event dates.",REDPALE),PageBreak()]

st += [p("4. Report services and API endpoints","H1x")]
apis=[
 ["Endpoint","Backend output"],
 ["GET /reports/leads-performance","Lead totals, contact/application/final conversion rates, funnel, officer/branch ranking, stale leads, geography and drop-off reasons."],
 ["GET /reports/leads-performance/details","Paginated leads supporting a selected metric, including creator, branch, statuses/timestamps and conversion link."],
 ["GET /reports/customer-demographics","Counts by gender, approved age bands, economic activity, region and district."],
 ["GET /reports/applications","TAT, queue aging, rejection reasons, abandonment, counts and value by status, plus drill-down."],
 ["GET /reports/expected-collections","Due schedule rows and totals for today/week/month: expected, collected, shortfall, days overdue, branch and officer."],
 ["GET /reports/portfolio-summary","Canonical portfolio, PAR, NPL, provision, product and branch totals. Complete/retain documented behavior."],
 ["GET /reports/aging","Aging buckets and provision with loan-level traceability. Complete/retain documented behavior."],
 ["GET /reports/disbursements","Management detail including approval and disbursement actors/timestamps, branch, product and amount."],
 ["GET /reports/groups-performance","Attendance, repayment efficiency, group PAR, member concentration and officer capacity."],
 ["GET /reports/financial-ledger","Other income, expenses and non-client receipts by category, period, branch, channel and approval state."],
 ["GET /reports/{type}/export","CSV/XLSX/PDF binary using identical filters, permissions and calculations as the report JSON."],
]
st += [tbl(apis,[62*mm,110*mm]),Spacer(1,5*mm),p("Common query filters","H2x"),b("from, to or as_of; branch_id; officer_id; product_id; status; page and page_size."),b("Validate from <= to, accepted date format, maximum range, pagination limits and allowed granularity."),PageBreak()]

st += [p("5. How each backend report request should run","H1x"),call("Required request pipeline","Every report and export should pass through the same ordered pipeline. This prevents permission leaks, inconsistent formulas and differences between dashboard totals and downloaded files.")]
pipeline=[
 ["Step","Backend action","Failure behavior"],
 ["1. Authenticate","Validate token/session and load user ID, role, branch and report permissions.","401 when authentication is missing or invalid."],
 ["2. Validate input","Parse report type, dates, filters, page size and export format. Normalize timezone/date boundaries.","422 with field-level validation details."],
 ["3. Resolve scope","Calculate effective branch/officer scope from the authenticated user. Ignore or reject broader client scope.","403 for forbidden report type or branch."],
 ["4. Query source data","Use indexed database queries over all qualifying records, not a capped frontend list.","Return a controlled 500 error and request/correlation ID; log technical details privately."],
 ["5. Calculate","Apply the single canonical report service for formulas, groupings and classifications.","Fail the report if required financial source data is internally inconsistent."],
 ["6. Reconcile","Check summary totals against grouped/detail totals where applicable and record data freshness.","Flag or block export when reconciliation fails."],
 ["7. Respond/export","Return JSON envelope or generate CSV/XLSX/PDF from the same result model.","404 for unsupported report; 422 for unsupported format."],
 ["8. Audit","Record sensitive report/export access with actor, scope, type, filters, timestamp and outcome.","Audit failure policy must be defined; sensitive export should fail closed if required by compliance."],
]
st += [Spacer(1,5*mm),tbl(pipeline,[15*mm,101*mm,56*mm]),Spacer(1,6*mm),p("Service structure","H2x"),b("Report controller: input validation, authorization and response formatting."),b("Report query/service: database selection, grouping and canonical formulas."),b("Report DTO/schema: stable JSON fields independent of database column names."),b("Export renderer: CSV/XLSX/PDF created from the report DTO, never by re-querying with different logic."),b("Audit/observability: correlation ID, duration, row count, applied scope and failure category without logging sensitive row content."),PageBreak()]

st += [p("6. Canonical calculations","H1x"),call("One formula, one owner","Each metric must have one backend definition shared by dashboards, detail views and exports. Store definitions in code and document numerator, denominator, event date, timezone, exclusions and rounding.")]
formula=[
 ["Metric","Recommended backend definition"],
 ["Contact rate","Distinct leads that reached Contacted or a later qualifying stage / distinct leads created in the selected cohort x 100."],
 ["Application rate","Distinct cohort leads linked to an application / distinct leads created in the cohort x 100."],
 ["Final conversion","Distinct cohort leads linked to a disbursed loan / distinct leads created in the cohort x 100. Confirm this business definition before release."],
 ["Stale lead","Lead in New or Follow Up whose last meaningful activity is older than the configured threshold, initially 48 hours."],
 ["Application TAT","disbursed_at - approved_at. Also return median, percentiles and counts within/over the service target."],
 ["Collection rate","Verified collected amount for due items / expected scheduled amount for the same period x 100."],
 ["PAR ratio","Outstanding principal for qualifying loans in arrears / total outstanding principal of active portfolio x 100. Agree the PAR threshold, such as PAR30."],
 ["NPL ratio","Outstanding principal classified as non-performing / total outstanding principal x 100, following approved policy."],
 ["Officer productivity","Return separate volumes and quality measures; do not combine them into an unexplained score."],
]
st += [Spacer(1,5*mm),tbl(formula,[42*mm,130*mm]),Spacer(1,5*mm),call("Historical timeseries warning","Do not repeat today's outstanding balance for past months. Build true month-end values from dated balance snapshots or reconstruct them from disbursement, schedule, payment, adjustment and reversal events.",AMBER),PageBreak()]

st += [p("7. Authorization, exports and reliability","H1x"),p("Role and branch isolation","H2x"),b("Loan officer: assigned customers/portfolio within the permitted branch."),b("Branch manager: assigned branch only."),b("Super administrator: permitted global or selected-branch scope."),b("Management disbursement and financial ledger reports: explicit report-type permission in addition to reports.view/reports.export."),b("Enforce permissions before aggregation and export generation. Record sensitive exports in an audit log.")]
contract=[
 ["Response section","What it must contain"],
 ["scope","Effective branch, officer, product and status filters after permission enforcement."],
 ["period","from, to, as_of, timezone and date inclusivity."],
 ["summary","Canonical metric values and qualifying record counts."],
 ["breakdowns","Grouped rows for charts/tables with stable codes and labels."],
 ["meta","generated_at, data freshness, page, page_size and total."],
 ["traceability","Detail endpoint or identifiers allowing each total to be reconciled to source records."],
]
st += [Spacer(1,5*mm),tbl(contract,[45*mm,127*mm]),Spacer(1,5*mm),p("Operational reliability","H2x"),b("Aggregate in the database across the full authorized dataset. Do not calculate official totals from a frontend/server pagination cap such as 500 rows."),b("Add indexes for report filters and joins: branch/date, officer/date, status/date, due_date, payment_date and foreign keys."),b("Use consistent timezone handling and idempotent webhook/payment processing."),b("Cache only when the cache key includes the full authorized scope and period; invalidate when source events change."),PageBreak()]

st += [p("8. Production readiness and delivery controls","H1x")]
prod=[
 ["Concern","What must be implemented"],
 ["Database performance","Explain/analyze critical queries; add composite indexes; avoid N+1 queries; use server-side aggregation and cursor/stable pagination for large detail sets."],
 ["Consistency","Use transactions for status transition plus event insert, payment plus allocations, and reversal plus audit. Prevent partial reporting state."],
 ["Idempotency","Deduplicate payment webhooks and retryable write commands using stable external/event IDs."],
 ["Freshness","Return data_fresh_as_of/generated_at. If snapshots are used, document refresh frequency and expose stale status."],
 ["Caching","Key by report type, complete effective scope, filters, formula version and freshness. Invalidate on qualifying source changes."],
 ["Observability","Structured logs and metrics for latency, failures, row counts, export size, reconciliation failures and permission denials."],
 ["Security","Parameterized queries, export formula-injection protection, safe filenames, output size limits, rate limits and no sensitive fields outside the report contract."],
 ["Testing","Unit formula tests; integration database tests; permission matrix tests; export parsing tests; scale tests beyond page limits; fixed timezone boundary fixtures."],
 ["Versioning","Version formula definitions and response schemas when a breaking calculation or field meaning changes."],
]
st += [tbl(prod,[42*mm,130*mm]),Spacer(1,6*mm),p("Deployment checklist","H2x"),b("Apply schema migrations and indexes with a rollback plan."),b("Run controlled historical backfill and publish counts of known versus unknown legacy values."),b("Deploy endpoints behind report-specific feature flags where useful."),b("Reconcile production-like sample totals with finance/operations before enabling exports."),b("Enable submenu pages progressively only after their endpoint, permission tests and export tests pass."),PageBreak()]

st += [p("9. Implementation order and acceptance tests","H1x")]
order=[
 ["Phase","Backend delivery"],
 ["1 - Definitions and audit","Approve formulas and scope rules; add creator attribution, lifecycle events, required reasons, allocation records and migrations."],
 ["2 - Lead reporting","Implement leads-performance summary/details and export. Reconcile creator, gender, branch, funnel, conversion, stale and drop-off results."],
 ["3 - Collections and risk","Implement expected collections, canonical portfolio/PAR/NPL/aging and accurate historical timeseries."],
 ["4 - Applications/disbursement","Implement TAT, queue aging, rejection analysis and management-only disbursement report/export."],
 ["5 - Broader reporting","Customer demographics, group performance, targets, income, expenses and non-client payments."],
]
st += [tbl(order,[38*mm,134*mm]),Spacer(1,6*mm),p("Backend acceptance checklist","H2x")]
checks=[
 ["Test","Pass condition"],
 ["Attribution","New lead creator equals authenticated user in database, API and export; spoofing another creator fails."],
 ["Authorization","Cross-branch requests and unauthorized report types return 403 without leaking totals or rows."],
 ["Reconciliation","Summary equals detail-row aggregation and CSV/XLSX/PDF totals for identical filters."],
 ["Lifecycle","Every accepted status change creates one event with actor and timestamp; required reasons cannot be omitted."],
 ["Date behavior","Boundary dates, timezone and as_of calculations match the documented policy."],
 ["Finance","Reversals and duplicate webhooks do not double-count collections; allocations equal payment amount."],
 ["Scale","Results remain complete beyond 500 records and pagination returns stable, non-duplicated rows."],
 ["Legacy data","Unknown historic values are labelled and included according to the documented rule, never invented."],
]
st += [tbl(checks,[42*mm,130*mm]),Spacer(1,5*mm),call("Definition of complete","The backend work is complete only when every report is permission-safe, traceable to detail records, consistent across screen and exports, accurate beyond pagination limits, and reproducible for a specified period or as-of date.")]

doc.build(st)
print(OUT)
