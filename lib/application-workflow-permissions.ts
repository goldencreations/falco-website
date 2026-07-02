type PermissionUser = {
 role: string;
 permissions?: string[];
};

function userPermissions(user: PermissionUser): string[] {
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
export function canManagerReviewApplication(user: PermissionUser): boolean {
 const perms = userPermissions(user);
 if (perms.includes("loans.review")) return true;
 if (perms.includes("applications.review")) return true;
 return user.role === "branch_manager";
}

/** Final approval that creates the loan (`approved` → `pending_disbursement`). */
export function canFinalApproveApplication(user: PermissionUser): boolean {
 // The backend's final application transition is deliberately admin-only.
 // Managers perform the first-level review even if an older session still
 // contains the former `loans.approve` grant.
 return user.role === "super_admin";
}

export function canRunApplicationApprovalWorkflow(
 user: PermissionUser
): boolean {
 return canManagerReviewApplication(user) || canFinalApproveApplication(user);
}
