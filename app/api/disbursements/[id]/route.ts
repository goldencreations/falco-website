import { NextResponse } from "next/server";
import { adaptApiDisbursementRow } from "@/lib/disbursement-adapters";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

function loanIdFromDisbursementPayload(data: unknown): string | undefined {
 if (!data || typeof data !== "object") return undefined;
 const o = data as Record<string, unknown>;
 const d = o.disbursement && typeof o.disbursement === "object" ? (o.disbursement as Record<string, unknown>) : o;
 const lid = d.loan_id ?? d.loanId;
 return lid != null ? String(lid) : undefined;
}

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const res = await falcoServerFetch<unknown>(`/disbursements/${encodeURIComponent(id)}`);
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const loanId = loanIdFromDisbursementPayload(res.data);
 if (loanId) {
 const pre = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(loanId)}`);
 if (pre.ok) {
 const row = pre.data && typeof pre.data === "object" ? (pre.data as Record<string, unknown>) : null;
 const inner = row?.loan && typeof row.loan === "object" ? (row.loan as Record<string, unknown>) : row;
 const rid = inner?.branch_id != null ? String(inner.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }
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

 const pre = await falcoServerFetch<unknown>(`/disbursements/${encodeURIComponent(id)}`);
 if (pre.ok) {
 const loanId = loanIdFromDisbursementPayload(pre.data);
 if (loanId) {
 const lr = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(loanId)}`);
 if (lr.ok) {
 const row = lr.data && typeof lr.data === "object" ? (lr.data as Record<string, unknown>) : null;
 const inner = row?.loan && typeof row.loan === "object" ? (row.loan as Record<string, unknown>) : row;
 const rid = inner?.branch_id != null ? String(inner.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }
 }
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
 }

 const action = String(body.action ?? "");
 if (!["approve", "reject", "complete"].includes(action)) {
 return NextResponse.json({ error: "action must be approve, reject, or complete" }, { status: 400 });
 }

 const forward: Record<string, unknown> = { action };
 if (action === "reject" && body.rejection_reason != null) forward.rejection_reason = body.rejection_reason;
 if (action === "complete") {
 if (body.transaction_reference != null) forward.transaction_reference = body.transaction_reference;
 if (body.disbursed_at != null) forward.disbursed_at = body.disbursed_at;
 }

 const res = await falcoServerFetch<unknown>(`/disbursements/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: forward,
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 /** On approval, complete disbursement so the loan becomes `active` (per disbursements-controller.md). */
 if (action === "approve") {
 const loanId =
 loanIdFromDisbursementPayload(res.data) ??
 (pre.ok ? loanIdFromDisbursementPayload(pre.data) : undefined);
 const completeBody: Record<string, unknown> = {
 action: "complete",
 disbursed_at: new Date().toISOString().slice(0, 10),
 };
 if (body.transaction_reference != null) {
 completeBody.transaction_reference = body.transaction_reference;
 }
 const completeRes = await falcoServerFetch<unknown>(
 `/disbursements/${encodeURIComponent(id)}`,
 { method: "PATCH", body: completeBody }
 );
 if (completeRes.ok) {
 const data = completeRes.data;
 if (data && typeof data === "object") {
 const o = data as Record<string, unknown>;
 const row = o.disbursement && typeof o.disbursement === "object" ? o.disbursement : data;
 return NextResponse.json({
 disbursement: adaptApiDisbursementRow(row as Record<string, unknown>),
 loan_activated: true,
 loan_id: loanId,
 });
 }
 return NextResponse.json(completeRes.data);
 }
 }

 const data = res.data;
 if (data && typeof data === "object") {
 const o = data as Record<string, unknown>;
 const row = o.disbursement && typeof o.disbursement === "object" ? o.disbursement : data;
 return NextResponse.json({ disbursement: adaptApiDisbursementRow(row as Record<string, unknown>) });
 }
 return NextResponse.json(res.data);
}
