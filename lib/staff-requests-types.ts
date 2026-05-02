/** Workflow entities for provisioning and access changes — mirrors future HR/access tables. */

export type StaffRequestStatus = "pending" | "approved" | "rejected";

/** Roles a branch manager may propose (excludes branch_manager and super_admin). */
export type StaffProvisioningRole = "loan_officer" | "collections_officer" | "credit_analyst";

export interface StaffProvisioningRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: StaffProvisioningRole;
  branch_id: string;
  requested_by: string;
  status: StaffRequestStatus;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

export interface StaffAccessRequest {
  id: string;
  type: "suspend" | "reinstate";
  staff_id: string;
  requested_by: string;
  reason: string | null;
  status: StaffRequestStatus;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
}
