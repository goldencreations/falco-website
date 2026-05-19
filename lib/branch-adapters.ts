import type { Branch } from "@/lib/types";

function normalizeBoolean(value: unknown, defaultValue = true): boolean {
 if (value === null || value === undefined) return defaultValue;
 if (typeof value === "boolean") return value;
 if (typeof value === "number") return value !== 0;
 if (typeof value === "string") {
 const v = value.trim().toLowerCase();
 if (v === "true" || v === "1" || v === "yes") return true;
 if (v === "false" || v === "0" || v === "no") return false;
 }
 return defaultValue;
}

/** Normalize a single branch row from the LMS API. */
export function adaptApiBranchToBranch(row: Record<string, unknown>): Branch {
 return {
 id: String(row.id ?? ""),
 name: String(row.name ?? row.branch_name ?? ""),
 code: String(row.code ?? row.branch_code ?? ""),
 region: String(row.region ?? ""),
 address: String(row.address ?? ""),
 phone: String(row.phone ?? ""),
 manager_id: row.manager_id == null || row.manager_id === "" ? "" : String(row.manager_id),
 is_active: normalizeBoolean(row.is_active, true),
 };
}

function collectBranchRows(raw: unknown): Record<string, unknown>[] {
 const rows: Record<string, unknown>[] = [];
 if (Array.isArray(raw)) {
 for (const item of raw) {
 if (item && typeof item === "object") rows.push(item as Record<string, unknown>);
 }
 return rows;
 }
 if (!raw || typeof raw !== "object") return rows;
 const o = raw as Record<string, unknown>;
 for (const key of ["branches", "data"]) {
 const candidate = o[key];
 if (Array.isArray(candidate)) {
 for (const item of candidate) {
 if (item && typeof item === "object") rows.push(item as Record<string, unknown>);
 }
 return rows;
 }
 }
 return rows;
}

export function extractBranchesList(raw: unknown): Branch[] {
 return collectBranchRows(raw)
 .map(adaptApiBranchToBranch)
 .filter((branch) => Boolean(branch.id));
}

/** Merge branch lists by id (first occurrence wins). */
export function mergeBranchesList(...lists: Branch[][]): Branch[] {
 const byId = new Map<string, Branch>();
 for (const list of lists) {
 for (const branch of list) {
 const id = String(branch.id).trim();
 if (!id || byId.has(id)) continue;
 byId.set(id, branch);
 }
 }
 return Array.from(byId.values()).sort((a, b) =>
 (a.name || a.code).localeCompare(b.name || b.code)
 );
}

/** Settings branch rows (`GET /settings/branches`) → full `Branch` records. */
export function settingsRowsToBranches(
 rows: Array<{ id: string; name: string; code?: string; region?: string }>
): Branch[] {
 return rows
 .filter((row) => row.id.trim())
 .map((row) => ({
 id: row.id.trim(),
 name: row.name.trim() || row.code?.trim() || row.id.trim(),
 code: row.code?.trim() || row.id.trim(),
 region: row.region?.trim() ?? "",
 address: "",
 phone: "",
 manager_id: "",
 is_active: true,
 }));
}

export function extractSingleBranch(raw: unknown): Branch | null {
 if (!raw || typeof raw !== "object") return null;
 const o = raw as Record<string, unknown>;
 if (o.branch && typeof o.branch === "object") {
 return adaptApiBranchToBranch(o.branch as Record<string, unknown>);
 }
 const data = o.data;
 if (data && typeof data === "object") {
 const d = data as Record<string, unknown>;
 if (d.branch && typeof d.branch === "object") {
 return adaptApiBranchToBranch(d.branch as Record<string, unknown>);
 }
 if ("id" in d && "name" in d) return adaptApiBranchToBranch(d);
 }
 if ("id" in o && "name" in o) return adaptApiBranchToBranch(o);
 return null;
}
