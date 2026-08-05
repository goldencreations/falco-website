import { NextResponse } from "next/server";
import { adaptApiDisbursementRow } from "@/lib/disbursement-adapters";
import { enrichDisbursementRowsWithUserNames } from "@/lib/disbursement-enrichment";
import { canApproveDisbursement } from "@/lib/disbursement-permissions";
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

 if (!canApproveDisbursement(auth.user)) {
 return NextResponse.json(
 { error: "You do not have permission to approve or complete disbursements." },
 { status: 403 }
 );
 }

 const forward: Record<string, unknown> = { action };
 if (action === "reject" && body.rejection_reason != null) forward.rejection_reason = body.rejection_reason;
 if (action === "approve" && body.transaction_reference != null) {
  // Optional staff note for cash only — never treat as ClickPesa order_reference.
  forward.transaction_reference = body.transaction_reference;
 }
 // order_reference is backend-owned; never accept client-supplied values.
 delete forward.order_reference;

 if (action === "complete") {
  const preRow = pre.ok ? adaptApiDisbursementRow(pre.data as Record<string, unknown>) : null;
  const isGateway =
   Boolean(preRow?.gateway) ||
   ["mpesa", "airtel_money", "yas", "halopesa", "crdb", "nmb"].includes(preRow?.method ?? "");
  if (isGateway || preRow?.status === "processing") {
   return NextResponse.json(
    {
     error:
      "ClickPesa disbursements cannot be completed manually. Wait for gateway confirmation or reconciliation.",
    },
    { status: 422 }
   );
  }
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

 const data = res.data;
 if (data && typeof data === "object") {
 const o = data as Record<string, unknown>;
 const row = o.disbursement && typeof o.disbursement === "object" ? o.disbursement : data;
 const adapted = adaptApiDisbursementRow(row as Record<string, unknown>);
 const [enriched] = await enrichDisbursementRowsWithUserNames([adapted]);
 return NextResponse.json({ disbursement: enriched });
 }
 return NextResponse.json(res.data);
}
