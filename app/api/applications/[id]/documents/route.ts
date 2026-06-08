import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { getFalcoApiBaseUrl } from "@/lib/falco-api";
import { falcoServerFetch, resolveFalcoAccessToken } from "@/lib/server-falco";

async function proxyDocumentUpload(
 request: Request,
 applicationId: string,
 init: { method: "POST"; body: FormData | unknown; contentType?: string }
): Promise<Response> {
 const token = await resolveFalcoAccessToken(request);
 if (!token) {
 return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
 }

 const headers: Record<string, string> = {
 Authorization: `Bearer ${token}`,
 Accept: "application/json",
 };
 if (init.contentType) headers["Content-Type"] = init.contentType;

 try {
 const res = await fetch(
 `${getFalcoApiBaseUrl()}/applications/${encodeURIComponent(applicationId)}/documents`,
 {
 method: "POST",
 headers,
 body: init.body as BodyInit,
 cache: "no-store",
 }
 );

 const text = await res.text();
 let data: unknown = null;
 if (text) {
 try {
 data = JSON.parse(text);
 } catch {
 data = { message: text };
 }
 }

 if (!res.ok) {
 const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
 const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
 return NextResponse.json(
 {
 message:
 typeof err.message === "string"
 ? err.message
 : typeof o.message === "string"
 ? o.message
 : "Document upload failed",
 details: err.details ?? o.details,
 },
 { status: res.status }
 );
 }

 return NextResponse.json(data ?? { ok: true });
 } catch (e) {
 const message =
 e instanceof Error && e.message
 ? e.message
 : "Could not reach the document service. Try a smaller file or try again.";
 return NextResponse.json({ message }, { status: 502 });
 }
}

export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, { request });
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

 const contentType = request.headers.get("content-type") ?? "";

 if (contentType.includes("application/json")) {
 let body: unknown;
 try {
 body = await request.json();
 } catch {
 return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}/documents`, {
 method: "POST",
 body,
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data ?? { ok: true });
 }

 const incoming = await request.formData();
 const outbound = new FormData();
 for (const [key, value] of incoming.entries()) {
 if (value instanceof File) outbound.append(key, value, value.name);
 else outbound.append(key, value);
 }

 return proxyDocumentUpload(request, id, { method: "POST", body: outbound });
}
