import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { fetchCreditAnalysisApplicationsList } from "@/lib/credit-analysis-server";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await fetchCreditAnalysisApplicationsList(request, auth.user, {
 page: url.searchParams.get("page"),
 page_size: url.searchParams.get("page_size"),
 status: url.searchParams.get("status"),
 branch_id: url.searchParams.get("branch_id"),
 assigned_analyst_id: url.searchParams.get("assigned_analyst_id"),
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
