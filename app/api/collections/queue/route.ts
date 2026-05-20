import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/collections/queue", {
 request,
 query: {
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 page: url.searchParams.get("page") ?? "1",
 page_size: url.searchParams.get("page_size") ?? "100",
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
