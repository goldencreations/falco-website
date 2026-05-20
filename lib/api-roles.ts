import type { UserRole } from "@/lib/types";

/** Roles returned by the Falco LMS API (`GET /api/me`, login payload). */
export type ApiStaffRole =
 | "admin"
 | "manager"
 | "loan_officer"
 | "credit_analyst"
 | "collections_officer"
 | "accountant"
 | "customer_service";

const API_TO_APP: Record<ApiStaffRole, UserRole> = {
 admin: "super_admin",
 manager: "branch_manager",
 loan_officer: "loan_officer",
 credit_analyst: "credit_analyst",
 collections_officer: "collections_officer",
 accountant: "accountant",
 customer_service: "customer_service",
};

export function mapApiRoleToAppRole(role: string | undefined | null): UserRole | null {
 if (!role) return null;
 const key = String(role).trim().toLowerCase() as ApiStaffRole;
 const mapped = API_TO_APP[key];
 return mapped ?? null;
}

/** Map app role to API role for `POST/PATCH /users` payloads. */
export function mapAppRoleToApiRole(role: UserRole): ApiStaffRole | null {
 const entry = Object.entries(API_TO_APP).find(([, v]) => v === role);
 return (entry?.[0] as ApiStaffRole) ?? null;
}
