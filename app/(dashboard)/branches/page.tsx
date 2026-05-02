"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Building2,
  CalendarRange,
  Download,
  Eye,
  PencilLine,
  Plus,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  collectionActivities,
  customers,
  formatCurrency,
  formatDate,
  loans,
  payments,
  repaymentSchedules,
} from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import type { Branch, Customer } from "@/lib/types";

interface BranchFormState {
  name: string;
  code: string;
  region: string;
  address: string;
  phone: string;
  manager_id: string;
}

const defaultForm: BranchFormState = {
  name: "",
  code: "",
  region: "",
  address: "",
  phone: "",
  manager_id: "",
};

function customerFullName(customer: Customer) {
  return [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(" ");
}

export default function BranchesPage() {
  const {
    branches: branchRecords,
    users,
    addBranch,
    updateBranch,
    assignManager,
    assignLoanOfficer,
    removeLoanOfficer,
  } = useBranchAssignment();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranchId, setEditBranchId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<BranchFormState>(defaultForm);
  const [createError, setCreateError] = useState("");
  const [overviewBranchId, setOverviewBranchId] = useState<string | null>(null);
  const [selectedBranchQuickOpen, setSelectedBranchQuickOpen] = useState<string>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [newOfficerId, setNewOfficerId] = useState("");
  const [exportingBranchId, setExportingBranchId] = useState<string | null>(null);

  const branchManagers = useMemo(() => users.filter((u) => u.role === "branch_manager"), [users]);
  const loanOfficers = useMemo(() => users.filter((u) => u.role === "loan_officer"), [users]);

  const editingBranch = useMemo(
    () => branchRecords.find((branch) => branch.id === editBranchId) ?? null,
    [branchRecords, editBranchId]
  );

  const branchSummary = useMemo(() => {
    return branchRecords.map((branch) => {
      const branchCustomers = customers.filter((c) => c.branch_id === branch.id);
      const branchLoans = loans.filter((l) => l.branch_id === branch.id);
      const branchLoanIds = new Set(branchLoans.map((l) => l.id));
      const collected = payments
        .filter((p) => p.status === "completed" && branchLoanIds.has(p.loan_id))
        .reduce((sum, p) => sum + p.amount, 0);
      const disbursed = branchLoans.reduce((sum, l) => sum + l.principal_amount, 0);
      const manager = users.find((u) => u.id === branch.manager_id);
      const officers = loanOfficers.filter((officer) => officer.branch_id === branch.id);
      return {
        branch,
        manager,
        officers,
        customerCount: branchCustomers.length,
        loanCount: branchLoans.length,
        disbursed,
        collected,
      };
    });
  }, [branchRecords, users, loanOfficers]);

  const selectedBranch = useMemo(
    () => branchRecords.find((b) => b.id === overviewBranchId) ?? null,
    [branchRecords, overviewBranchId]
  );

  const branchCustomers = useMemo(
    () => (selectedBranch ? customers.filter((c) => c.branch_id === selectedBranch.id) : []),
    [selectedBranch]
  );
  const branchLoans = useMemo(
    () => (selectedBranch ? loans.filter((l) => l.branch_id === selectedBranch.id) : []),
    [selectedBranch]
  );
  const branchLoanIds = useMemo(() => new Set(branchLoans.map((loan) => loan.id)), [branchLoans]);
  const branchOfficerList = useMemo(
    () => loanOfficers.filter((officer) => officer.branch_id === selectedBranch?.id),
    [loanOfficers, selectedBranch]
  );
  const branchManager = useMemo(
    () => users.find((user) => user.id === selectedBranch?.manager_id) ?? null,
    [users, selectedBranch]
  );

  const startDate = fromDate ? new Date(fromDate) : null;
  const endDate = toDate ? new Date(toDate) : null;

  const scheduleInDateRange = (dueDateString: string) => {
    const due = new Date(dueDateString);
    if (startDate && due < startDate) return false;
    if (endDate && due > endDate) return false;
    return true;
  };

  const expectedCollectionInRange = useMemo(() => {
    if (!selectedBranch) return 0;
    return repaymentSchedules
      .filter((schedule) => {
        if (!branchLoanIds.has(schedule.loan_id)) return false;
        if (schedule.is_paid) return false;
        return scheduleInDateRange(schedule.due_date);
      })
      .reduce((sum, schedule) => sum + schedule.total_due, 0);
  }, [selectedBranch, branchLoanIds, fromDate, toDate]);

  const customerRows = useMemo(() => {
    return branchCustomers
      .map((customer) => {
        const customerLoans = branchLoans.filter((loan) => loan.customer_id === customer.id);
        const customerLoanIds = new Set(customerLoans.map((loan) => loan.id));
        const dueSchedules = repaymentSchedules.filter(
          (schedule) => customerLoanIds.has(schedule.loan_id) && !schedule.is_paid
        );
        const withinRange = dueSchedules.some((schedule) => scheduleInDateRange(schedule.due_date));
        const collected = payments
          .filter((payment) => payment.status === "completed" && customerLoanIds.has(payment.loan_id))
          .reduce((sum, payment) => sum + payment.amount, 0);
        const taken = customerLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
        const outstanding = customerLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
        return {
          customer,
          taken,
          collected,
          outstanding,
          withinRange,
        };
      })
      .filter((row) => (!fromDate && !toDate ? true : row.withinRange));
  }, [branchCustomers, branchLoans, fromDate, toDate]);

  const selectedCustomer = customerRows.find((row) => row.customer.id === selectedCustomerId);
  const selectedCustomerLoans = selectedCustomer
    ? branchLoans.filter((loan) => loan.customer_id === selectedCustomer.customer.id)
    : [];
  const selectedCustomerLoanIds = new Set(selectedCustomerLoans.map((loan) => loan.id));
  const returnedAmount = payments
    .filter((payment) => payment.status === "completed" && selectedCustomerLoanIds.has(payment.loan_id))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const takenAmount = selectedCustomerLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
  const expectedProfit = selectedCustomerLoans.reduce((sum, loan) => sum + loan.interest_amount, 0);
  const createdByUser = selectedCustomer
    ? users.find((user) => user.id === selectedCustomer.customer.created_by)
    : null;
  const followUpUser = selectedCustomer
    ? (() => {
        const customerCollections = collectionActivities.filter((activity) =>
          selectedCustomerLoanIds.has(activity.loan_id)
        );
        const lastCollectionActor = customerCollections.at(-1)?.performed_by;
        if (lastCollectionActor) return users.find((user) => user.id === lastCollectionActor) ?? null;
        const latestPaymentActor = payments
          .filter((p) => selectedCustomerLoanIds.has(p.loan_id) && p.status === "completed")
          .at(-1)?.received_by;
        if (latestPaymentActor) return users.find((u) => u.id === latestPaymentActor) ?? null;
        const defaultOfficerId = selectedCustomerLoans[0]?.loan_officer_id;
        return users.find((u) => u.id === defaultOfficerId) ?? null;
      })()
    : null;

  const customerDistributionData = [
    { label: "Taken", amount: takenAmount, color: "#10b981" },
    { label: "Returned", amount: returnedAmount, color: "#065f46" },
    { label: "Expected Profit", amount: expectedProfit, color: "#10b981" },
  ];

  const createBranch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.name.trim() || !createForm.code.trim() || !createForm.manager_id) {
      setCreateError("Branch name, code and manager are required.");
      return;
    }
    const duplicate = branchRecords.some(
      (branch) => branch.code.toLowerCase() === createForm.code.trim().toLowerCase()
    );
    if (duplicate) {
      setCreateError("Branch code already exists.");
      return;
    }

    const payload = {
      name: createForm.name.trim(),
      location: createForm.address.trim(),
      phone: createForm.phone.trim(),
      manager_id: createForm.manager_id,
      is_active: true,
    };
    void payload;

    const newBranch: Branch = {
      id: `br-${Date.now()}`,
      name: createForm.name.trim(),
      code: createForm.code.trim().toUpperCase(),
      region: createForm.region.trim() || "Not specified",
      address: createForm.address.trim() || "Not specified",
      phone: createForm.phone.trim() || "N/A",
      manager_id: createForm.manager_id,
      is_active: true,
    };
    addBranch(newBranch);
    setCreateOpen(false);
    setCreateForm(defaultForm);
    setCreateError("");
  };

  const saveBranchEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingBranch) return;
    updateBranch(editingBranch.id, editingBranch);
    setEditBranchId(null);
  };

  const managerOptions = branchManagers.filter(
    (manager) => manager.branch_id === selectedBranch?.id || manager.branch_id === "" || manager.id === selectedBranch?.manager_id
  );

  const unassignedOrExternalOfficers = loanOfficers.filter(
    (officer) => officer.branch_id !== selectedBranch?.id
  );

  const exportBranchDetailsPdf = async (branchId: string) => {
    try {
      setExportingBranchId(branchId);
      const response = await fetch(`/api/branches/${branchId}/export`);
      if (!response.ok) {
        throw new Error(`Branch export failed with status ${response.status}`);
      }
      const payload = (await response.json()) as {
        generated_at: string;
        branch: {
          name: string;
          code: string;
          region: string;
          address: string;
          phone: string;
          manager: { full_name: string; phone: string; email: string } | null;
          loan_officers: Array<{ full_name: string; phone: string; employee_id: string }>;
          totals: { customers: number; disbursed: number; collected: number; outstanding: number };
        };
        customers: Array<{
          customer_number: string;
          customer_name: string;
          contact_phone: string;
          assigned_loan_officer: { full_name: string; phone: string } | null;
          total_taken: number;
          total_outstanding: number;
        }>;
        payments: Array<{
          payment_number: string;
          customer_name: string;
          amount: number;
          status: string;
          method: string;
          payment_date: string;
          received_by: string;
        }>;
      };

      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;
      const doc = new jsPDF("p", "mm", "a4");
      doc.setFontSize(16);
      doc.text("Branch Portfolio Export", 14, 16);
      doc.setFontSize(10);
      doc.text(
        `${payload.branch.name} (${payload.branch.code}) - Generated ${new Date(
          payload.generated_at
        ).toLocaleString()}`,
        14,
        22
      );

      autoTable(doc, {
        startY: 28,
        head: [["Branch Detail", "Value"]],
        body: [
          ["Region", payload.branch.region],
          ["Address", payload.branch.address],
          ["Phone", payload.branch.phone],
          ["Manager", payload.branch.manager?.full_name ?? "Unassigned"],
          ["Manager Contact", payload.branch.manager?.phone ?? "N/A"],
          ["Total Customers", String(payload.branch.totals.customers)],
          ["Disbursed", formatCurrency(payload.branch.totals.disbursed)],
          ["Collected", formatCurrency(payload.branch.totals.collected)],
          ["Outstanding", formatCurrency(payload.branch.totals.outstanding)],
        ],
        styles: { fontSize: 9 },
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
        head: [["Loan Officers", "Employee ID", "Phone"]],
        body: payload.branch.loan_officers.map((officer) => [
          officer.full_name,
          officer.employee_id,
          officer.phone,
        ]),
        styles: { fontSize: 8 },
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
        head: [[
          "Customer",
          "Phone",
          "Assigned Loan Officer",
          "Officer Contact",
          "Taken",
          "Outstanding",
        ]],
        body: payload.customers.map((customer) => [
          `${customer.customer_name} (${customer.customer_number})`,
          customer.contact_phone,
          customer.assigned_loan_officer?.full_name ?? "Unassigned",
          customer.assigned_loan_officer?.phone ?? "N/A",
          formatCurrency(customer.total_taken),
          formatCurrency(customer.total_outstanding),
        ]),
        styles: { fontSize: 8 },
      });

      autoTable(doc, {
        startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
        head: [["Payment #", "Customer", "Amount", "Status", "Method", "Date", "Received By"]],
        body: payload.payments.map((payment) => [
          payment.payment_number,
          payment.customer_name,
          formatCurrency(payment.amount),
          payment.status,
          payment.method,
          new Date(payment.payment_date).toLocaleString(),
          payment.received_by,
        ]),
        styles: { fontSize: 8 },
      });

      doc.save(`${payload.branch.code}-branch-export.pdf`);
    } catch (error) {
      console.error("Branch export failed", error);
    } finally {
      setExportingBranchId(null);
    }
  };

  return (
    <>
      <DashboardHeader
        title="Branch Management"
        description="Create branches, manage manager/officer assignments, and monitor branch portfolio with professional customer drill-down."
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm sm:hidden dark:border-emerald-900/40 dark:from-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Branch Network Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                <p className="text-[11px] text-muted-foreground">Branches</p>
                <p className="text-lg font-semibold">{branchRecords.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                <p className="text-[11px] text-muted-foreground">Managers</p>
                <p className="text-lg font-semibold">{branchManagers.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                <p className="text-[11px] text-muted-foreground">Loan officers</p>
                <p className="text-lg font-semibold">{loanOfficers.length}</p>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                <p className="text-[11px] text-muted-foreground">Customers</p>
                <p className="text-lg font-semibold">{customers.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200/40 bg-gradient-to-b from-emerald-50/35 to-background shadow-sm dark:from-emerald-950/10">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">Branches</CardTitle>
                <CardDescription>
                  Use branch cards for quick actions, then open the full branch overview panel.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selectedBranchQuickOpen} onValueChange={setSelectedBranchQuickOpen}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Select branch panel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select branch panel</SelectItem>
                    {branchRecords.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => selectedBranchQuickOpen !== "all" && setOverviewBranchId(selectedBranchQuickOpen)}
                >
                  Open Panel
                </Button>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Branch
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {branchSummary.map(({ branch, manager, officers, customerCount, loanCount, disbursed, collected }) => (
                  <Card
                    key={branch.id}
                    className="border border-emerald-200/50 bg-gradient-to-br from-emerald-50/45 to-background shadow-sm dark:from-emerald-950/10"
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{branch.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {branch.code} · {branch.region}
                          </p>
                        </div>
                        <Badge variant={branch.is_active ? "default" : "secondary"}>
                          {branch.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p className="truncate">Manager: {manager?.full_name ?? "Unassigned"}</p>
                        <p>Officers: {officers.length}</p>
                        <p>{branch.phone}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border border-emerald-200/60 bg-emerald-100/50 p-2 dark:border-emerald-900/30 dark:bg-emerald-950/15">
                          <p className="text-xs text-muted-foreground">Customers</p>
                          <p className="font-semibold">{customerCount}</p>
                        </div>
                        <div className="rounded-md border border-emerald-200/60 bg-emerald-100/50 p-2 dark:border-emerald-900/30 dark:bg-emerald-950/15">
                          <p className="text-xs text-muted-foreground">Loans</p>
                          <p className="font-semibold">{loanCount}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Disbursed {formatCurrency(disbursed)} · Collected {formatCurrency(collected)}
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditBranchId(branch.id)}>
                          <PencilLine className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button size="sm" onClick={() => setOverviewBranchId(branch.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>
              Add branch details aligned with architecture branch fields and manager assignment.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={createBranch}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="branch-name">Branch Name</Label>
                <Input
                  id="branch-name"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-code">Branch Code</Label>
                <Input
                  id="branch-code"
                  value={createForm.code}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, code: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-region">Region</Label>
                <Input
                  id="branch-region"
                  value={createForm.region}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, region: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch-phone">Phone</Label>
                <Input
                  id="branch-phone"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="branch-address">Location / Address</Label>
                <Input
                  id="branch-address"
                  value={createForm.address}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Branch Manager</Label>
                <Select value={createForm.manager_id} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, manager_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchManagers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name} ({manager.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingBranch)} onOpenChange={(open) => !open && setEditBranchId(null)}>
        <DialogContent className="sm:max-w-xl">
          {editingBranch ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Branch</DialogTitle>
                <DialogDescription>Update branch details and assignment in one place.</DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" onSubmit={saveBranchEdit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Branch Name</Label>
                    <Input value={editingBranch.name} onChange={(e) => updateBranch(editingBranch.id, { name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch Code</Label>
                    <Input value={editingBranch.code} onChange={(e) => updateBranch(editingBranch.id, { code: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Region</Label>
                    <Input value={editingBranch.region} onChange={(e) => updateBranch(editingBranch.id, { region: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={editingBranch.phone} onChange={(e) => updateBranch(editingBranch.id, { phone: e.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Location</Label>
                    <Input value={editingBranch.address} onChange={(e) => updateBranch(editingBranch.id, { address: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditBranchId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedBranch)} onOpenChange={(open) => !open && setOverviewBranchId(null)}>
        <SheetContent
          side="right"
          className="flex h-full max-h-[100dvh] w-full max-w-[100vw] flex-col gap-0 overflow-hidden border-emerald-200/50 p-0 sm:max-w-5xl dark:border-emerald-900/30"
        >
          {selectedBranch ? (
            <>
              <div
                className="flex shrink-0 justify-center pt-2 sm:hidden"
                aria-hidden
              >
                <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
              </div>
              <SheetHeader className="shrink-0 space-y-3 border-b border-emerald-200/60 bg-emerald-50/35 px-4 pb-4 pt-2 text-left sm:px-6 sm:py-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <div className="pr-8 sm:pr-4">
                  <SheetTitle className="flex items-start gap-2 text-left text-base leading-snug sm:items-center sm:text-lg">
                    <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:mt-0" />
                    <span className="break-words">{selectedBranch.name} Overview</span>
                  </SheetTitle>
                  <SheetDescription className="text-left text-xs sm:text-sm">
                    Professional branch summary with assignment controls and customer analytics.
                  </SheetDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full touch-manipulation sm:w-auto sm:self-start"
                  onClick={() => exportBranchDetailsPdf(selectedBranch.id)}
                  disabled={exportingBranchId === selectedBranch.id}
                >
                  <Download className="mr-2 h-4 w-4 shrink-0" />
                  {exportingBranchId === selectedBranch.id ? "Exporting..." : "Export Branch PDF"}
                </Button>
              </SheetHeader>
              <ScrollArea className="min-h-0 flex-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                <div className="space-y-5 pb-6 sm:pb-8">
                  <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm sm:hidden dark:border-emerald-900/40 dark:from-emerald-950/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Branch Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-[11px] text-muted-foreground">Customers</p>
                          <p className="text-lg font-semibold">{branchCustomers.length}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-[11px] text-muted-foreground">Loan Officers</p>
                          <p className="text-lg font-semibold">{branchOfficerList.length}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-[11px] text-muted-foreground">Disbursed</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(
                              branchLoans.reduce((sum, loan) => sum + loan.principal_amount, 0)
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-[11px] text-muted-foreground">Collected</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(
                              payments
                                .filter((p) => p.status === "completed" && branchLoanIds.has(p.loan_id))
                                .reduce((sum, p) => sum + p.amount, 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="hidden gap-4 sm:grid md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Customers</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold">{branchCustomers.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Loan Officers</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold">{branchOfficerList.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Total Disbursed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold">
                          {formatCurrency(
                            branchLoans.reduce((sum, loan) => sum + loan.principal_amount, 0)
                          )}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Collected</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold">
                          {formatCurrency(
                            payments
                              .filter((p) => p.status === "completed" && branchLoanIds.has(p.loan_id))
                              .reduce((sum, p) => sum + p.amount, 0)
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="text-base">Manager Assignment</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Current Manager</p>
                        <p className="break-words font-medium">{branchManager?.full_name ?? "Unassigned"}</p>
                      </div>
                      <div className="min-w-0">
                        <Select
                          value={selectedBranch.manager_id || "none"}
                          onValueChange={(value) => assignManager(selectedBranch.id, value === "none" ? null : value)}
                        >
                          <SelectTrigger className="w-full touch-manipulation">
                            <SelectValue placeholder="Change manager" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Remove manager</SelectItem>
                            {managerOptions.map((manager) => (
                              <SelectItem key={manager.id} value={manager.id}>
                                {manager.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                        Loan Officers in Branch
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <Select value={newOfficerId} onValueChange={setNewOfficerId}>
                          <SelectTrigger className="w-full min-w-0 touch-manipulation sm:w-80">
                            <SelectValue placeholder="Assign loan officer from another branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {unassignedOrExternalOfficers.map((officer) => (
                              <SelectItem key={officer.id} value={officer.id}>
                                {officer.full_name} ({officer.branch_id || "unassigned"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          className="w-full touch-manipulation sm:w-auto sm:shrink-0"
                          onClick={() => {
                            if (!newOfficerId) return;
                            assignLoanOfficer(newOfficerId, selectedBranch.id);
                            setNewOfficerId("");
                          }}
                        >
                          Add Officer
                        </Button>
                      </div>

                      {branchOfficerList.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {branchOfficerList.map((officer) => (
                            <div
                              key={officer.id}
                              className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="break-words font-medium">{officer.full_name}</p>
                                <p className="text-muted-foreground">{officer.employee_id}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-10 w-full touch-manipulation sm:h-9 sm:w-9 sm:shrink-0"
                                aria-label={`Remove ${officer.full_name} from branch`}
                                onClick={() => removeLoanOfficer(officer.id)}
                              >
                                <UserMinus className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No loan officers assigned.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="text-base">Expected Office Collection Filter</CardTitle>
                      <CardDescription>
                        Filter expected due amount and portfolio list by date range.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="from-date">From</Label>
                        <Input
                          id="from-date"
                          type="date"
                          className="touch-manipulation"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="to-date">To</Label>
                        <Input
                          id="to-date"
                          type="date"
                          className="touch-manipulation"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                        />
                      </div>
                      <div className="flex items-stretch sm:col-span-2 sm:items-end">
                        <div className="w-full rounded-lg border p-3">
                          <p className="text-xs text-muted-foreground">Expected Amount in Range</p>
                          <p className="text-lg font-semibold tabular-nums sm:text-xl">
                            {formatCurrency(expectedCollectionInRange)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3 sm:pb-6">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4 shrink-0 text-primary" />
                        Customer Portfolio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customerRows.length === 0 ? (
                        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                          No customers match the selected date filter.
                        </div>
                      ) : (
                        <>
                          <div className="space-y-3 sm:hidden">
                            {customerRows.map((row) => (
                              <div
                                key={row.customer.id}
                                className="rounded-xl border bg-card/80 p-4 shadow-sm ring-1 ring-border/60"
                              >
                                <div className="min-w-0">
                                  <p className="break-words font-medium leading-snug">
                                    {customerFullName(row.customer)}
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {row.customer.phone_primary}
                                  </p>
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                                  <div>
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Taken
                                    </dt>
                                    <dd className="mt-0.5 tabular-nums font-semibold">
                                      {formatCurrency(row.taken)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Collected
                                    </dt>
                                    <dd className="mt-0.5 tabular-nums font-semibold">
                                      {formatCurrency(row.collected)}
                                    </dd>
                                  </div>
                                  <div className="col-span-2">
                                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                      Outstanding
                                    </dt>
                                    <dd className="mt-0.5 tabular-nums font-semibold">
                                      {formatCurrency(row.outstanding)}
                                    </dd>
                                  </div>
                                </dl>
                                <Button
                                  className="mt-4 w-full touch-manipulation"
                                  size="sm"
                                  onClick={() => setSelectedCustomerId(row.customer.id)}
                                >
                                  View Summary
                                </Button>
                              </div>
                            ))}
                          </div>
                          <div className="hidden sm:block">
                            <div className="-mx-1 overflow-x-auto rounded-md border sm:mx-0">
                              <table className="w-full min-w-[640px] text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/50 text-left">
                                    <th className="p-2">Customer</th>
                                    <th className="p-2 text-right">Taken</th>
                                    <th className="p-2 text-right">Collected</th>
                                    <th className="p-2 text-right">Outstanding</th>
                                    <th className="p-2 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {customerRows.map((row) => (
                                    <tr key={row.customer.id} className="border-b last:border-0">
                                      <td className="p-2">
                                        <p className="font-medium">{customerFullName(row.customer)}</p>
                                        <p className="text-xs text-muted-foreground">{row.customer.phone_primary}</p>
                                      </td>
                                      <td className="p-2 text-right tabular-nums">{formatCurrency(row.taken)}</td>
                                      <td className="p-2 text-right tabular-nums">{formatCurrency(row.collected)}</td>
                                      <td className="p-2 text-right tabular-nums">{formatCurrency(row.outstanding)}</td>
                                      <td className="p-2 text-right">
                                        <Button
                                          size="sm"
                                          className="touch-manipulation"
                                          onClick={() => setSelectedCustomerId(row.customer.id)}
                                        >
                                          View Summary
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(selectedCustomer)} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
          {selectedCustomer ? (
            <>
              <DialogHeader>
                <DialogTitle>{customerFullName(selectedCustomer.customer)} Summary</DialogTitle>
                <DialogDescription>
                  Circular distribution, timeline, customer owner, and collection follow-up duty.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Taken</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold">{formatCurrency(takenAmount)}</p></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Returned</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold">{formatCurrency(returnedAmount)}</p></CardContent></Card>
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Expected Profit</CardTitle></CardHeader><CardContent><p className="text-lg font-semibold">{formatCurrency(expectedProfit)}</p></CardContent></Card>
                </div>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Distribution</CardTitle>
                    <CardDescription>
                      Color legend for taken amount, returned amount, and expected profit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={customerDistributionData}
                            dataKey="amount"
                            nameKey="label"
                            innerRadius={65}
                            outerRadius={110}
                            paddingAngle={3}
                          >
                            {customerDistributionData.map((entry, index) => (
                              <Cell key={`${entry.label}-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {customerDistributionData.map((item) => (
                        <div key={item.label} className="rounded-md border p-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                              aria-hidden
                            />
                            <p className="font-medium">{item.label}</p>
                          </div>
                          <p className="mt-1 text-muted-foreground">{formatCurrency(item.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <CalendarRange className="h-4 w-4 text-primary" />
                      Assignment and Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p>Added by: {createdByUser?.full_name ?? "Unknown"}</p>
                    <p>Collection follow-up: {followUpUser?.full_name ?? "Not assigned"}</p>
                    <p>
                      First Loan Date:{" "}
                      {selectedCustomerLoans[0]
                        ? formatDate(selectedCustomerLoans.map((l) => l.disbursement_date).sort()[0])
                        : "N/A"}
                    </p>
                    <p>
                      Latest Due Date:{" "}
                      {selectedCustomerLoans.length
                        ? formatDate(
                            [...selectedCustomerLoans]
                              .sort((a, b) => a.maturity_date.localeCompare(b.maturity_date))
                              .at(-1)?.maturity_date ?? ""
                          )
                        : "N/A"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
