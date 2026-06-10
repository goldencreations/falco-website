import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { sanitizeApplicationBodyFromClient } from "@/lib/application-payload";
import {
  debugApplicationCreate,
  debugApplicationDetail,
  summarizeApplicationBody,
  summarizeApplicationDetailRow,
} from "@/lib/application-debug";
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

 debugApplicationDetail("GET /api/applications/:id — request", {
  application_id: id,
  user_id: auth.user.id,
  role: auth.user.role,
 });

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 });
 if (!res.ok) {
 debugApplicationDetail("GET /api/applications/:id — backend error", {
  application_id: id,
  status: res.error.status,
  message: res.error.message,
  details: res.error.details,
 });
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const row = extractApplicationDetail(res.data);
 if (row) {
 debugApplicationDetail("GET /api/applications/:id — success", {
  application_id: id,
  summary: summarizeApplicationDetailRow(row),
 });
 const rid = row.branch_id != null ? String(row.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) {
 debugApplicationDetail("GET /api/applications/:id — branch denied", {
  application_id: id,
  branch_id: rid,
 });
 return denied;
 }
 } else {
 debugApplicationDetail("GET /api/applications/:id — no detail row parsed", {
  application_id: id,
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

 const sanitized = sanitizeApplicationBodyFromClient(body);
 debugApplicationCreate("PATCH /api/applications/:id — request", {
  application_id: id,
  user_id: auth.user.id,
  role: auth.user.role,
  body: summarizeApplicationBody(body),
  sanitized: summarizeApplicationBody(sanitized),
 });

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, {
 request,
 method: "PATCH",
 body: sanitized,
 });

 if (!res.ok) {
 debugApplicationCreate("PATCH /api/applications/:id — backend error", {
  application_id: id,
  status: res.error.status,
  message: res.error.message,
  details: res.error.details,
 });
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 debugApplicationCreate("PATCH /api/applications/:id — success", { application_id: id });
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
