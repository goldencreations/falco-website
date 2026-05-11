"use client";

import { useState } from "react";
import Link from "next/link";
import {
 Download,
 Plus,
 Search,
 Filter,
 Eye,
 CheckCircle,
 XCircle,
 Clock,
 FileText,
 Scale,
 X,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
 Bar,
 BarChart,
 CartesianGrid,
 Cell,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
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
 DialogTitle,
} from "@/components/ui/dialog";
import {
 loanApplications,
 currentUser,
 getCustomerById,
 getProductById,
 getBranchById,
 getUserById,
 formatCurrency,
 formatDateTime,
} from "@/lib/mock-data";
import type { LoanApplicationStatus } from "@/lib/types";
import type { PaymentMethod } from "@/lib/types";
import { exportApplicationToPdf } from "@/lib/application-pdf";
import { useSessionUser } from "@/lib/use-session-user";

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
 const { user } = useSessionUser();
 const effectiveRole = user?.role ?? currentUser.role;
 const isManagerView = effectiveRole === "branch_manager";
 const isOfficerView = effectiveRole === "loan_officer";
 const isTopAdminView = effectiveRole === "super_admin";
 const isCompactOpsView = isManagerView || isOfficerView;
 const scopeBranchId = isManagerView || isOfficerView ? user?.branch_id : null;
 const applicationsNewPath =
 effectiveRole === "branch_manager"
 ? "/manager/applications/new"
 : effectiveRole === "loan_officer"
 ? "/officer/applications/new"
 : "/applications/new";
 const canDisburse = isTopAdminView;
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [applications, setApplications] = useState(loanApplications);
 const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
 const [disburseApplicationId, setDisburseApplicationId] = useState<string | null>(null);
 const [disbursementMethod, setDisbursementMethod] = useState<PaymentMethod>("bank_transfer");
 const visibleApplications = scopeBranchId
 ? applications.filter((app) => {
 if (app.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 return app.created_by === user.id;
 })
 : applications;

 const filteredApplications = visibleApplications.filter((app) => {
 const customer = getCustomerById(app.customer_id);
 const matchesSearch =
 searchQuery === "" ||
 app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
 customer?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 customer?.last_name.toLowerCase().includes(searchQuery.toLowerCase());

 const matchesStatus = statusFilter === "all" || app.status === statusFilter;

 return matchesSearch && matchesStatus;
 });
 const statusCounts = visibleApplications.reduce(
 (acc, app) => {
 acc[app.status] = (acc[app.status] || 0) + 1;
 return acc;
 },
 {} as Record<string, number>
 );

 const selectedApplication = selectedApplicationId
 ? visibleApplications.find((app) => app.id === selectedApplicationId) ?? null
 : null;
 const selectedCustomer = selectedApplication ? getCustomerById(selectedApplication.customer_id) : null;
 const selectedProduct = selectedApplication ? getProductById(selectedApplication.product_id) : null;
 const selectedBranch = selectedApplication ? getBranchById(selectedApplication.branch_id) : null;
 const selectedCreator = selectedApplication ? getUserById(selectedApplication.created_by) : null;
 const selectedAssignedOfficer = selectedCustomer
 ? getUserById(selectedCustomer.assigned_loan_officer_id ?? selectedCustomer.created_by)
 : null;
 const disburseApplication = disburseApplicationId
 ? visibleApplications.find((app) => app.id === disburseApplicationId) ?? null
 : null;

 const addWorkflowNote = (existing: string | undefined, nextNote: string) =>
 [existing, nextNote].filter(Boolean).join("\n");

 const updateApplicationStatus = (id: string, status: LoanApplicationStatus, extras?: Record<string, unknown>) => {
 setApplications((prev) =>
 prev.map((app) =>
 app.id === id
 ? {
 ...app,
 status,
 updated_at: new Date().toISOString(),
 ...(extras ?? {}),
 }
 : app
 )
 );
 };

 const statusChartData = [
 { key: "draft", label: "Draft", count: statusCounts.draft || 0, fill: "#94a3b8" },
 { key: "submitted", label: "Submitted", count: statusCounts.submitted || 0, fill: "#f59e0b" },
 { key: "under_review", label: "Review", count: statusCounts.under_review || 0, fill: "#6366f1" },
 { key: "approved", label: "Approved", count: statusCounts.approved || 0, fill: "#10b981" },
 { key: "rejected", label: "Rejected", count: statusCounts.rejected || 0, fill: "#ef4444" },
 { key: "disbursed", label: "Disbursed", count: statusCounts.disbursed || 0, fill: "#059669" },
 ];

 const pendingApplicationsCount = (statusCounts.submitted || 0) + (statusCounts.under_review || 0);
 const completedApplicationsCount = Math.max(visibleApplications.length - pendingApplicationsCount, 0);
 const completionPercent = visibleApplications.length
 ? Math.round((completedApplicationsCount / visibleApplications.length) * 100)
 : 0;
 const inProgressCount = pendingApplicationsCount;
 const pendingCount = Math.max((statusCounts.draft || 0) + (statusCounts.rejected || 0), 0);
 const progressTotal = Math.max(completedApplicationsCount + inProgressCount + pendingCount, 1);
 const arcLength = Math.PI * 90;
 const completedArc = (completedApplicationsCount / progressTotal) * arcLength;
 const inProgressArc = (inProgressCount / progressTotal) * arcLength;
 const pendingArc = (pendingCount / progressTotal) * arcLength;

 const exportSelectedApplicationPdf = () => {
 if (!selectedApplication || !selectedCustomer || !selectedProduct) return;
 exportApplicationToPdf({
 application: selectedApplication,
 customerName: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`,
 customerNumber: selectedCustomer.customer_number,
 productName: selectedProduct.name,
 branchName: selectedBranch?.name ?? selectedApplication.branch_id,
 createdByName: selectedCreator?.full_name ?? selectedApplication.created_by,
 });
 };

 return (
 <>
 <DashboardHeader
 title="Loan Applications"
 description="Manage and review loan applications"
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto p-4 pb-10 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-background to-background p-4 sm:p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
 Application Control Center
 </p>
 <h2 className="mt-1 text-lg font-semibold tracking-tight">Professional loan application monitoring</h2>
 <p className="mt-1 text-sm text-muted-foreground">
 Review, open details in-place, and export a formal PDF record directly from this page.
 </p>
 </div>
 {(effectiveRole === "super_admin" || effectiveRole === "branch_manager" || effectiveRole === "loan_officer") ? (
 <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
 <Link href={applicationsNewPath}>
 <Plus className="mr-2 h-4 w-4" />
 New Application
 </Link>
 </Button>
 ) : null}
 </div>
 </div>

 {/* Summary Cards */}
 {!isCompactOpsView ? (
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card className="border-emerald-100 bg-emerald-50/40">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Total Applications
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{visibleApplications.length}</div>
 </CardContent>
 </Card>
 <Card className="border-amber-200 bg-amber-50/60">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Pending Review
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">{pendingApplicationsCount}</div>
 </CardContent>
 </Card>
 <Card className="border-emerald-100 bg-emerald-50/30">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Approved
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-accent">{statusCounts.approved || 0}</div>
 </CardContent>
 </Card>
 <Card className="border-slate-200 bg-slate-50/60">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">
 Draft
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-muted-foreground">{statusCounts.draft || 0}</div>
 </CardContent>
 </Card>
 </div>
 ) : (
 <Card className="border-emerald-100">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Application Progress</CardTitle>
 <CardDescription>Completed vs pending applications in your branch</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-end sm:justify-between">
 <div className="relative h-28 w-52 sm:h-32 sm:w-56">
 <svg viewBox="0 0 220 130" className="h-full w-full">
 <defs>
 <pattern id="pending-stripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(35)">
 <line x1="0" y1="0" x2="0" y2="8" stroke="#9ca3af" strokeWidth="4" />
 </pattern>
 </defs>
 <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="#e5e7eb" strokeWidth="20" strokeLinecap="round" />
 <path
 d="M20 110 A90 90 0 0 1 200 110"
 fill="none"
 stroke="#16a34a"
 strokeWidth="20"
 strokeLinecap="round"
 strokeDasharray={`${completedArc} ${arcLength}`}
 strokeDashoffset={0}
 />
 <path
 d="M20 110 A90 90 0 0 1 200 110"
 fill="none"
 stroke="#166534"
 strokeWidth="20"
 strokeLinecap="round"
 strokeDasharray={`${inProgressArc} ${arcLength}`}
 strokeDashoffset={-completedArc}
 />
 <path
 d="M20 110 A90 90 0 0 1 200 110"
 fill="none"
 stroke="url(#pending-stripe)"
 strokeWidth="20"
 strokeLinecap="butt"
 strokeDasharray={`${pendingArc} ${arcLength}`}
 strokeDashoffset={-(completedArc + inProgressArc)}
 />
 </svg>
 <div className="absolute inset-x-0 bottom-2 text-center">
 <p className="text-3xl font-bold leading-none">{completionPercent}%</p>
 <p className="text-xs text-muted-foreground">project ended</p>
 </div>
 </div>
 <div className="grid w-full max-w-[260px] gap-1.5 text-sm">
 <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5">
 <span className="text-muted-foreground">Total applications</span>
 <span className="font-semibold">{visibleApplications.length}</span>
 </div>
 <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5">
 <span className="text-muted-foreground">Completed</span>
 <span className="font-semibold text-emerald-700">{completedApplicationsCount}</span>
 </div>
 <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5">
 <span className="text-muted-foreground">In progress</span>
 <span className="font-semibold text-emerald-900">{inProgressCount}</span>
 </div>
 <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-1.5">
 <span className="text-muted-foreground">Pending</span>
 <span className="font-semibold text-slate-600">{pendingCount}</span>
 </div>
 </div>
 </div>
 <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
 <span className="inline-flex items-center gap-1.5">
 <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
 Completed
 </span>
 <span className="inline-flex items-center gap-1.5">
 <span className="h-2.5 w-2.5 rounded-full bg-emerald-900" />
 In Progress
 </span>
 <span className="inline-flex items-center gap-1.5">
 <span
 className="h-2.5 w-2.5 rounded-full border border-slate-400"
 style={{ backgroundImage: "repeating-linear-gradient(45deg, #9ca3af, #9ca3af 2px, transparent 2px, transparent 4px)" }}
 />
 Pending
 </span>
 </div>
 </CardContent>
 </Card>
 )}

 {!isCompactOpsView ? (
 <div className="grid gap-4">
 <Card className="border-emerald-100 lg:col-span-2">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Application Pipeline Graph</CardTitle>
 <CardDescription>Status mix for currently visible applications</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[220px] w-full">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={statusChartData} barCategoryGap={18}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
 <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
 <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
 <Tooltip
 formatter={(value: number) => [value, "Applications"]}
 contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))" }}
 />
 <Bar dataKey="count" radius={[8, 8, 0, 0]}>
 {statusChartData.map((entry) => (
 <Cell key={entry.key} fill={entry.fill} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>
 </div>
 ) : null}

 {/* Filters and Actions */}
 <Card className="border-emerald-100">
 <CardContent className="p-4">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 flex-col gap-3 sm:flex-row">
 <div className="relative min-w-0 flex-1 sm:max-w-sm">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search applications..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full sm:w-44">
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
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Applications Table */}
 <Card className="overflow-hidden border-emerald-100">
 <CardContent className="space-y-4 p-0">
 <div className="grid gap-3 p-4 sm:hidden">
 {filteredApplications.length === 0 ? (
 <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
 No applications found
 </p>
 ) : (
 filteredApplications.map((app) => {
 const customer = getCustomerById(app.customer_id);
 const product = getProductById(app.product_id);
 const status = statusConfig[app.status];
 const StatusIcon = status.icon;
 return (
 <div key={app.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
 <div className="flex items-start justify-between gap-2">
 <p className="font-mono text-xs font-medium">{app.application_number}</p>
 <Badge variant={status.variant} className="gap-1">
 <StatusIcon className="h-3 w-3" />
 {status.label}
 </Badge>
 </div>
 <p className="mt-2 font-medium">
 {customer?.first_name} {customer?.last_name}
 </p>
 <p className="text-xs text-muted-foreground">{product?.name}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Officer:{" "}
 <span className="font-medium text-foreground">
 {getUserById(customer?.assigned_loan_officer_id ?? customer?.created_by ?? "")?.full_name ??
 "Unassigned"}
 </span>
 </p>
 <p className="mt-1 text-sm font-semibold">{formatCurrency(app.requested_amount)}</p>
 <div className="mt-3 flex gap-2">
 <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => setSelectedApplicationId(app.id)}>
 <Eye className="mr-1 h-3.5 w-3.5" />
 View Details
 </Button>
 <Button size="sm" className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setSelectedApplicationId(app.id)}>
 <Download className="mr-1 h-3.5 w-3.5" />
 PDF
 </Button>
 </div>
 </div>
 );
 })
 )}
 </div>

 <div className="hidden sm:block">
 <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [touch-action:pan-x]">
 <Table className="min-w-[780px] lg:min-w-0">
 <TableHeader>
 <TableRow>
 <TableHead>Application #</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead className="hidden lg:table-cell">Loan Officer</TableHead>
 <TableHead className="hidden md:table-cell">Product</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead className="hidden xl:table-cell">Purpose</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="hidden lg:table-cell">Date</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredApplications.length === 0 ? (
 <TableRow>
 <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
 No applications found
 </TableCell>
 </TableRow>
 ) : (
 filteredApplications.map((app) => {
 const customer = getCustomerById(app.customer_id);
 const product = getProductById(app.product_id);
 const status = statusConfig[app.status];
 const StatusIcon = status.icon;

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
 <TableCell className="hidden lg:table-cell">
 <div className="max-w-[180px] truncate text-sm">
 {getUserById(
 customer?.assigned_loan_officer_id ?? customer?.created_by ?? ""
 )?.full_name ?? "Unassigned"}
 </div>
 </TableCell>
 <TableCell className="hidden md:table-cell">{product?.name}</TableCell>
 <TableCell className="text-right font-medium">
 {formatCurrency(app.requested_amount)}
 </TableCell>
 <TableCell className="hidden max-w-[200px] truncate xl:table-cell">
 {app.purpose}
 </TableCell>
 <TableCell>
 <Badge variant={status.variant} className="gap-1">
 <StatusIcon className="h-3 w-3" />
 {status.label}
 </Badge>
 </TableCell>
 <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
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
 <DropdownMenuItem onClick={() => setSelectedApplicationId(app.id)}>
 <Eye className="mr-2 h-4 w-4" />
 View Details
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => {
 const branch = getBranchById(app.branch_id);
 const createdBy = getUserById(app.created_by);
 if (!customer || !product) return;
 exportApplicationToPdf({
 application: app,
 customerName: `${customer.first_name} ${customer.last_name}`,
 customerNumber: customer.customer_number,
 productName: product.name,
 branchName: branch?.name ?? app.branch_id,
 createdByName: createdBy?.full_name ?? app.created_by,
 });
 }}
 >
 <Download className="mr-2 h-4 w-4" />
 Export PDF
 </DropdownMenuItem>
 <DropdownMenuItem asChild>
 <Link href={`/credit-analysis?applicationId=${app.id}`}>
 <Scale className="mr-2 h-4 w-4" />
 Analyze
 </Link>
 </DropdownMenuItem>
                  {isOfficerView && app.status === "draft" && (
                    <DropdownMenuItem
                      className="text-accent"
                      onClick={() =>
                        updateApplicationStatus(app.id, "submitted", {
                          submitted_at: new Date().toISOString(),
                          review_notes: addWorkflowNote(
                            app.review_notes,
                            `Loan Officer (${user?.full_name ?? "Officer"}) submitted application for manager review.`
                          ),
                        })
                      }
                    >
                      Submit to Manager
                    </DropdownMenuItem>
                  )}
                  {(isManagerView || isTopAdminView) && app.status === "submitted" && (
                    <DropdownMenuItem
                      className="text-accent"
                      onClick={() =>
                        updateApplicationStatus(app.id, "under_review", {
                          reviewed_by: user?.id,
                          reviewed_at: new Date().toISOString(),
                          review_notes: addWorkflowNote(
                            app.review_notes,
                            `${isManagerView ? "Manager" : "Top Admin"} (${user?.full_name ?? "Approver"}) opened review.`
                          ),
                        })
                      }
                    >
                      Start Review
                    </DropdownMenuItem>
                  )}
 {app.status === "under_review" && (
 <>
                      {(isManagerView || isTopAdminView) && (
                        <DropdownMenuItem
                          className="text-accent"
                          onClick={() =>
                            updateApplicationStatus(app.id, "approved", {
                              approved_by: user?.id,
                              approved_at: new Date().toISOString(),
                              review_notes: addWorkflowNote(
                                app.review_notes,
                                `${isManagerView ? "Manager" : "Top Admin"} (${user?.full_name ?? "Approver"}) approved application.`
                              ),
                            })
                          }
                        >
                          Approve
                        </DropdownMenuItem>
                      )}
                      {(isManagerView || isTopAdminView) && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            updateApplicationStatus(app.id, "rejected", {
                              reviewed_by: user?.id,
                              reviewed_at: new Date().toISOString(),
                              rejection_reason: `${isManagerView ? "Manager" : "Top Admin"} rejected application during review.`,
                            })
                          }
                        >
                          Reject
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {(isTopAdminView && app.status === "submitted") && (
                    <DropdownMenuItem
                      className="text-accent"
                      onClick={() =>
                        updateApplicationStatus(app.id, "approved", {
                          approved_by: user?.id,
                          approved_at: new Date().toISOString(),
                          review_notes: addWorkflowNote(
                            app.review_notes,
                            `Top Admin (${user?.full_name ?? "Top Admin"}) approved directly from submitted queue.`
                          ),
                        })
                      }
                    >
                      Top Admin Approve
                    </DropdownMenuItem>
                  )}
                  {(isTopAdminView && (app.status === "submitted" || app.status === "under_review")) && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() =>
                        updateApplicationStatus(app.id, "rejected", {
                          reviewed_by: user?.id,
                          reviewed_at: new Date().toISOString(),
                          rejection_reason: "Rejected by Top Admin.",
                        })
                      }
                    >
                      Top Admin Reject
                    </DropdownMenuItem>
                  )}
                  {app.status === "approved" && (
                    <>
                      {canDisburse ? (
                        <DropdownMenuItem
                          className="text-accent"
                          onClick={() => {
                            setDisburseApplicationId(app.id);
                            setDisbursementMethod("bank_transfer");
                          }}
                        >
                          Disburse (Top Admin)
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem disabled>
                          Disburse (Top Admin only)
                        </DropdownMenuItem>
                      )}
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
</div>
</div>
</CardContent>
</Card>
</div>
</main>

<Dialog open={Boolean(selectedApplication)} onOpenChange={(open) => !open && setSelectedApplicationId(null)}>
<DialogContent
showCloseButton={false}
className="flex max-h-[min(92vh,820px)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden border border-border/80 p-0 sm:max-w-3xl"
>
{selectedApplication && selectedCustomer && selectedProduct ? (
<>
<div className="relative border-b bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 px-6 pb-6 pt-6 text-primary-foreground">
<button
type="button"
onClick={() => setSelectedApplicationId(null)}
className="absolute right-4 top-4 rounded-md p-1.5 text-emerald-100/90 transition-colors hover:bg-white/10 hover:text-white"
aria-label="Close"
>
<X className="h-4 w-4" />
</button>
<div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-start sm:justify-between">
<div className="space-y-1">
<p className="font-mono text-[11px] uppercase tracking-widest text-emerald-100/90">
Loan application record
</p>
<DialogTitle className="text-left text-xl font-semibold tracking-tight text-white">
{selectedApplication.application_number}
</DialogTitle>
<DialogDescription className="text-left text-emerald-100/90">
{selectedCustomer.first_name} {selectedCustomer.last_name} · {selectedProduct.name}
</DialogDescription>
</div>
<Badge
className="w-fit border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20"
variant="outline"
>
{statusConfig[selectedApplication.status].label}
</Badge>
</div>
<p className="pointer-events-none absolute bottom-2 right-6 hidden rotate-[-10deg] select-none border-2 border-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/25 sm:block">
Falco Financial
</p>
</div>

<div className="max-h-[min(54vh,500px)] overflow-y-auto px-6 py-5">
<div className="grid gap-6 md:grid-cols-2">
<div className="space-y-4">
<div>
<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
Amount & terms
</h4>
<p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
{formatCurrency(selectedApplication.requested_amount)}
</p>
<p className="mt-1 text-sm text-muted-foreground">
Requested over {selectedApplication.term_days} days
</p>
</div>
<Separator />
<dl className="grid gap-2 text-sm">
<div className="flex justify-between gap-4">
<dt className="text-muted-foreground">Purpose</dt>
<dd className="text-right font-medium">{selectedApplication.purpose}</dd>
</div>
<div className="flex justify-between gap-4">
<dt className="text-muted-foreground">Collateral</dt>
<dd className="text-right">{selectedApplication.collateral_type ?? "—"}</dd>
</div>
<div className="flex justify-between gap-4">
<dt className="text-muted-foreground">Collateral value</dt>
<dd className="text-right tabular-nums">
{selectedApplication.collateral_value
? formatCurrency(selectedApplication.collateral_value)
: "—"}
</dd>
</div>
</dl>
</div>
<div className="space-y-4">
<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
Applicant & workflow
</h4>
<dl className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
<div>
<dt className="text-muted-foreground">Customer</dt>
<dd className="font-medium">
{selectedCustomer.first_name} {selectedCustomer.last_name}
</dd>
<dd className="text-xs text-muted-foreground">{selectedCustomer.customer_number}</dd>
</div>
<div>
<dt className="text-muted-foreground">Branch</dt>
<dd>{selectedBranch?.name ?? selectedApplication.branch_id}</dd>
</div>
<div>
<dt className="text-muted-foreground">Created by</dt>
<dd>{selectedCreator?.full_name ?? selectedApplication.created_by}</dd>
</div>
<div>
<dt className="text-muted-foreground">Assigned loan officer</dt>
<dd>{selectedAssignedOfficer?.full_name ?? "Unassigned"}</dd>
</div>
<div>
<dt className="text-muted-foreground">Created</dt>
<dd>{formatDateTime(selectedApplication.created_at)}</dd>
</div>
</dl>
</div>
</div>

{(selectedApplication.review_notes || selectedApplication.rejection_reason) && (
<>
<Separator className="my-5" />
<div className="space-y-3">
{selectedApplication.review_notes && (
<div className="rounded-lg border bg-background p-3">
<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
Review notes
</p>
<p className="mt-1 whitespace-pre-line text-sm">{selectedApplication.review_notes}</p>
</div>
)}
{selectedApplication.rejection_reason && (
<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
<p className="text-xs font-semibold uppercase tracking-wide text-destructive">
Rejection reason
</p>
<p className="mt-1 text-sm text-destructive">{selectedApplication.rejection_reason}</p>
</div>
)}
</div>
</>
)}
</div>

<div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
<Button variant="outline" onClick={() => setSelectedApplicationId(null)}>
Close
</Button>
<Button className="bg-emerald-600 hover:bg-emerald-700" onClick={exportSelectedApplicationPdf}>
<Download className="mr-2 h-4 w-4" />
Export Professional PDF
</Button>
</div>
</>
) : null}
</DialogContent>
</Dialog>

<Dialog open={Boolean(disburseApplication)} onOpenChange={(open) => !open && setDisburseApplicationId(null)}>
<DialogContent>
  <DialogTitle>Confirm Loan Disbursement</DialogTitle>
  <DialogDescription>
    Top Admin action: choose a disbursement method and confirm to mark this approved application as disbursed.
  </DialogDescription>
  <div className="space-y-3 py-2">
    <Select
      value={disbursementMethod}
      onValueChange={(value) => setDisbursementMethod(value as PaymentMethod)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Disbursement method" />
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
    <Button variant="outline" onClick={() => setDisburseApplicationId(null)}>
      Cancel
    </Button>
    <Button
      onClick={() => {
        if (!disburseApplication) return;
        updateApplicationStatus(disburseApplication.id, "disbursed", {
          approved_by: disburseApplication.approved_by ?? user?.id,
          approved_at: disburseApplication.approved_at ?? new Date().toISOString(),
          review_notes: addWorkflowNote(
            disburseApplication.review_notes,
            `Disbursed by Top Admin (${user?.full_name ?? "Top Admin"}) via ${disbursementMethod.replace("_", " ")}.`
          ),
        });
        setDisburseApplicationId(null);
      }}
      disabled={!disburseApplication}
    >
      Confirm Disbursement
    </Button>
  </DialogFooter>
</DialogContent>
</Dialog>
</>
);
}
