"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Scale,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loanApplications,
  currentUser,
  getCustomerById,
  getProductById,
  formatCurrency,
  formatDateTime,
} from "@/lib/mock-data";
import type { LoanApplicationStatus } from "@/lib/types";

type ApprovalRole = "loan_officer" | "branch_manager" | "super_admin";
type WorkflowStage =
  | "loan_officer_review"
  | "manager_review"
  | "top_admin_review"
  | "completed";

const statusConfig: Record<
  LoanApplicationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
  draft: { label: "Draft", variant: "outline", icon: FileText },
  submitted: { label: "Submitted", variant: "secondary", icon: Clock },
  under_review: { label: "Under Review", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  disbursed: { label: "Disbursed", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

export default function ApplicationsPage() {
  const roleDefault: ApprovalRole =
    currentUser.role === "super_admin" ||
    currentUser.role === "branch_manager" ||
    currentUser.role === "loan_officer"
      ? currentUser.role
      : "loan_officer";
  const [actingRole, setActingRole] = useState<ApprovalRole>(roleDefault);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [applications, setApplications] = useState(loanApplications);
  const [disbursementDialogOpen, setDisbursementDialogOpen] = useState(false);
  const [disbursementMethod, setDisbursementMethod] = useState<string>("");
  const [selectedForDisbursement, setSelectedForDisbursement] = useState<string | null>(null);

  const getWorkflowStage = (status: LoanApplicationStatus): WorkflowStage => {
    if (status === "draft" || status === "submitted") return "loan_officer_review";
    if (status === "under_review") return "manager_review";
    if (status === "approved") return "top_admin_review";
    return "completed";
  };

  const workflowLabel: Record<WorkflowStage, string> = {
    loan_officer_review: "Loan Officer",
    manager_review: "Manager",
    top_admin_review: "Top Admin",
    completed: "Completed",
  };

  const processSummary = useMemo(
    () => ({
      loanOfficerQueue: applications.filter(
        (app) => getWorkflowStage(app.status) === "loan_officer_review"
      ).length,
      managerQueue: applications.filter((app) => getWorkflowStage(app.status) === "manager_review")
        .length,
      adminQueue: applications.filter((app) => getWorkflowStage(app.status) === "top_admin_review")
        .length,
      completed: applications.filter((app) => getWorkflowStage(app.status) === "completed").length,
    }),
    [applications]
  );

  const submitToManager = (appId: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              status: "under_review",
              submitted_at: app.submitted_at ?? new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : app
      )
    );
  };

  const managerDecision = (appId: string, decision: "approved" | "rejected") => {
    setApplications((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              status: decision,
              reviewed_by: "branch-manager-review",
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          : app
      )
    );
  };

  const openDisbursementDialog = (appId: string) => {
    setSelectedForDisbursement(appId);
    setDisbursementMethod("");
    setDisbursementDialogOpen(true);
  };

  const confirmDisbursement = () => {
    if (!selectedForDisbursement || !disbursementMethod) return;
    setApplications((prev) =>
      prev.map((app) =>
        app.id === selectedForDisbursement
          ? {
              ...app,
              status: "disbursed",
              approved_by: "top-admin",
              approved_at: app.approved_at ?? new Date().toISOString(),
              review_notes: `Disbursed via ${disbursementMethod}`,
              updated_at: new Date().toISOString(),
            }
          : app
      )
    );
    setDisbursementDialogOpen(false);
    setSelectedForDisbursement(null);
    setDisbursementMethod("");
  };

  const filteredApplications = applications.filter((app) => {
    const customer = getCustomerById(app.customer_id);
    const matchesSearch =
      searchQuery === "" ||
      app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.last_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = applications.reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <>
      <DashboardHeader
        title="Loan Applications"
        description="Manage and review loan applications"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{applications.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Review
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {(statusCounts.submitted || 0) + (statusCounts.under_review || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">
                  {statusCounts.approved || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Draft
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">
                  {statusCounts.draft || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow Process</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Loan Officer Queue</p>
                <p className="mt-1 text-2xl font-semibold">{processSummary.loanOfficerQueue}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Manager Queue</p>
                <p className="mt-1 text-2xl font-semibold">{processSummary.managerQueue}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Top Admin Queue</p>
                <p className="mt-1 text-2xl font-semibold">{processSummary.adminQueue}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="mt-1 text-2xl font-semibold">{processSummary.completed}</p>
              </div>
            </CardContent>
          </Card>

          {/* Filters and Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search applications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="disbursed">Disbursed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actingRole} onValueChange={(value) => setActingRole(value as ApprovalRole)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Acting as" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan_officer">Acting as Loan Officer</SelectItem>
                  <SelectItem value="branch_manager">Acting as Manager</SelectItem>
                  <SelectItem value="super_admin">Acting as Top Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button asChild>
              <Link href="/applications/new">
                <Plus className="mr-2 h-4 w-4" />
                New Application
              </Link>
            </Button>
          </div>

          {/* Applications Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Workflow Stage</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No applications found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApplications.map((app) => {
                      const customer = getCustomerById(app.customer_id);
                      const product = getProductById(app.product_id);
                      const status = statusConfig[app.status];
                      const StatusIcon = status.icon;
                      const stage = getWorkflowStage(app.status);

                      return (
                        <TableRow key={app.id}>
                          <TableCell className="font-mono text-sm">
                            {app.application_number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {customer?.first_name} {customer?.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {customer?.customer_number}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{product?.name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(app.requested_amount)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {app.purpose}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{workflowLabel[stage]}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(app.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/applications/${app.id}`}>
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/credit-analysis?applicationId=${app.id}`}>
                                    <Scale className="mr-2 h-4 w-4" />
                                    Analyze
                                  </Link>
                                </DropdownMenuItem>
                                {stage === "loan_officer_review" && (
                                  <DropdownMenuItem
                                    disabled={actingRole !== "loan_officer"}
                                    onClick={() => submitToManager(app.id)}
                                  >
                                    Submit to Manager
                                  </DropdownMenuItem>
                                )}
                                {stage === "manager_review" && (
                                  <>
                                    <DropdownMenuItem
                                      className="text-accent"
                                      disabled={actingRole !== "branch_manager"}
                                      onClick={() => managerDecision(app.id, "approved")}
                                    >
                                      Manager Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      disabled={actingRole !== "branch_manager"}
                                      onClick={() => managerDecision(app.id, "rejected")}
                                    >
                                      Manager Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {stage === "top_admin_review" && (
                                  <>
                                    <DropdownMenuItem
                                      className="text-accent"
                                      disabled={actingRole !== "super_admin"}
                                      onClick={() => openDisbursementDialog(app.id)}
                                    >
                                      Disburse (Top Admin)
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={disbursementDialogOpen} onOpenChange={setDisbursementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Loan Disbursement</DialogTitle>
            <DialogDescription>
              Top Admin must choose disbursement method and confirm before marking this loan as
              disbursed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Disbursement Method</p>
            <Select value={disbursementMethod} onValueChange={setDisbursementMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisbursementDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDisbursement} disabled={!disbursementMethod}>
              Confirm Disbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
