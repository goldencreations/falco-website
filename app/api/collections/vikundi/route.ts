import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { loadVikundiCollectionSourceData } from "@/lib/vikundi-collection-data";
import {
  aggregateVikundiTotals,
  buildVikundiCollectionSummary,
} from "@/lib/vikundi-collection-summary";

export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
  const data = await loadVikundiCollectionSourceData(request, branch_id);

  if (!data.groupsRes.ok) {
    return NextResponse.json(
      { message: data.groupsRes.error.message, details: data.groupsRes.error.details },
      { status: data.groupsRes.error.status }
    );
  }

  const summaries = data.groups.map((group) =>
    buildVikundiCollectionSummary(group, {
      loans: data.loans,
      payments: data.payments,
      queue: data.queue,
      leads: data.leads,
      customers: data.customers,
    })
  );

  return NextResponse.json({
    summaries,
    totals: aggregateVikundiTotals(summaries),
    branch_id: branch_id ?? null,
  });
}
