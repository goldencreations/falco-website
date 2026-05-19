import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery, isBranchDataScoped } from "@/lib/authorization";
import { mapFormPayloadToCustomerApi } from "@/lib/customer-payload";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const q = url.searchParams.get("q") ?? undefined;
 const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const risk_grade = url.searchParams.get("risk_grade") ?? undefined;
 const is_active = url.searchParams.get("is_active");
 const page = url.searchParams.get("page") ?? "1";
 const page_size = url.searchParams.get("page_size") ?? "50";

 const res = await falcoServerFetch<unknown>("/customers", {
 request,
 query: {
 q,
 branch_id,
 risk_grade,
 is_active: is_active === null || is_active === "" ? undefined : is_active,
 page,
 page_size,
 },
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const apiBody = mapFormPayloadToCustomerApi(body);
 if (isBranchDataScoped(auth.user)) {
 apiBody.branch_id = auth.user.branch_id;
 }

 const res = await falcoServerFetch<unknown>("/customers", {
 method: "POST",
 body: apiBody,
 });

 if (!res.ok) {
 return NextResponse.json(
 {
 message: res.error.message,
 code: res.error.code,
 details: res.error.details,
 },
 { status: res.error.status }
 );
 }

 return NextResponse.json(res.data);
}
