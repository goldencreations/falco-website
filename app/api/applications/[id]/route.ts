import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { sanitizeApplicationBodyFromClient } from "@/lib/application-payload";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import type { SessionUser } from "@/lib/auth";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 });
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const row = extractApplicationDetail(res.data);
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

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 });
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

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 method: "PATCH",
 body: sanitizeApplicationBodyFromClient(body),
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}

function canDeleteOnServer(
 user: SessionUser,
 app: { status?: string; branch_id?: string | null; created_by?: string | null }
): boolean {
 const status = String(app.status ?? "");
 if (status === "disbursed") return false;
 if (user.role === "super_admin") return true;
 if (user.role === "branch_manager") {
 return [
 "draft",
 "submitted",
 "under_review",
 "approved",
 "rejected",
 "cancelled",
 "pending_disbursement",
 ].includes(status);
 }
 if (user.role === "loan_officer") {
 return status === "draft" && String(app.created_by ?? "") === String(user.id);
 }
 return user.permissions.includes("applications.manage");
}

export async function DELETE(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 });
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

 if (!canDeleteOnServer(auth.user, row)) {
 return NextResponse.json(
 { message: "You are not allowed to delete this application in its current status." },
 { status: 403 }
 );
 }
 }

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 method: "DELETE",
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json({ ok: true, deleted: true, id });
}
