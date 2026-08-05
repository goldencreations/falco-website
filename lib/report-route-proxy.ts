import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

const REPORT_QUERY_KEYS = [
  "from",
  "to",
  "as_of",
  "period",
  "granularity",
  "group_id",
  "officer_id",
  "product_id",
  "status",
  "page",
  "page_size",
  "sla_hours",
  "stalled_hours",
] as const;

/** Proxies an authenticated report request while enforcing the user's branch scope. */
export async function proxyReportGet(request: Request, backendPath: string) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const query: Record<string, string | undefined> = {};
  for (const key of REPORT_QUERY_KEYS) query[key] = url.searchParams.get(key) ?? undefined;
  query.branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));

  const res = await falcoServerFetch<unknown>(backendPath, { request, query });
  if (!res.ok) {
    return NextResponse.json(
      { message: res.error.message, details: res.error.details },
      { status: res.error.status }
    );
  }
  return NextResponse.json(res.data, { headers: { "Cache-Control": "no-store" } });
}
