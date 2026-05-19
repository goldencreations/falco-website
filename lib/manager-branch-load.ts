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

function branchParams(branchId: string): URLSearchParams {
 const p = new URLSearchParams();
 if (branchId) p.set("branch_id", branchId);
 p.set("page_size", "200");
 return p;
}

export async function loadManagerBranchSnapshot(branchId: string): Promise<ManagerBranchSnapshot> {
 const q = branchParams(branchId);
 const today = new Date().toISOString().slice(0, 10);

 const [metricsRes, customersRes, appsRes, loansRes, paymentsRes, teamRes, activitiesRes] =
 await Promise.all([
 fetch(`/api/falco/dashboard/metrics?branch_id=${encodeURIComponent(branchId)}`, {
 credentials: "include",
 }),
 fetch(`/api/customers?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/applications?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/loans?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/payments?${q.toString()}`, { credentials: "include" }),
 fetch(`/api/staff/directory?${q.toString()}`, { credentials: "include" }),
 fetch(
 `/api/collections/activities?branch_id=${encodeURIComponent(branchId)}&from=${today}&to=${today}&page_size=200`,
 { credentials: "include" }
 ),
 ]);

 const metrics = metricsRes.ok ? ((await metricsRes.json()) as ManagerMetricsPayload) : null;
 const customers = customersRes.ok ? extractCustomersList(await customersRes.json()) : [];
 const applications = appsRes.ok ? extractApplicationsList(await appsRes.json()) : [];
 const loans = loansRes.ok ? extractLoansList(await loansRes.json()) : [];
 const payments = paymentsRes.ok
 ? extractPaymentsPayload(await paymentsRes.json()).payments
 : [];
 const team = teamRes.ok ? extractUsersListPayload(await teamRes.json()).users : [];
 const activities = activitiesRes.ok
 ? extractPaginatedData<Record<string, unknown>>(await activitiesRes.json())
 : [];

 return {
 metrics,
 customers,
 applications,
 loans,
 payments,
 team,
 collectionsToday: activities.length,
 };
}
