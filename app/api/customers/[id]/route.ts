import { NextResponse } from "next/server";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import {
 requireApiUser,
 ensureResourceBranchAllowed,
 isBranchDataScoped,
} from "@/lib/authorization";
import { debugCustomerDetail, summarizeCustomerDetailRow } from "@/lib/customer-debug";
import { mapFormPayloadToCustomerApi } from "@/lib/customer-payload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 debugCustomerDetail("GET /api/customers/:id — request", {
  customer_id: id,
  user_id: auth.user.id,
  role: auth.user.role,
 });

 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
  request,
 });
 if (!res.ok) {
 debugCustomerDetail("GET /api/customers/:id — backend error", {
  customer_id: id,
  status: res.error.status,
  message: res.error.message,
 });
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const row = extractCustomerDetail(res.data);
 if (row) {
 debugCustomerDetail("GET /api/customers/:id — success", {
  customer_id: id,
  summary: summarizeCustomerDetailRow(row),
 });
 const rid = row.branch_id != null ? String(row.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 } else {
 debugCustomerDetail("GET /api/customers/:id — no detail row parsed", {
  customer_id: id,
  response_keys: res.data && typeof res.data === "object" ? Object.keys(res.data as object) : [],
 });
 }
 return NextResponse.json(res.data);
}

export async function PATCH(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 if (isBranchDataScoped(auth.user)) {
 const pre = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
  request,
 });
 if (!pre.ok) {
  return NextResponse.json(
   { message: pre.error.message, details: pre.error.details },
   { status: pre.error.status }
  );
 }
 const row = extractCustomerDetail(pre.data);
 const rid = row?.branch_id != null ? String(row.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const apiBody = mapFormPayloadToCustomerApi(body);
 // Branch-scoped updates must not send branch_id — backend rejects cross-branch
 // body values and the customer record branch is already validated above.
 if (isBranchDataScoped(auth.user)) {
 delete apiBody.branch_id;
 }

 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: apiBody,
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}

/**
 * Only Admin/Super admin can call `DELETE /customers/{id}`. The backend returns 204 only for
 * customers without loan-application or group-membership history; otherwise it returns 409 and
 * the UI must offer Deactivate instead (see `/deactivate` route).
 */
export async function DELETE(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request, ["super_admin"]);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;
 if (!id?.trim()) {
 return NextResponse.json({ message: "Customer id is required" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
 method: "DELETE",
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return new NextResponse(null, { status: 204 });
}
