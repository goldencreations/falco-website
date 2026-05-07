import {
 collectionActivities,
 customers,
 loanApplications,
 loans,
 payments,
 users,
} from "@/lib/mock-data";

export function getBranchCustomers(branchId: string) {
 return customers.filter((item) => item.branch_id === branchId);
}

export function getBranchApplications(branchId: string) {
 return loanApplications.filter((item) => item.branch_id === branchId);
}

export function getBranchLoans(branchId: string) {
 return loans.filter((item) => item.branch_id === branchId);
}

export function getBranchPayments(branchId: string) {
 const branchLoanIds = new Set(getBranchLoans(branchId).map((item) => item.id));
 return payments.filter((item) => branchLoanIds.has(item.loan_id));
}

export function getBranchCollections(branchId: string) {
 const branchLoanIds = new Set(getBranchLoans(branchId).map((item) => item.id));
 return collectionActivities.filter((item) => branchLoanIds.has(item.loan_id));
}

export function getBranchTeam(branchId: string) {
 return users.filter((item) => item.branch_id === branchId && item.is_active);
}
