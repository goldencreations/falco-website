import { NextResponse } from "next/server";
import { extractLoanDetail } from "@/lib/loan-adapters";
import { ensureResourceBranchAllowed, requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function POST(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const pre = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(id)}`);
 if (!pre.ok) {
 return NextResponse.json(
 { message: pre.error.message, details: pre.error.details },
 { status: pre.error.status }
 );
 }
 const loan = extractLoanDetail(pre.data);
 if (loan) {
 const denied = ensureResourceBranchAllowed(auth.user, loan.branch_id || undefined);
 if (denied) return denied;
 }

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(id)}/disburse`, {
 method: "POST",
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
