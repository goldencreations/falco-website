import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/collections/activities", {
 request,
 query: {
 loan_id: url.searchParams.get("loan_id") ?? undefined,
 customer_id: url.searchParams.get("customer_id") ?? undefined,
 action: url.searchParams.get("action") ?? undefined,
 from: url.searchParams.get("from") ?? undefined,
 to: url.searchParams.get("to") ?? undefined,
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "50",
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

 const res = await falcoServerFetch<unknown>("/collections/activities", {
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
 return NextResponse.json(res.data, { status: 201 });
}
