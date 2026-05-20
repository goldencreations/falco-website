import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { extractProvisioningApproveResult } from "@/lib/staff-provisioning-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

export async function PATCH(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request, ["super_admin"]);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 const body = (await request.json()) as Record<string, unknown>;

 const status = String(body.status ?? "");
 const patchBody: Record<string, unknown> = {
 status,
 notes: body.notes ?? body.resolution_notes ?? null,
 };
 if (status === "approved" && typeof body.temporary_password === "string" && body.temporary_password.trim()) {
 patchBody.temporary_password = body.temporary_password.trim();
 }

 const res = await falcoServerFetch<unknown>(`/users/provisioning-requests/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: patchBody,
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 const parsed = extractProvisioningApproveResult(res.data);
 return NextResponse.json(parsed ?? res.data);
}
