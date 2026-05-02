import { NextResponse } from "next/server";
import { currentUser } from "@/lib/mock-data";
import { createAccessRequest, listAccessRequests } from "@/lib/mock-staff-requests";
import { getDirectoryUserById } from "@/lib/mock-user-directory";

export async function GET() {
  if (currentUser.role === "super_admin") {
    return NextResponse.json({ requests: listAccessRequests() });
  }
  if (currentUser.role === "branch_manager") {
    return NextResponse.json({
      requests: listAccessRequests({ status: "pending" }).filter(
        (r) => r.requested_by === currentUser.id
      ),
    });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  if (currentUser.role !== "branch_manager") {
    return NextResponse.json({ error: "Only branch managers can request access changes" }, { status: 403 });
  }

  const body = (await request.json()) as {
    type?: "suspend" | "reinstate";
    staff_id?: string;
    reason?: string | null;
  };

  if (!body.type || !body.staff_id) {
    return NextResponse.json({ error: "type and staff_id required" }, { status: 400 });
  }

  const target = getDirectoryUserById(body.staff_id);
  if (!target) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }
  if (target.branch_id !== currentUser.branch_id) {
    return NextResponse.json({ error: "Staff is not in your branch" }, { status: 403 });
  }
  if (target.role === "branch_manager" || target.role === "super_admin") {
    return NextResponse.json({ error: "Cannot request access change for this role" }, { status: 400 });
  }

  const row = createAccessRequest({
    type: body.type,
    staff_id: body.staff_id,
    requested_by: currentUser.id,
    reason: body.reason ?? null,
  });

  return NextResponse.json({ request: row });
}
