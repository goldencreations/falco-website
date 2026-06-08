import { NextResponse } from "next/server";
import { mapAppRoleToApiRole } from "@/lib/api-roles";
import { requireApiUser, ensureResourceBranchAllowed, isBranchDataScoped } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";
import { adaptApiUserToUser } from "@/lib/user-adapters";
import type { User, UserRole } from "@/lib/types";

const ROLES: UserRole[] = [
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 if (!canManageUsers(auth.user)) {
 return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 }

 const { id } = await context.params;
 const body = (await request.json()) as Record<string, unknown>;

 if (isBranchDataScoped(auth.user)) {
 const cur = await falcoServerFetch<{ user?: Record<string, unknown> }>(`/users/${encodeURIComponent(id)}`);
 if (!cur.ok) {
 if (cur.error.status === 404) {
 return NextResponse.json({ error: "User not found" }, { status: 404 });
 }
 return NextResponse.json(
 { error: cur.error.message, details: cur.error.details },
 { status: cur.error.status }
 );
 }
 const existing = (cur.data as { user?: Record<string, unknown> }).user;
 const bid = existing?.branch_id != null ? String(existing.branch_id) : undefined;
 const denied = ensureResourceBranchAllowed(auth.user, bid);
 if (denied) return denied;
 if (typeof body.branch_id === "string" && body.branch_id.trim() !== auth.user.branch_id.trim()) {
 return NextResponse.json({ error: "Cannot assign user to another branch" }, { status: 403 });
 }
 }

 const patch: Record<string, unknown> = {};

 if (typeof body.email === "string") patch.email = body.email.trim().toLowerCase();
 if (typeof body.full_name === "string") patch.full_name = body.full_name.trim();
 if (typeof body.phone === "string") patch.phone = body.phone.trim();
 if (typeof body.branch_id === "string") patch.branch_id = body.branch_id;
 if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

 if ("role" in body && body.role !== undefined) {
 if (typeof body.role !== "string" || !ROLES.includes(body.role as UserRole)) {
 return NextResponse.json({ error: "Invalid role" }, { status: 400 });
 }
 const apiRole = mapAppRoleToApiRole(body.role as UserRole);
 if (!apiRole) return NextResponse.json({ error: "Invalid role mapping" }, { status: 400 });
 patch.role = apiRole;
 }

 if (Object.keys(patch).length === 0) {
 return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
 }

 const res = await falcoServerFetch<{ user?: Record<string, unknown> }>(`/users/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: patch,
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

 const user = adaptApiUserToUser(row) as User;
 return NextResponse.json({ user });
}
