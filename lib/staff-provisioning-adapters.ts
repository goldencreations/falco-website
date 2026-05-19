import type {
 StaffAccessRequest,
 StaffProvisioningRequest,
 StaffProvisioningRole,
 StaffRequestStatus,
} from "@/lib/staff-requests-types";

function str(value: unknown, fallback = ""): string {
 if (value === null || value === undefined) return fallback;
 return String(value);
}

function asStatus(value: unknown): StaffRequestStatus {
 const s = str(value, "pending");
 if (s === "approved" || s === "rejected") return s;
 return "pending";
}

function asProvisioningRole(value: unknown): StaffProvisioningRole {
 const r = str(value, "loan_officer");
 if (r === "collections_officer" || r === "credit_analyst") return r;
 return "loan_officer";
}

export function adaptProvisioningRequest(row: Record<string, unknown>): StaffProvisioningRequest {
 return {
 id: str(row.id),
 full_name: str(row.full_name),
 email: str(row.email),
 phone: str(row.phone),
 role: asProvisioningRole(row.role),
 branch_id: str(row.branch_id),
 requested_by: str(row.requested_by),
 status: asStatus(row.status),
 created_at: str(row.created_at ?? new Date().toISOString()),
 updated_at: str(row.updated_at ?? row.created_at ?? new Date().toISOString()),
 reviewed_by: row.reviewed_by ? str(row.reviewed_by) : null,
 reviewed_at: row.reviewed_at ? str(row.reviewed_at) : null,
 notes: row.notes != null ? str(row.notes) : null,
 };
}

export function extractProvisioningRequestsList(json: unknown): StaffProvisioningRequest[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.requests)
 ? o.requests
 : Array.isArray(o.data)
 ? o.data
 : [];
 return (rows as Record<string, unknown>[])
 .filter((r) => r && typeof r === "object")
 .map((r) => {
 if (r.request && typeof r.request === "object") {
 return adaptProvisioningRequest(r.request as Record<string, unknown>);
 }
 return adaptProvisioningRequest(r);
 });
}

export type ProvisioningApproveResult = {
 request: StaffProvisioningRequest;
 createdUserId?: string;
 employeeId?: string;
 temporaryPassword?: string;
};

export function extractProvisioningApproveResult(json: unknown): ProvisioningApproveResult | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const root =
 o.request && typeof o.request === "object"
 ? (o.request as Record<string, unknown>)
 : o.data && typeof o.data === "object" && !Array.isArray(o.data)
 ? (o.data as Record<string, unknown>)
 : o;

 const requestRow =
 root.request && typeof root.request === "object"
 ? (root.request as Record<string, unknown>)
 : root;

 if (!requestRow.id && !requestRow.full_name) return null;

 const user =
 (root.user && typeof root.user === "object" ? root.user : null) ??
 (o.user && typeof o.user === "object" ? o.user : null);

 const userObj = user as Record<string, unknown> | null;

 return {
 request: adaptProvisioningRequest(requestRow),
 createdUserId: userObj ? str(userObj.id) : str(root.created_user_id ?? root.user_id) || undefined,
 employeeId: userObj ? str(userObj.employee_id) : undefined,
 temporaryPassword:
 str(root.temporary_password ?? o.temporary_password ?? root.password ?? "") || undefined,
 };
}

export function adaptAccessRequest(row: Record<string, unknown>): StaffAccessRequest {
 return {
 id: str(row.id),
 type: row.type === "reinstate" ? "reinstate" : "suspend",
 staff_id: str(row.staff_id),
 requested_by: str(row.requested_by),
 reason: row.reason != null ? str(row.reason) : null,
 status: asStatus(row.status),
 created_at: str(row.created_at ?? new Date().toISOString()),
 updated_at: str(row.updated_at ?? row.created_at ?? new Date().toISOString()),
 reviewed_by: row.reviewed_by ? str(row.reviewed_by) : null,
 reviewed_at: row.reviewed_at ? str(row.reviewed_at) : null,
 resolution_notes:
 row.resolution_notes != null
 ? str(row.resolution_notes)
 : row.notes != null
 ? str(row.notes)
 : null,
 };
}

export function extractAccessRequestsList(json: unknown): StaffAccessRequest[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.requests) ? o.requests : Array.isArray(o.data) ? o.data : [];
 return (rows as Record<string, unknown>[])
 .filter((r) => r && typeof r === "object")
 .map((r) => adaptAccessRequest(r));
}
