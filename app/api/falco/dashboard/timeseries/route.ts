import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { buildOfficerTimeseriesPayload } from "@/lib/officer-reports-server";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /dashboard/timeseries`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const metric = url.searchParams.get("metric");
 const from = url.searchParams.get("from");
 const to = url.searchParams.get("to");
 if (!metric || !from || !to) {
 return NextResponse.json(
 { message: "metric, from, and to query parameters are required." },
 { status: 422 }
 );
 }

 const branchId = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));

 if (auth.user.role === "loan_officer" && branchId) {
 const data = await buildOfficerTimeseriesPayload(request, branchId, auth.user.id, metric, from, to);
 return NextResponse.json(data);
 }

 const res = await falcoServerFetch<unknown>("/dashboard/timeseries", {
 request,
 query: {
 metric,
 from,
 to,
 branch_id: branchId,
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
