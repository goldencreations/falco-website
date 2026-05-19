import { extractCustomerDetail } from "@/lib/customer-adapters";
import { extractLoansList } from "@/lib/loan-adapters";
import type { PaymentViewRow } from "@/lib/payment-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

function displayNameFromCustomerRow(c: Record<string, unknown>): string {
 const full = String(c.full_name ?? "").trim();
 const fn = String(c.first_name ?? "").trim();
 const ln = String(c.last_name ?? "").trim();
 return full || `${fn} ${ln}`.trim();
}

/** Attach loan numbers and customer names to payment rows for the payments table. */
export async function enrichPaymentRowsWithContext(
 rows: PaymentViewRow[]
): Promise<PaymentViewRow[]> {
 const result = rows.map((r) => ({ ...r }));
 const loanIds = [...new Set(result.map((r) => r.loan_id).filter(Boolean))];
 if (loanIds.length === 0) return result;

 const loanById = new Map<string, { loan_number: string; customer_id: string }>();

 for (let page = 1; page <= 5; page++) {
 const res = await falcoServerFetch<unknown>("/loans", {
 query: { page: String(page), page_size: "100" },
 });
 if (!res.ok) break;
 for (const loan of extractLoansList(res.data)) {
 if (!loan.id) continue;
 loanById.set(loan.id, {
 loan_number: loan.loan_number,
 customer_id: loan.customer_id,
 });
 }
 const raw = res.data as Record<string, unknown>;
 const batch = Array.isArray(raw?.data) ? raw.data.length : 0;
 if (batch < 100) break;
 }

 const customerIds = [
 ...new Set(
 result
 .map((r) => {
 if (r.customer_display_name?.trim()) return null;
 const loan = loanById.get(r.loan_id);
 return loan?.customer_id ?? r.customer_id;
 })
 .filter((id): id is string => Boolean(id))
 ),
 ].slice(0, 50);

 const customerNames = new Map<string, { name: string; phone?: string }>();
 await Promise.all(
 customerIds.map(async (customerId) => {
 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`);
 if (!res.ok) return;
 const row = extractCustomerDetail(res.data);
 if (!row) return;
 const name = displayNameFromCustomerRow(row);
 if (name) {
 customerNames.set(customerId, {
 name,
 phone: String(row.phone_number ?? row.phone_primary ?? ""),
 });
 }
 })
 );

 return result.map((r) => {
 const loan = loanById.get(r.loan_id);
 const cid = loan?.customer_id ?? r.customer_id;
 const cust = cid ? customerNames.get(cid) : undefined;
 return {
 ...r,
 loan_number: r.loan_number ?? loan?.loan_number,
 customer_display_name: r.customer_display_name?.trim() || cust?.name || r.customer_display_name,
 customer_phone: r.customer_phone ?? cust?.phone,
 };
 });
}
