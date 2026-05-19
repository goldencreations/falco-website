import { adaptApiBranchToBranch, extractBranchesList } from "@/lib/branch-adapters";
import { mapApiRoleToAppRole, mapAppRoleToApiRole } from "@/lib/api-roles";
import type { SessionUser } from "@/lib/auth";
import { isBranchDataScoped } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";
import type { Branch, User, UserRole } from "@/lib/types";
import { adaptApiUserToUser, extractUsersListPayload } from "@/lib/user-adapters";

function collectSummaryRows(raw: unknown): Record<string, unknown>[] {
 if (!raw || typeof raw !== "object") return [];
 const o = raw as Record<string, unknown>;
 for (const key of ["summaries", "summary", "branches", "data", "rows"]) {
 const candidate = o[key];
 if (Array.isArray(candidate)) {
 return candidate.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
 }
 }
 return [];
}

function branchIdFromSummaryRow(row: Record<string, unknown>): string {
 const nested = row.branch;
 if (nested && typeof nested === "object") {
 const b = nested as Record<string, unknown>;
 return String(b.id ?? b.branch_id ?? row.branch_id ?? row.id ?? "").trim();
 }
 return String(row.branch_id ?? row.id ?? "").trim();
}

function branchFromSummaryRow(row: Record<string, unknown>): Branch | null {
 const nested = row.branch;
 if (nested && typeof nested === "object") {
 const adapted = adaptApiBranchToBranch(nested as Record<string, unknown>);
 if (adapted.id) return adapted;
 }
 const id = branchIdFromSummaryRow(row);
 if (!id) return null;
 return adaptApiBranchToBranch({
 id,
 name: row.branch_name ?? row.name ?? `Branch ${id}`,
 code: row.branch_code ?? row.code ?? id,
 region: row.region ?? "",
 address: row.address ?? "",
 phone: row.phone ?? "",
 manager_id: row.manager_id ?? "",
 is_active: row.is_active ?? true,
 });
}

function officersFromSummaryRow(row: Record<string, unknown>, branchId: string): User[] {
 const pools = [row.officers, row.loan_officers, row.staff, row.users];
 const rawOfficers = pools.find((pool) => Array.isArray(pool)) as unknown[] | undefined;
 if (!rawOfficers) return [];
 const users: User[] = [];
 for (const item of rawOfficers) {
 if (!item || typeof item !== "object") continue;
 const record = item as Record<string, unknown>;
 try {
 const user = adaptApiUserToUser({
 ...record,
 branch_id: record.branch_id ?? branchId,
 role: record.role ?? "loan_officer",
 });
 if (user.role === "loan_officer" && user.is_active !== false) {
 users.push(user);
 }
 } catch {
 /* skip malformed officer row */
 }
 }
 return users;
}

export function syntheticBranchFromSession(user: SessionUser): Branch {
 const id = user.branch_id.trim() || "branch";
 return {
 id,
 name: `Branch ${id}`,
 code: id,
 region: "",
 address: "",
 phone: "",
 manager_id: "",
 is_active: true,
 };
}

export function canListStaffViaUsersApi(user: SessionUser): boolean {
 return (
 user.role === "super_admin" ||
 user.permissions.includes("users.view") ||
 user.permissions.includes("users.manage")
 );
}

/** Branches visible to the actor, with fallbacks for branch-scoped roles. */
export async function fetchBranchesForSessionUser(user: SessionUser): Promise<Branch[]> {
 try {
 return await fetchBranchesForSessionUserInner(user);
 } catch {
 const scopedId = user.branch_id?.trim();
 if (scopedId) return [syntheticBranchFromSession(user)];
 return [];
 }
}

async function fetchBranchesForSessionUserInner(user: SessionUser): Promise<Branch[]> {
 const scopedId = user.branch_id?.trim();

 if (!isBranchDataScoped(user)) {
 const listRes = await falcoServerFetch<unknown>("/branches");
 if (listRes.ok) return extractBranchesList(listRes.data);

 const settingsRes = await falcoServerFetch<unknown>("/settings/branches");
 if (settingsRes.ok) return extractBranchesList(settingsRes.data);
 }

 const summaryRes = await falcoServerFetch<unknown>("/branches/summary");
 if (summaryRes.ok) {
 const rows = collectSummaryRows(summaryRes.data);
 const branches = rows
 .map(branchFromSummaryRow)
 .filter((branch): branch is Branch => Boolean(branch?.id));
 if (scopedId) {
 const scoped = branches.filter((b) => String(b.id).trim() === scopedId);
 if (scoped.length) return scoped;
 }
 if (branches.length) return branches;
 }

 if (scopedId) return [syntheticBranchFromSession(user)];
 return [];
}

export type StaffListOptions = {
 branchId?: string;
 requestedRole?: string;
 isActive?: string;
};

/** Staff list with summary fallback when `/users` is forbidden. */
export async function fetchStaffUsersForSessionUser(
 user: SessionUser,
 options: StaffListOptions = {}
): Promise<User[]> {
 const branchId = options.branchId?.trim() || user.branch_id?.trim();
 const requestedRole = options.requestedRole?.trim();
 const apiRole = requestedRole
 ? mapAppRoleToApiRole(requestedRole as UserRole) ?? requestedRole
 : undefined;
 const appRoleFilter =
 mapApiRoleToAppRole(apiRole ?? requestedRole ?? "") ??
 (requestedRole ? (requestedRole as UserRole) : null);

 if (canListStaffViaUsersApi(user)) {
 const res = await falcoServerFetch<unknown>("/users", {
 query: {
 branch_id: branchId || undefined,
 role: apiRole,
 is_active: options.isActive,
 page: "1",
 page_size: "100",
 },
 });
 if (res.ok) {
 let { users } = extractUsersListPayload(res.data);
 if (branchId) {
 users = users.filter((u) => String(u.branch_id).trim() === branchId);
 }
 if (appRoleFilter) {
 users = users.filter((u) => u.role === appRoleFilter);
 }
 return users;
 }
 }

 const summaryRes = await falcoServerFetch<unknown>("/branches/summary");
 if (summaryRes.ok && branchId) {
 const rows = collectSummaryRows(summaryRes.data);
 const officers: User[] = [];
 for (const row of rows) {
 const rowBranchId = branchIdFromSummaryRow(row);
 if (rowBranchId !== branchId) continue;
 officers.push(...officersFromSummaryRow(row, branchId));
 }
 if (officers.length) {
 return appRoleFilter ? officers.filter((u) => u.role === appRoleFilter) : officers;
 }
 }

 if (user.role === "loan_officer" && branchId && user.branch_id.trim() === branchId) {
 return [
 adaptApiUserToUser({
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: "loan_officer",
 branch_id: user.branch_id,
 phone: "",
 employee_id: "",
 is_active: true,
 }),
 ];
 }

 return [];
}
