import { NextResponse } from "next/server";
import { currentUser } from "@/lib/mock-data";
import { patchAccessRequest } from "@/lib/mock-staff-requests";
import type { StaffRequestStatus } from "@/lib/staff-requests-types";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (currentUser.role !== "super_admin") {
    return NextResponse.json({ error: "Only super admin can resolve access requests" }, { status: 403 });
  }

  const body = (await request.json()) as {
    status?: StaffRequestStatus;
    resolution_notes?: string | null;
  };

  if (!body.status || !["approved", "rejected"].includes(body.status)) {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
  }

  const result = patchAccessRequest(id, {
    status: body.status,
    reviewed_by: currentUser.id,
    resolution_notes: body.resolution_notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ request: result.request });
}
