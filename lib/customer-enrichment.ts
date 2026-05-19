import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import type { Customer } from "@/lib/types";

/**
 * List endpoints often omit `metadata.loan_officer_id`. Fetch detail for customers
 * missing an assigned RM so team dashboards and assignment UI stay accurate.
 */
export async function enrichCustomersWithLoanOfficerDetails(
 customers: Customer[],
 fetchDetail: (customerId: string) => Promise<Record<string, unknown> | null>
): Promise<Customer[]> {
 const missing = customers.filter((c) => !String(c.assigned_loan_officer_id ?? "").trim());
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
 assigned_loan_officer_id: enriched.assigned_loan_officer_id ?? prev.assigned_loan_officer_id,
 created_by: enriched.created_by || prev.created_by,
 });
 })
 );
 }

 return Array.from(byId.values());
}

export { extractCustomerDetail };
