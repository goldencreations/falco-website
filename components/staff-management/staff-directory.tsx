"use client";

import {
  Activity,
  Building2,
  CalendarClock,
  Eye,
  KeyRound,
  Mail,
  MoreHorizontal,
  PanelRight,
  Phone,
  Plus,
  ShieldCheck,
  UserCog,
  UserPen,
  UserRoundCheck,
  UserRoundMinus,
  Users2,
} from "lucide-react";
import { branches, formatDateTime } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StaffRecord, StaffRole, StaffStatusFilter } from "@/components/staff-management/types";
import {
  isOnline,
  roleBadgeClass,
  roleHasPortalAccess,
  roleLabel,
  STAFF_ROLE_OPTIONS,
} from "@/components/staff-management/utils";

interface StaffDirectoryProps {
  staffMembers: StaffRecord[];
  filteredStaff: StaffRecord[];
  search: string;
  selectedRole: "all" | StaffRole;
  selectedBranch: string;
  selectedStatus: StaffStatusFilter;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: "all" | StaffRole) => void;
  onBranchChange: (value: string) => void;
  onStatusChange: (value: StaffStatusFilter) => void;
  onAddStaff: () => void;
  onView: (staff: StaffRecord) => void;
  onEdit: (staff: StaffRecord) => void;
  onResetPassword: (staff: StaffRecord) => void;
  onToggleStatus: (staff: StaffRecord) => void;
  onOpenWorkspace: (staff: StaffRecord) => void;
}

export function StaffDirectory({
  staffMembers,
  filteredStaff,
  search,
  selectedRole,
  selectedBranch,
  selectedStatus,
  onSearchChange,
  onRoleChange,
  onBranchChange,
  onStatusChange,
  onAddStaff,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onOpenWorkspace,
}: StaffDirectoryProps) {
  const activeCount = staffMembers.filter((staff) => staff.is_active).length;
  const onlineCount = staffMembers.filter((staff) => isOnline(staff.last_login)).length;
  const branchManagerCount = staffMembers.filter((staff) => staff.role === "branch_manager").length;
  const loanOfficerCount = staffMembers.filter((staff) => staff.role === "loan_officer").length;

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm sm:hidden dark:from-emerald-950/20 dark:to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Staff overview
          </CardTitle>
          <CardDescription>Operational snapshot for this branch network.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/20">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total staff</p>
              <p className="mt-1 text-xl font-semibold">{staffMembers.length}</p>
            </div>
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/20">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Active</p>
              <p className="mt-1 text-xl font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/20">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Managers</p>
              <p className="mt-1 text-xl font-semibold">{branchManagerCount}</p>
            </div>
            <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/20">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Online now</p>
              <p className="mt-1 text-xl font-semibold">{onlineCount}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Includes {loanOfficerCount} loan officers across all branches.
          </p>
        </CardContent>
      </Card>

      <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-emerald-200/50 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{staffMembers.length}</p>
              <Users2 className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/50 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{activeCount}</p>
              <UserRoundCheck className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/50 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Branch managers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{branchManagerCount}</p>
              <ShieldCheck className="h-5 w-5 text-info" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-emerald-200/50 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Online Right Now</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{onlineCount}</p>
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-emerald-200/40 bg-gradient-to-b from-emerald-50/35 to-background shadow-sm dark:from-emerald-950/10 dark:to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5 text-primary" />
            Staff Directory
          </CardTitle>
          <CardDescription>
            Directory of staff by role and branch. Portal passwords apply only to roles that sign in to the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Search by name, email, or employee ID"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                className="sm:col-span-2 lg:min-w-80"
              />
              <Select
                value={selectedRole}
                onValueChange={(value) => onRoleChange(value as "all" | StaffRole)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {STAFF_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedBranch} onValueChange={onBranchChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                value={selectedStatus}
                onValueChange={(value) => onStatusChange(value as StaffStatusFilter)}
              >
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={onAddStaff}>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            </div>
          </div>

          {filteredStaff.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users2 className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-semibold">No staff found</p>
                <p className="text-sm text-muted-foreground">
                  Adjust filters or add a new staff profile to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStaff.map((staff) => {
                const branch = branches.find((item) => item.id === staff.branch_id);
                const online = isOnline(staff.last_login);
                return (
                  <Card
                    key={staff.id}
                    className="border border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary">
                            {staff.full_name
                              .split(" ")
                              .map((chunk) => chunk[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-semibold">{staff.full_name}</p>
                            <p className="text-xs text-muted-foreground">{staff.employee_id}</p>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Staff actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenWorkspace(staff)}>
                              <PanelRight className="mr-2 h-4 w-4" />
                              Open workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onView(staff)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEdit(staff)}>
                              <UserPen className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                            {roleHasPortalAccess(staff.role) ? (
                              <DropdownMenuItem onClick={() => onResetPassword(staff)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Reset password
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant={staff.is_active ? "destructive" : "default"}
                              onClick={() => onToggleStatus(staff)}
                            >
                              {staff.is_active ? (
                                <>
                                  <UserRoundMinus className="mr-2 h-4 w-4" />
                                  Suspend Staff
                                </>
                              ) : (
                                <>
                                  <UserRoundCheck className="mr-2 h-4 w-4" />
                                  Activate Staff
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={roleBadgeClass(staff.role)}>
                          {roleLabel(staff.role)}
                        </Badge>
                        <Badge variant={staff.is_active ? "default" : "secondary"}>
                          {staff.is_active ? "Active" : "Suspended"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={online ? "border-success/20 bg-success/10 text-success" : ""}
                        >
                          {online ? "Online" : "Offline"}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{staff.email}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {staff.phone}
                        </p>
                        <p className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {branch?.name ?? "Unassigned branch"}
                        </p>
                        <p className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          Last login: {staff.last_login ? formatDateTime(staff.last_login) : "Never logged in"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
