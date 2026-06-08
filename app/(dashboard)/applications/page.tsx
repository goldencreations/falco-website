"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Loader2,
  Plus,
  Search,
  Filter,
  Eye,
  Pencil,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Scale,
  Trash2,
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
 adaptApiApplicationListRow,
 extractApplicationDetail,
 extractApplicationsList,
 type ApplicationViewRow,
} from "@/lib/application-adapters";
import {
 enrichApplicationRow,
 enrichApplicationRows,
 fetchApplicationEnrichmentContext,
 type EnrichmentContext,
} from "@/lib/application-enrichment";
import { RequiredDocumentsFields } from "@/components/applications/required-documents-fields";
import {
 DeleteApplicationDialog,
 type DeleteApplicationTarget,
} from "@/components/applications/delete-application-dialog";
import {
 documentTypeFromRow,
 fetchApplicationDocumentStatus,
 formatRequiredDocumentLabel,
} from "@/lib/application-documents";
import {
  activateApplicationApi,
  buildApplicationChecklist,
  canDeleteApplication,
  getApplicationWorkflowActions,
  approveApplicationApi,
  runAdminActivateApplicationWorkflow,
} from "@/lib/application-workflow";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { exportApplicationToPdf } from "@/lib/application-pdf";
import { useSessionUser } from "@/lib/use-session-user";
import type { LoanApplicationStatus } from "@/lib/types";

const statusConfig: Record<
 LoanApplicationStatus,
 { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
 draft: { label: "Draft", variant: "outline", icon: FileText },
 submitted: { label: "Submitted", variant: "secondary", icon: Clock },
 under_review: { label: "Under Review", variant: "secondary", icon: Clock },
 approved: { label: "Approved", variant: "default", icon: CheckCircle },
 pending_disbursement: { label: "Pending disbursement", variant: "default", icon: CheckCircle },
 rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
 disbursed: { label: "Disbursed", variant: "default", icon: CheckCircle },
 cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

export default function ApplicationsPage() {
 const { user } = useSessionUser();
 const effectiveRole = user?.role ?? "super_admin";
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
 const creditAnalysisPath =
 effectiveRole === "loan_officer" ? "/officer/credit-analysis" : "/credit-analysis";
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [applications, setApplications] = useState<ApplicationViewRow[]>([]);
 const [listLoading, setListLoading] = useState(true);
 const [actionError, setActionError] = useState<string | null>(null);
 const [actionBusyId, setActionBusyId] = useState<string | null>(null);
 const [activateDocsDialog, setActivateDocsDialog] = useState<{
 appId: string;
 amount: number;
 required: string[];
 missing: string[];
 uploadedTypes: string[];
 } | null>(null);
 const [activateDocFiles, setActivateDocFiles] = useState<Record<string, File | null>>({});
 const [enrichmentCtx, setEnrichmentCtx] = useState<EnrichmentContext | null>(null);
 const [detailRow, setDetailRow] = useState<ApplicationViewRow | null>(null);
 const [detailLoading, setDetailLoading] = useState(false);
 const [activateUploadedTypes, setActivateUploadedTypes] = useState<string[]>([]);
 const [successMessage, setSuccessMessage] = useState<string | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<DeleteApplicationTarget | null>(null);

 const reloadApplications = useCallback(async () => {
 setListLoading(true);
 setActionError(null);
 try {
 const ctx = await fetchApplicationEnrichmentContext(scopeBranchId, { role: effectiveRole });
 setEnrichmentCtx(ctx);

 const params = new URLSearchParams();
 params.set("page_size", isOfficerView ? "80" : "100");
 if (scopeBranchId) params.set("branch_id", scopeBranchId);
 const res = await fetch(`/api/applications?${params.toString()}`, { credentials: "include" });
 const json = await res.json();
 if (!res.ok) {
 throw new Error(typeof json.message === "string" ? json.message : "Failed to load applications");
 }
 const rows = enrichApplicationRows(extractApplicationsList(json), ctx);
 setApplications(rows);
 } catch (e) {
 setActionError(e instanceof Error ? e.message : "Failed to load applications");
 } finally {
 setListLoading(false);
 }
 }, [scopeBranchId, effectiveRole, isOfficerView]);

 useEffect(() => {
 void reloadApplications();
 }, [reloadApplications]);

 useEffect(() => {
 if (typeof window === "undefined") return;
 const id = new URLSearchParams(window.location.search).get("id")?.trim();
 if (id) setSelectedApplicationId(id);
 }, []);

 useEffect(() => {
 if (typeof window === "undefined") return;
 const params = new URLSearchParams(window.location.search);
 if (params.get("activated") === "1") {
 setSuccessMessage(
 "Application activated. Loan is pending disbursement — open Loan Disbursement to release funds."
 );
 }
 }, []);
 const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
 /** Branch managers and loan officers see all applications in their assigned branch. */
 const visibleApplications = scopeBranchId
 ? applications.filter((app) => app.branch_id === scopeBranchId)
 : applications;

 const filteredApplications = visibleApplications.filter((app) => {
 const matchesSearch =
 searchQuery === "" ||
 app.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
 app.customerSearchText.includes(searchQuery.toLowerCase());

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

 const listSelectedApplication = selectedApplicationId
 ? visibleApplications.find((app) => app.id === selectedApplicationId) ?? null
 : null;
 const selectedApplication = detailRow ?? listSelectedApplication;
 const selectedAssignedOfficer = selectedApplication?.officerName ?? "Unassigned";

 useEffect(() => {
 if (!selectedApplicationId) {
 setDetailRow(null);
 return;
 }
 let cancelled = false;
 setDetailLoading(true);
 void (async () => {
 const ctx =
 enrichmentCtx ?? (await fetchApplicationEnrichmentContext(scopeBranchId, { role: effectiveRole }));
 if (cancelled) return;
 if (!enrichmentCtx) setEnrichmentCtx(ctx);
 const res = await fetch(`/api/applications/${encodeURIComponent(selectedApplicationId)}`, {
 credentials: "include",
 });
 const json = await res.json();
 if (cancelled) return;
 const detail = extractApplicationDetail(json);
 if (!detail) return;
 const row = enrichApplicationRow(
 adaptApiApplicationListRow({ application: detail }),
 ctx
 );
 setDetailRow(row);
 })()
 .finally(() => {
 if (!cancelled) setDetailLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [selectedApplicationId, enrichmentCtx, scopeBranchId, effectiveRole]);
 const openDeleteDialog = (app: ApplicationViewRow) => {
 setDeleteTarget({
 id: app.id,
 application_number: app.application_number,
 customerDisplayName: app.customerDisplayName,
 });
 };

 const handleApplicationDeleted = () => {
 setDeleteTarget(null);
 setSelectedApplicationId(null);
 setDetailRow(null);
 setSuccessMessage("Application deleted from the database.");
 void reloadApplications();
 };

 const handleAdminActivate = async (app: ApplicationViewRow) => {
 setActionError(null);
 const status = await fetchApplicationDocumentStatus(
 app.id,
 app.product_id,
 app.required_documents
 );
 if (!status) {
 setActionError("Could not load required documents for this application.");
 return;
 }
 if (status.missing.length > 0) {
 openActivateDocsDialog(app, status.missing);
 setActivateUploadedTypes(status.uploadedTypes);
 return;
 }
 const ok = await runWorkflowAction(app.id, async () => {
 const r = await activateApplicationApi(
 app.id,
 app.approved_amount ?? app.requested_amount
 );
 if (!r.ok && /missing required documents/i.test(r.error)) {
 const status = await fetchApplicationDocumentStatus(
 app.id,
 app.product_id,
 app.required_documents
 );
 if (status?.missing.length) openActivateDocsDialog(app, status.missing);
 }
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 });
 if (ok) {
 setSuccessMessage(
 "Application activated. Loan is pending disbursement — open Loan Disbursement to release funds."
 );
 }
 };

 const openActivateDocsDialog = (app: ApplicationViewRow, missing: string[]) => {
 const files: Record<string, File | null> = {};
 for (const t of missing) files[t] = null;
 setActivateDocFiles(files);
 setActivateUploadedTypes([]);
 setActivateDocsDialog({
 appId: app.id,
 amount: app.approved_amount ?? app.requested_amount,
 required: app.required_documents ?? missing,
 missing,
 uploadedTypes: [],
 });
 };

 const confirmActivateWithDocuments = async () => {
 if (!activateDocsDialog) return;
 const { appId, amount, missing } = activateDocsDialog;
 const stillMissing = missing.filter((t) => !activateDocFiles[t] && !activateUploadedTypes.includes(t));
 if (stillMissing.length > 0) {
 setActionError(
 `Select files for: ${stillMissing.map(formatRequiredDocumentLabel).join(", ")}`
 );
 return;
 }
 const ok = await runWorkflowAction(appId, async () => {
 const r = await runAdminActivateApplicationWorkflow(
 appId,
 amount,
 user?.full_name ?? "User",
 activateDocFiles
 );
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 });
 if (ok) {
 setActivateDocsDialog(null);
 setActivateDocFiles({});
 setSuccessMessage("Application activated. Loan is now active and ready on the Loans page.");
 }
 };

 const runWorkflowAction = async (
 appId: string,
 action: () => Promise<{ ok: boolean; error?: string }>
 ) => {
 setActionBusyId(appId);
 setActionError(null);
 const result = await action();
 if (!result.ok) {
 setActionError(result.error ?? "Action failed");
 setActionBusyId(null);
 return false;
 }
 await reloadApplications();
 setActionBusyId(null);
 setSelectedApplicationId(null);
 setDetailRow(null);
 return true;
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
 if (!selectedApplication) return;
 exportApplicationToPdf({
 application: selectedApplication,
 customerName: selectedApplication.customerDisplayName,
 customerNumber: selectedApplication.customerNumber,
 productName: selectedApplication.productName,
 branchName: selectedApplication.branchName,
 createdByName: selectedApplication.creatorName || selectedApplication.created_by,
 });
 };

 return (
 <>
 <DashboardHeader
 title="Loan Applications"
 description={
 isOfficerView
 ? "Branch loan applications from the Falco API — limited to your assigned branch."
 : isManagerView
 ? "Branch loan applications from the Falco API — limited to your assigned branch."
 : "Manage and review loan applications"
 }
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto p-2 pb-6 sm:p-3">
 <div className="w-full space-y-4">
 <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-background to-background p-3 sm:p-4">
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

 {successMessage ? (
 <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
 <span>{successMessage}</span>
 <div className="flex gap-2">
 <Button size="sm" variant="outline" asChild>
 <Link href="/disbursements">Loan Disbursement</Link>
 </Button>
 <Button size="sm" variant="ghost" onClick={() => setSuccessMessage(null)}>
 Dismiss
 </Button>
 </div>
 </div>
 ) : null}

 {actionError ? (
 <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
 {actionError}
 </div>
 ) : null}

 {/* Filters and Actions */}
 <Card className="border-emerald-100">
 <CardContent className="p-3 sm:p-4">
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
 <SelectItem value="pending_disbursement">Pending disbursement</SelectItem>
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
 <p className="mt-2 font-medium">{app.customerDisplayName}</p>
 <p className="text-xs text-muted-foreground">{app.productName}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Officer: <span className="font-medium text-foreground">{app.officerName || "Unassigned"}</span>
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
 const status = statusConfig[app.status];
 const StatusIcon = status.icon;

 return (
 <TableRow key={app.id}>
 <TableCell className="font-mono text-sm">
 {app.application_number}
 </TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{app.customerDisplayName}</p>
 <p className="text-sm text-muted-foreground">{app.customerNumber}</p>
 </div>
 </TableCell>
 <TableCell className="hidden lg:table-cell">
 <div className="max-w-[180px] truncate text-sm">{app.officerName || "Unassigned"}</div>
 </TableCell>
 <TableCell className="hidden md:table-cell">{app.productName}</TableCell>
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
 exportApplicationToPdf({
 application: app,
 customerName: app.customerDisplayName,
 customerNumber: app.customerNumber,
 productName: app.productName,
 branchName: app.branchName,
 createdByName: app.creatorName || app.created_by,
 });
 }}
 >
 <Download className="mr-2 h-4 w-4" />
 Export PDF
 </DropdownMenuItem>
 <DropdownMenuItem asChild>
 <Link href={`${creditAnalysisPath}?applicationId=${app.id}`}>
 <Scale className="mr-2 h-4 w-4" />
 Analyze
 </Link>
 </DropdownMenuItem>
 {app.status === "draft" && (
 <DropdownMenuItem asChild>
 <Link href={`${applicationsNewPath}?edit=${app.id}`}>
 <Pencil className="mr-2 h-4 w-4" />
 Continue draft
 </Link>
 </DropdownMenuItem>
 )}
 {getApplicationWorkflowActions(app, effectiveRole, user?.full_name ?? "User").length > 0 ? (
 <DropdownMenuItem disabled className="text-xs font-semibold text-muted-foreground">
 Change status (API)
 </DropdownMenuItem>
 ) : null}
  {getApplicationWorkflowActions(app, effectiveRole, user?.full_name ?? "User").map((wf) => (
    <DropdownMenuItem
      key={wf.id}
      className={wf.variant === "destructive" ? "text-destructive" : "text-accent"}
      disabled={actionBusyId === app.id}
      onClick={() =>
        void (wf.id === "admin_activate"
          ? handleAdminActivate(app)
          : runWorkflowAction(app.id, wf.run))
      }
    >
      {actionBusyId === app.id ? (
        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
      ) : null}
      {wf.label}
    </DropdownMenuItem>
  ))}
 {canDeleteApplication(effectiveRole, app, user?.id) ? (
 <>
 <DropdownMenuItem disabled className="text-xs font-semibold text-muted-foreground">
 Danger zone
 </DropdownMenuItem>
 <DropdownMenuItem
 className="text-destructive focus:text-destructive"
 disabled={actionBusyId === app.id}
 onClick={() => openDeleteDialog(app)}
 >
 <Trash2 className="mr-2 h-4 w-4" />
 Delete application…
 </DropdownMenuItem>
 </>
 ) : null}
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
{selectedApplication ? (
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
{selectedApplication.customerDisplayName} · {selectedApplication.productName}
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
<dd className="text-right font-medium">
{selectedApplication.purpose?.trim() &&
selectedApplication.purpose.trim().toLowerCase() !== "general purpose" ? (
 selectedApplication.purpose
) : (
 <Badge variant="outline" className="font-normal">
 Required — add purpose
 </Badge>
)}
</dd>
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
<dd className="font-medium">{selectedApplication.customerDisplayName}</dd>
<dd className="text-xs text-muted-foreground">{selectedApplication.customerNumber}</dd>
</div>
<div>
<dt className="text-muted-foreground">Branch</dt>
<dd>{selectedApplication.branchName}</dd>
</div>
<div>
<dt className="text-muted-foreground">Loan product</dt>
<dd className="font-medium">
{selectedApplication.productName || "—"}
{selectedApplication.product_id ? (
 <span className="ml-1 text-xs font-normal text-muted-foreground">
 (#{selectedApplication.product_id})
 </span>
) : null}
</dd>
</div>
<div>
<dt className="text-muted-foreground">Created by</dt>
<dd>{selectedApplication.creatorName || selectedApplication.created_by}</dd>
</div>
<div>
<dt className="text-muted-foreground">Assigned loan officer</dt>
<dd>{selectedAssignedOfficer}</dd>
</div>
<div>
<dt className="text-muted-foreground">Created</dt>
<dd>{formatDateTime(selectedApplication.created_at)}</dd>
</div>
</dl>
</div>
</div>

<Separator className="my-5" />
<div className="space-y-2">
<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
Uploaded documents
</h4>
{detailLoading ? (
<p className="text-sm text-muted-foreground">Loading documents…</p>
) : selectedApplication.documents?.length ? (
<ul className="space-y-2 text-sm">
{selectedApplication.documents.map((doc) => (
<li
key={doc.id || `${doc.type}-${doc.name}`}
className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
>
<span className="font-medium">{formatRequiredDocumentLabel(documentTypeFromRow(doc))}</span>
<span className="text-muted-foreground">{doc.name}</span>
{doc.verified ? (
<Badge variant="outline" className="text-emerald-700">
Verified
</Badge>
) : (
<Badge variant="outline">Pending</Badge>
)}
</li>
))}
</ul>
) : (
<p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
)}
</div>

{selectedApplication.status === "draft" ? (
<>
<Separator className="my-5" />
<div className="space-y-2">
<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
Application checklist
</h4>
<div className="flex flex-wrap gap-2">
{buildApplicationChecklist(
 selectedApplication,
 effectiveRole,
 selectedApplication.required_documents
).map((item) => (
<Badge
key={item.key}
variant={item.complete ? "default" : "outline"}
className={item.complete ? "bg-emerald-600 hover:bg-emerald-700" : "border-amber-300 text-amber-900"}
>
{item.complete ? "✓ " : "○ "}
{item.label}
{!item.complete && item.hint ? ` — ${item.hint}` : ""}
</Badge>
))}
</div>
</div>
</>
) : null}

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

<div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
<Button variant="outline" onClick={() => setSelectedApplicationId(null)}>
Close
</Button>
{selectedApplication.status === "draft" ? (
<Button asChild variant="secondary">
<Link href={`${applicationsNewPath}?edit=${selectedApplication.id}`}>
<Pencil className="mr-2 h-4 w-4" />
Continue draft
</Link>
</Button>
) : null}
{selectedApplication.status === "pending_disbursement" ? (
<Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
<Link
 href={
 selectedApplication.loan_id
 ? `/disbursements?loanId=${encodeURIComponent(selectedApplication.loan_id)}`
 : "/disbursements"
 }
>
Create disbursement
</Link>
</Button>
) : null}
{getApplicationWorkflowActions(
  selectedApplication,
  effectiveRole,
  user?.full_name ?? "User"
).map((wf) => (
<Button
  key={wf.id}
  variant={wf.variant === "destructive" ? "destructive" : "default"}
  className={wf.variant === "destructive" ? undefined : "bg-emerald-600 hover:bg-emerald-700"}
  disabled={actionBusyId === selectedApplication.id}
  onClick={() =>
    void (wf.id === "admin_activate"
      ? handleAdminActivate(selectedApplication)
      : runWorkflowAction(selectedApplication.id, wf.run))
  }
>
{actionBusyId === selectedApplication.id ? (
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
) : null}
{wf.label}
</Button>
))}
<Button variant="outline" onClick={exportSelectedApplicationPdf}>
<Download className="mr-2 h-4 w-4" />
Export PDF
</Button>
{canDeleteApplication(effectiveRole, selectedApplication, user?.id) ? (
<Button
 variant="destructive"
 disabled={actionBusyId === selectedApplication.id}
 onClick={() => openDeleteDialog(selectedApplication)}
>
<Trash2 className="mr-2 h-4 w-4" />
Delete application
</Button>
) : null}
</div>
</>
) : null}
</DialogContent>
</Dialog>

<DeleteApplicationDialog
 open={deleteTarget != null}
 onOpenChange={(open) => {
 if (!open) setDeleteTarget(null);
 }}
 application={deleteTarget}
 onDeleted={handleApplicationDeleted}
/>

<Dialog
 open={activateDocsDialog != null}
 onOpenChange={(open) => {
 if (!open) {
 setActivateDocsDialog(null);
 setActivateDocFiles({});
 }
 }}
>
<DialogContent className="max-w-lg">
<DialogTitle>Required documents</DialogTitle>
<DialogDescription>
Upload the missing files below, then activation will continue automatically.
</DialogDescription>
{activateDocsDialog ? (
<RequiredDocumentsFields
 requiredTypes={activateDocsDialog.missing}
 filesByType={activateDocFiles}
 uploadedTypes={[...activateDocsDialog.uploadedTypes, ...activateUploadedTypes]}
 applicationId={activateDocsDialog.appId}
 uploadOnSelect
 onUploadComplete={(type) =>
 setActivateUploadedTypes((prev) =>
 prev.includes(type) ? prev : [...prev, type]
 )
 }
 onChange={(type, file) =>
 setActivateDocFiles((prev) => ({ ...prev, [type]: file }))
 }
 />
) : null}
<DialogFooter className="gap-2 sm:gap-0">
<Button
 variant="outline"
 onClick={() => {
 setActivateDocsDialog(null);
 setActivateDocFiles({});
 }}
>
Cancel
</Button>
<Button
  className="bg-emerald-600 hover:bg-emerald-700"
  disabled={!activateDocsDialog || actionBusyId === activateDocsDialog.appId}
  onClick={() => void confirmActivateWithDocuments()}
>
  {activateDocsDialog && actionBusyId === activateDocsDialog.appId ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  ) : null}
  Activate & create loan
</Button>
</DialogFooter>
</DialogContent>
</Dialog>
</>
);
}
