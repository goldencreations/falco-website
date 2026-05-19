import { extractCustomersList } from "@/lib/customer-adapters";
import {
 enrichCustomersWithLoanOfficerDetails,
 extractCustomerDetail,
} from "@/lib/customer-enrichment";
import { falcoServerFetch } from "@/lib/server-falco";
import type { Customer } from "@/lib/types";

/** Load branch customers and enrich missing relationship-manager fields from detail API. */
export async function loadBranchCustomersEnriched(
 request: Request,
 branchId: string,
 options?: { pageSize?: string; isActive?: string }
): Promise<Customer[]> {
 const res = await falcoServerFetch<unknown>("/customers", {
 request,
 query: {
 branch_id: branchId,
 is_active: options?.isActive ?? "true",
 page: "1",
 page_size: options?.pageSize ?? "100",
 },
 });

 if (!res.ok) return [];

 let customers = extractCustomersList(res.data);
 customers = await enrichCustomersWithLoanOfficerDetails(customers, async (customerId) => {
 const detailRes = await falcoServerFetch<unknown>(
 `/customers/${encodeURIComponent(customerId)}`,
 { request }
 );
 if (!detailRes.ok) return null;
 return extractCustomerDetail(detailRes.data);
 });

 return customers;
}

/** Customers assigned to this loan officer (RM) or created by them. */
export function filterCustomersForLoanOfficer(customers: Customer[], officerId: string): Customer[] {
 const oid = officerId.trim();
 if (!oid) return [];
 return customers.filter((c) => {
 const rm = String(c.assigned_loan_officer_id ?? "").trim();
 const creator = String(c.created_by ?? "").trim();
 return rm === oid || creator === oid;
 });
}
