import { extractApplicationsList, type ApplicationViewRow } from "@/lib/application-adapters";
import type {
 ReportApplicationRow,
 ReportCollectionRow,
 ReportCustomerRow,
 ReportLoanRow,
} from "@/lib/branch-report-pdf";
import {
 adaptCollectionActivityRow,
 extractPaginatedData,
} from "@/lib/collection-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import { formatDate, formatDateTime } from "@/lib/formatters";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import type { CollectionActivity, Customer } from "@/lib/types";

export type ReportExportDetailRows = {
 applications: ReportApplicationRow[];
 customers: ReportCustomerRow[];
 loans: ReportLoanRow[];
 collections: ReportCollectionRow[];
};

const REPORT_PAGE_SIZE = 100;
const MAX_REPORT_PAGES = 200;

function inDateRange(iso: string | undefined, from: string, to: string): boolean {
 if (!iso) return false;
 const day = iso.slice(0, 10);
 return day >= from && day <= to;
}

function customerDisplayName(c: Customer): string {
 return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").trim() || c.customer_number;
}

export function mapReportApplications(apps: ApplicationViewRow[], from: string, to: string): ReportApplicationRow[] {
 return apps
 .filter((a) => inDateRange(a.created_at, from, to))
 .map((a) => ({
 application_number: a.application_number || a.id,
 customer_name: a.customerDisplayName || a.customerNumber || "—",
 status: a.status,
 amount: Number(a.requested_amount ?? a.approved_amount ?? 0),
 created_at: a.created_at ? formatDate(a.created_at) : "—",
 }));
}

export function mapReportCustomers(customers: Customer[], from: string, to: string): ReportCustomerRow[] {
 return customers.filter((c) => inDateRange(c.created_at, from, to)).map((c) => ({
 customer_number: c.customer_number || c.id,
 customer_name: customerDisplayName(c),
 phone: c.phone_primary || c.phone_secondary || "—",
 region: c.region || "—",
 district: c.district || "—",
 added_at: formatDate(c.created_at),
 }));
}

export function mapReportLoans(loans: LoanListRow[], from: string, to: string): ReportLoanRow[] {
 return loans.filter((l) => inDateRange(l.disbursement_date, from, to)).map((l) => ({
 loan_number: l.loan_number || l.id,
 customer_name: l.customerDisplayName || "—",
 product_name: l.productName || "—",
 principal: Number(l.principal_amount ?? 0),
 outstanding: Number(l.total_outstanding ?? 0),
 status: l.status,
 disbursed_at: formatDate(l.disbursement_date),
 }));
}

function paginationTotal(json: unknown): number | null {
 if (!json || typeof json !== "object") return null;
 const response = json as Record<string, unknown>;
 const meta = response.meta && typeof response.meta === "object"
 ? response.meta as Record<string, unknown>
 : null;
 const total = Number(meta?.total ?? response.total);
 return Number.isFinite(total) && total >= 0 ? total : null;
}

async function fetchAllReportPages<T>(input: {
 endpoint: string;
 params: URLSearchParams;
 extractRows: (json: unknown) => T[];
 getId: (row: T) => string;
}): Promise<T[]> {
 const rows: T[] = [];
 const seen = new Set<string>();

 for (let page = 1; page <= MAX_REPORT_PAGES; page += 1) {
 const params = new URLSearchParams(input.params);
 params.set("page", String(page));
 params.set("page_size", String(REPORT_PAGE_SIZE));

 const response = await fetch(`${input.endpoint}?${params.toString()}`, {
 credentials: "include",
 cache: "no-store",
 });
 const json = await response.json().catch(() => ({}));
 if (!response.ok) {
 const message = json && typeof json === "object" && "message" in json
 ? String((json as { message?: unknown }).message || "")
 : "";
 throw new Error(message || `Could not load report rows (${response.status}).`);
 }

 const pageRows = input.extractRows(json);
 let added = 0;
 for (const row of pageRows) {
 const id = input.getId(row);
 if (id && seen.has(id)) continue;
 if (id) seen.add(id);
 rows.push(row);
 added += 1;
 }

 const total = paginationTotal(json);
 if (pageRows.length < REPORT_PAGE_SIZE || (total !== null && rows.length >= total)) {
 return rows;
 }
 if (added === 0) {
 throw new Error("The report service repeated a page before all rows were loaded.");
 }
 }

 throw new Error("The report is too large to export in one file. Narrow the date range or branch.");
}

function mapCollectionActivities(
 activities: CollectionActivity[],
 customerById: Map<string, string>,
 loanById: Map<string, LoanListRow>
): ReportCollectionRow[] {
 return activities.map((a) => ({
 action: a.action || "other",
 customer_name:
 customerById.get(a.customer_id) ?? loanById.get(a.loan_id)?.customerDisplayName ?? "—",
 notes: (a.notes || a.outcome || "").trim() || "—",
 performed_at: a.performed_at ? formatDateTime(a.performed_at) : "—",
 }));
}

/** Load detail rows for PDF export (applications, customers, loans, collection activities). */
export async function loadReportExportDetailRows(input: {
 branchId?: string;
 from: string;
 to: string;
}): Promise<ReportExportDetailRows> {
 const branchParams = new URLSearchParams();
 if (input.branchId) branchParams.set("branch_id", input.branchId);
 const activityParams = new URLSearchParams(branchParams);
 activityParams.set("from", input.from);
 activityParams.set("to", input.to);

 const [applicationList, customerList, loanList, activityList] = await Promise.all([
 fetchAllReportPages({
 endpoint: "/api/applications",
 params: branchParams,
 extractRows: extractApplicationsList,
 getId: (row) => row.id,
 }),
 fetchAllReportPages({
 endpoint: "/api/customers",
 params: branchParams,
 extractRows: extractCustomersList,
 getId: (row) => row.id,
 }),
 fetchAllReportPages({
 endpoint: "/api/loans",
 params: branchParams,
 extractRows: extractLoansList,
 getId: (row) => row.id,
 }),
 fetchAllReportPages({
 endpoint: "/api/collections/activities",
 params: activityParams,
 extractRows: (json) => extractPaginatedData<Record<string, unknown>>(json).map(adaptCollectionActivityRow),
 getId: (row) => row.id,
 }),
 ]);

 const customerById = new Map(customerList.map((c) => [c.id, customerDisplayName(c)]));
 const customers = mapReportCustomers(customerList, input.from, input.to);

 const loanById = new Map(loanList.map((l) => [l.id, l]));
 const loans = mapReportLoans(loanList, input.from, input.to);
 const applications = mapReportApplications(applicationList, input.from, input.to);
 const collections = mapCollectionActivities(
 activityList.filter((activity) => inDateRange(activity.performed_at, input.from, input.to)),
 customerById,
 loanById
 );

 return { applications, customers, loans, collections };
}
