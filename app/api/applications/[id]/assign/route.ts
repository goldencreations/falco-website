import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

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
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`);
 if (!pre.ok) {
 return NextResponse.json(
 { message: pre.error.message, details: pre.error.details },
 { status: pre.error.status }
 );
 }
 const row = extractApplicationDetail(pre.data);
 if (row) {
 const denied = ensureResourceBranchAllowed(
 auth.user,
 row.branch_id != null ? String(row.branch_id) : undefined
 );
 if (denied) return denied;
 }

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}/assign`, {
 method: "PATCH",
 body,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
