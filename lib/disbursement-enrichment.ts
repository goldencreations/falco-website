import { extractCustomerDetail } from "@/lib/customer-adapters";
import type { DisbursementViewRow } from "@/lib/disbursement-adapters";
import { extractLoanDetail } from "@/lib/loan-adapters";
import { adaptApiUserToUser } from "@/lib/user-adapters";
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

function needsStaffNameLookup(label: string | undefined, userId: string | undefined): boolean {
 if (!userId?.trim()) return false;
 const name = label?.trim() ?? "";
 if (!name) return true;
 if (name === userId) return true;
 if (/^\d+$/.test(name)) return true;
 return false;
}

/** Fill missing `prepared_by_name` / `approved_by_name` / `rejected_by_name` via `/users/{id}`. */
export async function enrichDisbursementRowsWithUserNames(
 rows: DisbursementViewRow[]
): Promise<DisbursementViewRow[]> {
 const result = rows.map((r) => ({ ...r }));
 const ids = new Set<string>();

 for (const r of result) {
 if (needsStaffNameLookup(r.prepared_by_name, r.prepared_by)) ids.add(r.prepared_by);
 if (r.approved_by && needsStaffNameLookup(r.approved_by_name, r.approved_by)) ids.add(r.approved_by);
 if (r.rejected_by && needsStaffNameLookup(r.rejected_by_name, r.rejected_by)) ids.add(r.rejected_by);
 }

 if (ids.size === 0) return result;

 const idToName = new Map<string, string>();
 await Promise.all(
 [...ids].slice(0, 50).map(async (userId) => {
 const res = await falcoServerFetch<unknown>(`/users/${encodeURIComponent(userId)}`);
 if (!res.ok) return;
 const raw =
 res.data && typeof res.data === "object"
 ? ((res.data as Record<string, unknown>).user ?? res.data)
 : null;
 if (!raw || typeof raw !== "object") return;
 const user = adaptApiUserToUser(raw as Record<string, unknown>);
 const name = user.full_name?.trim();
 if (name) idToName.set(userId, name);
 })
 );

 return result.map((r) => ({
 ...r,
 prepared_by_name:
 r.prepared_by_name?.trim() && !needsStaffNameLookup(r.prepared_by_name, r.prepared_by)
 ? r.prepared_by_name
 : idToName.get(r.prepared_by) ?? r.prepared_by_name,
 approved_by_name:
 r.approved_by && r.approved_by_name?.trim() && !needsStaffNameLookup(r.approved_by_name, r.approved_by)
 ? r.approved_by_name
 : r.approved_by
 ? idToName.get(r.approved_by) ?? r.approved_by_name
 : r.approved_by_name,
 rejected_by_name:
 r.rejected_by && r.rejected_by_name?.trim() && !needsStaffNameLookup(r.rejected_by_name, r.rejected_by)
 ? r.rejected_by_name
 : r.rejected_by
 ? idToName.get(r.rejected_by) ?? r.rejected_by_name
 : r.rejected_by_name,
 }));
}
