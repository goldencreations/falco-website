"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  currentUser,
  customers,
  loans,
  payments,
} from "@/lib/mock-data";
import { StaffDirectory } from "@/components/staff-management/staff-directory";
import { StaffDialogs } from "@/components/staff-management/staff-dialogs";
import { StaffWorkspaceSheet } from "@/components/staff-management/staff-workspace-sheet";
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

export function StaffManagementPage() {
  const { users: managedUsers, branches: managedBranches } = useBranchAssignment();
  const initialStaff = useMemo(
    () =>
      managedUsers
        .map((user, index) => mapUserToStaff(user, index))
        .filter((staff): staff is StaffRecord => Boolean(staff)),
    [managedUsers]
  );

  const [staffMembers, setStaffMembers] = useState<StaffRecord[]>(initialStaff);
  useEffect(() => {
    setStaffMembers(initialStaff);
  }, [initialStaff]);

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

  const workspaceDto = useMemo(
    () =>
      workspaceStaff
        ? buildStaffWorkspaceDTO(workspaceStaff.id, workspaceStaff, {
            users: managedUsers,
            branches: managedBranches,
            customers,
            loans,
            payments,
          })
        : null,
    [workspaceStaff, managedUsers, managedBranches]
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

  const handleCreateStaff = (event: FormEvent<HTMLFormElement>) => {
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

    const now = new Date().toISOString();
    const employeeNumber = String(staffMembers.length + 101).padStart(3, "0");

    const backendPayload = {
      email: createForm.email.trim().toLowerCase(),
      full_name: createForm.full_name.trim(),
      phone: createForm.phone.trim(),
      role: createForm.role,
      branch_id: createForm.branch_id,
      is_active: true,
      ...(roleHasPortalAccess(createForm.role)
        ? { password: createForm.password }
        : { password: null as string | null }),
    };
    void backendPayload;

    const newStaff: StaffRecord = {
      id: `staff-${Date.now()}`,
      email: createForm.email.trim().toLowerCase(),
      full_name: createForm.full_name.trim(),
      phone: createForm.phone.trim(),
      role: createForm.role,
      branch_id: createForm.branch_id,
      employee_id: `EMP-${employeeNumber}`,
      is_active: true,
      created_at: now,
      updated_at: now,
      last_login: null,
    };

    setStaffMembers((prev) => [newStaff, ...prev]);
    closeCreate();
  };

  const openEdit = (staff: StaffRecord) => {
    setEditStaff(staff);
    setEditForm(emptyEditForm(staff));
    setEditFormError("");
  };

  const handleEditStaff = (event: FormEvent<HTMLFormElement>) => {
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

    const updatedPayload = {
      id: editStaff.id,
      full_name: editForm.full_name.trim(),
      email: editForm.email.trim().toLowerCase(),
      phone: editForm.phone.trim(),
      role: editForm.role,
      branch_id: editForm.branch_id,
      is_active: editForm.is_active,
    };
    void updatedPayload;

    setStaffMembers((prev) =>
      prev.map((staff) =>
        staff.id === editStaff.id
          ? {
              ...staff,
              full_name: editForm.full_name.trim(),
              email: editForm.email.trim().toLowerCase(),
              phone: editForm.phone.trim(),
              role: editForm.role,
              branch_id: editForm.branch_id,
              is_active: editForm.is_active,
              updated_at: new Date().toISOString(),
            }
          : staff
      )
    );

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

    const resetPayload = {
      id: resetStaff.id,
      new_password: resetForm.password,
      requested_by: currentUser.id,
    };
    void resetPayload;

    setStaffMembers((prev) =>
      prev.map((staff) =>
        staff.id === resetStaff.id ? { ...staff, updated_at: new Date().toISOString() } : staff
      )
    );
    setResetStaff(null);
    setResetForm(defaultResetForm);
    setResetFormError("");
  };

  const toggleStaffStatus = (staff: StaffRecord) => {
    const nextStatus = !staff.is_active;
    const statusPayload = {
      id: staff.id,
      is_active: nextStatus,
      updated_by: currentUser.id,
    };
    void statusPayload;

    setStaffMembers((prev) =>
      prev.map((item) =>
        item.id === staff.id
          ? { ...item, is_active: nextStatus, updated_at: new Date().toISOString() }
          : item
      )
    );
  };

  return (
    <>
      <DashboardHeader
        title="Staff Management"
        description="Add staff by role and branch. Initial passwords are required only for Super Admin, Branch Manager, and Loan Officer."
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
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
            toggleStaffStatus(s);
          }}
        />
      ) : null}

      <StaffDialogs
        createOpen={isCreateOpen}
        createForm={createForm}
        createFormError={createFormError}
        onCreateOpenChange={setIsCreateOpen}
        onCreateFormChange={(updater) => setCreateForm((prev) => updater(prev))}
        onCreateSubmit={handleCreateStaff}
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
        onEditSubmit={handleEditStaff}
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
