import type { Branch, User } from "@/lib/types";

/** Branches available for customer assignment (treat missing is_active as active). */
export function activeBranchesForAssignment(branches: Branch[], lockedBranchId = ""): Branch[] {
 return branches.filter(
 (branch) =>
 branch.is_active !== false &&
 (!lockedBranchId || String(branch.id).trim() === String(lockedBranchId).trim())
 );
}

/** Loan officers assigned to the given branch. */
export function loanOfficersForBranch(users: User[], branchId: string): User[] {
 const target = String(branchId).trim();
 if (!target) return [];
 return users.filter(
 (user) =>
 user.role === "loan_officer" &&
 user.is_active !== false &&
 String(user.branch_id).trim() === target
 );
}
