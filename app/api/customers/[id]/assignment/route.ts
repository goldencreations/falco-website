import { NextResponse } from "next/server";
import { mapAppRoleToApiRole } from "@/lib/api-roles";
import { buildCustomerLoanOfficerPatch, customerRowFromApiResponse } from "@/lib/customer-assignment";
import { adaptApiCustomerRowToCustomer } from "@/lib/customer-adapters";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import { fetchStaffUsersForSessionUser } from "@/lib/branch-summary-fallback";
import { falcoServerFetch } from "@/lib/server-falco";

/** Assign primary loan officer (`metadata.loan_officer_id`) via `PATCH /customers/{id}`. */
export async function PATCH(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const { id: customerId } = await context.params;
 const auth = await requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;

 const body = (await request.json()) as { assigned_loan_officer_id?: string };
 const officerId = body.assigned_loan_officer_id?.trim();
 if (!officerId) {
 return NextResponse.json({ error: "assigned_loan_officer_id required" }, { status: 400 });
 }

 const detailRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
 request,
 });
 if (!detailRes.ok) {
 return NextResponse.json(
 { error: detailRes.error.message, details: detailRes.error.details },
 { status: detailRes.error.status }
 );
 }

 const customerRow = customerRowFromApiResponse(detailRes.data);
 if (!customerRow) {
 return NextResponse.json({ error: "Customer not found" }, { status: 404 });
 }

 const branchId = customerRow.branch_id != null ? String(customerRow.branch_id) : "";
 const denied = ensureResourceBranchAllowed(user, branchId || undefined);
 if (denied) return denied;

 const officers = await fetchStaffUsersForSessionUser(user, {
 branchId: branchId || user.branch_id,
 requestedRole: mapAppRoleToApiRole("loan_officer") ?? "loan_officer",
 isActive: "true",
 });

 const officer = officers.find((u) => u.id === officerId);
 if (!officer) {
 return NextResponse.json({ error: "Loan officer not found in your branch" }, { status: 404 });
 }
 if (officer.role !== "loan_officer") {
 return NextResponse.json({ error: "Target must be a loan officer" }, { status: 400 });
 }
 if (user.role === "branch_manager" && officer.branch_id !== user.branch_id) {
 return NextResponse.json({ error: "Officer not in your branch" }, { status: 403 });
 }

 const patchBody = buildCustomerLoanOfficerPatch(customerRow, officerId);
 const patchRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
 method: "PATCH",
 body: patchBody,
 request,
 });

 if (!patchRes.ok) {
 return NextResponse.json(
 { error: patchRes.error.message, details: patchRes.error.details },
 { status: patchRes.error.status }
 );
 }

 const updatedRow = customerRowFromApiResponse(patchRes.data) ?? customerRow;
 const customer = adaptApiCustomerRowToCustomer({
 ...updatedRow,
 metadata: {
 ...(typeof updatedRow.metadata === "object" && updatedRow.metadata !== null
 ? (updatedRow.metadata as Record<string, unknown>)
 : {}),
 loan_officer_id: officerId,
 assigned_loan_officer_id: officerId,
 },
 loan_officer_id: officerId,
 assigned_loan_officer_id: officerId,
 });

 return NextResponse.json({ customer });
}
