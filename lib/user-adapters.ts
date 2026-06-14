import { mapApiRoleToAppRole } from "@/lib/api-roles";
import type { User, UserRole } from "@/lib/types";

/** Single user object as returned by `/users`, `/users/{id}`, or nested `user` fields. */
export function adaptApiUserToUser(row: Record<string, unknown>): User {
 const role = mapApiRoleToAppRole(typeof row.role === "string" ? row.role : "") ?? ("loan_officer" as UserRole);
 return {
 id: String(row.id ?? ""),
 email: String(row.email ?? ""),
 full_name: String(row.full_name ?? row.name ?? ""),
 role,
 branch_id: row.branch_id == null || row.branch_id === "" ? "" : String(row.branch_id),
 branch_name: row.branch_name == null || row.branch_name === "" ? undefined : String(row.branch_name),
 phone: String(row.phone ?? ""),
 employee_id: String(row.employee_id ?? ""),
 is_active: Boolean(row.is_active ?? true),
 created_at: String(row.created_at ?? new Date().toISOString()),
 last_login: row.last_login == null ? null : String(row.last_login),
 };
}

export function extractUsersListPayload(json: unknown): { users: User[]; meta?: unknown } {
 if (!json || typeof json !== "object") return { users: [] };
 const o = json as Record<string, unknown>;
 if (Array.isArray(o.data)) {
 const users: User[] = [];
 for (const row of o.data as Record<string, unknown>[]) {
 try {
 users.push(adaptApiUserToUser(row));
 } catch {
 /* skip malformed row */
 }
 }
 return { users, meta: o.meta };
 }
 if (o.user && typeof o.user === "object") {
 return { users: [adaptApiUserToUser(o.user as Record<string, unknown>)] };
 }
 if (Array.isArray(o.users)) {
 const users: User[] = [];
 for (const row of o.users as Record<string, unknown>[]) {
 try {
 users.push(adaptApiUserToUser(row));
 } catch {
 /* skip */
 }
 }
 return { users };
 }
 return { users: [] };
}
