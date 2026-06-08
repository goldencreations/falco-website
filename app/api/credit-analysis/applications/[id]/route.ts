import { NextResponse } from "next/server";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import { fetchCreditAnalysisApplicationContext } from "@/lib/credit-analysis-server";

function branchIdFromCreditAnalysisEnvelope(data: unknown): string | undefined {
 if (!data || typeof data !== "object") return undefined;
 const o = data as Record<string, unknown>;
 const app = o.application;
 if (app && typeof app === "object") {
 const b = (app as Record<string, unknown>).branch_id;
 return b != null ? String(b) : undefined;
 }
 return undefined;
}

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 const { id } = await context.params;

 const res = await fetchCreditAnalysisApplicationContext(request, id);
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const rid = branchIdFromCreditAnalysisEnvelope(res.data);
 if (rid) {
 const denied = ensureResourceBranchAllowed(auth.user, rid);
 if (denied) return denied;
 }
 return NextResponse.json(res.data);
}
