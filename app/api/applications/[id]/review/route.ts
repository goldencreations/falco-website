import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { formatFalcoApiError } from "@/lib/falco-api";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
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
 {
 message: formatFalcoApiError(pre.error),
 details: pre.error.details,
 code: pre.error.code,
 },
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

 if (body.decision === "approve") {
 const amount = Number(body.approved_amount);
 if (!Number.isFinite(amount) || amount <= 0) {
 return NextResponse.json(
 {
 message: "approved_amount must be a positive number when decision is approve.",
 details: [{ field: "approved_amount", message: "Enter a valid approved amount." }],
 },
 { status: 400 }
 );
 }
 body.approved_amount = amount;
 }

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}/review`, {
 method: "POST",
 body,
 });

 if (!res.ok) {
 return NextResponse.json(
 {
 message: formatFalcoApiError(res.error),
 details: res.error.details,
 code: res.error.code,
 },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
