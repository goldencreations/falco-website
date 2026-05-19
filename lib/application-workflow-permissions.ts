import type { SessionUser } from "@/lib/auth";

function userPermissions(user: Pick<SessionUser, "role" | "permissions">): string[] {
 if (user.permissions?.length) return user.permissions;
 if (user.role === "super_admin") {
 return ["loans.review", "loans.approve", "applications.review", "applications.view"];
 }
 if (user.role === "branch_manager") {
 return ["loans.review", "applications.review", "applications.view"];
 }
 return [];
}

/** Manager / first-level review (`under_review` → `approved`). */
export function canManagerReviewApplication(user: Pick<SessionUser, "role" | "permissions">): boolean {
 const perms = userPermissions(user);
 if (perms.includes("loans.review")) return true;
 if (perms.includes("applications.review")) return true;
 return user.role === "branch_manager";
}

/** Final approval that creates the loan (`approved` → `pending_disbursement`). */
export function canFinalApproveApplication(user: Pick<SessionUser, "role" | "permissions">): boolean {
 const perms = userPermissions(user);
 if (perms.includes("loans.approve")) return true;
 return user.role === "super_admin";
}

export function canRunApplicationApprovalWorkflow(
 user: Pick<SessionUser, "role" | "permissions">
): boolean {
 return canManagerReviewApplication(user) || canFinalApproveApplication(user);
}
