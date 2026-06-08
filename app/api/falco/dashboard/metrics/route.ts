import { NextResponse } from "next/server";
import { shouldSoftEmptyApiError } from "@/lib/api-soft-fallback";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const res = await falcoServerFetch<unknown>("/dashboard/metrics", {
 request,
 query: {
 branch_id: resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id")),
 },
 });

 if (!res.ok) {
 if (shouldSoftEmptyApiError(auth.user, res.error.status)) {
 return NextResponse.json({
 metrics: {},
 _fallback: true,
 message: res.error.message,
 });
 }
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
