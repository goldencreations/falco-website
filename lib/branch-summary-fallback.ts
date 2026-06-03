import { adaptApiBranchToBranch, extractBranchesList } from "@/lib/branch-adapters";
import { mapApiRoleToAppRole, mapAppRoleToApiRole } from "@/lib/api-roles";
import type { SessionUser } from "@/lib/auth";
import { isBranchDataScoped, syntheticBranchFromSession } from "@/lib/branch-scope";
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

function managerFromSummaryRow(row: Record<string, unknown>, branchId: string): User | null {
 const manager = row.manager;
 if (!manager || typeof manager !== "object") return null;
 try {
 const record = manager as Record<string, unknown>;
 const user = adaptApiUserToUser({
 ...record,
 branch_id: record.branch_id ?? branchId,
 role: record.role ?? "manager",
 });
 if (user.role !== "branch_manager" || user.is_active === false) return null;
 return user;
 } catch {
 return null;
 }
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

/** Build a deduped staff list from all rows in `GET /branches/summary`. */
export function usersFromBranchesSummary(raw: unknown): User[] {
 const rows = collectSummaryRows(raw);
 const byId = new Map<string, User>();
 for (const row of rows) {
 const branchId = branchIdFromSummaryRow(row);
 const manager = managerFromSummaryRow(row, branchId);
 if (manager?.id) byId.set(manager.id, manager);
 for (const officer of officersFromSummaryRow(row, branchId)) {
 if (officer.id) byId.set(officer.id, officer);
 }
 }
 return Array.from(byId.values());
}

export { syntheticBranchFromSession } from "@/lib/branch-scope";

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

 const applyFilters = (list: User[]) => {
 let users = list;
 if (branchId) {
 users = users.filter((u) => String(u.branch_id).trim() === branchId);
 }
 if (appRoleFilter) {
 users = users.filter((u) => u.role === appRoleFilter);
 }
 if (options.isActive === "true") {
 users = users.filter((u) => u.is_active !== false);
 }
 return users;
 };

 if (canListStaffViaUsersApi(user)) {
 const res = await falcoServerFetch<unknown>("/users", {
 query: {
 branch_id: branchId || undefined,
 role: apiRole,
 is_active: options.isActive,
 page: "1",
 page_size: "200",
 },
 });
 if (res.ok) {
 const { users } = extractUsersListPayload(res.data);
 const filtered = applyFilters(users);
 if (filtered.length) return filtered;
 }
 }

 const summaryRes = await falcoServerFetch<unknown>("/branches/summary");
 if (summaryRes.ok) {
 const fromSummary = usersFromBranchesSummary(summaryRes.data);
 if (fromSummary.length) {
 const filtered = applyFilters(fromSummary);
 if (filtered.length) return filtered;
 }
 if (branchId) {
 const rows = collectSummaryRows(summaryRes.data);
 const scoped: User[] = [];
 for (const row of rows) {
 const rowBranchId = branchIdFromSummaryRow(row);
 if (rowBranchId !== branchId) continue;
 const manager = managerFromSummaryRow(row, branchId);
 if (manager) scoped.push(manager);
 scoped.push(...officersFromSummaryRow(row, branchId));
 }
 if (scoped.length) {
 return applyFilters(scoped);
 }
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
