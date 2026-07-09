"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/dashboard-header";
import type { User } from "@/lib/types";
import type { StaffAccessRequest, StaffProvisioningRequest } from "@/lib/staff-requests-types";
import { StaffDirectory } from "@/components/staff-management/staff-directory";
import { StaffDialogs } from "@/components/staff-management/staff-dialogs";
import { StaffWorkspaceSheet } from "@/components/staff-management/staff-workspace-sheet";
import { ApproveHireDialog } from "@/components/staff-management/approve-hire-dialog";
import {
 AccessRequestsTable,
 PendingHiresTable,
} from "@/components/staff-management/staff-admin-queues";
import { extractProvisioningRequestsList } from "@/lib/staff-provisioning-adapters";
import type { ProvisioningApproveResult } from "@/lib/staff-provisioning-adapters";
import {
 buildStaffWorkspaceDTO,
 type StaffWorkspaceAccessFlags,
} from "@/components/staff-management/staff-workspace-model";
import {
 PasswordResetResult,
 StaffEditFormState,
 StaffFormState,
 StaffRecord,
 StaffRole,
 StaffStatusFilter,
} from "@/components/staff-management/types";
import {
 defaultCreateForm,
 emptyEditForm,
 mapUserToStaff,
 roleHasPortalAccess,
 validateStaffForm,
} from "@/components/staff-management/utils";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatApiResponseError } from "@/lib/falco-api";
import { useSessionUser } from "@/lib/use-session-user";

type AdminTab = "directory" | "pending" | "access";

function StaffManagementDenied() {
 return (
 <>
 <DashboardHeader
 title="Staff Management"
 description="Organization-wide staff directory and approval queues."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <p className="text-muted-foreground">You do not have access to this page.</p>
 </main>
 </>
 );
}

function StaffManagementPageInner() {
 const { user } = useSessionUser();
 const { users: managedUsers, branches: managedBranches, refresh: refreshBranchAssignments } =
 useBranchAssignment();

 const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
 const [staffMembers, setStaffMembers] = useState<StaffRecord[]>([]);

 const [adminTab, setAdminTab] = useState<AdminTab>("directory");
 const [provisioningRows, setProvisioningRows] = useState<StaffProvisioningRequest[]>([]);
 const [accessRows, setAccessRows] = useState<StaffAccessRequest[]>([]);
 const [loadingProvisioning, setLoadingProvisioning] = useState(false);
 const [loadingAccess, setLoadingAccess] = useState(false);
 const [reviewHireRequest, setReviewHireRequest] = useState<StaffProvisioningRequest | null>(null);
 const [approveHireOpen, setApproveHireOpen] = useState(false);

 const [search, setSearch] = useState("");
 const [selectedRole, setSelectedRole] = useState<"all" | StaffRole>("all");
 const [selectedBranch, setSelectedBranch] = useState<string>("all");
 const [selectedStatus, setSelectedStatus] = useState<StaffStatusFilter>("all");

 const [isCreateOpen, setIsCreateOpen] = useState(false);
 const [createForm, setCreateForm] = useState<StaffFormState>(defaultCreateForm);
 const [createFormError, setCreateFormError] = useState("");
 const [createSaving, setCreateSaving] = useState(false);

 const [viewStaff, setViewStaff] = useState<StaffRecord | null>(null);
 const [editStaff, setEditStaff] = useState<StaffRecord | null>(null);
 const [editForm, setEditForm] = useState<StaffEditFormState | null>(null);
 const [editFormError, setEditFormError] = useState("");

 const [resetStaff, setResetStaff] = useState<StaffRecord | null>(null);
 const [resetSubmitting, setResetSubmitting] = useState(false);
 const [resetFormError, setResetFormError] = useState("");
 const [resetResult, setResetResult] = useState<PasswordResetResult | null>(null);

 const [deleteStaff, setDeleteStaff] = useState<StaffRecord | null>(null);
 const [deleteSubmitting, setDeleteSubmitting] = useState(false);
 const [deleteError, setDeleteError] = useState("");

 const [workspaceStaff, setWorkspaceStaff] = useState<StaffRecord | null>(null);
 const [workspaceOpen, setWorkspaceOpen] = useState(false);
 const workspaceCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const [accessOverrides, setAccessOverrides] = useState<Record<string, StaffWorkspaceAccessFlags>>({});

 const refreshDirectory = useCallback(async () => {
 try {
 const res = await fetch("/api/staff/directory?page_size=500", { credentials: "include" });
 const data = (await res.json().catch(() => ({}))) as {
 users?: User[];
 error?: string;
 message?: string;
 };
 if (!res.ok) {
 const msg =
 typeof data.error === "string"
 ? data.error
 : typeof data.message === "string"
 ? data.message
 : `Could not load directory (${res.status})`;
 if (res.status === 401) {
 toast.error("Session expired. Sign in again to manage staff.");
 }
 setDirectoryUsers([]);
 setStaffMembers([]);
 return;
 }
 const users = data.users ?? [];
 setDirectoryUsers(users);
 const mapped = users.map((u) => mapUserToStaff(u)).filter((s): s is StaffRecord => Boolean(s));
 setStaffMembers(mapped);
 } catch {
 toast.error("Network error loading staff directory.");
 setDirectoryUsers([]);
 setStaffMembers([]);
 }
 }, []);

 const loadProvisioning = useCallback(async () => {
 setLoadingProvisioning(true);
 try {
 const res = await fetch("/api/staff/provisioning?status=pending", { credentials: "include" });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setProvisioningRows([]);
 if (res.status === 401) {
 toast.error("Session expired. Sign in again to manage staff.");
 } else if (res.status === 503) {
 toast.error(
 formatApiResponseError(
 data,
 "Cannot reach staff records. Check your connection and try again."
 )
 );
 }
 return;
 }
 setProvisioningRows(extractProvisioningRequestsList(data).filter((r) => r.status === "pending"));
 } catch {
 setProvisioningRows([]);
 toast.error("Network error loading pending hire requests.");
 } finally {
 setLoadingProvisioning(false);
 }
 }, []);

 const loadAccess = useCallback(async () => {
 setLoadingAccess(true);
 try {
 const res = await fetch("/api/staff/access-requests", { credentials: "include" });
 const data = await res.json().catch(() => ({}));
 const all = ((data as { requests?: StaffAccessRequest[] }).requests ?? []) as StaffAccessRequest[];
 setAccessRows(all.filter((r) => r.status === "pending"));
 } finally {
 setLoadingAccess(false);
 }
 }, []);

 useEffect(() => {
 void refreshDirectory();
 void loadProvisioning();
 void loadAccess();
 }, [refreshDirectory, loadProvisioning, loadAccess]);

 useEffect(() => {
 return () => {
 if (workspaceCloseTimer.current) clearTimeout(workspaceCloseTimer.current);
 };
 }, []);

 useEffect(() => {
 if (!workspaceStaff) return;
 const refreshed = staffMembers.find((s) => s.id === workspaceStaff.id);
 if (refreshed && refreshed !== workspaceStaff) {
 setWorkspaceStaff(refreshed);
 }
 }, [staffMembers, workspaceStaff]);

 const usersForWorkspace = useMemo(
 () => (directoryUsers.length > 0 ? directoryUsers : managedUsers),
 [directoryUsers, managedUsers]
 );

 const workspaceDto = useMemo(
 () =>
 workspaceStaff
 ? buildStaffWorkspaceDTO(workspaceStaff.id, workspaceStaff, {
 users: usersForWorkspace,
 branches: managedBranches,
 customers: [],
 loans: [],
 payments: [],
 })
 : null,
 [workspaceStaff, usersForWorkspace, managedBranches]
 );

 const workspaceAccessFlags: StaffWorkspaceAccessFlags = useMemo(() => {
 if (!workspaceStaff || !workspaceDto) {
 return { can_create_applications: true, can_create_customers: true };
 }
 return {
 ...workspaceDto.access_defaults,
 ...accessOverrides[workspaceStaff.id],
 };
 }, [workspaceStaff, workspaceDto, accessOverrides]);

 const openWorkspace = (staff: StaffRecord) => {
 if (workspaceCloseTimer.current) {
 clearTimeout(workspaceCloseTimer.current);
 workspaceCloseTimer.current = null;
 }
 setWorkspaceStaff(staff);
 setWorkspaceOpen(true);
 };

 const handleWorkspaceOpenChange = (open: boolean) => {
 setWorkspaceOpen(open);
 if (!open) {
 workspaceCloseTimer.current = setTimeout(() => {
 setWorkspaceStaff(null);
 workspaceCloseTimer.current = null;
 }, 320);
 } else if (workspaceCloseTimer.current) {
 clearTimeout(workspaceCloseTimer.current);
 workspaceCloseTimer.current = null;
 }
 };

 const filteredStaff = staffMembers.filter((staff) => {
 const matchesSearch =
 staff.full_name.toLowerCase().includes(search.toLowerCase()) ||
 staff.email.toLowerCase().includes(search.toLowerCase()) ||
 staff.employee_id.toLowerCase().includes(search.toLowerCase());
 const matchesRole = selectedRole === "all" || staff.role === selectedRole;
 const matchesBranch = selectedBranch === "all" || staff.branch_id === selectedBranch;
 const matchesStatus =
 selectedStatus === "all" ||
 (selectedStatus === "active" ? staff.is_active : !staff.is_active);

 return matchesSearch && matchesRole && matchesBranch && matchesStatus;
 });

 const closeCreate = () => {
 setIsCreateOpen(false);
 setCreateForm(defaultCreateForm);
 setCreateFormError("");
 };

 const handleCreateStaff = async (event: FormEvent<HTMLFormElement>) => {
 event.preventDefault();

 const validationError = validateStaffForm(createForm);
 if (validationError) {
 setCreateFormError(validationError);
 return;
 }

 if (staffMembers.some((staff) => staff.email.toLowerCase() === createForm.email.toLowerCase())) {
 setCreateFormError("Email already exists. Use another email address.");
 return;
 }

 setCreateSaving(true);
 setCreateFormError("");
 try {
 const res = await fetch("/api/staff/directory", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 full_name: createForm.full_name.trim(),
 email: createForm.email.trim().toLowerCase(),
 phone: createForm.phone.trim(),
 role: createForm.role,
 branch_id: createForm.branch_id,
 password: createForm.password,
 confirmPassword: createForm.confirmPassword,
 }),
 });

 const data = (await res.json().catch(() => ({}))) as {
 error?: string;
 message?: string;
 user?: unknown;
 };
 if (!res.ok) {
 const msg =
 res.status === 401
 ? "Your session expired. Sign out, sign in again as Super Admin, then retry."
 : res.status === 503
 ? formatApiResponseError(
 data,
 "Cannot reach staff records. Check your connection and try again."
 )
 : formatApiResponseError(data, "Could not create staff member.");
 setCreateFormError(msg);
 if (res.status === 401) {
 toast.error("Session expired. Please sign in again.");
 }
 if (res.status === 401) toast.error("Session expired. Sign in again.");
 return;
 }
 if (!data.user) {
 setCreateFormError("The staff member was not returned after saving. Please try again.");
 return;
 }

 toast.success("Staff member created.");
 closeCreate();
 await Promise.all([refreshDirectory(), refreshBranchAssignments()]);
 } catch {
 setCreateFormError("Network error. Check your connection and try again.");
 toast.error("Could not reach the server.");
 } finally {
 setCreateSaving(false);
 }
 };

 const openEdit = (staff: StaffRecord) => {
 setEditStaff(staff);
 setEditForm(emptyEditForm(staff));
 setEditFormError("");
 };

 const handleEditStaff = async (event: FormEvent<HTMLFormElement>) => {
 event.preventDefault();
 if (!editStaff || !editForm) return;

 if (!editForm.full_name.trim() || !editForm.email.trim() || !editForm.phone.trim()) {
 setEditFormError("Full name, email and phone are required.");
 return;
 }
 if (!editForm.email.includes("@")) {
 setEditFormError("A valid email is required.");
 return;
 }
 if (!editForm.branch_id) {
 setEditFormError("Branch assignment is required.");
 return;
 }

 const duplicateEmail = staffMembers.some(
 (staff) =>
 staff.id !== editStaff.id && staff.email.toLowerCase() === editForm.email.trim().toLowerCase()
 );
 if (duplicateEmail) {
 setEditFormError("Email already exists. Use another email address.");
 return;
 }

 const res = await fetch(`/api/staff/directory/${editStaff.id}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 full_name: editForm.full_name.trim(),
 email: editForm.email.trim().toLowerCase(),
 phone: editForm.phone.trim(),
 role: editForm.role,
 branch_id: editForm.branch_id,
 is_active: editForm.is_active,
 }),
 });

 const payload = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
 if (!res.ok) {
 setEditFormError(
 typeof payload.error === "string"
 ? payload.error
 : typeof payload.message === "string"
 ? payload.message
 : "Update failed."
 );
 return;
 }

 await Promise.all([refreshDirectory(), refreshBranchAssignments()]);
 setEditStaff(null);
 setEditForm(null);
 setEditFormError("");
 };

 const handleResetPassword = async () => {
 if (!resetStaff) return;
 if (!roleHasPortalAccess(resetStaff.role)) {
 setResetStaff(null);
 setResetFormError("");
 return;
 }

 setResetSubmitting(true);
 setResetFormError("");
 try {
 const res = await fetch(`/api/staff/directory/${resetStaff.id}/reset-password`, {
 method: "POST",
 credentials: "include",
 });

 const data = (await res.json().catch(() => ({}))) as {
 error?: string;
 message?: string;
 temporary_password?: string;
 };

 if (!res.ok || !data.temporary_password) {
 setResetFormError(data.message ?? data.error ?? "Reset request failed.");
 return;
 }

 setResetResult({ staff: resetStaff, temporaryPassword: data.temporary_password });
 setResetStaff(null);
 await refreshDirectory();
 } catch {
 setResetFormError("Network error — could not reset password.");
 } finally {
 setResetSubmitting(false);
 }
 };

  const toggleStaffStatus = async (staff: StaffRecord) => {
 const nextStatus = !staff.is_active;
 try {
 const res = await fetch(`/api/staff/directory/${staff.id}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ is_active: nextStatus }),
 });
 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
 toast.error(err.message ?? err.error ?? `Could not ${nextStatus ? "activate" : "suspend"} staff member`);
 return;
 }
 toast.success(`${staff.full_name} ${nextStatus ? "activated" : "suspended"}`);
 await refreshDirectory();
 } catch {
 toast.error("Network error — could not update staff status");
 }
 };

 const handleDeleteStaff = async () => {
 if (!deleteStaff) return;
 setDeleteSubmitting(true);
 setDeleteError("");
 try {
 const res = await fetch(`/api/staff/directory/${deleteStaff.id}`, {
 method: "DELETE",
 credentials: "include",
 });
 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
 const message = err.error ?? err.message ?? "Could not delete staff member.";
 setDeleteError(message);
 if (res.status !== 409) toast.error(message);
 return;
 }
 toast.success(`${deleteStaff.full_name} was deleted.`);
 setDeleteStaff(null);
 await refreshDirectory();
 } catch {
 setDeleteError("Network error — could not delete staff member.");
 } finally {
 setDeleteSubmitting(false);
 }
 };

 const resolveStaffName = useCallback(
 (staffId: string) => staffMembers.find((s) => s.id === staffId)?.full_name ?? staffId,
 [staffMembers]
 );

 const handleProvisioningReject = async (id: string) => {
 const res = await fetch(`/api/staff/provisioning/${encodeURIComponent(id)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ status: "rejected", notes: null }),
 });
 if (!res.ok) {
 toast.error("Could not reject hire request");
 return;
 }
 toast.message("Hire request rejected");
 await loadProvisioning();
 };

 const handleHireApproved = async (_result?: ProvisioningApproveResult) => {
 await loadProvisioning();
 await refreshDirectory();
 };

 const handleAccessResolve = async (id: string, status: "approved" | "rejected") => {
 const res = await fetch(`/api/staff/access-requests/${id}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ status, resolution_notes: null }),
 });
 if (!res.ok) return;
 await loadAccess();
 await refreshDirectory();
 };

 return (
 <>
 <DashboardHeader
 title="Staff Management"
 description="Directory and live user creation for admins; pending hires and access requests from branches."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <Tabs value={adminTab} onValueChange={(v) => setAdminTab(v as AdminTab)}>
 <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
 <TabsTrigger value="directory">Directory</TabsTrigger>
 <TabsTrigger value="pending">
 Pending hires ({provisioningRows.length})
 </TabsTrigger>
 <TabsTrigger value="access">
 Access requests ({accessRows.length})
 </TabsTrigger>
 </TabsList>

 <TabsContent value="directory" className="mt-6 space-y-6">
 <StaffDirectory
 branches={managedBranches}
 staffMembers={staffMembers}
 filteredStaff={filteredStaff}
 search={search}
 selectedRole={selectedRole}
 selectedBranch={selectedBranch}
 selectedStatus={selectedStatus}
 onSearchChange={setSearch}
 onRoleChange={setSelectedRole}
 onBranchChange={setSelectedBranch}
 onStatusChange={setSelectedStatus}
 onAddStaff={() => setIsCreateOpen(true)}
 onView={setViewStaff}
 onEdit={openEdit}
 onResetPassword={(staff) => {
 setResetStaff(staff);
 setResetFormError("");
 }}
 onToggleStatus={toggleStaffStatus}
 onOpenWorkspace={openWorkspace}
 onDelete={(staff) => {
 setDeleteStaff(staff);
 setDeleteError("");
 }}
 />
 </TabsContent>

 <TabsContent value="pending" className="mt-6">
 <PendingHiresTable
 branches={managedBranches}
 rows={provisioningRows}
 loading={loadingProvisioning}
 onReview={(row) => {
 setReviewHireRequest(row);
 setApproveHireOpen(true);
 }}
 onReject={(id) => void handleProvisioningReject(id)}
 />
 </TabsContent>

 <TabsContent value="access" className="mt-6">
 <AccessRequestsTable
 rows={accessRows}
 loading={loadingAccess}
 resolveStaffName={resolveStaffName}
 onApprove={(id) => void handleAccessResolve(id, "approved")}
 onReject={(id) => void handleAccessResolve(id, "rejected")}
 />
 </TabsContent>
 </Tabs>
 </div>
 </main>

 {workspaceStaff && workspaceDto ? (
 <StaffWorkspaceSheet
 open={workspaceOpen}
 onOpenChange={handleWorkspaceOpenChange}
 staff={workspaceStaff}
 workspace={workspaceDto}
 accessFlags={workspaceAccessFlags}
 onAccessChange={(flags) =>
 setAccessOverrides((prev) => ({ ...prev, [workspaceStaff.id]: flags }))
 }
 currentUserId={user?.id ?? ""}
 onEdit={(s) => {
 openEdit(s);
 handleWorkspaceOpenChange(false);
 }}
 onResetPassword={(s) => {
 setResetStaff(s);
 setResetFormError("");
 handleWorkspaceOpenChange(false);
 }}
 onToggleStatus={(s) => {
 void toggleStaffStatus(s);
 }}
 onDelete={(s) => {
 setDeleteStaff(s);
 setDeleteError("");
 handleWorkspaceOpenChange(false);
 }}
 />
 ) : null}

 <ApproveHireDialog
 open={approveHireOpen}
 onOpenChange={setApproveHireOpen}
 request={reviewHireRequest}
 branchName={
 managedBranches.find((b) => b.id === reviewHireRequest?.branch_id)?.name ??
 reviewHireRequest?.branch_id ??
 ""
 }
 onResolved={() => void handleHireApproved()}
 />

 <StaffDialogs
 branches={managedBranches}
 createOpen={isCreateOpen}
 createForm={createForm}
 createFormError={createFormError}
 createSaving={createSaving}
 onCreateOpenChange={setIsCreateOpen}
 onCreateFormChange={(updater) => setCreateForm((prev) => updater(prev))}
 onCreateSubmit={(e) => void handleCreateStaff(e)}
 onCreateCancel={closeCreate}
 viewStaff={viewStaff}
 onViewClose={() => setViewStaff(null)}
 editStaff={editStaff}
 editForm={editForm}
 editFormError={editFormError}
 onEditClose={() => {
 setEditStaff(null);
 setEditForm(null);
 setEditFormError("");
 }}
 onEditFormChange={(updater) => setEditForm((prev) => (prev ? updater(prev) : prev))}
 onEditSubmit={(e) => void handleEditStaff(e)}
 resetStaff={resetStaff}
 resetSubmitting={resetSubmitting}
 resetFormError={resetFormError}
 onResetClose={() => {
 setResetStaff(null);
 setResetFormError("");
 }}
 onResetConfirm={() => void handleResetPassword()}
 resetResult={resetResult}
 onResetResultClose={() => setResetResult(null)}
 deleteStaff={deleteStaff}
 deleteSubmitting={deleteSubmitting}
 deleteError={deleteError}
 onDeleteClose={() => {
 setDeleteStaff(null);
 setDeleteError("");
 }}
 onDeleteConfirm={() => void handleDeleteStaff()}
 />
 </>
 );
}

export function StaffManagementPage() {
 const { user, loaded } = useSessionUser();
 if (!loaded) {
 return (
 <>
 <DashboardHeader
 title="Staff Management"
 description="Organization-wide staff directory and approval queues."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <p className="text-muted-foreground">Loading…</p>
 </main>
 </>
 );
 }
 if (user?.role !== "super_admin") {
 return <StaffManagementDenied />;
 }
 return <StaffManagementPageInner />;
}
