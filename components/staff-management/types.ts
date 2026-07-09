export type StaffRole =
 | "super_admin"
 | "branch_manager"
 | "loan_officer"
 | "accountant"
 | "credit_analyst"
 | "collections_officer";

export type StaffStatusFilter = "all" | "active" | "suspended";

export interface StaffRecord {
 id: string;
 email: string;
 full_name: string;
 role: StaffRole;
 branch_id: string;
 phone: string;
 employee_id: string;
 is_active: boolean;
 created_at: string;
 updated_at: string;
 last_login: string | null;
}

export interface StaffFormState {
 full_name: string;
 email: string;
 phone: string;
 role: StaffRole;
 branch_id: string;
 password: string;
 confirmPassword: string;
}

export interface StaffEditFormState {
 full_name: string;
 email: string;
 phone: string;
 role: StaffRole;
 branch_id: string;
 is_active: boolean;
}

/** Result of a successful admin-initiated password reset — shown once, then discarded. */
export interface PasswordResetResult {
 staff: StaffRecord;
 temporaryPassword: string;
}
