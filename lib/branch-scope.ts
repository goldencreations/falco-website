import type { Branch, UserRole } from "@/lib/types";

/** Minimal user shape for branch scoping (safe in client components). */
export type BranchScopedUser = {
 role: UserRole;
 branch_id: string;
};

export function isBranchDataScoped(user: BranchScopedUser): boolean {
 return user.role !== "super_admin" && Boolean(user.branch_id?.trim());
}

/** Normalize branch codes/ids for comparisons (`branch-d012` vs `BRANCH-D012`). */
export function normalizeBranchKey(value: string): string {
 return value.trim().toLowerCase().replace(/^branch[-_\s]*/, "").replace(/[^a-z0-9]/g, "");
}

export function branchIdsMatch(
 a: string | undefined | null,
 b: string | undefined | null
): boolean {
 const left = normalizeBranchKey(String(a ?? ""));
 const right = normalizeBranchKey(String(b ?? ""));
 if (!left || !right) return false;
 return left === right;
}

export function branchMatchesScope(branch: Branch, scopedId: string): boolean {
 const scope = normalizeBranchKey(scopedId);
 return (
 normalizeBranchKey(String(branch.id)) === scope ||
 normalizeBranchKey(String(branch.code)) === scope
 );
}

export function knownBranchNameFromCode(branchId: string): string | null {
 const key = branchId.trim().toLowerCase();
 if (key === "branch-d012") return "Dar main";
 return null;
}

export function syntheticBranchFromSession(user: BranchScopedUser): Branch {
 const id = user.branch_id.trim() || "branch";
 return {
 id,
 name: knownBranchNameFromCode(id) ?? "Branch",
 code: id,
 region: "",
 address: "",
 phone: "",
 manager_id: "",
 is_active: true,
 };
}
