import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { customerToFormPayload, mapFormPayloadToCustomerApi } from "@/lib/customer-payload";
import { falcoServerFetch } from "@/lib/server-falco";
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

/** After create, link the customer to their relationship manager (metadata + PATCH). */
export async function patchCustomerLoanOfficerOnServer(
 request: Request,
 customerId: string,
 officerId: string
): Promise<{ ok: true; customer: Customer } | { ok: false; message: string }> {
 const id = customerId.trim();
 const oid = officerId.trim();
 if (!id || !oid) {
 return { ok: false, message: "Customer id and loan officer id are required." };
 }

 const detailRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
 request,
 });
 if (!detailRes.ok) {
 return { ok: false, message: detailRes.error.message };
 }

 const customerRow = customerRowFromApiResponse(detailRes.data);
 if (!customerRow) {
 return { ok: false, message: "Customer not found after create." };
 }

 const patchBody = buildCustomerLoanOfficerPatch(customerRow, oid);
 const patchRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: patchBody,
 request,
 });

 if (!patchRes.ok) {
 return { ok: false, message: patchRes.error.message };
 }

 const updatedRow = customerRowFromApiResponse(patchRes.data) ?? customerRow;
 const customer = adaptApiCustomerRowToCustomer({
 ...updatedRow,
 metadata: {
 ...(typeof updatedRow.metadata === "object" && updatedRow.metadata !== null
 ? (updatedRow.metadata as Record<string, unknown>)
 : {}),
 loan_officer_id: oid,
 assigned_loan_officer_id: oid,
 },
 assigned_loan_officer_id: oid,
 loan_officer_id: oid,
 });

 return { ok: true, customer };
}
