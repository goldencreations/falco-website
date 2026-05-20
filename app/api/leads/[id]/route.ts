import { NextResponse } from "next/server";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 const res = await falcoServerFetch<unknown>(`/leads/${encodeURIComponent(id)}`, { request });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
 { status: res.error.status }
 );
 }

 const lead =
 res.data && typeof res.data === "object"
 ? ((res.data as Record<string, unknown>).lead as Record<string, unknown> | undefined)
 : undefined;
 const denied = ensureResourceBranchAllowed(
 auth.user,
 lead?.branch_id != null ? String(lead.branch_id) : undefined
 );
 if (denied) return denied;

 return NextResponse.json(res.data);
}

export async function PATCH(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON", error: "Invalid JSON" }, { status: 400 });
 }

 const pre = await falcoServerFetch<unknown>(`/leads/${encodeURIComponent(id)}`, { request });
 if (pre.ok && pre.data && typeof pre.data === "object") {
 const lead = (pre.data as Record<string, unknown>).lead as Record<string, unknown> | undefined;
 const denied = ensureResourceBranchAllowed(
 auth.user,
 lead?.branch_id != null ? String(lead.branch_id) : undefined
 );
 if (denied) return denied;
 }

 const res = await falcoServerFetch<unknown>(`/leads/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body,
 request,
 });

 if (!res.ok) {
 const msg = formatFalcoApiError(res.error);
 return NextResponse.json(
 { message: msg, error: msg, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}
