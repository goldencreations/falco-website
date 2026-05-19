import { NextResponse } from "next/server";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import {
 requireApiUser,
 ensureResourceBranchAllowed,
 isBranchDataScoped,
} from "@/lib/authorization";
import { mapFormPayloadToCustomerApi } from "@/lib/customer-payload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`);
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const row = extractCustomerDetail(res.data);
 if (row) {
 const rid = row.branch_id != null ? String(row.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
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
 const pre = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`);
 if (pre.ok) {
 const row = extractCustomerDetail(pre.data);
 const rid = row?.branch_id != null ? String(row.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const apiBody = mapFormPayloadToCustomerApi(body);
 if (isBranchDataScoped(auth.user)) {
 apiBody.branch_id = auth.user.branch_id;
 }

 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: apiBody,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
