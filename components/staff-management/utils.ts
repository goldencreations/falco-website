import { users } from "@/lib/mock-data";
import type { StaffProvisioningRole } from "@/lib/staff-requests-types";
import {
  PasswordResetState,
  StaffEditFormState,
  StaffFormState,
  StaffRecord,
  StaffRole,
} from "@/components/staff-management/types";

export const ONLINE_WINDOW_MINUTES = 15;

export const STAFF_ROLE_OPTIONS: Array<{
  label: string;
  value: StaffRole;
  portalAccess: boolean;
}> = [
  { label: "Super Admin", value: "super_admin", portalAccess: true },
  { label: "Branch Manager", value: "branch_manager", portalAccess: true },
  { label: "Loan Officer", value: "loan_officer", portalAccess: true },
  { label: "Credit Analyst", value: "credit_analyst", portalAccess: false },
  { label: "Collections Officer", value: "collections_officer", portalAccess: false },
];

/** Branch-proposed and super-admin–queued hires: loan officer, credit, collections only. */
export const PROVISIONING_STAFF_ROLE_OPTIONS = STAFF_ROLE_OPTIONS.filter((o) =>
  (["loan_officer", "credit_analyst", "collections_officer"] as const).includes(
    o.value as StaffProvisioningRole
  )
);

const STAFF_ROLE_VALUES = new Set(STAFF_ROLE_OPTIONS.map((o) => o.value));

export function isStaffRole(value: string): value is StaffRole {
  return STAFF_ROLE_VALUES.has(value as StaffRole);
}

export function roleHasPortalAccess(role: StaffRole): boolean {
  return STAFF_ROLE_OPTIONS.find((o) => o.value === role)?.portalAccess ?? false;
}

export const defaultCreateForm: StaffFormState = {
  full_name: "",
  email: "",
  phone: "",
  role: "loan_officer",
  branch_id: "",
  password: "",
  confirmPassword: "",
};

export const defaultResetForm: PasswordResetState = {
  password: "",
  confirmPassword: "",
};

export function mapUserToStaff(user: (typeof users)[number], index: number): StaffRecord | null {
  if (!isStaffRole(user.role)) {
    return null;
  }

  const lastLogin =
    index === 0 ? new Date(Date.now() - 5 * 60 * 1000).toISOString() : user.last_login;

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    branch_id: user.branch_id,
    phone: user.phone,
    employee_id: user.employee_id,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.created_at,
    last_login: lastLogin,
  };
}

const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  branch_manager: "Branch Manager",
  loan_officer: "Loan Officer",
  credit_analyst: "Credit Analyst",
  collections_officer: "Collections Officer",
};

export function roleLabel(role: StaffRole) {
  return ROLE_LABELS[role];
}

const ROLE_BADGE_CLASSES: Record<StaffRole, string> = {
  super_admin: "border-destructive/25 bg-destructive/10 text-destructive",
  branch_manager: "border-info/20 bg-info/10 text-info",
  loan_officer: "border-primary/20 bg-primary/10 text-primary",
  credit_analyst: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  collections_officer: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

export function roleBadgeClass(role: StaffRole) {
  return ROLE_BADGE_CLASSES[role];
}

export function isOnline(lastLogin: string | null) {
  if (!lastLogin) return false;
  const elapsedMs = Date.now() - new Date(lastLogin).getTime();
  return elapsedMs <= ONLINE_WINDOW_MINUTES * 60 * 1000;
}

export function emptyEditForm(staff: StaffRecord): StaffEditFormState {
  return {
    full_name: staff.full_name,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    branch_id: staff.branch_id,
    is_active: staff.is_active,
  };
}

export function validateStaffForm(form: StaffFormState) {
  if (!form.full_name.trim()) return "Full name is required.";
  if (!form.email.trim() || !form.email.includes("@")) return "A valid email is required.";
  if (!form.phone.trim()) return "Phone is required.";
  if (!form.branch_id) return "Branch assignment is required.";
  if (roleHasPortalAccess(form.role)) {
    if (!form.password || form.password.length < 8) {
      return "Password must be at least 8 characters for roles with portal access.";
    }
    if (form.password !== form.confirmPassword) {
      return "Password confirmation does not match.";
    }
  }
  return "";
}

const PROVISIONING_ROLES: StaffProvisioningRole[] = [
  "loan_officer",
  "collections_officer",
  "credit_analyst",
];

export function isProvisioningStaffRole(role: StaffRole): role is StaffProvisioningRole {
  return PROVISIONING_ROLES.includes(role as StaffProvisioningRole);
}

/** Pending hire form: no password until an administrator approves provisioning. */
export function validateProvisioningHireForm(form: StaffFormState) {
  if (!form.full_name.trim()) return "Full name is required.";
  if (!form.email.trim() || !form.email.includes("@")) return "A valid email is required.";
  if (!form.phone.trim()) return "Phone is required.";
  if (!form.branch_id) return "Branch assignment is required.";
  if (!isProvisioningStaffRole(form.role)) {
    return "Role must be loan officer, credit analyst, or collections officer.";
  }
  return "";
}

export function validatePasswordReset(form: PasswordResetState) {
  if (!form.password || form.password.length < 8) return "New password must be at least 8 characters.";
  if (form.password !== form.confirmPassword) return "Password confirmation does not match.";
  return "";
}
