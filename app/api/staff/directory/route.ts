import { NextResponse } from "next/server";
import { mapAppRoleToApiRole } from "@/lib/api-roles";
import { fetchStaffUsersForSessionUser } from "@/lib/branch-summary-fallback";
import { requireApiUser, resolvedBranchIdForListQuery, isBranchDataScoped } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";
import { adaptApiUserToUser } from "@/lib/user-adapters";
import { roleHasPortalAccess } from "@/components/staff-management/utils";
import type { StaffRole } from "@/components/staff-management/types";
import type { UserRole } from "@/lib/types";

const CREATABLE_ROLES: StaffRole[] = [
 "super_admin",
 "branch_manager",
 "loan_officer",
 "accountant",
 "credit_analyst",
 "collections_officer",
];

function canManageUsers(user: { role: UserRole; permissions: string[] }): boolean {
 return user.role === "super_admin" || user.permissions.includes("users.manage");
}

export async function GET(request: Request) {
 try {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 const requestedRole = url.searchParams.get("role")?.trim();
 const is_active = url.searchParams.get("is_active") ?? undefined;

 const users = await fetchStaffUsersForSessionUser(auth.user, {
 branchId: branch_id,
 requestedRole: requestedRole ?? undefined,
 isActive: is_active ?? undefined,
 request,
 });

 return NextResponse.json({ users });
 } catch (e) {
 const message = e instanceof Error ? e.message : "Failed to load staff directory";
 console.error("[staff/directory GET]", e);
 return NextResponse.json({ error: message, message, users: [] }, { status: 500 });
 }
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 if (!canManageUsers(auth.user)) {
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }

 const body = (await request.json()) as {
 full_name?: string;
 email?: string;
 phone?: string;
 employee_id?: string;
 role?: StaffRole;
 branch_id?: string;
 password?: string | null;
 confirmPassword?: string | null;
 };

 const email = body.email?.trim().toLowerCase();
 const full_name = body.full_name?.trim();
 const phone = body.phone?.trim();
 const role = body.role;
 let branch_id = body.branch_id?.trim();
 if (isBranchDataScoped(auth.user)) {
 branch_id = auth.user.branch_id;
 }

 if (!full_name || !email || !phone || !role || !branch_id) {
 return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
 }
 if (!email.includes("@")) {
 return NextResponse.json({ error: "Invalid email" }, { status: 400 });
 }
 if (!CREATABLE_ROLES.includes(role)) {
 return NextResponse.json({ error: "Invalid role" }, { status: 400 });
 }

 const apiRole = mapAppRoleToApiRole(role as UserRole);
 if (!apiRole) {
 return NextResponse.json({ error: "Invalid role mapping" }, { status: 400 });
 }

 const portal = roleHasPortalAccess(role);
 const password = body.password?.trim() ?? "";
 const confirm = body.confirmPassword?.trim() ?? "";

 if (portal) {
 if (password.length < 8) {
 return NextResponse.json(
 { error: "Password must be at least 8 characters for portal roles" },
 { status: 400 }
 );
 }
 if (password !== confirm) {
 return NextResponse.json({ error: "Password confirmation does not match" }, { status: 400 });
 }
 }

 const payload: Record<string, unknown> = {
 email,
 full_name,
 phone,
 role: apiRole,
 branch_id,
 employee_id:
 typeof body.employee_id === "string" && body.employee_id.trim()
 ? body.employee_id.trim()
 : `EMP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
 };
 if (portal && password) {
 payload.temporary_password = password;
 }

 const res = await falcoServerFetch<{ user?: Record<string, unknown> }>("/users", {
 method: "POST",
 body: payload,
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const row = (res.data as { user?: Record<string, unknown> }).user;
 if (!row) {
 return NextResponse.json({ error: "Unexpected response from server" }, { status: 502 });
 }

 const user = adaptApiUserToUser(row);
 return NextResponse.json({
 user,
 portal_credentials_set: portal,
 });
}
