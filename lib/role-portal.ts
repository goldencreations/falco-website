import type { UserRole } from "@/lib/types";

/** One home route per role — used after login and for middleware redirects. */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
 super_admin: "/dashboard",
 branch_manager: "/manager/dashboard",
 loan_officer: "/officer/dashboard",
 accountant: "/accountant/dashboard",
 credit_analyst: "/dashboard",
 collections_officer: "/dashboard",
 customer_service: "/dashboard",
};

/** Prefixes a role must not use (middleware sends them to ROLE_HOME_PATH). */
const FORBIDDEN_PREFIXES: Partial<Record<UserRole, readonly string[]>> = {
 branch_manager: ["/dashboard", "/officer", "/accountant", "/users"],
  loan_officer: [
    "/dashboard",
    "/manager",
    "/accountant",
    "/users",
    "/officer/collections",
    "/officer/disbursements",
    "/officer/payments",
    "/officer/reconciliation",
    "/officer/reports",
  ],
 accountant: ["/dashboard", "/manager", "/officer", "/users"],
 super_admin: ["/manager", "/officer", "/accountant", "/staff/team"],
};

export function loginRedirectForRole(role: UserRole): string {
 return ROLE_HOME_PATH[role] ?? "/dashboard";
}

/** Base path prefix for role-specific portals (`""` = super admin / dashboard). */
export function rolePortalBase(role: UserRole | undefined | null): string {
 switch (role) {
 case "branch_manager":
 return "/manager";
 case "loan_officer":
 return "/officer";
 case "accountant":
 return "/accountant";
 default:
 return "";
 }
}

export function isBranchScopedStaffRole(role: UserRole | undefined | null): boolean {
 return (
 role === "branch_manager" ||
 role === "loan_officer" ||
 role === "accountant" ||
 role === "collections_officer"
 );
}

/** True when pathname is not allowed for this role. */
export function isForbiddenPathForRole(role: UserRole, pathname: string): boolean {
 if (pathname.startsWith("/users") && role !== "super_admin") return true;
 const prefixes = FORBIDDEN_PREFIXES[role];
 if (!prefixes) return false;
 return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
