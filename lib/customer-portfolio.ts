import { extractCustomersList } from "@/lib/customer-adapters";
import { extractCustomersListMeta, sortCustomersNewestFirst } from "@/lib/customer-list-fetch";
import {
 enrichCustomersWithLoanOfficerDetails,
 extractCustomerDetail,
} from "@/lib/customer-enrichment";
import { falcoServerFetch } from "@/lib/server-falco";
import type { Customer } from "@/lib/types";

const MAX_PAGES = 50;

/** Load branch customers and enrich missing relationship-manager fields from detail API. */
export async function loadBranchCustomersEnriched(
 request: Request,
 branchId: string,
 options?: { pageSize?: string; isActive?: string }
): Promise<Customer[]> {
 const pageSize = options?.pageSize ?? "100";
 const byId = new Map<string, Customer>();
 let page = 1;
 let total: number | null = null;

 while (page <= MAX_PAGES) {
  const res = await falcoServerFetch<unknown>("/customers", {
   request,
   query: {
    branch_id: branchId,
    is_active: options?.isActive ?? "true",
    page: String(page),
    page_size: pageSize,
   },
  });

  if (!res.ok) {
   if (page === 1) return [];
   break;
  }

  const batch = extractCustomersList(res.data);
  for (const customer of batch) {
   if (customer?.id) byId.set(String(customer.id), customer);
  }

  const meta = extractCustomersListMeta(res.data);
  total = meta.total;
  if (batch.length < Number(pageSize) || (total != null && byId.size >= total)) break;
  page += 1;
 }

 let customers = sortCustomersNewestFirst([...byId.values()]);
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
