"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
 Search,
 Filter,
 Eye,
 Scale,
 CreditCard,
 AlertTriangle,
 CheckCircle,
 XCircle,
 Clock,
 Loader2,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ListPaginationBar, paginateItems } from "@/components/list-pagination-bar";
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
import { Progress } from "@/components/ui/progress";
import { parseLoansFromApiResponse, type LoanListRow } from "@/lib/loan-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import {
 loanAcceptsPayment,
 loanCustomerLabel,
 loanProductLabel,
 PAYMENT_BLOCKED_HELP_TEXT,
} from "@/lib/loan-display";
import {
 CONTRACT_PROGRESS_TOOLTIP,
 resolveLoanRepaymentTruth,
} from "@/lib/loan-repayment-truth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { LoanStatus, RiskClassification } from "@/lib/types";
import { loanMatchesOfficerPortfolio } from "@/lib/loan-officer-portfolio";
import { resolvePortalPath } from "@/lib/portal-paths";
import { isBranchScopedStaffRole, rolePortalBase } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";
import {
  listRowRevealClassName,
  listRowRevealStyle,
  useListRevealKey,
} from "@/lib/list-row-reveal";

const statusConfig: Record<
 LoanStatus,
 { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }
> = {
 draft: { label: "Draft", variant: "outline", icon: Clock },
 pending_disbursement: { label: "Pending", variant: "secondary", icon: Clock },
 active: { label: "Active", variant: "default", icon: CheckCircle },
 in_arrears: { label: "In Arrears", variant: "destructive", icon: AlertTriangle },
 defaulted: { label: "Defaulted", variant: "destructive", icon: XCircle },
 written_off: { label: "Written Off", variant: "outline", icon: XCircle },
 paid_off: { label: "Paid Off", variant: "default", icon: CheckCircle },
 restructured: { label: "Restructured", variant: "secondary", icon: Clock },
};

const riskConfig: Record<RiskClassification, { label: string; color: string }> = {
 current: { label: "Current", color: "bg-accent" },
 especially_mentioned: { label: "Watch", color: "bg-warning" },
 substandard: { label: "Substandard", color: "bg-destructive" },
 doubtful: { label: "Doubtful", color: "bg-destructive" },
 loss: { label: "Loss", color: "bg-foreground" },
};

const PAGE_SIZE = 8;

export default function LoansPage() {
 const { user } = useSessionUser();
 const isOfficerView = user?.role === "loan_officer";
 const isManagerView = user?.role === "branch_manager";
 const scopeBranchId = isBranchScopedStaffRole(user?.role) ? user?.branch_id ?? null : null;
 const portalBase = rolePortalBase(user?.role);
 const paymentsBasePath = portalBase ? `${portalBase}/payments` : "/payments";
 const creditAnalysisPath =
 user?.role === "loan_officer" ? "/officer/credit-analysis" : "/credit-analysis";
 const loanDetailPath = (id: string) => resolvePortalPath(user?.role, `/loans/${id}`);

 const [loans, setLoans] = useState<LoanListRow[]>([]);
 const [assignedCustomerIds, setAssignedCustomerIds] = useState<Set<string> | null>(null);
 const [listLoading, setListLoading] = useState(true);
 const [listError, setListError] = useState<string | null>(null);

 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [page, setPage] = useState(1);
 const [listRevealKey, bumpListReveal] = useListRevealKey();

 useEffect(() => {
 let cancelled = false;
 setListLoading(true);
 setListError(null);
 if (!isOfficerView) setAssignedCustomerIds(null);

 const params = new URLSearchParams();
 params.set("page_size", "100");
 if (scopeBranchId) params.set("branch_id", scopeBranchId);

 const loansPromise = fetch(`/api/loans?${params.toString()}`).then(async (r) => {
 if (!r.ok) {
 const j = await r.json().catch(() => ({}));
 throw new Error(typeof j.message === "string" ? j.message : "Failed to load loans");
 }
 return r.json();
 });

 const customersPromise = isOfficerView
 ? fetch("/api/customers/my-customers?page_size=500").then(async (r) => {
 if (!r.ok) return [] as ReturnType<typeof extractCustomersList>;
 const json = await r.json();
 return Array.isArray(json.customers) ? extractCustomersList(json) : extractCustomersList(json);
 })
 : Promise.resolve(null);

 void Promise.all([loansPromise, customersPromise])
 .then(([loansJson, customers]) => {
 if (cancelled) return;
 setLoans(parseLoansFromApiResponse(loansJson));
 bumpListReveal();
 if (customers) {
 setAssignedCustomerIds(new Set(customers.map((c) => String(c.id).trim()).filter(Boolean)));
 }
 })
 .catch((e: Error) => {
 if (!cancelled) setListError(e.message);
 })
 .finally(() => {
 if (!cancelled) setListLoading(false);
 });

 return () => {
 cancelled = true;
 };
 }, [scopeBranchId, isOfficerView, bumpListReveal]);

 const visibleLoans = useMemo(() => {
 if (!scopeBranchId) return loans;
 return loans.filter((loan) => {
 if (loan.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 if (!assignedCustomerIds) return true;
 return loanMatchesOfficerPortfolio(loan, assignedCustomerIds, user.id);
 });
 }, [loans, scopeBranchId, isOfficerView, user, assignedCustomerIds]);

 const filteredLoans = visibleLoans.filter((loan) => {
 const q = searchQuery.toLowerCase();
 const matchesSearch =
 searchQuery === "" ||
 (loan.loan_number ?? "").toLowerCase().includes(q) ||
 (loanCustomerLabel(loan) ?? "").toLowerCase().includes(q) ||
 (loan.productName ?? "").toLowerCase().includes(q) ||
 (loan.customerPhone && loan.customerPhone.toLowerCase().includes(q));

 const matchesStatus = statusFilter === "all" || loan.status === statusFilter;

 return matchesSearch && matchesStatus;
 });

 useEffect(() => {
  setPage(1);
 }, [searchQuery, statusFilter, scopeBranchId]);

 const pagedLoans = useMemo(
  () => paginateItems(filteredLoans, page, PAGE_SIZE),
  [filteredLoans, page]
 );

 useEffect(() => {
  const totalPages = Math.max(1, Math.ceil(filteredLoans.length / PAGE_SIZE));
  if (page > totalPages) setPage(totalPages);
 }, [page, filteredLoans.length]);

 const totalOutstanding = visibleLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
 const totalPenaltyOutstanding = visibleLoans.reduce(
 (sum, l) => sum + (l.penalty_outstanding ?? l.penalty ?? 0),
 0
 );
 const totalPrincipal = visibleLoans.reduce((sum, l) => sum + l.principal_amount, 0);
 const activeLoans = visibleLoans.filter((l) => l.status === "active").length;
 const inArrearsLoans = visibleLoans.filter((l) => l.status === "in_arrears").length;
 const recoveryRate =
 totalPrincipal > 0 ? ((1 - totalOutstanding / totalPrincipal) * 100).toFixed(1) : "0.0";

 return (
 <>
 <DashboardHeader
 title="Active Loans"
 description={
 isOfficerView
 ? "Active loans for customers assigned to you in your branch. Open a row for schedule, payments, and collections."
 : isManagerView
 ? "Active loans in your branch. Open a row for schedule, payments, and collections."
 : "Open a row for schedules, payments, and collections."
 }
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 {listError && (
 <p className="text-sm text-destructive" role="alert">
 {listError}
 </p>
 )}
 {/* Summary Cards */}
 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm sm:hidden ">
 <CardHeader className="pb-2">
 <CardTitle className="text-sm">Loan Disbursement Snapshot</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid grid-cols-2 gap-2">
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 ">
 <p className="text-[11px] text-muted-foreground">Loans</p>
 <p className="text-lg font-semibold">{listLoading ? "…" : visibleLoans.length}</p>
 </div>
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 ">
 <p className="text-[11px] text-muted-foreground">Recovery</p>
 <p className="text-lg font-semibold">{recoveryRate}%</p>
 </div>
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 ">
 <p className="text-[11px] text-muted-foreground">Disbursed</p>
 <p className="text-sm font-semibold">{formatCurrency(totalPrincipal)}</p>
 </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 ">
                <p className="text-[11px] text-muted-foreground">Outstanding</p>
                <p className="text-sm font-semibold">{formatCurrency(totalOutstanding)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 ">
                <p className="text-[11px] text-muted-foreground">Total Penalty</p>
                <p className="text-sm font-semibold text-destructive">
                  {formatCurrency(totalPenaltyOutstanding)}
                </p>
              </div>
            </div>
 <p className="text-xs text-muted-foreground">
 {activeLoans} active loans and {inArrearsLoans} in arrears.
 </p>
 </CardContent>
 </Card>

          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Loans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{listLoading ? "…" : visibleLoans.length}</div>
                <p className="text-sm text-muted-foreground">
                  {activeLoans} active, {inArrearsLoans} in arrears
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Penalty</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(totalPenaltyOutstanding)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Disbursed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPrincipal)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Recovery Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{recoveryRate}%</div>
              </CardContent>
            </Card>
          </div>

 {/* Filters */}
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search loans..."
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
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="in_arrears">In Arrears</SelectItem>
 <SelectItem value="defaulted">Defaulted</SelectItem>
 <SelectItem value="paid_off">Paid Off</SelectItem>
 <SelectItem value="pending_disbursement">Pending Disbursement</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Loans list */}
 <Card className="overflow-hidden border-emerald-100">
 <CardContent className="p-0">
 <div className="grid gap-3 p-4 sm:hidden">
 {listLoading ? (
 <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
 Loading loans…
 </div>
 ) : filteredLoans.length === 0 ? (
 <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
 No loans found
 </p>
 ) : (
 pagedLoans.map((loan, index) => {
 const status = statusConfig[loan.status];
 const riskRow = riskConfig[loan.risk_classification] ?? riskConfig.current;
 const StatusIcon = status.icon;
 const truth = resolveLoanRepaymentTruth(loan);
 const paidPercent = truth.contractualProgress;
 const contractualPaidDisplay = truth.contractualPaid;
 const penaltyOutstanding = truth.penaltyOutstanding;

 return (
 <div
  key={`${listRevealKey}-${page}-${loan.id}`}
  className={listRowRevealClassName(
   "rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
  )}
  style={listRowRevealStyle(index)}
 >
 <div className="flex items-start justify-between gap-2">
 <p className="font-mono text-xs font-medium">{loan.loan_number}</p>
 <Badge variant={status.variant} className="gap-1 shrink-0">
 <StatusIcon className="h-3 w-3" />
 {truth.displayStatus}
 </Badge>
 </div>
 <p className="mt-2 font-medium">{loanCustomerLabel(loan)}</p>
 <p className="text-xs text-muted-foreground">{loan.customerPhone?.trim() || "—"}</p>
 <p className="mt-1 text-xs text-muted-foreground">{loanProductLabel(loan)}</p>
 <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
 <div className="rounded-md border border-emerald-100 bg-background/80 px-2 py-1.5">
 <p className="text-muted-foreground">Principal</p>
 <p className="font-semibold">{formatCurrency(loan.principal_amount)}</p>
 </div>
 <div className="rounded-md border border-emerald-100 bg-background/80 px-2 py-1.5">
 <p className="text-muted-foreground">Outstanding</p>
 <p className="font-semibold">{formatCurrency(truth.totalOutstanding)}</p>
 </div>
 <div className="rounded-md border border-emerald-100 bg-background/80 px-2 py-1.5">
 <p className="text-muted-foreground">Contract total</p>
 <p className="font-semibold">{formatCurrency(truth.contractualTotal)}</p>
 </div>
 <div className="rounded-md border border-emerald-100 bg-background/80 px-2 py-1.5">
 <p className="text-muted-foreground">Applied to contract</p>
 <p className="font-semibold">{formatCurrency(contractualPaidDisplay)}</p>
 </div>
 </div>
 {truth.penaltiesCharged > 0 ? (
 <p className="mt-2 text-xs text-muted-foreground">
 Penalties charged {formatCurrency(truth.penaltiesCharged)}
 {penaltyOutstanding > 0
  ? ` · outstanding ${formatCurrency(penaltyOutstanding)}`
  : " · all paid"}
 {loan.daily_penalty_rate ? ` · ${formatCurrency(loan.daily_penalty_rate)}/day` : ""}
 </p>
 ) : null}
 <div className="mt-3" title={CONTRACT_PROGRESS_TOOLTIP}>
 <Progress
  value={Math.min(100, paidPercent)}
  className={`h-2 ${loan.status === "in_arrears" ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : ""}`}
 />
 <p className="mt-1 text-xs text-muted-foreground">
 {paidPercent.toFixed(2)}% of contract
 {contractualPaidDisplay > 0 ? ` · ${formatCurrency(contractualPaidDisplay)} applied` : ""}
 </p>
 </div>
 <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <div className={`h-2 w-2 rounded-full ${riskRow.color}`} />
 <span>{riskRow.label}</span>
 {truth.daysInArrears > 0 ? (
 <span className="text-destructive">({truth.daysInArrears}d in arrears)</span>
 ) : null}
 </div>
 <span>·</span>
 <span>Maturity {formatDate(loan.maturity_date)}</span>
 </div>
 {loan.oldest_overdue_date ? (
 <p className="mt-1 text-xs font-medium text-destructive">
 Oldest overdue {formatDate(loan.oldest_overdue_date)}
 {loan.overdue_amount != null ? ` · ${formatCurrency(loan.overdue_amount)}` : ""}
 </p>
 ) : loan.next_due_date ? (
 <p className="mt-1 text-xs text-muted-foreground">
 Next installment {formatDate(loan.next_due_date)}
 {loan.next_due_amount != null ? ` · ${formatCurrency(loan.next_due_amount)}` : ""}
 </p>
 ) : null}
 <div className="mt-3 flex flex-wrap gap-2">
 <Button size="sm" variant="outline" className="h-8 flex-1 min-w-[7rem]" asChild>
 <Link href={loanDetailPath(loan.id)}>
 <Eye className="mr-1 h-3.5 w-3.5" />
 View Details
 </Link>
 </Button>
 {loanAcceptsPayment(loan) ? (
 <Button size="sm" variant="outline" className="h-8 flex-1 min-w-[7rem]" asChild>
 <Link href={`${paymentsBasePath}?loan=${loan.id}&openPayment=1`}>
 <CreditCard className="mr-1 h-3.5 w-3.5" />
 Record Payment
 </Link>
 </Button>
 ) : (
 <Button
 size="sm"
 variant="outline"
 className="h-8 flex-1 min-w-[7rem]"
 disabled
 title={PAYMENT_BLOCKED_HELP_TEXT}
 >
 <CreditCard className="mr-1 h-3.5 w-3.5" />
 Record Payment
 </Button>
 )}
 {loan.application_id ? (
 <Button size="sm" variant="outline" className="h-8 w-full sm:w-auto" asChild title="Credit analysis for originating application">
 <Link href={`${creditAnalysisPath}?applicationId=${loan.application_id}`}>
 <Scale className="mr-1 h-3.5 w-3.5" />
 Credit Analysis
 </Link>
 </Button>
 ) : null}
 </div>
 </div>
 );
 })
 )}
 </div>

 <div className="hidden sm:block">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Loan #</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead>Product</TableHead>
 <TableHead className="text-right">Principal</TableHead>
 <TableHead className="text-right">Outstanding</TableHead>
 <TableHead className="text-right">Penalty</TableHead>
 <TableHead>Progress</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Risk</TableHead>
 <TableHead>Maturity</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {listLoading ? (
 <TableRow>
 <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
 <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-label="Loading loans" />
 </TableCell>
 </TableRow>
 ) : filteredLoans.length === 0 ? (
 <TableRow>
 <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
 No loans found
 </TableCell>
 </TableRow>
 ) : (
 pagedLoans.map((loan, index) => {
 const status = statusConfig[loan.status];
 const riskRow = riskConfig[loan.risk_classification] ?? riskConfig.current;
 const StatusIcon = status.icon;
 const truth = resolveLoanRepaymentTruth(loan);
 const paidPercent = truth.contractualProgress;
 const contractualPaidDisplay = truth.contractualPaid;

 return (
 <TableRow
  key={`${listRevealKey}-${page}-${loan.id}`}
  className={listRowRevealClassName()}
  style={listRowRevealStyle(index)}
 >
 <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{loanCustomerLabel(loan)}</p>
 <p className="text-sm text-muted-foreground">{loan.customerPhone?.trim() || "—"}</p>
 </div>
 </TableCell>
 <TableCell>{loanProductLabel(loan)}</TableCell>
 <TableCell className="text-right">{formatCurrency(loan.principal_amount)}</TableCell>
 <TableCell className="text-right font-medium">{formatCurrency(truth.totalOutstanding)}</TableCell>
 <TableCell className="text-right">
 {truth.penaltiesCharged > 0 || truth.penaltyOutstanding > 0 ? (
 <div>
 <p className="font-medium text-destructive">
 {formatCurrency(truth.penaltyOutstanding)}
 </p>
 <p className="text-xs text-muted-foreground">
 charged {formatCurrency(truth.penaltiesCharged)}
 </p>
 {loan.daily_penalty_rate ? (
 <p className="text-xs text-muted-foreground">
 {formatCurrency(loan.daily_penalty_rate)}/day
 </p>
 ) : null}
 </div>
 ) : (
 <span className="text-muted-foreground">—</span>
 )}
 </TableCell>
 <TableCell>
 <div className="w-28" title={CONTRACT_PROGRESS_TOOLTIP}>
 <Progress
  value={Math.min(100, paidPercent)}
  className={`h-2 ${loan.status === "in_arrears" ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : ""}`}
 />
 <p className="mt-1 text-xs text-muted-foreground leading-tight">
 {paidPercent.toFixed(2)}% of contract
 </p>
 {contractualPaidDisplay > 0 ? (
 <p className="text-xs text-muted-foreground leading-tight">
 {formatCurrency(contractualPaidDisplay)}
 </p>
 ) : null}
 </div>
 </TableCell>
 <TableCell>
 <div className="flex flex-col gap-1">
 {truth.dataRequiresReview ? (
 <Badge variant="outline" className="border-amber-400 text-amber-800 gap-1">
 <StatusIcon className="h-3 w-3" />
 Data requires review
 </Badge>
 ) : (
 <Badge variant={status.variant} className="gap-1">
 <StatusIcon className="h-3 w-3" />
 {truth.displayStatus}
 </Badge>
 )}
 {truth.daysInArrears > 0 ? (
 <span className="text-xs text-destructive">{truth.daysInArrears}d in arrears</span>
 ) : null}
 {loan.oldest_overdue_date ? (
 <span className="text-xs text-destructive">
 Oldest overdue {formatDate(loan.oldest_overdue_date)}
 {loan.overdue_amount != null ? ` · ${formatCurrency(loan.overdue_amount)}` : ""}
 </span>
 ) : loan.next_due_date ? (
 <span className="text-xs text-muted-foreground">
 Next {formatDate(loan.next_due_date)}
 </span>
 ) : null}
 </div>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <div className={`h-2 w-2 rounded-full ${riskRow.color}`} />
 <span className="text-sm">{riskRow.label}</span>
 </div>
 </TableCell>
 <TableCell className="text-sm">{formatDate(loan.maturity_date)}</TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end gap-1">
 <Button variant="ghost" size="sm" asChild title="View loan details">
 <Link href={loanDetailPath(loan.id)}>
 <Eye className="h-4 w-4" />
 </Link>
 </Button>
 {loanAcceptsPayment(loan) ? (
 <Button variant="ghost" size="sm" asChild title="Record payment">
 <Link href={`${paymentsBasePath}?loan=${loan.id}&openPayment=1`}>
 <CreditCard className="h-4 w-4" />
 </Link>
 </Button>
 ) : (
 <Button variant="ghost" size="sm" disabled title={PAYMENT_BLOCKED_HELP_TEXT}>
 <CreditCard className="h-4 w-4" />
 </Button>
 )}
 {loan.application_id ? (
 <Button variant="ghost" size="sm" asChild title="Credit analysis for originating application">
 <Link href={`${creditAnalysisPath}?applicationId=${loan.application_id}`}>
 <Scale className="h-4 w-4" />
 </Link>
 </Button>
 ) : null}
 </div>
 </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>
 <ListPaginationBar
  page={page}
  pageSize={PAGE_SIZE}
  total={filteredLoans.length}
  loading={listLoading}
  onPageChange={setPage}
 />
 </CardContent>
 </Card>
 </div>
 </main>

 </>
 );
}
