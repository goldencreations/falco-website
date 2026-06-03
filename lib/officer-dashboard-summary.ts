import type { ApplicationViewRow } from "@/lib/application-adapters";
import { extractApplicationsList } from "@/lib/application-adapters";
import {
 isApprovedApplicationStatus,
 isPendingApplicationStatus,
} from "@/lib/application-status";
import type { LoanListRow } from "@/lib/loan-adapters";
import { extractLoansList } from "@/lib/loan-adapters";
import type { ManagerMetricsPayload } from "@/lib/manager-branch-load";
import { assignedCustomerIdSet, loanMatchesOfficerPortfolio } from "@/lib/loan-officer-portfolio";
import type { Customer } from "@/lib/types";

export type ApplicationCountBucket = { pending: number; approved: number; total: number };

export function applicationCountsFromList(applications: ApplicationViewRow[]): ApplicationCountBucket {
 return {
 pending: applications.filter((a) => isPendingApplicationStatus(a.status)).length,
 approved: applications.filter((a) => isApprovedApplicationStatus(a.status)).length,
 total: applications.length,
 };
}

/** All applications in the officer's branch (same scope as `/officer/applications`). */
export function applicationCountsForBranch(
 applications: ApplicationViewRow[],
 branchId: string
): ApplicationCountBucket {
 const bid = branchId.trim();
 if (!bid) return { pending: 0, approved: 0, total: 0 };
 return applicationCountsFromList(
 applications.filter((app) => String(app.branch_id ?? "").trim() === bid)
 );
}

/** Applications tied to this officer's portfolio (customers they serve or apps they created). */
export function applicationBelongsToOfficerPortfolio(
 app: ApplicationViewRow,
 officerId: string,
 assignedCustomerIds: Set<string>
): boolean {
 const oid = officerId.trim();
 if (!oid) return false;

 const created = String(app.created_by ?? "").trim();
 const assigned = String(app.assigned_officer_id ?? "").trim();
 const customerOfficer = String(app.customer_loan_officer_id ?? "").trim();
 if (created === oid || assigned === oid || customerOfficer === oid) return true;

 const customerId = String(app.customer_id ?? "").trim();
 return Boolean(customerId && assignedCustomerIds.has(customerId));
}

export function applicationCountsForOfficerPortfolio(
 applications: ApplicationViewRow[],
 officerId: string,
 assignedCustomers: Customer[]
): ApplicationCountBucket {
 const assignedIds = assignedCustomerIdSet(assignedCustomers);
 const mine = applications.filter((app) =>
 applicationBelongsToOfficerPortfolio(app, officerId, assignedIds)
 );
 return applicationCountsFromList(mine);
}

export function portfolioMetricsFromOfficerLoans(
 loans: LoanListRow[],
 assignedCustomers: Customer[],
 officerId: string
): {
 outstanding: number;
 activeLoanCount: number;
 parAmount: number;
 collected: number;
} {
 const assignedIds = assignedCustomerIdSet(assignedCustomers);
 const mine = loans.filter((loan) =>
 loanMatchesOfficerPortfolio(loan, assignedIds, officerId)
 );

 let outstanding = 0;
 let parAmount = 0;
 let activeLoanCount = 0;

 for (const loan of mine) {
 const totalOut = Number(loan.total_outstanding ?? 0);
 if (Number.isFinite(totalOut) && totalOut > 0) outstanding += totalOut;

 if (loan.status === "active") activeLoanCount += 1;

 const arrears = Number(loan.days_in_arrears ?? 0);
 if (arrears > 0 && Number.isFinite(totalOut) && totalOut > 0) {
 parAmount += totalOut;
 }
 }

 return { outstanding, activeLoanCount, parAmount, collected: 0 };
}

/** Prefer branch dashboard metrics; fill gaps from officer loan portfolio. */
export function mergeOfficerDashboardMetrics(
 branchMetrics: ManagerMetricsPayload | null,
 loanFallback: ReturnType<typeof portfolioMetricsFromOfficerLoans>
): ManagerMetricsPayload {
 const m = branchMetrics?.metrics ?? {};
 const portfolio = m.portfolio ?? {};
 const risk = m.risk ?? {};
 const collections = m.collections ?? {};

 const outstanding = Number(portfolio.outstanding_amount ?? 0);
 const activeLoans = Number(portfolio.active_loan_count ?? 0);
 const par = Number(risk.par_amount ?? 0);

 return {
 metrics: {
 portfolio: {
 outstanding_amount:
 outstanding > 0 ? outstanding : loanFallback.outstanding,
 active_loan_count: activeLoans > 0 ? activeLoans : loanFallback.activeLoanCount,
 },
 risk: {
 par_amount: par > 0 ? par : loanFallback.parAmount,
 par_rate: risk.par_rate,
 npl_rate: risk.npl_rate,
 },
 collections: {
 amount: Number(collections.amount ?? 0),
 },
 applications: m.applications,
 },
 };
}

export function appCountsFromBranchMetrics(metrics: ManagerMetricsPayload | null): ApplicationCountBucket {
 const m = metrics?.metrics?.applications;
 return {
 pending: Number(m?.submitted ?? 0) + Number(m?.under_review ?? 0),
 approved: Number(m?.approved ?? 0),
 total: Number(m?.total ?? 0),
 };
}

export { extractApplicationsList, extractLoansList };
