import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import type { Customer } from "@/lib/types";

function customerNeedsDetailEnrichment(c: Customer): boolean {
 const missingOfficer = !String(c.assigned_loan_officer_id ?? "").trim();
 const missingIncome = !c.monthly_income || c.monthly_income <= 0;
 return missingOfficer || missingIncome;
}

/**
 * List endpoints often omit `monthly_income` and `metadata.loan_officer_id`.
 * Fetch detail for those rows so lists show registration income and assignments.
 */
export async function enrichCustomersWithLoanOfficerDetails(
 customers: Customer[],
 fetchDetail: (customerId: string) => Promise<Record<string, unknown> | null>
): Promise<Customer[]> {
 const missing = customers.filter(customerNeedsDetailEnrichment);
 if (missing.length === 0) return customers;

 const byId = new Map(customers.map((c) => [c.id, { ...c }]));
 const CHUNK = 12;

 for (let i = 0; i < missing.length; i += CHUNK) {
 const chunk = missing.slice(i, i + CHUNK);
 await Promise.all(
 chunk.map(async (c) => {
 const row = await fetchDetail(c.id);
 if (!row) return;
 const enriched = adaptApiCustomerRowToCustomer(row);
 const prev = byId.get(c.id);
 if (!prev) return;
 byId.set(c.id, {
 ...prev,
 monthly_income:
 enriched.monthly_income > 0 ? enriched.monthly_income : prev.monthly_income,
 other_income: enriched.other_income ?? prev.other_income,
 income_verified: enriched.income_verified || prev.income_verified,
 assigned_loan_officer_id: enriched.assigned_loan_officer_id ?? prev.assigned_loan_officer_id,
 created_by: enriched.created_by || prev.created_by,
 });
 })
 );
 }

 return Array.from(byId.values());
}

export { extractCustomerDetail };
