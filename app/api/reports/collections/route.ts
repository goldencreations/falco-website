import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /reports/collections`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const from = url.searchParams.get("from");
 const to = url.searchParams.get("to");
 if (!from || !to) {
 return NextResponse.json({ message: "Both from and to dates are required." }, { status: 422 });
 }

 const res = await falcoServerFetch<unknown>("/reports/collections", {
 request,
 query: {
 from,
 to,
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 granularity: url.searchParams.get("granularity") ?? "monthly",
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
