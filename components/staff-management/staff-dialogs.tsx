"use client";

import { FormEvent } from "react";
import { branches, formatDateTime } from "@/lib/mock-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PasswordResetState,
  StaffEditFormState,
  StaffFormState,
  StaffRecord,
  StaffRole,
} from "@/components/staff-management/types";
import {
  isOnline,
  PROVISIONING_STAFF_ROLE_OPTIONS,
  roleHasPortalAccess,
  roleLabel,
  STAFF_ROLE_OPTIONS,
} from "@/components/staff-management/utils";

interface StaffDialogsProps {
  createOpen: boolean;
  createForm: StaffFormState;
  createFormError: string;
  /** When true, creates a pending provisioning request (no password). */
  provisioningHire?: boolean;
  /** When set, create form branch field is read-only (e.g. branch manager). */
  createLockedBranchId?: string;
  onCreateOpenChange: (open: boolean) => void;
  onCreateFormChange: (updater: (prev: StaffFormState) => StaffFormState) => void;
  onCreateSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateCancel: () => void;
  viewStaff: StaffRecord | null;
  onViewClose: () => void;
  editStaff: StaffRecord | null;
  editForm: StaffEditFormState | null;
  editFormError: string;
  onEditClose: () => void;
  onEditFormChange: (updater: (prev: StaffEditFormState) => StaffEditFormState) => void;
  onEditSubmit: (event: FormEvent<HTMLFormElement>) => void;
  resetStaff: StaffRecord | null;
  resetForm: PasswordResetState;
  resetFormError: string;
  onResetClose: () => void;
  onResetFormChange: (updater: (prev: PasswordResetState) => PasswordResetState) => void;
  onResetSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function StaffRoleSelectContent({ variant = "all" }: { variant?: "all" | "provisioning" }) {
  if (variant === "provisioning") {
    return (
      <SelectGroup>
        <SelectLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Role (pending approval)
        </SelectLabel>
        {PROVISIONING_STAFF_ROLE_OPTIONS.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectGroup>
    );
  }

  const portalRoles = STAFF_ROLE_OPTIONS.filter((o) => o.portalAccess);
  const operationalRoles = STAFF_ROLE_OPTIONS.filter((o) => !o.portalAccess);
  return (
    <>
      <SelectGroup>
        <SelectLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Portal access
        </SelectLabel>
        {portalRoles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectGroup>
      <SelectGroup>
        <SelectLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Operational only
        </SelectLabel>
        {operationalRoles.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </>
  );
}

export function StaffFormFields({
  form,
  onChange,
  provisioningHire,
  lockedBranchId,
}: {
  form: StaffFormState;
  onChange: (updater: (prev: StaffFormState) => StaffFormState) => void;
  provisioningHire?: boolean;
  /** When set (e.g. branch manager), branch is fixed and not editable. */
  lockedBranchId?: string;
}) {
  const portal = !provisioningHire && roleHasPortalAccess(form.role);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Identity</p>
        <Separator className="my-3" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="staff-full-name">Full name</Label>
            <Input
              id="staff-full-name"
              value={form.full_name}
              onChange={(event) => onChange((prev) => ({ ...prev, full_name: event.target.value }))}
              placeholder="e.g. Neema Chuwa"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-email">Work email</Label>
            <Input
              id="staff-email"
              type="email"
              value={form.email}
              onChange={(event) => onChange((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="name@falcofinancial.co.tz"
              className="bg-background"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="staff-phone">Phone</Label>
            <Input
              id="staff-phone"
              value={form.phone}
              onChange={(event) => onChange((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+255 7XX XXX XXX"
              className="bg-background"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organization</p>
        <Separator className="my-3" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={form.role}
              onValueChange={(value) =>
                onChange((prev) => ({
                  ...prev,
                  role: value as StaffRole,
                  password: "",
                  confirmPassword: "",
                }))
              }
            >
              <SelectTrigger className="w-full min-w-0 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
                <StaffRoleSelectContent variant={provisioningHire ? "provisioning" : "all"} />
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {provisioningHire
                ? "Submits a pending hire. No portal login until a super administrator approves."
                : portal
                  ? "This role can sign in to the organization portal. Set an initial password below."
                  : "Operational profile: tracked in the directory without provisioning portal login."}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Branch</Label>
            {lockedBranchId ? (
              <p className="rounded-md border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-sm">
                {branches.find((b) => b.id === lockedBranchId)?.name ?? lockedBranchId}
                <span className="ml-2 text-xs text-muted-foreground">(your branch)</span>
              </p>
            ) : (
              <Select
                value={form.branch_id}
                onValueChange={(value) => onChange((prev) => ({ ...prev, branch_id: value }))}
              >
                <SelectTrigger className="w-full min-w-0 bg-background">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {portal ? (
        <Card className="border-border/80 bg-muted/20 shadow-none">
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-sm font-medium">Initial portal credentials</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Minimum 8 characters. The staff member will use this password on first sign-in (change after login is
                recommended).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-password">Password</Label>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => onChange((prev) => ({ ...prev, password: event.target.value }))}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-confirm-password">Confirm password</Label>
                <Input
                  id="staff-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    onChange((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  className="bg-background"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function StaffDialogs(props: StaffDialogsProps) {
  const isMobile = useIsMobile();

  const createTitle = props.provisioningHire ? "Propose new hire" : "Add staff member";
  const createDescription = props.provisioningHire
    ? "Submit name, contact, branch, and role. The profile stays pending until it is approved in the Pending hires queue."
    : "Create a staff record with the correct role and branch. Portal passwords are only required for roles that sign in to the system.";

  return (
    <>
      {isMobile ? (
        <Sheet open={props.createOpen} onOpenChange={props.onCreateOpenChange}>
          <SheetContent side="bottom" className="h-[92vh] overflow-hidden">
            <SheetHeader className="text-left">
              <SheetTitle>{createTitle}</SheetTitle>
              <SheetDescription>{createDescription}</SheetDescription>
            </SheetHeader>
            <form className="flex flex-1 flex-col gap-4 overflow-auto px-4 pb-4" onSubmit={props.onCreateSubmit}>
              <StaffFormFields
                form={props.createForm}
                onChange={props.onCreateFormChange}
                provisioningHire={props.provisioningHire}
                lockedBranchId={props.createLockedBranchId}
              />
              {props.createFormError ? <p className="text-sm text-destructive">{props.createFormError}</p> : null}
              <SheetFooter className="mt-auto flex-row gap-2 px-0 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={props.onCreateCancel}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {props.provisioningHire ? "Submit for approval" : "Create staff"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={props.createOpen} onOpenChange={props.onCreateOpenChange}>
          <DialogContent className="max-h-[min(90vh,720px)] gap-0 overflow-y-auto sm:max-w-xl">
            <DialogHeader className="space-y-2 pb-2">
              <DialogTitle>{createTitle}</DialogTitle>
              <DialogDescription className="text-pretty">{createDescription}</DialogDescription>
            </DialogHeader>
            <form className="grid gap-5 py-2" onSubmit={props.onCreateSubmit}>
              <StaffFormFields
                form={props.createForm}
                onChange={props.onCreateFormChange}
                provisioningHire={props.provisioningHire}
                lockedBranchId={props.createLockedBranchId}
              />
              {props.createFormError ? <p className="text-sm text-destructive">{props.createFormError}</p> : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={props.onCreateCancel}>
                  Cancel
                </Button>
                <Button type="submit">
                  {props.provisioningHire ? "Submit for approval" : "Create staff"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={Boolean(props.viewStaff)} onOpenChange={(open) => !open && props.onViewClose()}>
        <DialogContent className="sm:max-w-xl">
          {props.viewStaff ? (
            <>
              <DialogHeader>
                <DialogTitle>Staff details</DialogTitle>
                <DialogDescription>
                  Profile, access type, and activity for compliance and operational review.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Card className="border border-border/70 shadow-sm">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                        {props.viewStaff.full_name
                          .split(" ")
                          .map((chunk) => chunk[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold">{props.viewStaff.full_name}</p>
                        <p className="text-xs text-muted-foreground">{props.viewStaff.employee_id}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{props.viewStaff.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{props.viewStaff.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Role</p>
                        <p className="text-sm font-medium">{roleLabel(props.viewStaff.role)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">System access</p>
                        <p className="text-sm font-medium">
                          {roleHasPortalAccess(props.viewStaff.role)
                            ? "Portal login enabled"
                            : "Operational profile (no portal login)"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Branch</p>
                        <p className="text-sm font-medium">
                          {branches.find((branch) => branch.id === props.viewStaff.branch_id)?.name ?? "Unassigned"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-sm font-medium">{props.viewStaff.is_active ? "Active" : "Suspended"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Presence</p>
                        <p className="text-sm font-medium">{isOnline(props.viewStaff.last_login) ? "Online" : "Offline"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last login</p>
                        <p className="text-sm font-medium">
                          {props.viewStaff.last_login ? formatDateTime(props.viewStaff.last_login) : "Never"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">{formatDateTime(props.viewStaff.created_at)}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Last updated</p>
                        <p className="text-sm font-medium">{formatDateTime(props.viewStaff.updated_at)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={props.onViewClose}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(props.editStaff && props.editForm)} onOpenChange={(open) => !open && props.onEditClose()}>
        <DialogContent className="sm:max-w-2xl">
          {props.editStaff && props.editForm ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit staff</DialogTitle>
                <DialogDescription>
                  Update contact details, role, and branch. Suspending a user blocks portal access when their role
                  includes login.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-5" onSubmit={props.onEditSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Full name</Label>
                    <Input
                      value={props.editForm.full_name}
                      onChange={(event) =>
                        props.onEditFormChange((prev) => ({ ...prev, full_name: event.target.value }))
                      }
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={props.editForm.email}
                      onChange={(event) => props.onEditFormChange((prev) => ({ ...prev, email: event.target.value }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={props.editForm.phone}
                      onChange={(event) => props.onEditFormChange((prev) => ({ ...prev, phone: event.target.value }))}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={props.editForm.role}
                      onValueChange={(value) =>
                        props.onEditFormChange((prev) => ({ ...prev, role: value as StaffRole }))
                      }
                    >
                      <SelectTrigger className="w-full min-w-0 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
                        <StaffRoleSelectContent />
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Branch</Label>
                    <Select
                      value={props.editForm.branch_id}
                      onValueChange={(value) =>
                        props.onEditFormChange((prev) => ({ ...prev, branch_id: value }))
                      }
                    >
                      <SelectTrigger className="w-full min-w-0 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Card className="border-border/80 bg-muted/15 shadow-none">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Account status</p>
                      <p className="text-xs text-muted-foreground">
                        Inactive records cannot sign in when portal access applies.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {props.editForm.is_active ? "Active" : "Suspended"}
                      </span>
                      <Switch
                        checked={props.editForm.is_active}
                        onCheckedChange={(checked) =>
                          props.onEditFormChange((prev) => ({ ...prev, is_active: checked }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
                {props.editFormError ? <p className="text-sm text-destructive">{props.editFormError}</p> : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={props.onEditClose}>
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(props.resetStaff)} onOpenChange={(open) => !open && props.onResetClose()}>
        <DialogContent className="sm:max-w-md">
          {props.resetStaff ? (
            <>
              <DialogHeader>
                <DialogTitle>Reset password</DialogTitle>
                <DialogDescription>
                  Set a new temporary password for {props.resetStaff.full_name}. They should change it after signing
                  in.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={props.onResetSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    value={props.resetForm.password}
                    onChange={(event) =>
                      props.onResetFormChange((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirm password</Label>
                  <Input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={props.resetForm.confirmPassword}
                    onChange={(event) =>
                      props.onResetFormChange((prev) => ({ ...prev, confirmPassword: event.target.value }))
                    }
                    className="bg-background"
                  />
                </div>
                {props.resetFormError ? <p className="text-sm text-destructive">{props.resetFormError}</p> : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={props.onResetClose}>
                    Cancel
                  </Button>
                  <Button type="submit">Update password</Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
