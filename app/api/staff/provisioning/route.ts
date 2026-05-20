import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { extractProvisioningRequestsList } from "@/lib/staff-provisioning-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;

 const url = new URL(request.url);
 const status = url.searchParams.get("status") ?? undefined;

 const res = await falcoServerFetch<unknown>("/users/provisioning-requests", {
 query: { status },
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const requests = extractProvisioningRequestsList(res.data);
 if (user.role === "branch_manager") {
 const branchId = user.branch_id?.trim();
 return NextResponse.json({
 requests: branchId
 ? requests.filter((r) => r.branch_id === branchId)
 : requests.filter((r) => r.requested_by === user.id),
 });
 }
 return NextResponse.json({ requests });
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;

 const body = (await request.json()) as Record<string, unknown>;
 const res = await falcoServerFetch<unknown>("/users/provisioning-requests", {
 method: "POST",
 body,
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
