import { NextResponse } from "next/server";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
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
 const rid = row?.branch_id != null ? String(row.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(
 `/credit-analysis/applications/${encodeURIComponent(id)}/analysis`,
 { method: "POST", body, request }
 );

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
