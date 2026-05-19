import { extractCustomerDetail } from "@/lib/customer-adapters";
import type { DisbursementViewRow } from "@/lib/disbursement-adapters";
import { extractLoanDetail } from "@/lib/loan-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

function displayNameFromCustomerRow(c: Record<string, unknown>): string {
 const full = String(c.full_name ?? "").trim();
 const fn = String(c.first_name ?? "").trim();
 const ln = String(c.last_name ?? "").trim();
 return full || `${fn} ${ln}`.trim();
}

/** Fill missing `customer_display_name` / `loan_number` via loan + customer API lookups. */
export async function enrichDisbursementRowsWithCustomerNames(
 rows: DisbursementViewRow[]
): Promise<DisbursementViewRow[]> {
 const result = rows.map((r) => ({ ...r }));
 const missing = result.filter((r) => !r.customer_display_name?.trim() && r.loan_id);
 if (missing.length === 0) return result;

 const loanIdToCustomerId = new Map<string, string>();
 const customerIdToName = new Map<string, string>();
 const loanIdToLoanNumber = new Map<string, string>();

 const uniqueLoanIds = [...new Set(missing.map((r) => r.loan_id))].slice(0, 50);

 await Promise.all(
 uniqueLoanIds.map(async (loanId) => {
 const res = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(loanId)}`);
 if (!res.ok) return;
 const loan = extractLoanDetail(res.data);
 if (loan?.loan_number) loanIdToLoanNumber.set(loanId, loan.loan_number);
 const cid = loan?.customer_id?.trim();
 if (cid) loanIdToCustomerId.set(loanId, cid);
 })
 );

 const uniqueCustomerIds = [...new Set(loanIdToCustomerId.values())].slice(0, 50);

 await Promise.all(
 uniqueCustomerIds.map(async (customerId) => {
 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`);
 if (!res.ok) return;
 const row = extractCustomerDetail(res.data);
 if (!row) return;
 const name = displayNameFromCustomerRow(row);
 if (name) customerIdToName.set(customerId, name);
 })
 );

 return result.map((r) => {
 const cid = loanIdToCustomerId.get(r.loan_id);
 const name = cid ? customerIdToName.get(cid) : undefined;
 const loanNumber = r.loan_number ?? loanIdToLoanNumber.get(r.loan_id);
 if (!name && !loanNumber) return r;
 return {
 ...r,
 customer_display_name: r.customer_display_name?.trim() || name || r.customer_display_name,
 loan_number: loanNumber ?? r.loan_number,
 };
 });
}
