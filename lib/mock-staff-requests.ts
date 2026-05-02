import { branches } from "@/lib/mock-data";
import { addDirectoryUser, listDirectoryUsers, patchDirectoryUser } from "@/lib/mock-user-directory";
import type {
  StaffAccessRequest,
  StaffProvisioningRequest,
  StaffProvisioningRole,
  StaffRequestStatus,
} from "@/lib/staff-requests-types";
import type { User } from "@/lib/types";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

let provisioningRequests: StaffProvisioningRequest[] = [
  {
    id: "prov-seed-001",
    full_name: "Neema Kavishe",
    email: "neema.kavishe@pending.falco.local",
    phone: "+255 700 000 001",
    role: "loan_officer",
    branch_id: "br-002",
    requested_by: "usr-006",
    status: "pending",
    created_at: "2024-01-08T10:00:00.000Z",
    updated_at: "2024-01-08T10:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    notes: null,
  },
];

let accessRequests: StaffAccessRequest[] = [];

export function listProvisioningRequests(filter?: { status?: StaffRequestStatus; branch_id?: string }) {
  let list = [...provisioningRequests].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (filter?.status) list = list.filter((r) => r.status === filter.status);
  if (filter?.branch_id) list = list.filter((r) => r.branch_id === filter.branch_id);
  return list;
}

export function listAccessRequests(filter?: { status?: StaffRequestStatus }) {
  let list = [...accessRequests].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  if (filter?.status) list = list.filter((r) => r.status === filter.status);
  return list;
}

export function createProvisioningRequest(input: {
  full_name: string;
  email: string;
  phone: string;
  role: StaffProvisioningRole;
  branch_id: string;
  requested_by: string;
}): StaffProvisioningRequest {
  const now = new Date().toISOString();
  const row: StaffProvisioningRequest = {
    id: uid("prov"),
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    role: input.role,
    branch_id: input.branch_id,
    requested_by: input.requested_by,
    status: "pending",
    created_at: now,
    updated_at: now,
    reviewed_by: null,
    reviewed_at: null,
    notes: null,
  };
  provisioningRequests = [row, ...provisioningRequests];
  return row;
}

export function createAccessRequest(input: {
  type: "suspend" | "reinstate";
  staff_id: string;
  requested_by: string;
  reason?: string | null;
}): StaffAccessRequest {
  const now = new Date().toISOString();
  const row: StaffAccessRequest = {
    id: uid("acc"),
    type: input.type,
    staff_id: input.staff_id,
    requested_by: input.requested_by,
    reason: input.reason ?? null,
    status: "pending",
    created_at: now,
    updated_at: now,
    reviewed_by: null,
    reviewed_at: null,
    resolution_notes: null,
  };
  accessRequests = [row, ...accessRequests];
  return row;
}

function employeeIdNext(): string {
  const n = listDirectoryUsers().length + 104;
  return `EMP-${String(n).padStart(3, "0")}`;
}

export function patchProvisioningRequest(
  id: string,
  action: {
    status: StaffRequestStatus;
    reviewed_by: string;
    notes?: string | null;
  }
): { ok: true; request: StaffProvisioningRequest } | { ok: false; error: string } {
  const idx = provisioningRequests.findIndex((r) => r.id === id);
  if (idx === -1) return { ok: false, error: "Request not found" };
  const prev = provisioningRequests[idx];
  if (prev.status !== "pending" && action.status !== prev.status) {
    return { ok: false, error: "Request already resolved" };
  }

  const now = new Date().toISOString();
  const next: StaffProvisioningRequest = {
    ...prev,
    status: action.status,
    reviewed_by: action.reviewed_by,
    reviewed_at: now,
    notes: action.notes ?? prev.notes,
    updated_at: now,
  };
  provisioningRequests = provisioningRequests.map((r) => (r.id === id ? next : r));

  if (action.status === "approved") {
    const dup = listDirectoryUsers().some((u) => u.email.toLowerCase() === prev.email.toLowerCase());
    if (dup) {
      return { ok: false, error: "Email already exists on directory" };
    }
    const branch = branches.find((b) => b.id === prev.branch_id);
    const newUser: User = {
      id: uid("usr"),
      email: prev.email,
      full_name: prev.full_name,
      phone: prev.phone,
      role: prev.role,
      branch_id: prev.branch_id,
      employee_id: employeeIdNext(),
      is_active: true,
      created_at: now,
      last_login: null,
    };
    addDirectoryUser(newUser);
    void branch;
  }

  return { ok: true, request: next };
}

export function patchAccessRequest(
  id: string,
  action: {
    status: StaffRequestStatus;
    reviewed_by: string;
    resolution_notes?: string | null;
  }
): { ok: true; request: StaffAccessRequest } | { ok: false; error: string } {
  const idx = accessRequests.findIndex((r) => r.id === id);
  if (idx === -1) return { ok: false, error: "Request not found" };
  const prev = accessRequests[idx];
  if (prev.status !== "pending") return { ok: false, error: "Request already resolved" };

  const now = new Date().toISOString();
  const next: StaffAccessRequest = {
    ...prev,
    status: action.status,
    reviewed_by: action.reviewed_by,
    reviewed_at: now,
    resolution_notes: action.resolution_notes ?? null,
    updated_at: now,
  };
  accessRequests = accessRequests.map((r) => (r.id === id ? next : r));

  if (action.status === "approved") {
    if (prev.type === "suspend") {
      patchDirectoryUser(prev.staff_id, { is_active: false });
    } else {
      patchDirectoryUser(prev.staff_id, { is_active: true });
    }
  }

  return { ok: true, request: next };
}
