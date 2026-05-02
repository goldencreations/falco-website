"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Medal,
  RefreshCcw,
  Search,
  UserMinus,
  Users,
  Eye,
  UserPlus,
  Building2,
  TrendingUp,
} from "lucide-react";
import {
  branches,
  formatCurrency,
  loanApplications,
  loans,
  payments,
  currentUser,
} from "@/lib/mock-data";
import type { Customer, User } from "@/lib/types";
import {
  computeOfficerPerformance,
  rankOfficersByScore,
  type OfficerPerformance,
} from "@/lib/staff-team-metrics";
import { Separator } from "@/components/ui/separator";
import { OfficerPerformanceDialog } from "@/components/staff-team/officer-performance-dialog";
import { StaffFormFields } from "@/components/staff-management/staff-dialogs";
import {
  defaultCreateForm,
  validateProvisioningHireForm,
} from "@/components/staff-management/utils";
import type { StaffFormState } from "@/components/staff-management/types";

const TEAM_ROLES: User["role"][] = ["loan_officer", "collections_officer"];

export default function StaffTeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignCustomerId, setAssignCustomerId] = useState("");
  const [assignOfficerId, setAssignOfficerId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendStaffId, setSuspendStaffId] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSaving, setSuspendSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [viewOfficerId, setViewOfficerId] = useState<string | null>(null);
  const [hireOpen, setHireOpen] = useState(false);
  const [hireForm, setHireForm] = useState<StaffFormState>(defaultCreateForm);
  const [hireError, setHireError] = useState("");
  const [hireSaving, setHireSaving] = useState(false);

  const branchId = currentUser.branch_id;
  const lockHireBranch = currentUser.role === "branch_manager";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, cRes] = await Promise.all([
        fetch("/api/staff/directory"),
        fetch("/api/customers/with-assignments"),
      ]);
      const uData = await uRes.json();
      const cData = await cRes.json();
      setUsers(uData.users ?? []);
      setCustomers(cData.customers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (hireOpen) {
      setHireForm({ ...defaultCreateForm, branch_id: branchId });
      setHireError("");
    }
  }, [hireOpen, branchId]);

  const branchOfficers = useMemo(() => {
    return users.filter(
      (u) =>
        u.branch_id === branchId &&
        TEAM_ROLES.includes(u.role) &&
        u.is_active
    );
  }, [users, branchId]);

  const officersPerf = useMemo(() => {
    const rows = branchOfficers.map((officer) =>
      computeOfficerPerformance(officer, {
        customers,
        loans,
        applications: loanApplications,
        payments,
      })
    );
    return rankOfficersByScore(rows);
  }, [branchOfficers, customers]);

  const perfById = useMemo(() => {
    const m = new Map<string, OfficerPerformance>();
    officersPerf.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [officersPerf]);

  const best = officersPerf[0];

  const branchCustomers = useMemo(() => {
    return customers.filter((c) => c.branch_id === branchId && c.is_active);
  }, [customers, branchId]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return branchCustomers;
    return branchCustomers.filter(
      (c) =>
        c.customer_number.toLowerCase().includes(q) ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
    );
  }, [branchCustomers, customerSearch]);

  const viewOfficer = viewOfficerId ? users.find((u) => u.id === viewOfficerId) ?? null : null;
  const viewPerf = viewOfficerId ? perfById.get(viewOfficerId) ?? null : null;

  const handleAssign = async () => {
    if (!assignCustomerId || !assignOfficerId) return;
    setAssignSaving(true);
    try {
      const res = await fetch(`/api/customers/${assignCustomerId}/assignment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_loan_officer_id: assignOfficerId }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error ?? "Assignment failed");
        return;
      }
      await load();
      setAssignCustomerId("");
      setAssignOfficerId("");
    } finally {
      setAssignSaving(false);
    }
  };

  const handleSuspendRequest = async () => {
    if (!suspendStaffId) return;
    setSuspendSaving(true);
    try {
      const res = await fetch("/api/staff/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "suspend",
          staff_id: suspendStaffId,
          reason: suspendReason || null,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.error ?? "Request failed");
        return;
      }
      setSuspendOpen(false);
      setSuspendStaffId("");
      setSuspendReason("");
      alert("Suspension request submitted for super admin review.");
    } finally {
      setSuspendSaving(false);
    }
  };

  const handleProposeHire = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateProvisioningHireForm(hireForm);
    if (err) {
      setHireError(err);
      return;
    }
    const dup = users.some(
      (u) => u.email.toLowerCase() === hireForm.email.trim().toLowerCase()
    );
    if (dup) {
      setHireError("This email is already in the directory.");
      return;
    }
    setHireSaving(true);
    try {
      const res = await fetch("/api/staff/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: hireForm.full_name.trim(),
          email: hireForm.email.trim().toLowerCase(),
          phone: hireForm.phone.trim(),
          role: hireForm.role,
          branch_id: hireForm.branch_id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHireError(typeof data.error === "string" ? data.error : "Request failed.");
        return;
      }
      setHireOpen(false);
      alert(
        "Hire request submitted. Super Admin will review it in Staff Management → Pending hires. The user cannot access the system until approved."
      );
    } finally {
      setHireSaving(false);
    }
  };

  if (currentUser.role !== "branch_manager" && currentUser.role !== "super_admin") {
    return (
      <>
        <DashboardHeader title="Team & assignments" description="" />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <p className="text-muted-foreground">You do not have access to this workspace.</p>
        </main>
      </>
    );
  }

  const branchName = branches.find((b) => b.id === branchId)?.name ?? branchId;
  const loanOfficerCount = branchOfficers.filter((u) => u.role === "loan_officer").length;

  return (
    <>
      <DashboardHeader
        title="Team & assignments"
        description={`Branch workforce performance, RM assignments, and hire requests · ${branchName}`}
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6 lg:pb-8">
        <div className="mx-auto w-full max-w-7xl space-y-8">
          <div className="overflow-hidden rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 via-background to-background shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/25">
            <div className="flex flex-col gap-4 border-b border-emerald-200/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/30">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-md dark:bg-emerald-800">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-800/80 dark:text-emerald-200/80">
                    Branch operations
                  </p>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">{branchName}</h2>
                  <p className="text-sm text-muted-foreground">
                    Monitor officers, assign customers, and route hire or access requests to Head Office.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                  <span className="ml-2">Refresh</span>
                </Button>
                <Button type="button" size="sm" className="gap-2" onClick={() => setHireOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  Propose new hire
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSuspendOpen(true)}
                  className="gap-2"
                >
                  <UserMinus className="h-4 w-4" />
                  Request access change
                </Button>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-emerald-100/80 shadow-none dark:border-emerald-900/40">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    Active field staff
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">{branchOfficers.length}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Loan officers & collections in this branch
                </CardContent>
              </Card>
              <Card className="border-emerald-100/80 shadow-none dark:border-emerald-900/40">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    Loan officers
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">{loanOfficerCount}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  Eligible for RM assignment
                </CardContent>
              </Card>
              <Card className="border-emerald-100/80 shadow-none dark:border-emerald-900/40">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    Branch customers
                  </CardDescription>
                  <CardTitle className="text-3xl font-bold tabular-nums">{branchCustomers.length}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">Active records</CardContent>
              </Card>
              <Card className="border-emerald-100/80 shadow-none dark:border-emerald-900/40">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Top score
                  </CardDescription>
                  <CardTitle className="text-xl font-bold leading-tight">
                    {best ? best.score.toFixed(1) : "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-muted-foreground">
                  {best ? best.full_name : "No officers loaded"}
                </CardContent>
              </Card>
            </div>
          </div>

          {best && (
            <Card className="border border-emerald-200/70 bg-gradient-to-br from-emerald-600/95 via-emerald-700 to-emerald-900 text-emerald-50 shadow-md dark:border-emerald-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                  <Medal className="h-5 w-5 text-amber-300" />
                  Best performer
                </CardTitle>
                <CardDescription className="text-emerald-100/90">
                  Composite ranking from assignments, pipeline, loans, and collections (demo formula).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-tight text-white">{best.full_name}</p>
                  <p className="mt-1 text-sm text-emerald-100/90">
                    Score {best.score.toFixed(1)} · {best.loans_handled} loans ·{" "}
                    {formatCurrency(best.collections_tz_sum)} collections · {best.applications_count} applications
                  </p>
                </div>
                <Badge className="w-fit border-white/25 bg-white/15 text-white hover:bg-white/20">
                  {branchOfficers.length} active staff
                </Badge>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-lg">Officer performance</CardTitle>
              <CardDescription>
                Summary KPIs for each officer. Open the official record for customers, applications, and loans.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0 md:p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Officer</TableHead>
                        <TableHead className="text-right">Assigned cust.</TableHead>
                        <TableHead className="text-right">Created cust.</TableHead>
                        <TableHead className="text-right">Applications</TableHead>
                        <TableHead className="text-right">Loans</TableHead>
                        <TableHead className="text-right">Collections</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {officersPerf.map((row) => (
                        <TableRow key={row.user_id}>
                          <TableCell>
                            <div className="font-medium">{row.full_name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{row.employee_id}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.customers_assigned}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.customers_created}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.applications_count}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.loans_handled}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.collections_tz_sum)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {row.score.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => setViewOfficerId(row.user_id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>

                  <div className="grid gap-3 p-4 md:hidden">
                    {officersPerf.map((row) => (
                      <Card key={row.user_id} className="border-border/70">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{row.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{row.employee_id}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 gap-1"
                              onClick={() => setViewOfficerId(row.user_id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Assigned</span>
                              <p className="font-semibold tabular-nums">{row.customers_assigned}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Loans</span>
                              <p className="font-semibold tabular-nums">{row.loans_handled}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Apps</span>
                              <p className="font-semibold tabular-nums">{row.applications_count}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Score</span>
                              <p className="font-semibold tabular-nums">{row.score.toFixed(1)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="hidden md:block">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Assign loan officer to customer
                </CardTitle>
                <CardDescription>
                  Sets the primary relationship manager (`assigned_loan_officer_id`) for the selected customer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search customer…"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select value={assignCustomerId} onValueChange={setAssignCustomerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {filteredCustomers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.customer_number} · {c.first_name} {c.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Loan officer</Label>
                    <Select value={assignOfficerId} onValueChange={setAssignOfficerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select officer" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOfficers
                          .filter((u) => u.role === "loan_officer")
                          .map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleAssign}
                  disabled={!assignCustomerId || !assignOfficerId || assignSaving}
                >
                  {assignSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save assignment
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assign loan officer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search customer…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <Select value={assignCustomerId} onValueChange={setAssignCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Customer" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {filteredCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.customer_number} · {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignOfficerId} onValueChange={setAssignOfficerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Loan officer" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOfficers
                      .filter((u) => u.role === "loan_officer")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  onClick={handleAssign}
                  disabled={!assignCustomerId || !assignOfficerId || assignSaving}
                >
                  {assignSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save assignment
                </Button>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Proposed hires are queued for Super Admin under Staff Management → Pending hires. Suspension requests are
            queued under Access requests. No access changes apply until approved.
          </p>
        </div>
      </main>

      <OfficerPerformanceDialog
        open={viewOfficerId !== null && viewOfficer !== null && viewPerf !== null}
        onOpenChange={(o) => !o && setViewOfficerId(null)}
        officer={viewOfficer}
        perf={viewPerf}
        customers={customers}
        applications={loanApplications}
        loans={loans}
      />

      <Dialog open={hireOpen} onOpenChange={setHireOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] gap-0 overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Propose new hire</DialogTitle>
            <DialogDescription>
              Same workflow as Staff Management: submits a pending hire. The person cannot sign in until a Super Admin
              approves in Pending hires.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 py-2" onSubmit={handleProposeHire}>
            <StaffFormFields
              form={hireForm}
              onChange={(updater) => setHireForm((prev) => updater(prev))}
              provisioningHire
              lockedBranchId={lockHireBranch ? branchId : undefined}
            />
            {hireError ? <p className="text-sm text-destructive">{hireError}</p> : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setHireOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={hireSaving}>
                {hireSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit for approval
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request suspension</DialogTitle>
            <DialogDescription>
              Sends a request to Staff Management. Access is only removed after super admin approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Staff member</Label>
              <Select value={suspendStaffId} onValueChange={setSuspendStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select officer" />
                </SelectTrigger>
                <SelectContent>
                  {branchOfficers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                placeholder="Brief justification"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSuspendRequest} disabled={!suspendStaffId || suspendSaving}>
              {suspendSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
