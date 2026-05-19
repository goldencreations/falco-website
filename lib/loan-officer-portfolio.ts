import type { LoanListRow } from "@/lib/loan-adapters";
import type { Customer } from "@/lib/types";

export function assignedCustomerIdSet(customers: Customer[]): Set<string> {
 return new Set(customers.map((c) => String(c.id).trim()).filter(Boolean));
}

/** Loan belongs to officer portfolio if customer is assigned or loan is attributed to the officer. */
export function loanMatchesOfficerPortfolio(
 loan: Pick<LoanListRow, "customer_id" | "loan_officer_id" | "disbursed_by">,
 assignedCustomerIds: Set<string>,
 officerId: string
): boolean {
 const cid = String(loan.customer_id ?? "").trim();
 if (cid && assignedCustomerIds.has(cid)) return true;
 const oid = officerId.trim();
 if (!oid) return false;
 if (String(loan.loan_officer_id ?? "").trim() === oid) return true;
 if (String(loan.disbursed_by ?? "").trim() === oid) return true;
 return false;
}
