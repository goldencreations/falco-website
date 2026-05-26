import type { SessionUser } from "@/lib/auth";

function permissionsFor(user: Pick<SessionUser, "role" | "permissions">): string[] {
 if (user.permissions?.length) return user.permissions;
 if (user.role === "super_admin") {
 return ["disbursements.prepare", "disbursements.approve", "loans.view", "loans.disburse"];
 }
 if (user.role === "branch_manager") {
 return ["disbursements.prepare", "loans.view", "loans.disburse"];
 }
 if (user.role === "loan_officer") {
 return ["disbursements.prepare", "loans.view"];
 }
 if (user.role === "accountant") {
 return ["disbursements.approve", "disbursements.prepare", "loans.view", "loans.disburse"];
 }
 return [];
}

export function canPrepareDisbursement(user: Pick<SessionUser, "role" | "permissions">): boolean {
 const perms = permissionsFor(user);
 if (perms.includes("disbursements.prepare")) return true;
 if (perms.includes("loans.disburse")) return true;
 return (
 user.role === "super_admin" ||
 user.role === "branch_manager" ||
 user.role === "loan_officer" ||
 user.role === "accountant"
 );
}

export function canApproveDisbursement(user: Pick<SessionUser, "role" | "permissions">): boolean {
 const perms = permissionsFor(user);
 if (perms.includes("disbursements.approve")) return true;
 if (user.role === "accountant") return true;
 return user.role === "super_admin";
}
