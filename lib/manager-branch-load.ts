import { extractApplicationsList } from "@/lib/application-adapters";
import { extractPaginatedData } from "@/lib/collection-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import { extractLoansList } from "@/lib/loan-adapters";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import { extractUsersListPayload } from "@/lib/user-adapters";
import type { ApplicationViewRow } from "@/lib/application-adapters";
import type { LoanListRow } from "@/lib/loan-adapters";
import type { Customer, Payment, User } from "@/lib/types";

export type ManagerMetricsPayload = {
 metrics?: {
 portfolio?: { outstanding_amount?: number; active_loan_count?: number };
 risk?: { par_amount?: number; par_rate?: number; npl_rate?: number };
 collections?: { amount?: number };
 applications?: {
 submitted?: number;
 under_review?: number;
 approved?: number;
 rejected?: number;
 total?: number;
 };
 };
};

export type ManagerBranchSnapshot = {
 metrics: ManagerMetricsPayload | null;
 customers: Customer[];
 applications: ApplicationViewRow[];
 loans: LoanListRow[];
 payments: Payment[];
 team: User[];
 collectionsToday: number;
};

function branchParams(branchId: string, pageSize = "80"): URLSearchParams {
 const p = new URLSearchParams();
 if (branchId) p.set("branch_id", branchId);
 p.set("page_size", pageSize);
 return p;
}

export type ManagerDashboardEssentials = {
 metrics: ManagerMetricsPayload | null;
 applications: ApplicationViewRow[];
 collectionsToday: number;
};

/** Metrics + application counts first (fast paint). */
export async function loadManagerDashboardEssentials(
 branchId: string
): Promise<ManagerDashboardEssentials> {
 const q = branchParams(branchId, "60");
 const today = new Date().toISOString().slice(0, 10);

 const [metricsRes, appsRes, activitiesRes] = await Promise.all([
 fetch(`/api/falco/dashboard/metrics?branch_id=${encodeURIComponent(branchId)}`, {
 credentials: "include",
 }),
 fetch(`/api/applications?${q.toString()}`, { credentials: "include" }),
 fetch(
 `/api/collections/activities?branch_id=${encodeURIComponent(branchId)}&from=${today}&to=${today}&page_size=50`,
 { credentials: "include" }
 ),
 ]);

 const metrics = metricsRes.ok ? ((await metricsRes.json()) as ManagerMetricsPayload) : null;
 const applications = appsRes.ok ? extractApplicationsList(await appsRes.json()) : [];
 const activities = activitiesRes.ok
 ? extractPaginatedData<Record<string, unknown>>(await activitiesRes.json())
 : [];

 return {
 metrics,
 applications,
 collectionsToday: activities.length,
 };
}

/** Heavier lists loaded after essentials (customers, loans, payments, team). */
export async function loadManagerDashboardDetails(
 branchId: string
): Promise<
 Pick<ManagerBranchSnapshot, "customers" | "loans" | "payments" | "team" | "collectionsToday">
> {
 const q = branchParams(branchId, "80");
 const today = new Date().toISOString().slice(0, 10);

 const [customersRes, loansRes, paymentsRes, teamRes, activitiesRes] = await Promise.all([
 fetch(`/api/customers?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/loans?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/payments?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/staff/directory?${q.toString()}`, { credentials: "include" }),
 fetch(
 `/api/collections/activities?branch_id=${encodeURIComponent(branchId)}&from=${today}&to=${today}&page_size=50`,
 { credentials: "include" }
 ),
 ]);

 const customers = customersRes.ok ? extractCustomersList(await customersRes.json()) : [];
 const loans = loansRes.ok ? extractLoansList(await loansRes.json()) : [];
 const payments = paymentsRes.ok
 ? extractPaymentsPayload(await paymentsRes.json()).payments
 : [];
 const team = teamRes.ok ? extractUsersListPayload(await teamRes.json()).users : [];
 const activities = activitiesRes.ok
 ? extractPaginatedData<Record<string, unknown>>(await activitiesRes.json())
 : [];

 return {
 customers,
 loans,
 payments,
 team,
 collectionsToday: activities.length,
 };
}

export async function loadManagerBranchSnapshot(branchId: string): Promise<ManagerBranchSnapshot> {
 const [essentials, details] = await Promise.all([
 loadManagerDashboardEssentials(branchId),
 loadManagerDashboardDetails(branchId),
 ]);

 return {
 metrics: essentials.metrics,
 applications: essentials.applications,
 collectionsToday: details.collectionsToday || essentials.collectionsToday,
 customers: details.customers,
 loans: details.loans,
 payments: details.payments,
 team: details.team,
 };
}
