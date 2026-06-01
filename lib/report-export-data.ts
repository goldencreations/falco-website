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

function listQuery(branchId: string | undefined, pageSize = "500"): string {
 const p = new URLSearchParams();
 p.set("page_size", pageSize);
 p.set("page", "1");
 if (branchId) p.set("branch_id", branchId);
 return p.toString();
}

function inDateRange(iso: string | undefined, from: string, to: string): boolean {
 if (!iso) return false;
 const day = iso.slice(0, 10);
 return day >= from && day <= to;
}

function customerDisplayName(c: Customer): string {
 return [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").trim() || c.customer_number;
}

function mapApplications(apps: ApplicationViewRow[], from: string, to: string): ReportApplicationRow[] {
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

function mapCustomers(customers: Customer[]): ReportCustomerRow[] {
 return customers.map((c) => ({
 customer_number: c.customer_number || c.id,
 customer_name: customerDisplayName(c),
 phone: c.phone_primary || c.phone_secondary || "—",
 region: c.region || "—",
 district: c.district || "—",
 }));
}

function mapLoans(loans: LoanListRow[]): ReportLoanRow[] {
 return loans.map((l) => ({
 loan_number: l.loan_number || l.id,
 customer_name: l.customerDisplayName || "—",
 product_name: l.productName || "—",
 principal: Number(l.principal_amount ?? 0),
 outstanding: Number(l.total_outstanding ?? 0),
 status: l.status,
 }));
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
 const q = listQuery(input.branchId);
 const branchQ = input.branchId ? `branch_id=${encodeURIComponent(input.branchId)}&` : "";

 const [appsRes, customersRes, loansRes, activitiesRes] = await Promise.all([
 fetch(`/api/applications?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/customers?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/loans?${q}`, { credentials: "include", cache: "no-store" }),
 fetch(
 `/api/collections/activities?${branchQ}from=${encodeURIComponent(input.from)}&to=${encodeURIComponent(input.to)}&page_size=500&page=1`,
 { credentials: "include", cache: "no-store" }
 ),
 ]);

 const customerList = customersRes.ok ? extractCustomersList(await customersRes.json()) : [];
 const customerById = new Map(customerList.map((c) => [c.id, customerDisplayName(c)]));
 const customers = mapCustomers(customerList);

 const loanList = loansRes.ok ? extractLoansList(await loansRes.json()) : [];
 const loanById = new Map(loanList.map((l) => [l.id, l]));
 const loans = mapLoans(loanList);

 const applications = appsRes.ok
 ? mapApplications(extractApplicationsList(await appsRes.json()), input.from, input.to)
 : [];

 const activityList = activitiesRes.ok
 ? extractPaginatedData<Record<string, unknown>>(await activitiesRes.json()).map(
 adaptCollectionActivityRow
 )
 : [];
 const collections = mapCollectionActivities(activityList, customerById, loanById);

 return { applications, customers, loans, collections };
}
