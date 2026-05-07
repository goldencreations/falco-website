import { NextResponse } from "next/server";
import {
 createProvisioningRequest,
 listProvisioningRequests,
} from "@/lib/mock-staff-requests";
import type { StaffProvisioningRole } from "@/lib/staff-requests-types";
import { requireApiUser } from "@/lib/authorization";

const ROLES: StaffProvisioningRole[] = ["loan_officer", "collections_officer", "credit_analyst"];

export async function GET(request: Request) {
 const auth = requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;
 const { searchParams } = new URL(request.url);
 const status = searchParams.get("status") as "pending" | "approved" | "rejected" | null;
 const branch_id = searchParams.get("branch_id") ?? undefined;
 if (user.role === "branch_manager") {
 const list = listProvisioningRequests({
 status: status ?? undefined,
 branch_id: user.branch_id,
 });
 return NextResponse.json({ requests: list });
 }
 const list = listProvisioningRequests({
 status: status ?? undefined,
 branch_id: branch_id ?? undefined,
 });
 return NextResponse.json({ requests: list });
}

export async function POST(request: Request) {
 const auth = requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;

 const body = (await request.json()) as {
 full_name?: string;
 email?: string;
 phone?: string;
 role?: StaffProvisioningRole;
 branch_id?: string;
 };

 if (!body.full_name || !body.email || !body.phone || !body.role) {
 return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
 }
 if (!ROLES.includes(body.role)) {
 return NextResponse.json({ error: "Invalid role for provisioning request" }, { status: 400 });
 }

 let branchId = body.branch_id;
 if (user.role === "branch_manager") {
 branchId = user.branch_id;
 if (body.branch_id && body.branch_id !== user.branch_id) {
 return NextResponse.json({ error: "Cannot propose hires for another branch" }, { status: 403 });
 }
 }
 if (user.role === "super_admin" && !branchId) {
 return NextResponse.json({ error: "branch_id required" }, { status: 400 });
 }

 const row = createProvisioningRequest({
 full_name: body.full_name,
 email: body.email,
 phone: body.phone,
 role: body.role,
 branch_id: branchId!,
 requested_by: user.id,
 });

 return NextResponse.json({ request: row });
}
