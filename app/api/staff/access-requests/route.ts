import { NextResponse } from "next/server";
import { createAccessRequest, listAccessRequests } from "@/lib/mock-staff-requests";
import { getDirectoryUserById } from "@/lib/mock-user-directory";
import { requireApiUser } from "@/lib/authorization";

export async function GET(request: Request) {
 const auth = requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;
 if (user.role === "super_admin") {
 return NextResponse.json({ requests: listAccessRequests() });
 }
 if (user.role === "branch_manager") {
 return NextResponse.json({
 requests: listAccessRequests({ status: "pending" }).filter(
 (r) => r.requested_by === user.id
 ),
 });
 }
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
 const auth = requireApiUser(request, ["branch_manager"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;

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
 if (target.branch_id !== user.branch_id) {
 return NextResponse.json({ error: "Staff is not in your branch" }, { status: 403 });
 }
 if (target.role === "branch_manager" || target.role === "super_admin") {
 return NextResponse.json({ error: "Cannot request access change for this role" }, { status: 400 });
 }

 const row = createAccessRequest({
 type: body.type,
 staff_id: body.staff_id,
 requested_by: user.id,
 reason: body.reason ?? null,
 });

 return NextResponse.json({ request: row });
}
