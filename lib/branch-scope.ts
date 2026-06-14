import type { Branch, UserRole } from "@/lib/types";

/** Minimal user shape for branch scoping (safe in client components). */
export type BranchScopedUser = {
 role: UserRole;
 branch_id: string;
};

export function isBranchDataScoped(user: BranchScopedUser): boolean {
 return user.role !== "super_admin" && Boolean(user.branch_id?.trim());
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
