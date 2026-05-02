"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  currentUser,
  customers,
  loans,
  payments,
} from "@/lib/mock-data";
import type { User } from "@/lib/types";
import type { StaffAccessRequest, StaffProvisioningRequest } from "@/lib/staff-requests-types";
import { StaffDirectory } from "@/components/staff-management/staff-directory";
import { StaffDialogs } from "@/components/staff-management/staff-dialogs";
import { StaffWorkspaceSheet } from "@/components/staff-management/staff-workspace-sheet";
import {
  AccessRequestsTable,
  PendingHiresTable,
} from "@/components/staff-management/staff-admin-queues";
import {
  buildStaffWorkspaceDTO,
  type StaffWorkspaceAccessFlags,
} from "@/components/staff-management/staff-workspace-model";
import {
  PasswordResetState,
  StaffEditFormState,
  StaffFormState,
  StaffRecord,
  StaffRole,
  StaffStatusFilter,
} from "@/components/staff-management/types";
import {
  defaultCreateForm,
  defaultResetForm,
  emptyEditForm,
  mapUserToStaff,
  roleHasPortalAccess,
  validatePasswordReset,
  validateStaffForm,
} from "@/components/staff-management/utils";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const { users: managedUsers, branches: managedBranches } = useBranchAssignment();

  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffRecord[]>([]);

  const [adminTab, setAdminTab] = useState<AdminTab>("directory");
  const [provisioningRows, setProvisioningRows] = useState<StaffProvisioningRequest[]>([]);
  const [accessRows, setAccessRows] = useState<StaffAccessRequest[]>([]);
  const [loadingProvisioning, setLoadingProvisioning] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<"all" | StaffRole>("all");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<StaffStatusFilter>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<StaffFormState>(defaultCreateForm);
  const [createFormError, setCreateFormError] = useState("");

  const [viewStaff, setViewStaff] = useState<StaffRecord | null>(null);
  const [editStaff, setEditStaff] = useState<StaffRecord | null>(null);
  const [editForm, setEditForm] = useState<StaffEditFormState | null>(null);
  const [editFormError, setEditFormError] = useState("");

  const [resetStaff, setResetStaff] = useState<StaffRecord | null>(null);
  const [resetForm, setResetForm] = useState<PasswordResetState>(defaultResetForm);
  const [resetFormError, setResetFormError] = useState("");

  const [workspaceStaff, setWorkspaceStaff] = useState<StaffRecord | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accessOverrides, setAccessOverrides] = useState<Record<string, StaffWorkspaceAccessFlags>>({});

  const refreshDirectory = useCallback(async () => {
    const res = await fetch("/api/staff/directory");
    if (!res.ok) return;
    const data = (await res.json()) as { users: User[] };
    const users = data.users ?? [];
    setDirectoryUsers(users);
    const mapped = users
      .map((u, i) => mapUserToStaff(u, i))
      .filter((s): s is StaffRecord => Boolean(s));
    setStaffMembers(mapped);
  }, []);

  const loadProvisioning = useCallback(async () => {
    setLoadingProvisioning(true);
    try {
      const res = await fetch("/api/staff/provisioning?status=pending");
      const data = await res.json();
      setProvisioningRows(data.requests ?? []);
    } finally {
      setLoadingProvisioning(false);
    }
  }, []);

  const loadAccess = useCallback(async () => {
    setLoadingAccess(true);
    try {
      const res = await fetch("/api/staff/access-requests");
      const data = await res.json();
      const all = (data.requests ?? []) as StaffAccessRequest[];
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
            customers,
            loans,
            payments,
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

    const res = await fetch("/api/staff/directory", {
      method: "POST",
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

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setCreateFormError(typeof data.error === "string" ? data.error : "Request failed.");
      return;
    }

    closeCreate();
    await refreshDirectory();
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

    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setEditFormError(typeof payload.error === "string" ? payload.error : "Update failed.");
      return;
    }

    await refreshDirectory();
    setEditStaff(null);
    setEditForm(null);
    setEditFormError("");
  };

  const handleResetPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetStaff) return;
    if (!roleHasPortalAccess(resetStaff.role)) {
      setResetStaff(null);
      setResetForm(defaultResetForm);
      setResetFormError("");
      return;
    }

    const validationError = validatePasswordReset(resetForm);
    if (validationError) {
      setResetFormError(validationError);
      return;
    }

    setStaffMembers((prev) =>
      prev.map((staff) =>
        staff.id === resetStaff.id ? { ...staff, updated_at: new Date().toISOString() } : staff
      )
    );
    setResetStaff(null);
    setResetForm(defaultResetForm);
    setResetFormError("");
  };

  const toggleStaffStatus = async (staff: StaffRecord) => {
    const nextStatus = !staff.is_active;
    const res = await fetch(`/api/staff/directory/${staff.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: nextStatus }),
    });
    if (!res.ok) return;
    await refreshDirectory();
  };

  const resolveStaffName = useCallback(
    (staffId: string) => staffMembers.find((s) => s.id === staffId)?.full_name ?? staffId,
    [staffMembers]
  );

  const handleProvisioningResolve = async (id: string, status: "approved" | "rejected") => {
    const res = await fetch(`/api/staff/provisioning/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes: null }),
    });
    if (!res.ok) return;
    await loadProvisioning();
    await refreshDirectory();
  };

  const handleAccessResolve = async (id: string, status: "approved" | "rejected") => {
    const res = await fetch(`/api/staff/access-requests/${id}`, {
      method: "PATCH",
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
                  setResetForm(defaultResetForm);
                  setResetFormError("");
                }}
                onToggleStatus={toggleStaffStatus}
                onOpenWorkspace={openWorkspace}
              />
            </TabsContent>

            <TabsContent value="pending" className="mt-6">
              <PendingHiresTable
                rows={provisioningRows}
                loading={loadingProvisioning}
                onApprove={(id) => void handleProvisioningResolve(id, "approved")}
                onReject={(id) => void handleProvisioningResolve(id, "rejected")}
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
          currentUserId={currentUser.id}
          onEdit={(s) => {
            openEdit(s);
            handleWorkspaceOpenChange(false);
          }}
          onResetPassword={(s) => {
            setResetStaff(s);
            setResetForm(defaultResetForm);
            setResetFormError("");
            handleWorkspaceOpenChange(false);
          }}
          onToggleStatus={(s) => {
            void toggleStaffStatus(s);
          }}
        />
      ) : null}

      <StaffDialogs
        createOpen={isCreateOpen}
        createForm={createForm}
        createFormError={createFormError}
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
        resetForm={resetForm}
        resetFormError={resetFormError}
        onResetClose={() => {
          setResetStaff(null);
          setResetForm(defaultResetForm);
          setResetFormError("");
        }}
        onResetFormChange={(updater) => setResetForm((prev) => updater(prev))}
        onResetSubmit={handleResetPassword}
      />
    </>
  );
}

export function StaffManagementPage() {
  if (currentUser.role !== "super_admin") {
    return <StaffManagementDenied />;
  }
  return <StaffManagementPageInner />;
}
