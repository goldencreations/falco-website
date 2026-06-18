import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import {
  enrichGroupMembersWithCustomers,
  hydrateCustomersForMemberIds,
  loadVikundiCollectionSourceData,
  loadVikundiGroupDetail,
} from "@/lib/vikundi-collection-data";
import { buildVikundiCollectionDetail, memberIdsForGroup } from "@/lib/vikundi-collection-summary";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const detailRes = await loadVikundiGroupDetail(request, id);
  if (!detailRes.ok) {
    return NextResponse.json(
      { message: detailRes.error.message, details: detailRes.error.details },
      { status: detailRes.error.status }
    );
  }

  const data = await loadVikundiCollectionSourceData(request, detailRes.group.branch_id);
  const memberIds = [
    ...memberIdsForGroup(detailRes.group),
    ...detailRes.group.members.map((member) => member.customerId),
  ];
  const customers = await hydrateCustomersForMemberIds(request, data.customers, memberIds);
  const enrichedGroup = enrichGroupMembersWithCustomers(detailRes.group, customers);
  const detail = buildVikundiCollectionDetail(enrichedGroup, {
    loans: data.loans,
    payments: data.payments,
    queue: data.queue,
    leads: data.leads,
    customers,
  });

  return NextResponse.json({ detail });
}
