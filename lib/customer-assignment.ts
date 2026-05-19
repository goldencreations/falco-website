import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { customerToFormPayload, mapFormPayloadToCustomerApi } from "@/lib/customer-payload";
import type { Customer } from "@/lib/types";

/** Build a full customer PATCH body that updates the relationship manager in metadata. */
export function buildCustomerLoanOfficerPatch(
 customerRow: Record<string, unknown>,
 loanOfficerId: string
): Record<string, unknown> {
 const customer = adaptApiCustomerRowToCustomer(customerRow);
 customer.assigned_loan_officer_id = loanOfficerId;
 const form = customerToFormPayload(customer, customerRow);
 return mapFormPayloadToCustomerApi(form);
}

export function customerRowFromApiResponse(data: unknown): Record<string, unknown> | null {
 return extractCustomerDetail(data);
}

export function customerFromRow(data: unknown): Customer | null {
 const row = customerRowFromApiResponse(data);
 if (!row) return null;
 return adaptApiCustomerRowToCustomer(row);
}
