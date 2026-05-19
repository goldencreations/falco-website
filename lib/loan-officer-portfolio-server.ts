import type { LoanListRow } from "@/lib/loan-adapters";
import {
 filterCustomersForLoanOfficer,
 loadBranchCustomersEnriched,
} from "@/lib/customer-portfolio";
import {
 assignedCustomerIdSet,
 loanMatchesOfficerPortfolio,
} from "@/lib/loan-officer-portfolio";
import type { Customer } from "@/lib/types";

/** Branch customers assigned to this loan officer (RM) or created by them. */
export async function loadAssignedCustomersForOfficer(
 request: Request,
 branchId: string,
 officerId: string
): Promise<Customer[]> {
 const customers = await loadBranchCustomersEnriched(request, branchId, { pageSize: "500" });
 return filterCustomersForLoanOfficer(customers, officerId);
}

export async function filterLoansForLoanOfficer(
 loans: LoanListRow[],
 request: Request,
 branchId: string,
 officerId: string
): Promise<LoanListRow[]> {
 const assigned = await loadAssignedCustomersForOfficer(request, branchId, officerId);
 const ids = assignedCustomerIdSet(assigned);
 return loans.filter((loan) => loanMatchesOfficerPortfolio(loan, ids, officerId));
}

export async function ensureLoanInOfficerPortfolio(
 loan: Pick<LoanListRow, "customer_id" | "loan_officer_id" | "disbursed_by" | "branch_id">,
 request: Request,
 user: { id: string; branch_id: string; role: string }
): Promise<{ allowed: true } | { allowed: false; message: string }> {
 if (user.role !== "loan_officer") return { allowed: true };

 const branchId = user.branch_id?.trim();
 if (!branchId) {
 return { allowed: false, message: "Your account is not linked to a branch." };
 }
 if (String(loan.branch_id ?? "").trim() !== branchId) {
 return { allowed: false, message: "This loan is outside your branch." };
 }

 const assigned = await loadAssignedCustomersForOfficer(request, branchId, user.id);
 const ids = assignedCustomerIdSet(assigned);
 if (loanMatchesOfficerPortfolio(loan, ids, user.id)) {
 return { allowed: true };
 }
 return {
 allowed: false,
 message: "This loan is not linked to a customer assigned to you.",
 };
}
