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
import { cn } from "@/lib/utils";

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
  recordLayout,
}: {
  form: StaffFormState;
  onChange: (updater: (prev: StaffFormState) => StaffFormState) => void;
  provisioningHire?: boolean;
  /** When set (e.g. branch manager), branch is fixed and not editable. */
  lockedBranchId?: string;
  /** Disbursement-record style: two-column sections, grouped password box, no helper blurbs. */
  recordLayout?: boolean;
}) {
  const portal = !provisioningHire && roleHasPortalAccess(form.role);

  const sectionLabel = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

  if (recordLayout) {
    return (
      <div className="space-y-6">
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <div className="space-y-4">
            <h4 className={sectionLabel}>Identity & contact</h4>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-full-name" className="text-muted-foreground">
                  Full name
                </Label>
                <Input
                  id="staff-full-name"
                  value={form.full_name}
                  onChange={(event) => onChange((prev) => ({ ...prev, full_name: event.target.value }))}
                  placeholder="e.g. Neema Chuwa"
                  className="border-border/80 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email" className="text-muted-foreground">
                  Work email
                </Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => onChange((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="name@falcofinancial.co.tz"
                  className="border-border/80 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-phone" className="text-muted-foreground">
                  Phone
                </Label>
                <Input
                  id="staff-phone"
                  value={form.phone}
                  onChange={(event) => onChange((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+255 7XX XXX XXX"
                  className="border-border/80 bg-background"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className={sectionLabel}>Role & branch</h4>
            <dl className="grid gap-4 rounded-xl border border-border/60 bg-muted/25 p-4 shadow-inner dark:bg-muted/15">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Role</Label>
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
                  <SelectTrigger className="w-full min-w-0 border-border/80 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
                    <StaffRoleSelectContent variant={provisioningHire ? "provisioning" : "all"} />
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Branch</Label>
                {lockedBranchId ? (
                  <p className="rounded-lg border border-border/70 bg-background px-3 py-2.5 text-sm font-medium">
                    {branches.find((b) => b.id === lockedBranchId)?.name ?? lockedBranchId}
                  </p>
                ) : (
                  <Select
                    value={form.branch_id}
                    onValueChange={(value) => onChange((prev) => ({ ...prev, branch_id: value }))}
                  >
                    <SelectTrigger className="w-full min-w-0 border-border/80 bg-background">
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
            </dl>
          </div>
        </div>

        {portal ? (
          <div className="space-y-3">
            <h4 className={sectionLabel}>Portal credentials</h4>
            <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/30 p-4 sm:grid-cols-2 dark:bg-muted/20">
              <div className="space-y-2">
                <Label htmlFor="staff-password" className="text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="staff-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => onChange((prev) => ({ ...prev, password: event.target.value }))}
                  className="border-border/80 bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-confirm-password" className="text-muted-foreground">
                  Confirm password
                </Label>
                <Input
                  id="staff-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    onChange((prev) => ({ ...prev, confirmPassword: event.target.value }))
                  }
                  className="border-border/80 bg-background"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

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
  const headerEyebrow = props.provisioningHire ? "Pending hire request" : "Staff directory";
  const createDescriptionSr = props.provisioningHire
    ? "Form to propose a new hire for approval."
    : "Form to add a staff member to the directory.";

  const headerWatermark = (
    <p className="pointer-events-none absolute bottom-2 right-12 hidden rotate-[-9deg] select-none border border-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/25 sm:block">
      Falco Financial
    </p>
  );

  const dialogCloseClass =
    "[&_[data-slot=dialog-close]]:absolute [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:z-30 [&_[data-slot=dialog-close]]:text-emerald-100 [&_[data-slot=dialog-close]]:opacity-90 [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:opacity-100 [&_[data-slot=dialog-close]]:focus:ring-emerald-400";

  return (
    <>
      {isMobile ? (
        <Sheet open={props.createOpen} onOpenChange={props.onCreateOpenChange}>
          <SheetContent side="bottom" className="flex h-[92vh] flex-col gap-0 overflow-hidden border-border/80 p-0">
            <div className="relative border-b border-emerald-950/40 bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 text-primary-foreground">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />
              <SheetHeader className="relative space-y-1 border-0 bg-transparent px-5 pb-5 pt-6 text-left sm:px-6 sm:pb-6 sm:pt-7">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-100/90">{headerEyebrow}</p>
                <SheetTitle className="text-left text-xl font-semibold tracking-tight text-white">{createTitle}</SheetTitle>
                <SheetDescription className="sr-only">{createDescriptionSr}</SheetDescription>
              </SheetHeader>
              {headerWatermark}
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={props.onCreateSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                <StaffFormFields
                  form={props.createForm}
                  onChange={props.onCreateFormChange}
                  provisioningHire={props.provisioningHire}
                  lockedBranchId={props.createLockedBranchId}
                  recordLayout
                />
                {props.createFormError ? (
                  <p className="mt-4 text-sm text-destructive">{props.createFormError}</p>
                ) : null}
              </div>
              <SheetFooter className="mt-auto flex-shrink-0 flex-col-reverse gap-2 border-t border-border/60 bg-muted/25 px-4 py-4 dark:bg-muted/15 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={props.onCreateCancel}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 sm:w-auto"
                >
                  {props.provisioningHire ? "Submit for approval" : "Create staff"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={props.createOpen} onOpenChange={props.onCreateOpenChange}>
          <DialogContent
            className={cn(
              "flex max-h-[min(92vh,760px)] min-h-0 flex-col gap-0 overflow-hidden border-border/80 p-0 sm:max-w-2xl",
              dialogCloseClass
            )}
          >
            <div className="relative border-b border-emerald-950/40 bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 text-primary-foreground">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_55%)]" />
              <DialogHeader className="relative space-y-1 border-0 bg-transparent px-5 pb-6 pt-7 text-left sm:px-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-100/90">{headerEyebrow}</p>
                <DialogTitle className="text-left text-xl font-semibold tracking-tight text-white">{createTitle}</DialogTitle>
                <DialogDescription className="sr-only">{createDescriptionSr}</DialogDescription>
              </DialogHeader>
              {headerWatermark}
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={props.onCreateSubmit}>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                <StaffFormFields
                  form={props.createForm}
                  onChange={props.onCreateFormChange}
                  provisioningHire={props.provisioningHire}
                  lockedBranchId={props.createLockedBranchId}
                  recordLayout
                />
                {props.createFormError ? (
                  <p className="mt-4 text-sm text-destructive">{props.createFormError}</p>
                ) : null}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/25 px-5 py-4 dark:bg-muted/15 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
                <Button type="button" variant="outline" onClick={props.onCreateCancel}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                >
                  {props.provisioningHire ? "Submit for approval" : "Create staff"}
                </Button>
              </div>
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
