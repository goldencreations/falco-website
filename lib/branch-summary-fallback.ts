import {
  resolveCanonicalBranchLoanOfficers,
  resolveOfficerMetricUserId,
  isSyntheticOfficerId,
} from "@/lib/officer-branch-roster";
import { buildOfficerNameDirectoryFromApiPayloads } from "@/lib/officer-names-from-payload";
import type { ApplicationViewRow } from "@/lib/application-adapters";
import { adaptApiBranchToBranch, extractBranchesList } from "@/lib/branch-adapters";
import { buildCustomerMap, enrichApplicationRows } from "@/lib/application-enrichment";
import { mapApiRoleToAppRole, mapAppRoleToApiRole } from "@/lib/api-roles";
import type { SessionUser } from "@/lib/auth";
import {
 branchIdsMatch,
 branchMatchesScope,
 isBranchDataScoped,
 knownBranchNameFromCode,
 syntheticBranchFromSession,
} from "@/lib/branch-scope";
import { falcoServerFetch } from "@/lib/server-falco";
import type { Branch, Customer, User, UserRole } from "@/lib/types";
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
 const name = String(row.branch_name ?? row.name ?? "Branch");
 const normalizedName = name.trim().toLowerCase();
 const normalizedId = id.trim().toLowerCase();
 return adaptApiBranchToBranch({
 id,
 name: normalizedName === normalizedId || normalizedName === `branch ${normalizedId}` ? "Branch" : name,
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
 const pools: unknown[] = [];
 for (const key of ["officers", "loan_officers", "staff", "users"]) {
 const pool = row[key];
 if (Array.isArray(pool)) pools.push(...pool);
 }
 const singleOfficer = row.loan_officer;
 if (singleOfficer && typeof singleOfficer === "object") pools.push(singleOfficer);

 const nested = row.branch;
 if (nested && typeof nested === "object") {
 const branch = nested as Record<string, unknown>;
 for (const key of ["officers", "loan_officers", "staff", "users"]) {
 const pool = branch[key];
 if (Array.isArray(pool)) pools.push(...pool);
 }
 const branchOfficer = branch.loan_officer;
 if (branchOfficer && typeof branchOfficer === "object") pools.push(branchOfficer);
 }

 const users: User[] = [];
 const seen = new Set<string>();
 for (const item of pools) {
 if (!item || typeof item !== "object") continue;
 const record = item as Record<string, unknown>;
 try {
 const user = adaptApiUserToUser({
 ...record,
 full_name:
 record.full_name ??
 record.name ??
 record.officer_name ??
 record.user_name ??
 "",
 branch_id: record.branch_id ?? branchId,
 role: record.role ?? "loan_officer",
 });
 const role = mapApiRoleToAppRole(String(record.role ?? user.role)) ?? user.role;
 const employeeId = user.employee_id?.trim() ?? "";
 const fullName = user.full_name?.trim() ?? "";
 const officerKey =
 user.id?.trim() ||
 (employeeId ? `emp:${employeeId.toLowerCase()}` : "") ||
 (isUsableOfficerName(fullName) ? `name:${fullName.toLowerCase()}` : "");
 if (role !== "loan_officer" || user.is_active === false || !officerKey || seen.has(officerKey)) {
 continue;
 }
 seen.add(officerKey);
 users.push({ ...user, id: user.id?.trim() || officerKey, role: "loan_officer" });
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
 user.role === "loan_officer" ||
 user.permissions.includes("users.view") ||
 user.permissions.includes("users.manage")
 );
}

/** Branches visible to the actor, with fallbacks for branch-scoped roles. */
export async function fetchBranchesForSessionUser(user: SessionUser, request?: Request): Promise<Branch[]> {
 try {
 return await fetchBranchesForSessionUserInner(user, request);
 } catch {
 const scopedId = user.branch_id?.trim();
 if (scopedId) return [syntheticBranchFromSession(user)];
 return [];
 }
}

async function fetchBranchesForSessionUserInner(user: SessionUser, request?: Request): Promise<Branch[]> {
 const scopedId = user.branch_id?.trim();

 const listRes = await falcoServerFetch<unknown>("/branches", { request });
 if (listRes.ok) {
 const branches = extractBranchesList(listRes.data);
 if (scopedId) {
 const scoped = branches.filter((b) => branchMatchesScope(b, scopedId));
 if (scoped.length) return scoped;
 }
 if (branches.length) return branches;
 }

 if (scopedId) {
 for (const query of [{ code: scopedId }, { id: scopedId }, { branch_id: scopedId }]) {
 const scopedRes = await falcoServerFetch<unknown>("/branches", { request, query });
 if (!scopedRes.ok) continue;
 const branches = extractBranchesList(scopedRes.data);
 const scoped = branches.filter((b) => branchMatchesScope(b, scopedId));
 if (scoped.length) return scoped;
 if (branches.length === 1) return branches;
 }
 }

 if (!isBranchDataScoped(user)) {
 const settingsRes = await falcoServerFetch<unknown>("/settings/branches", { request });
 if (settingsRes.ok) return extractBranchesList(settingsRes.data);
 }

 const summaryRes = await falcoServerFetch<unknown>("/branches/summary", { request });
 if (summaryRes.ok) {
 const rows = collectSummaryRows(summaryRes.data);
 const branches = rows
 .map(branchFromSummaryRow)
 .filter((branch): branch is Branch => Boolean(branch?.id));
 if (scopedId) {
 const scoped = branches.filter((b) => branchMatchesScope(b, scopedId));
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
 request?: Request;
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
 users = users.filter((u) => branchIdsMatch(u.branch_id, branchId));
 }
 if (appRoleFilter) {
 users = users.filter((u) => u.role === appRoleFilter);
 }
 if (options.isActive === "true") {
 users = users.filter((u) => u.is_active !== false);
 }
 return users;
 };

 const partialFromUsers = new Map<string, User>();
 if (canListStaffViaUsersApi(user)) {
 const res = await falcoServerFetch<unknown>("/users", {
 request: options.request,
 query: {
 branch_id: branchId || undefined,
 role: apiRole,
 is_active: options.isActive,
 page: "1",
 per_page: "100",
 page_size: "100",
 },
 });
 if (res.ok) {
  const { users } = extractUsersListPayload(res.data);
  for (const officer of applyFilters(users)) {
   if (officer.id) partialFromUsers.set(officer.id, officer);
  }
  if (partialFromUsers.size && user.role !== "loan_officer") {
   return Array.from(partialFromUsers.values());
  }
 }
 }

 const summaryRes = await falcoServerFetch<unknown>("/branches/summary", { request: options.request });
 const merged = new Map<string, User>(partialFromUsers);
 if (summaryRes.ok) {
 const fromSummary = applyFilters(usersFromBranchesSummary(summaryRes.data));
 for (const officer of fromSummary) {
 if (officer.id) merged.set(officer.id, officer);
 }
 if (branchId) {
 const rows = collectSummaryRows(summaryRes.data);
 for (const row of rows) {
 const rowBranchId = branchIdFromSummaryRow(row);
 if (!branchIdsMatch(rowBranchId, branchId)) continue;
 const manager = managerFromSummaryRow(row, branchId);
 if (manager?.id) merged.set(manager.id, manager);
 for (const officer of officersFromSummaryRow(row, branchId)) {
 if (officer.id) merged.set(officer.id, officer);
 }
 }
 }
 }
 if (merged.size) return Array.from(merged.values());

 if (user.role === "loan_officer" && branchId && branchIdsMatch(user.branch_id, branchId)) {
 return [
 adaptApiUserToUser({
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: "loan_officer",
 branch_id: user.branch_id,
 branch_name: knownBranchNameFromCode(user.branch_id) ?? undefined,
 phone: "",
 employee_id: "",
 is_active: true,
 }),
 ];
 }

 return [];
}

/** Active loan officers for a branch — merges `/branches/summary`, `/users`, and operational data. */
export async function loadBranchLoanOfficersForSessionUser(
 user: SessionUser,
 branchId: string,
 request?: Request
): Promise<User[]> {
 const scopedBranch = branchId.trim() || user.branch_id?.trim() || "";
 if (!scopedBranch) return [];

 const byId = new Map<string, User>();
 const merge = (list: User[]) => {
 for (const officer of list) {
 if (!officer.id || officer.role !== "loan_officer" || officer.is_active === false) continue;
 if (officer.branch_id && !branchIdsMatch(officer.branch_id, scopedBranch)) continue;
 byId.set(officer.id, mergeOfficerUsers(byId.get(officer.id), officer));
 }
 };

 merge(
 await fetchStaffUsersForSessionUser(user, {
 branchId: scopedBranch,
 requestedRole: "loan_officer",
 isActive: "true",
 request,
 })
 );

 const apiRole = mapAppRoleToApiRole("loan_officer");
 if (canListStaffViaUsersApi(user)) {
 const usersRes = await falcoServerFetch<unknown>("/users", {
 request,
 query: {
 role: apiRole ?? undefined,
 is_active: "true",
 page: "1",
 per_page: "100",
 page_size: "100",
 },
 });
 if (usersRes.ok) {
 merge(
 extractUsersListPayload(usersRes.data).users.filter(
 (officer) =>
 officer.role === "loan_officer" &&
 officer.is_active !== false &&
 branchIdsMatch(officer.branch_id, scopedBranch)
 )
 );
 }
 }

 if (
 user.role === "loan_officer" &&
 branchIdsMatch(user.branch_id, scopedBranch) &&
 !byId.has(user.id)
 ) {
 byId.set(
 user.id,
 adaptApiUserToUser({
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: "loan_officer",
 branch_id: user.branch_id,
 branch_name: knownBranchNameFromCode(user.branch_id) ?? undefined,
 phone: "",
 employee_id: "",
 is_active: true,
 })
 );
 }

 return hydrateLoanOfficerProfiles(Array.from(byId.values()), request);
}

function isUsableOfficerName(name: string | undefined): boolean {
 const value = name?.trim() ?? "";
 if (!value) return false;
 if (value === "—" || value === "Unassigned") return false;
 if (/^loan officer$/i.test(value)) return false;
 if (/^officer #/i.test(value)) return false;
 return true;
}

export function mergeOfficerUsers(prev: User | undefined, next: User): User {
 if (!prev) return next;
 const mergedName = (() => {
  const candidates = [next.full_name, prev.full_name].filter((name) => isUsableOfficerName(name));
  if (!candidates.length) return "";
  return candidates.sort((a, b) => {
   const wordDiff = b.split(/\s+/).length - a.split(/\s+/).length;
   if (wordDiff !== 0) return wordDiff;
   return b.length - a.length;
  })[0];
 })();
 return {
  ...prev,
  ...next,
  full_name: mergedName,
 employee_id: next.employee_id?.trim() || prev.employee_id?.trim() || "",
 email: prev.email || next.email,
 phone: prev.phone || next.phone,
 branch_id: prev.branch_id || next.branch_id,
 branch_name: prev.branch_name || next.branch_name,
 role: "loan_officer",
 is_active: prev.is_active !== false && next.is_active !== false,
 };
}

export function buildOfficerNameDirectory(ctx: OperationalOfficerSource): Map<string, string> {
 const names = new Map<string, string>();
 const put = (id: string | undefined, name: string | undefined) => {
 const oid = id?.trim();
 if (!oid || !isUsableOfficerName(name)) return;
 if (!names.has(oid)) names.set(oid, name!.trim());
 };

 for (const application of ctx.applications) {
 put(application.created_by, application.creatorName);
 put(application.assigned_officer_id, application.officerName);
 }
 for (const loan of ctx.loans) {
 put(loan.loan_officer_id, loan.loanOfficerDisplayName);
 }

 return names;
}

export function enrichOfficersWithNameDirectory(
 officers: User[],
 names: Map<string, string>
): User[] {
 return officers.map((officer) => {
 const resolved = names.get(String(officer.id));
 if (!isUsableOfficerName(resolved)) return officer;
 if (!isUsableOfficerName(officer.full_name)) {
 return { ...officer, full_name: resolved!.trim() };
 }
 return officer;
 });
}

/** Registered staff for a branch (names from user provisioning / staff directory). */
export async function fetchBranchRegisteredStaffRegistry(
 user: SessionUser,
 branchId: string,
 request?: Request
): Promise<Map<string, User>> {
 const byId = new Map<string, User>();
 const ingest = (row: Record<string, unknown>, defaultBranchId?: string) => {
 try {
 const adapted = adaptApiUserToUser({
 ...row,
 id: row.id ?? row.user_id ?? row.officer_id,
 full_name:
 row.full_name ??
 row.name ??
 row.officer_name ??
 row.user_name ??
 "",
 branch_id: row.branch_id ?? defaultBranchId,
 });
 if (!adapted.id) return;
 const key = String(adapted.id);
 byId.set(key, mergeOfficerUsers(byId.get(key), adapted));
 } catch {
 /* skip malformed staff row */
 }
 };

 const summaryRes = await falcoServerFetch<unknown>("/branches/summary", { request });
 if (summaryRes.ok) {
 for (const row of collectSummaryRows(summaryRes.data)) {
 const rowBranchId = branchIdFromSummaryRow(row);
 if (!branchIdsMatch(rowBranchId, branchId)) continue;
 for (const officer of officersFromSummaryRow(row, rowBranchId || branchId)) {
 if (officer.id) byId.set(String(officer.id), mergeOfficerUsers(byId.get(String(officer.id)), officer));
 }
 for (const key of ["officers", "loan_officers", "staff", "users"]) {
 const pool = row[key];
 if (!Array.isArray(pool)) continue;
 for (const item of pool) {
 if (item && typeof item === "object") ingest(item as Record<string, unknown>, rowBranchId || branchId);
 }
 }
 }
 for (const officer of usersFromBranchesSummary(summaryRes.data)) {
 if (officer.id) byId.set(String(officer.id), mergeOfficerUsers(byId.get(String(officer.id)), officer));
 }
 }

 for (const officer of await fetchStaffUsersForSessionUser(user, {
 branchId,
 isActive: "true",
 request,
 })) {
 if (officer.id) byId.set(String(officer.id), mergeOfficerUsers(byId.get(String(officer.id)), officer));
 }

 const apiRole = mapAppRoleToApiRole("loan_officer");
 const queries: Array<Record<string, string | undefined>> = [
 { branch_id: branchId, is_active: "true", page: "1", per_page: "100", page_size: "100" },
 {
 branch_id: branchId,
 role: apiRole ?? undefined,
 is_active: "true",
 page: "1",
 per_page: "100",
 page_size: "100",
 },
 { is_active: "true", page: "1", per_page: "100", page_size: "100" },
 ];
 for (const query of queries) {
 const res = await falcoServerFetch<unknown>("/users", { request, query });
 if (!res.ok) continue;
 for (const officer of extractUsersListPayload(res.data).users) {
 if (officer.branch_id && !branchIdsMatch(officer.branch_id, branchId)) continue;
 if (!officer.id) continue;
 byId.set(String(officer.id), mergeOfficerUsers(byId.get(String(officer.id)), officer));
 }
 }

 return byId;
}

/** Full branch loan-officer roster with resolved names for peer rankings. */
export async function resolveBranchLoanOfficerRoster(
 user: SessionUser,
 branchId: string,
 ctx: OperationalOfficerSource,
 request?: Request
): Promise<User[]> {
 const scopedBranch = branchId.trim() || user.branch_id?.trim() || "";
 if (!scopedBranch) return [];

 const [registry, staffRoster] = await Promise.all([
  fetchBranchRegisteredStaffRegistry(user, scopedBranch, request),
  loadBranchLoanOfficersForSessionUser(user, scopedBranch, request),
 ]);

 const summaryRes = ctx.apiPayloads?.rawBranchesSummary
  ? { ok: true as const, data: ctx.apiPayloads.rawBranchesSummary }
  : await falcoServerFetch<unknown>("/branches/summary", { request });
 const payloads = {
  ...(ctx.apiPayloads ?? {}),
  rawBranchesSummary: summaryRes.ok ? summaryRes.data : ctx.apiPayloads?.rawBranchesSummary,
 };

 const canonical = resolveCanonicalBranchLoanOfficers(
  scopedBranch,
  payloads,
  registry,
  user,
  {
   customers: ctx.customers,
   applications: ctx.applications,
   loans: ctx.loans,
  }
 );
 const nameDirectory = buildOfficerNameDirectory(ctx);
 const byId = new Map<string, User>();

 for (const officer of canonical) {
  if (!officer.id) continue;
  byId.set(officer.id, mergeOfficerUsers(byId.get(officer.id), officer));
 }

 for (const officer of staffRoster) {
  if (!officer.id) continue;
  byId.set(officer.id, mergeOfficerUsers(byId.get(officer.id), officer));
 }

 let officers = enrichOfficersWithNameDirectory(Array.from(byId.values()), nameDirectory);

 if (
  officers.length === 0 &&
  user.role === "loan_officer" &&
  branchIdsMatch(user.branch_id, scopedBranch)
 ) {
  officers = [
   adaptApiUserToUser({
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: "loan_officer",
    branch_id: user.branch_id,
    branch_name: knownBranchNameFromCode(user.branch_id) ?? undefined,
    phone: "",
    employee_id: "",
    is_active: true,
   }),
  ];
 }

 officers = dedupeOfficersForPeerRanking(officers);

 if (officers.length <= 1) {
  const payloadNames = buildOfficerNameDirectoryFromApiPayloads(payloads);
  officers = mergeOperationalLoanOfficers(officers, ctx, scopedBranch, payloadNames);
  officers = dedupeOfficersForPeerRanking(officers);
 }

 return officers.sort((a, b) => {
  const nameA = isUsableOfficerName(a.full_name) ? a.full_name : a.employee_id || a.id;
  const nameB = isUsableOfficerName(b.full_name) ? b.full_name : b.employee_id || b.id;
  return nameA.localeCompare(nameB);
 });
}

/** Collapse roster entries that share the same portfolio metric user id. */
export function dedupeOfficersForMetrics(
 officers: User[],
 payloads: import("@/lib/officer-names-from-payload").OfficerNamePayloadSources,
 registry: Map<string, User>
): User[] {
 const byMetric = new Map<string, User>();
 for (const officer of officers) {
  const metricId = resolveOfficerMetricUserId(officer, payloads, registry);
  const normalized = { ...officer, id: metricId };
  const existing = byMetric.get(metricId);
  if (!existing || isSyntheticOfficerId(existing.id)) {
   byMetric.set(metricId, mergeOfficerUsers(undefined, normalized));
  } else {
   byMetric.set(metricId, mergeOfficerUsers(existing, normalized));
  }
 }
 return Array.from(byMetric.values());
}

function dedupeOfficersForPeerRanking(officers: User[]): User[] {
 const byKey = new Map<string, User>();

 const isSyntheticId = (id: string) => id.startsWith("emp:") || id.startsWith("name:");

 for (const officer of officers) {
  if (!officer.id) continue;
  const employeeKey = officer.employee_id?.trim().toLowerCase();
  const nameKey = officer.full_name?.trim().toLowerCase();
  const key = employeeKey || nameKey || officer.id;
  const existing = byKey.get(key);

  if (!existing) {
   byKey.set(key, officer);
   continue;
  }

  if (isSyntheticId(existing.id) && !isSyntheticId(officer.id)) {
   byKey.set(key, mergeOfficerUsers(officer, existing));
  } else {
   byKey.set(key, mergeOfficerUsers(existing, officer));
  }
 }

 return Array.from(byKey.values());
}

type OperationalOfficerSource = {
 customers: Customer[];
 applications: ApplicationViewRow[];
 loans: Array<{
 loan_officer_id?: string;
 disbursed_by?: string;
 loanOfficerDisplayName?: string;
 }>;
 apiPayloads?: import("@/lib/officer-names-from-payload").OfficerNamePayloadSources;
};

/** Add loan officers discovered in branch portfolio data when staff APIs return a partial roster. */
export function mergeOperationalLoanOfficers(
 roster: User[],
 ctx: OperationalOfficerSource,
 branchId: string,
 nameDirectory?: Map<string, string>
): User[] {
 const byId = new Map(roster.map((officer) => [officer.id, officer]));

 const add = (id: string | undefined, partial?: Partial<User>) => {
 const oid = id?.trim();
 if (!oid) return;
 const resolvedName =
 partial?.full_name?.trim() || nameDirectory?.get(oid) || nameDirectory?.get(String(oid));
 if (!byId.has(oid) && !isUsableOfficerName(resolvedName) && !partial?.employee_id?.trim()) return;
 if (byId.has(oid)) {
 const existing = byId.get(oid)!;
 byId.set(
 oid,
 mergeOfficerUsers(existing, {
 ...existing,
 full_name: isUsableOfficerName(resolvedName)
 ? resolvedName!
 : isUsableOfficerName(existing.full_name)
 ? existing.full_name
 : "",
 employee_id: partial?.employee_id?.trim() || existing.employee_id,
 })
 );
 return;
 }
 byId.set(
 oid,
 mergeOfficerUsers(undefined, adaptApiUserToUser({
 id: oid,
 full_name: isUsableOfficerName(resolvedName) ? resolvedName! : "",
 employee_id: partial?.employee_id?.trim() ?? "",
 role: "loan_officer",
 branch_id: partial?.branch_id ?? branchId,
 email: partial?.email ?? "",
 phone: partial?.phone ?? "",
 is_active: true,
 }))
 );
 };

 for (const customer of ctx.customers) {
 add(customer.assigned_loan_officer_id);
 }
 for (const application of ctx.applications) {
 add(application.created_by, { full_name: application.creatorName });
 add(application.assigned_officer_id, { full_name: application.officerName });
 }
 for (const loan of ctx.loans) {
  add(loan.loan_officer_id, { full_name: loan.loanOfficerDisplayName });
 }

 return Array.from(byId.values())
  .filter((officer) => {
   if (officer.role !== "loan_officer") return false;
   const name = officer.full_name?.trim() || nameDirectory?.get(officer.id);
   return isUsableOfficerName(name) || Boolean(officer.employee_id?.trim());
  });
}

export async function hydrateLoanOfficerProfiles(officers: User[], request?: Request): Promise<User[]> {
 return Promise.all(
 officers.map(async (officer) => {
 const needsProfile = !officer.full_name?.trim();
 if (!needsProfile) return officer;

 const res = await falcoServerFetch<{ user?: Record<string, unknown> }>(
 `/users/${encodeURIComponent(officer.id)}`,
 { request }
 );
 if (!res.ok) return officer;

 const row = (res.data as { user?: Record<string, unknown> }).user ?? res.data;
 if (!row || typeof row !== "object") return officer;
 const hydrated = adaptApiUserToUser(row as Record<string, unknown>);
 if (hydrated.role !== "loan_officer") return officer;
 return hydrated;
 })
 );
}
