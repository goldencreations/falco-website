/**
 * Canonical branch loan-officer roster and name resolution for peer rankings.
 * Branch summary is the source of truth for who belongs to the branch; user IDs
 * are linked via employee_id, phone, and nested objects in Falco list payloads.
 */

import { mapApiRoleToAppRole } from "@/lib/api-roles";
import { branchIdsMatch } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth";
import {
  buildOfficerNameDirectoryFromApiPayloads,
  type OfficerNamePayloadSources,
} from "@/lib/officer-names-from-payload";
import type { User } from "@/lib/types";
import { adaptApiUserToUser } from "@/lib/user-adapters";

export type BranchOfficerProfile = {
  id: string;
  full_name: string;
  employee_id: string;
  email: string;
  phone: string;
};

function norm(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function digitsOnly(value: string | undefined): string {
  return value?.replace(/\D/g, "") ?? "";
}

export function isUsableOfficerProfileName(name: string | undefined): boolean {
  const value = name?.trim() ?? "";
  if (!value) return false;
  if (value === "—" || value === "Unassigned") return false;
  if (/^loan officer$/i.test(value)) return false;
  if (/^officer #/i.test(value)) return false;
  if (/^unknown officer$/i.test(value)) return false;
  return true;
}

function listRows(json: unknown, keys: string[]): Record<string, unknown>[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  for (const key of keys) {
    const candidate = o[key];
    if (Array.isArray(candidate)) {
      return candidate.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
    }
  }
  if (Array.isArray(json)) {
    return json.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
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

function collectSummaryRows(raw: unknown): Record<string, unknown>[] {
  return listRows(raw, ["summaries", "summary", "branches", "data", "rows"]);
}

function mergeProfile(
  prev: BranchOfficerProfile | undefined,
  next: Partial<BranchOfficerProfile>
): BranchOfficerProfile {
  const id = String(next.id ?? prev?.id ?? "").trim();
  return {
    id,
    full_name: isUsableOfficerProfileName(next.full_name)
      ? next.full_name!.trim()
      : prev?.full_name ?? "",
    employee_id: next.employee_id?.trim() || prev?.employee_id || "",
    email: next.email?.trim() || prev?.email || "",
    phone: next.phone?.trim() || prev?.phone || "",
  };
}

function maybeIngestStaffRecord(
  profiles: Map<string, BranchOfficerProfile>,
  record: Record<string, unknown>,
  idFallback?: unknown
): void {
  const role = mapApiRoleToAppRole(typeof record.role === "string" ? record.role : "");
  if (role && role !== "loan_officer") return;

  const id = String(record.id ?? record.user_id ?? record.officer_id ?? idFallback ?? "").trim();
  const full_name = String(
    record.full_name ?? record.name ?? record.officer_name ?? record.user_name ?? ""
  ).trim();

  if (!id) return;

  profiles.set(
    id,
    mergeProfile(profiles.get(id), {
      id,
      full_name: isUsableOfficerProfileName(full_name) ? full_name : undefined,
      employee_id: String(record.employee_id ?? ""),
      email: String(record.email ?? ""),
      phone: String(record.phone ?? ""),
    })
  );
}

function walkObjectForStaff(
  profiles: Map<string, BranchOfficerProfile>,
  value: unknown,
  depth = 0
): void {
  if (depth > 10 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) walkObjectForStaff(profiles, item, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;

  const nestedKeys = [
    "loan_officer",
    "assigned_officer",
    "officer",
    "creator",
    "created_by_user",
    "relationship_manager",
    "received_by_user",
    "receiver",
    "disbursed_by_user",
    "user",
  ];

  for (const key of nestedKeys) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const nestedRecord = nested as Record<string, unknown>;
      const fallbackId =
        record.loan_officer_id ??
        record.assigned_officer_id ??
        record.created_by ??
        record.received_by ??
        record.disbursed_by ??
        record.disbursed_by_id;
      maybeIngestStaffRecord(profiles, nestedRecord, fallbackId);
    }
  }

  maybeIngestStaffRecord(profiles, record);

  for (const child of Object.values(record)) {
    if (child && typeof child === "object") walkObjectForStaff(profiles, child, depth + 1);
  }
}

export type PortfolioOfficerContext = {
  customers?: Array<{ assigned_loan_officer_id?: string }>;
  applications?: Array<{ created_by?: string; assigned_officer_id?: string }>;
  loans?: Array<{ loan_officer_id?: string }>;
};

/** Loan-officer workflow IDs only (excludes payment receivers / disbursers). */
export function collectPortfolioLoanOfficerIds(
  payloads: OfficerNamePayloadSources,
  ctx?: PortfolioOfficerContext
): Set<string> {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = String(value ?? "").trim();
    if (id) ids.add(id);
  };

  if (ctx?.customers) {
    for (const customer of ctx.customers) add(customer.assigned_loan_officer_id);
  }
  if (ctx?.applications) {
    for (const application of ctx.applications) {
      add(application.created_by);
      add(application.assigned_officer_id);
    }
  }
  if (ctx?.loans) {
    for (const loan of ctx.loans) add(loan.loan_officer_id);
  }

  const ingestRecord = (record: Record<string, unknown>) => {
    add(record.loan_officer_id);
    add(record.assigned_officer_id);
    add(record.assigned_loan_officer_id);
    add(record.created_by);

    const nestedOfficer = record.loan_officer ?? record.assigned_officer ?? record.creator;
    if (nestedOfficer && typeof nestedOfficer === "object") {
      const nested = nestedOfficer as Record<string, unknown>;
      const role = mapApiRoleToAppRole(typeof nested.role === "string" ? nested.role : "");
      if (!role || role === "loan_officer") {
        add(nested.id);
        add(nested.user_id);
      }
    }
  };

  for (const row of listRows(payloads.rawLoans ?? null, ["data", "loans", "items"])) {
    const record =
      row.loan && typeof row.loan === "object"
        ? (row.loan as Record<string, unknown>)
        : row;
    ingestRecord(record);
  }

  for (const row of listRows(payloads.rawCustomers ?? null, ["data", "customers"])) {
    const record =
      row.customer && typeof row.customer === "object"
        ? (row.customer as Record<string, unknown>)
        : row;
    ingestRecord(record);
  }

  for (const row of listRows(payloads.rawApplications ?? null, ["data", "applications"])) {
    const record =
      row.application && typeof row.application === "object"
        ? (row.application as Record<string, unknown>)
        : row;
    ingestRecord(record);
  }

  return ids;
}

export function collectOfficerIdsFromFlatFields(payloads: OfficerNamePayloadSources): Set<string> {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    const id = String(value ?? "").trim();
    if (id) ids.add(id);
  };

  for (const raw of [payloads.rawApplications, payloads.rawLoans, payloads.rawCustomers, payloads.rawPayments]) {
    if (!raw) continue;
    const keys =
      raw === payloads.rawApplications
        ? ["data", "applications"]
        : raw === payloads.rawLoans
          ? ["data", "loans", "items"]
          : raw === payloads.rawCustomers
            ? ["data", "customers"]
            : ["data", "payments"];

    for (const row of listRows(raw, keys)) {
      const record =
        row.application && typeof row.application === "object"
          ? (row.application as Record<string, unknown>)
          : row.loan && typeof row.loan === "object"
            ? (row.loan as Record<string, unknown>)
            : row.customer && typeof row.customer === "object"
              ? (row.customer as Record<string, unknown>)
              : row.payment && typeof row.payment === "object"
                ? (row.payment as Record<string, unknown>)
                : row;

      add(record.loan_officer_id);
      add(record.assigned_officer_id);
      add(record.created_by);
      add(record.received_by);
      add(record.received_by_id);
      add(record.disbursed_by);
      add(record.disbursed_by_id);
      add(record.assigned_loan_officer_id);

      const nestedOfficer = record.loan_officer ?? record.assigned_officer ?? record.creator;
      if (nestedOfficer && typeof nestedOfficer === "object") {
        add((nestedOfficer as Record<string, unknown>).id);
        add((nestedOfficer as Record<string, unknown>).user_id);
      }
    }
  }

  return ids;
}

/** Loan officers listed on branch export (`GET /branches/{branch}/export`). */
export function extractBranchExportLoanOfficers(raw: unknown): BranchOfficerProfile[] {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const branch = root.branch;
  if (!branch || typeof branch !== "object") return [];

  const pool = (branch as Record<string, unknown>).loan_officers;
  if (!Array.isArray(pool)) return [];

  const officers: BranchOfficerProfile[] = [];
  const seen = new Set<string>();

  for (const item of pool) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const role = mapApiRoleToAppRole(typeof record.role === "string" ? record.role : "");
    if (role && role !== "loan_officer") continue;

    const id = String(record.id ?? record.user_id ?? record.officer_id ?? "").trim();
    const full_name = String(
      record.full_name ?? record.name ?? record.officer_name ?? record.user_name ?? ""
    ).trim();
    const employee_id = String(record.employee_id ?? "").trim();
    const phone = String(record.phone ?? "").trim();
    const email = String(record.email ?? "").trim();

    if (!id && !employee_id && !isUsableOfficerProfileName(full_name)) continue;

    const dedupe =
      id ||
      employee_id ||
      (isUsableOfficerProfileName(full_name) ? norm(full_name) : "");
    if (!dedupe || seen.has(dedupe)) continue;
    seen.add(dedupe);

    officers.push({ id, full_name, employee_id, phone, email });
  }

  return officers;
}

/** Loan officers listed on branch summary (names from staff registration). */
export function extractSummaryLoanOfficersForBranch(
  raw: unknown,
  branchId: string
): BranchOfficerProfile[] {
  const officers: BranchOfficerProfile[] = [];
  const seen = new Set<string>();

  for (const row of collectSummaryRows(raw)) {
    if (!branchIdsMatch(branchIdFromSummaryRow(row), branchId)) continue;

    const pools: unknown[] = [];
    for (const key of ["loan_officers", "officers", "staff", "users"]) {
      const pool = row[key];
      if (Array.isArray(pool)) pools.push(...pool);
    }
    const nested = row.branch;
    if (nested && typeof nested === "object") {
      const branch = nested as Record<string, unknown>;
      for (const key of ["loan_officers", "officers", "staff", "users"]) {
        const pool = branch[key];
        if (Array.isArray(pool)) pools.push(...pool);
      }
    }

    for (const item of pools) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const role = mapApiRoleToAppRole(typeof record.role === "string" ? record.role : "");
      if (role && role !== "loan_officer") continue;

      const id = String(record.id ?? record.user_id ?? record.officer_id ?? "").trim();
      const full_name = String(
        record.full_name ?? record.name ?? record.officer_name ?? record.user_name ?? ""
      ).trim();
      const employee_id = String(record.employee_id ?? "").trim();
      const phone = String(record.phone ?? "").trim();

      if (!id && !employee_id && !isUsableOfficerProfileName(full_name)) continue;

      const dedupe = id || employee_id || (isUsableOfficerProfileName(full_name) ? norm(full_name) : "");
      if (!dedupe || seen.has(dedupe)) continue;
      seen.add(dedupe);

      officers.push({ id, full_name, employee_id, phone, email: String(record.email ?? "") });
    }
  }

  return officers;
}

/** Deep-scan Falco payloads and build id → officer profile (full_name from registration). */
export function buildBranchOfficerProfilesFromPayloads(
  payloads: OfficerNamePayloadSources
): Map<string, BranchOfficerProfile> {
  const profiles = new Map<string, BranchOfficerProfile>();

  for (const raw of [
    payloads.rawBranchesSummary,
    payloads.rawBranchExport,
    payloads.rawApplications,
    payloads.rawLoans,
    payloads.rawCustomers,
    payloads.rawPayments,
  ]) {
    if (raw) walkObjectForStaff(profiles, raw);
  }

  const nameDirectory = buildOfficerNameDirectoryFromApiPayloads(payloads);
  for (const [id, name] of nameDirectory) {
    profiles.set(id, mergeProfile(profiles.get(id), { id, full_name: name }));
  }

  return profiles;
}

function buildLinkMaps(
  profiles: Map<string, BranchOfficerProfile>,
  registry: Map<string, User>
): {
  employeeToUserId: Map<string, string>;
  phoneToUserId: Map<string, string>;
  nameToUserId: Map<string, string>;
} {
  const employeeToUserId = new Map<string, string>();
  const phoneToUserId = new Map<string, string>();
  const nameToUserId = new Map<string, string>();

  const link = (id: string, employee_id?: string, phone?: string, full_name?: string) => {
    if (!id) return;
    if (employee_id) employeeToUserId.set(norm(employee_id), id);
    const phoneKey = digitsOnly(phone);
    if (phoneKey.length >= 9) phoneToUserId.set(phoneKey, id);
    if (isUsableOfficerProfileName(full_name) && !nameToUserId.has(norm(full_name!))) {
      nameToUserId.set(norm(full_name!), id);
    }
  };

  for (const [id, profile] of profiles) {
    link(id, profile.employee_id, profile.phone, profile.full_name);
  }
  for (const user of registry.values()) {
    if (user.role !== "loan_officer" || !user.id) continue;
    link(user.id, user.employee_id, user.phone, user.full_name);
  }

  return { employeeToUserId, phoneToUserId, nameToUserId };
}

function resolveSummaryOfficerId(
  summary: BranchOfficerProfile,
  links: ReturnType<typeof buildLinkMaps>,
  flatIds: Set<string>,
  profiles: Map<string, BranchOfficerProfile>
): string {
  if (summary.id && flatIds.has(summary.id)) return summary.id;
  if (summary.id) return summary.id;

  if (summary.employee_id) {
    const byEmployee = links.employeeToUserId.get(norm(summary.employee_id));
    if (byEmployee) return byEmployee;
  }

  const phoneKey = digitsOnly(summary.phone);
  if (phoneKey.length >= 9) {
    const byPhone = links.phoneToUserId.get(phoneKey);
    if (byPhone) return byPhone;
  }

  if (isUsableOfficerProfileName(summary.full_name)) {
    const byName = links.nameToUserId.get(norm(summary.full_name));
    if (byName) return byName;
  }

  for (const id of flatIds) {
    const profile = profiles.get(id);
    if (!profile) continue;
    if (summary.employee_id && norm(profile.employee_id) === norm(summary.employee_id)) return id;
    const summaryPhone = digitsOnly(summary.phone);
    const profilePhone = digitsOnly(profile.phone);
    if (summaryPhone.length >= 9 && summaryPhone === profilePhone) return id;
  }

  return "";
}

export function isSyntheticOfficerId(id: string): boolean {
  return id.startsWith("emp:") || id.startsWith("name:");
}

/** Map roster entry to the user id used in portfolio metrics (real UUID when linked). */
export function resolveOfficerMetricUserId(
  officer: User,
  payloads: OfficerNamePayloadSources,
  registry: Map<string, User>
): string {
  const id = officer.id.trim();
  if (!isSyntheticOfficerId(id)) return id;

  const profiles = buildBranchOfficerProfilesFromPayloads(payloads);
  const links = buildLinkMaps(profiles, registry);

  if (officer.employee_id) {
    const byEmployee = links.employeeToUserId.get(norm(officer.employee_id));
    if (byEmployee && !isSyntheticOfficerId(byEmployee)) return byEmployee;
  }

  const phoneKey = digitsOnly(officer.phone);
  if (phoneKey.length >= 9) {
    const byPhone = links.phoneToUserId.get(phoneKey);
    if (byPhone && !isSyntheticOfficerId(byPhone)) return byPhone;
  }

  if (isUsableOfficerProfileName(officer.full_name)) {
    const byName = links.nameToUserId.get(norm(officer.full_name));
    if (byName && !isSyntheticOfficerId(byName)) return byName;
  }

  return id;
}

function dedupeRosterProfiles(
  roster: Map<string, BranchOfficerProfile>
): Map<string, BranchOfficerProfile> {
  const result = new Map<string, BranchOfficerProfile>();
  const indexByKey = new Map<string, string>();

  for (const [id, profile] of roster) {
    const key =
      norm(profile.employee_id) ||
      (isUsableOfficerProfileName(profile.full_name) ? `name:${norm(profile.full_name)}` : "") ||
      id;
    const existingId = indexByKey.get(key);

    if (!existingId) {
      indexByKey.set(key, id);
      result.set(id, profile);
      continue;
    }

    if (isSyntheticOfficerId(existingId) && !isSyntheticOfficerId(id)) {
      result.delete(existingId);
      indexByKey.set(key, id);
      result.set(id, mergeProfile(profile, result.get(existingId)));
      continue;
    }

    if (!isSyntheticOfficerId(existingId) && isSyntheticOfficerId(id)) {
      result.set(existingId, mergeProfile(result.get(existingId), profile));
      continue;
    }

    result.set(id, profile);
  }

  return result;
}

/**
 * Registered branch loan officers only (staff directory, summary, export).
 * Does not include every user id found in customers/loans/payments payloads.
 */
export function resolveRegisteredBranchLoanOfficers(
  branchId: string,
  payloads: OfficerNamePayloadSources,
  registry: Map<string, User>,
  staffRoster: User[],
  sessionUser?: SessionUser
): User[] {
  const nameDirectory = buildOfficerNameDirectoryFromApiPayloads(payloads);
  const profiles = buildBranchOfficerProfilesFromPayloads(payloads);
  const links = buildLinkMaps(profiles, registry);
  const flatIds = collectOfficerIdsFromFlatFields(payloads);

  const summaryOfficers = [
    ...(payloads.rawBranchesSummary
      ? extractSummaryLoanOfficersForBranch(payloads.rawBranchesSummary, branchId)
      : []),
    ...(payloads.rawBranchExport
      ? extractBranchExportLoanOfficers(payloads.rawBranchExport)
      : []),
  ];

  const byId = new Map<string, User>();

  const upsert = (officer: User) => {
    if (!officer.id) return;
    if (officer.role && officer.role !== "loan_officer") return;
    if (officer.is_active === false) return;
    if (officer.branch_id && !branchIdsMatch(officer.branch_id, branchId)) return;

    const resolvedName =
      (isUsableOfficerProfileName(officer.full_name) ? officer.full_name.trim() : "") ||
      nameDirectory.get(officer.id) ||
      "";
    if (!isUsableOfficerProfileName(resolvedName) && !officer.employee_id?.trim()) return;

    byId.set(
      officer.id,
      adaptApiUserToUser({
        ...officer,
        id: officer.id,
        full_name: resolvedName,
        role: "loan_officer",
        branch_id: branchId,
        is_active: true,
      })
    );
  };

  for (const officer of staffRoster) upsert(officer);
  for (const user of registry.values()) upsert(user);

  for (const summary of summaryOfficers) {
    let id = resolveSummaryOfficerId(summary, links, flatIds, profiles);
    if (!id && summary.id) id = summary.id;
    if (!id && summary.employee_id) id = `emp:${norm(summary.employee_id)}`;
    if (!id && isUsableOfficerProfileName(summary.full_name)) {
      id = `name:${norm(summary.full_name)}`;
    }
    if (!id) continue;

    const registryUser = registry.get(id);
    const resolvedName =
      (isUsableOfficerProfileName(summary.full_name) ? summary.full_name : "") ||
      nameDirectory.get(id) ||
      (isUsableOfficerProfileName(registryUser?.full_name) ? registryUser!.full_name : "") ||
      (sessionUser?.id === id ? sessionUser.full_name : "");

    if (!isUsableOfficerProfileName(resolvedName) && !summary.employee_id?.trim()) continue;

    upsert(
      adaptApiUserToUser({
        id,
        full_name: resolvedName,
        employee_id: summary.employee_id || registryUser?.employee_id || "",
        email: summary.email || registryUser?.email || "",
        phone: summary.phone || registryUser?.phone || "",
        role: "loan_officer",
        branch_id: branchId,
        is_active: true,
      })
    );
  }

  if (
    sessionUser?.role === "loan_officer" &&
    sessionUser.id &&
    branchIdsMatch(sessionUser.branch_id, branchId)
  ) {
    upsert(
      adaptApiUserToUser({
        id: sessionUser.id,
        email: sessionUser.email,
        full_name: sessionUser.full_name,
        role: "loan_officer",
        branch_id: sessionUser.branch_id,
        employee_id: "",
        phone: "",
        is_active: true,
      })
    );
  }

  return Array.from(byId.values());
}

/**
 * Stable branch roster: summary officers first, then linked operational IDs.
 * Names come from branch summary and nested Falco payload objects.
 */
export function resolveCanonicalBranchLoanOfficers(
  branchId: string,
  payloads: OfficerNamePayloadSources,
  registry: Map<string, User>,
  sessionUser?: SessionUser,
  portfolioCtx?: PortfolioOfficerContext
): User[] {
  const profiles = buildBranchOfficerProfilesFromPayloads(payloads);
  const flatIds = collectOfficerIdsFromFlatFields(payloads);
  const portfolioIds = collectPortfolioLoanOfficerIds(payloads, portfolioCtx);
  const links = buildLinkMaps(profiles, registry);
  const nameDirectory = buildOfficerNameDirectoryFromApiPayloads(payloads);
  const summaryOfficers = [
    ...(payloads.rawBranchesSummary
      ? extractSummaryLoanOfficersForBranch(payloads.rawBranchesSummary, branchId)
      : []),
    ...(payloads.rawBranchExport
      ? extractBranchExportLoanOfficers(payloads.rawBranchExport)
      : []),
  ];

  for (const [id, user] of registry) {
    if (user.role !== "loan_officer" || user.is_active === false) continue;
    if (user.branch_id && !branchIdsMatch(user.branch_id, branchId)) continue;
    flatIds.add(id);
    profiles.set(
      id,
      mergeProfile(profiles.get(id), {
        id,
        full_name: user.full_name,
        employee_id: user.employee_id,
        email: user.email,
        phone: user.phone,
      })
    );
  }

  const rosterProfiles = new Map<string, BranchOfficerProfile>();

  const upsertRosterProfile = (id: string, patch: Partial<BranchOfficerProfile>) => {
    if (!id) return;
    rosterProfiles.set(id, mergeProfile(rosterProfiles.get(id), { id, ...patch }));
  };

  for (const summary of summaryOfficers) {
    let id = resolveSummaryOfficerId(summary, links, flatIds, profiles);
    if (!id && summary.id) id = summary.id;
    if (!id && summary.employee_id) id = `emp:${norm(summary.employee_id)}`;
    if (!id && isUsableOfficerProfileName(summary.full_name)) {
      id = `name:${norm(summary.full_name)}`;
    }
    if (!id) continue;

    upsertRosterProfile(id, {
      full_name: summary.full_name,
      employee_id: summary.employee_id || profiles.get(id)?.employee_id,
      phone: summary.phone || profiles.get(id)?.phone,
    });
  }

  const summaryLinkedIds = new Set<string>();
  for (const summary of summaryOfficers) {
    let linkedId = resolveSummaryOfficerId(summary, links, flatIds, profiles);
    if (!linkedId && summary.id) linkedId = summary.id;
    if (!linkedId && summary.employee_id) linkedId = `emp:${norm(summary.employee_id)}`;
    if (!linkedId && isUsableOfficerProfileName(summary.full_name)) {
      linkedId = `name:${norm(summary.full_name)}`;
    }
    if (linkedId) summaryLinkedIds.add(linkedId);
  }

  const isKnownLoanOfficer = (id: string, profile?: BranchOfficerProfile): boolean => {
    const registryUser = registry.get(id);
    if (registryUser?.role === "loan_officer" && registryUser.is_active !== false) return true;
    if (summaryLinkedIds.has(id)) return true;
    const resolvedName =
      (isUsableOfficerProfileName(profile?.full_name) ? profile!.full_name : "") ||
      nameDirectory.get(id) ||
      "";
    if (!isUsableOfficerProfileName(resolvedName)) return false;
    if (profile?.employee_id?.trim()) return true;
    for (const summary of summaryOfficers) {
      if (
        summary.employee_id &&
        profile?.employee_id &&
        norm(summary.employee_id) === norm(profile.employee_id)
      ) {
        return true;
      }
      if (
        isUsableOfficerProfileName(summary.full_name) &&
        isUsableOfficerProfileName(resolvedName) &&
        norm(summary.full_name) === norm(resolvedName)
      ) {
        return true;
      }
    }
    return portfolioIds.has(id);
  };

  for (const id of portfolioIds) {
    if (!isKnownLoanOfficer(id, profiles.get(id))) continue;

    const profile = profiles.get(id);
    let summaryName = "";
    let summaryEmployeeId = "";
    for (const summary of summaryOfficers) {
      const employeeMatch =
        summary.employee_id &&
        profile?.employee_id &&
        norm(summary.employee_id) === norm(profile.employee_id);
      const phoneMatch =
        digitsOnly(summary.phone).length >= 9 &&
        digitsOnly(summary.phone) === digitsOnly(profile?.phone);
      const nameMatch =
        isUsableOfficerProfileName(summary.full_name) &&
        isUsableOfficerProfileName(profile?.full_name) &&
        norm(summary.full_name) === norm(profile!.full_name);
      if (employeeMatch || phoneMatch || nameMatch) {
        summaryName = summary.full_name;
        summaryEmployeeId = summary.employee_id;
        break;
      }
    }

    upsertRosterProfile(id, {
      full_name: summaryName || profile?.full_name || rosterProfiles.get(id)?.full_name,
      employee_id: summaryEmployeeId || profile?.employee_id || rosterProfiles.get(id)?.employee_id,
      phone: profile?.phone ?? rosterProfiles.get(id)?.phone,
      email: profile?.email ?? rosterProfiles.get(id)?.email,
    });
  }

  if (
    sessionUser?.role === "loan_officer" &&
    sessionUser.id &&
    branchIdsMatch(sessionUser.branch_id, branchId)
  ) {
    upsertRosterProfile(sessionUser.id, {
      full_name: sessionUser.full_name,
    });
  }

  const dedupedRoster = dedupeRosterProfiles(rosterProfiles);
  const officers: User[] = [];

  for (const [id, profile] of dedupedRoster) {
    const registryUser = registry.get(id);
    const resolvedName =
      (isUsableOfficerProfileName(profile.full_name) ? profile.full_name : "") ||
      nameDirectory.get(id) ||
      (isUsableOfficerProfileName(registryUser?.full_name) ? registryUser!.full_name : "") ||
      (sessionUser?.id === id ? sessionUser.full_name : "");

    officers.push(
      adaptApiUserToUser({
        id,
        full_name: resolvedName,
        employee_id: profile.employee_id || registryUser?.employee_id || "",
        email: profile.email || registryUser?.email || "",
        phone: profile.phone || registryUser?.phone || "",
        role: "loan_officer",
        branch_id: branchId,
        is_active: true,
      })
    );
  }

  return officers
    .filter((officer) => officer.role === "loan_officer" && officer.id)
    .sort((a, b) => {
      const nameA = isUsableOfficerProfileName(a.full_name) ? a.full_name : a.employee_id || a.id;
      const nameB = isUsableOfficerProfileName(b.full_name) ? b.full_name : b.employee_id || b.id;
      return nameA.localeCompare(nameB);
    });
}

function mergeNameEntry(names: Map<string, string>, id: string, candidate: string | undefined): void {
  if (!id || !isUsableOfficerProfileName(candidate)) return;
  const next = candidate!.trim();
  const prev = names.get(id);
  if (!prev || next.split(/\s+/).length > prev.split(/\s+/).length || next.length > prev.length) {
    names.set(id, next);
  }
}

export function buildBranchOfficerNameMap(
  officers: User[],
  payloads?: OfficerNamePayloadSources,
  registry?: Map<string, User>
): Map<string, string> {
  const names = new Map<string, string>();
  if (payloads) {
    for (const [id, name] of buildOfficerNameDirectoryFromApiPayloads(payloads)) {
      mergeNameEntry(names, id, name);
    }
  }
  if (registry) {
    for (const [id, user] of registry) {
      mergeNameEntry(names, id, user.full_name);
    }
  }
  for (const officer of officers) {
    mergeNameEntry(names, officer.id, officer.full_name);
  }
  return names;
}
