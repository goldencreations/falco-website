import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { uploadCreditAnalysisAttachment } from "@/lib/credit-analysis-server";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const pre = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(id)}`, { request });
 if (pre.ok) {
 const row = extractApplicationDetail(pre.data);
 const denied = ensureResourceBranchAllowed(
 auth.user,
 row?.branch_id != null ? String(row.branch_id) : undefined
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

 const res = await falcoServerFetch<unknown>(
 `/credit-analysis/applications/${encodeURIComponent(id)}/attachments`,
 { method: "POST", body, request }
 );

 if (res.ok) {
 return NextResponse.json(res.data ?? { ok: true });
 }

 if (res.error.status === 403) {
 const fallback = await falcoServerFetch<unknown>(
 `/applications/${encodeURIComponent(id)}/documents`,
 { method: "POST", body, request }
 );
 if (fallback.ok) {
 const data = fallback.data;
 const doc =
 data && typeof data === "object" && (data as Record<string, unknown>).document;
 if (doc && typeof doc === "object") {
 return NextResponse.json({
 attachment: { id: String((doc as Record<string, unknown>).id ?? "") },
 });
 }
 return NextResponse.json(fallback.data ?? { ok: true });
 }
 }

 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const incoming = await request.formData();
 const res = await uploadCreditAnalysisAttachment(request, id, incoming);

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data ?? { ok: true });
}
