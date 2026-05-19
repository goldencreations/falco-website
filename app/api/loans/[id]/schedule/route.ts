import { NextResponse } from "next/server";
import { extractLoanDetail } from "@/lib/loan-adapters";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const pre = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(id)}`);
 if (pre.ok) {
 const loan = extractLoanDetail(pre.data);
 const rid = loan?.branch_id != null ? String(loan.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }

 const res = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(id)}/schedule`);
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
