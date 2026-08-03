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
 Building2,
 User,
 CalendarRange,
 TrendingUp,
 Loader2,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
 extractCollectionActivitiesCount,
 extractCustomerFromLoanDetail,
 extractLoanDetail,
 parseLoansFromApiResponse,
 extractPaymentsList,
 extractScheduleList,
 type LoanListRow,
} from "@/lib/loan-adapters";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail, extractCustomersList } from "@/lib/customer-adapters";
import {
 effectiveLoanTotalPaid,
 effectivePaidPercent,
 loanAcceptsPayment,
 loanCustomerLabel,
 loanProductLabel,
 PAYMENT_BLOCKED_HELP_TEXT,
} from "@/lib/loan-display";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import type { PaymentViewRow } from "@/lib/payment-adapters";
import type { Customer, LoanStatus, RepaymentSchedule, RiskClassification } from "@/lib/types";
import { loanMatchesOfficerPortfolio } from "@/lib/loan-officer-portfolio";
import { isBranchScopedStaffRole, rolePortalBase } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";

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

export default function LoansPage() {
 const { user } = useSessionUser();
 const isOfficerView = user?.role === "loan_officer";
 const isManagerView = user?.role === "branch_manager";
 const scopeBranchId = isBranchScopedStaffRole(user?.role) ? user?.branch_id ?? null : null;
 const portalBase = rolePortalBase(user?.role);
 const paymentsBasePath = portalBase ? `${portalBase}/payments` : "/payments";
 const creditAnalysisPath =
 user?.role === "loan_officer" ? "/officer/credit-analysis" : "/credit-analysis";

 const [loans, setLoans] = useState<LoanListRow[]>([]);
 const [assignedCustomerIds, setAssignedCustomerIds] = useState<Set<string> | null>(null);
 const [listLoading, setListLoading] = useState(true);
 const [listError, setListError] = useState<string | null>(null);

 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [viewLoan, setViewLoan] = useState<LoanListRow | null>(null);

 const [detailLoan, setDetailLoan] = useState<LoanListRow | null>(null);
 const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
 const [detailLoading, setDetailLoading] = useState(false);
 const [viewSchedule, setViewSchedule] = useState<RepaymentSchedule[]>([]);
 const [viewPayments, setViewPayments] = useState<PaymentViewRow[]>([]);
 const [collectionActivityCount, setCollectionActivityCount] = useState(0);

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
 }, [scopeBranchId, isOfficerView]);

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

 const displayLoan = detailLoan ?? viewLoan;
 const viewCustomer = detailCustomer;

 useEffect(() => {
 if (!viewLoan) {
 setDetailLoan(null);
 setDetailCustomer(null);
 setViewSchedule([]);
 setViewPayments([]);
 setCollectionActivityCount(0);
 setDetailLoading(false);
 return;
 }

 let cancelled = false;
 setDetailLoading(true);
 const id = viewLoan.id;
 const cid = viewLoan.customer_id;

 const load = async () => {
 try {
 const [dRes, sRes, pRes, cRes] = await Promise.all([
 fetch(`/api/loans/${encodeURIComponent(id)}`),
 fetch(`/api/loans/${encodeURIComponent(id)}/schedule`),
 fetch(`/api/payments?loan_id=${encodeURIComponent(id)}&page_size=100`),
 fetch(`/api/collections/activities?loan_id=${encodeURIComponent(id)}&page_size=100`),
 ]);

 if (cancelled) return;

 if (dRes.ok) {
 const dJson = await dRes.json();
 const loanRow = extractLoanDetail(dJson);
 if (loanRow) setDetailLoan(loanRow);
 let cust = extractCustomerFromLoanDetail(dJson);
 const resolvedCid = cid || loanRow?.customer_id || "";
 if (!cust && resolvedCid) {
 const cr = await fetch(`/api/customers/${encodeURIComponent(resolvedCid)}`);
 if (cr.ok) {
 const cj = await cr.json();
 const row = extractCustomerDetail(cj);
 if (row) cust = adaptApiCustomerRowToCustomer(row);
 }
 }
 setDetailCustomer(cust);
 } else {
 setDetailLoan(viewLoan);
 const fallbackCid = viewLoan.customer_id?.trim();
 if (fallbackCid) {
 const cr = await fetch(`/api/customers/${encodeURIComponent(fallbackCid)}`);
 if (!cancelled && cr.ok) {
 const cj = await cr.json();
 const row = extractCustomerDetail(cj);
 setDetailCustomer(row ? adaptApiCustomerRowToCustomer(row) : null);
 } else {
 setDetailCustomer(null);
 }
 } else {
 setDetailCustomer(null);
 }
 }

 if (!cancelled && sRes.ok) {
 const sj = await sRes.json();
 setViewSchedule(extractScheduleList(sj));
 } else if (!cancelled) setViewSchedule([]);

 if (!cancelled && pRes.ok) {
 const pj = await pRes.json();
 const paymentRows = extractPaymentsPayload(pj).payments.filter(
 (p) => p.loan_id === id || p.loan_id === viewLoan.id
 );
 setViewPayments(paymentRows);
 const paidFromPayments = paymentRows
 // `status` is canonical for settlement — the backend already maps verified ledger
 // rows to "completed" (see payments-controller.md), so ledger_status/reconciliation
 // metadata aren't independently trustworthy signals for "has this money posted".
 .filter((p) => String(p.status ?? "").toLowerCase() === "completed")
 .reduce((sum, p) => sum + p.amount, 0);
 if (paidFromPayments > 0) {
 setDetailLoan((prev) => {
 const base = prev ?? viewLoan;
 const total_paid = Math.max(base.total_paid, paidFromPayments);
 return {
 ...base,
 payments_recorded_total: paidFromPayments,
 total_paid,
 payment_count: paymentRows.length,
 };
 });
 }
 } else if (!cancelled) setViewPayments([]);

 if (!cancelled && cRes.ok) {
 const cj = await cRes.json();
 setCollectionActivityCount(extractCollectionActivitiesCount(cj));
 } else if (!cancelled) setCollectionActivityCount(0);
 } finally {
 if (!cancelled) setDetailLoading(false);
 }
 };

 void load();
 return () => {
 cancelled = true;
 };
 }, [viewLoan]);

 const viewPaymentsCompleted = viewPayments.filter((p) => p.status === "completed");
 const paidInstallments = viewSchedule.filter((item) => item.is_paid).length;
 const overdueInstallments = viewSchedule.filter((item) => !item.is_paid && item.days_overdue > 0).length;
 const totalCollected = Math.max(
 displayLoan ? effectiveLoanTotalPaid(displayLoan) : 0,
 viewPaymentsCompleted.reduce((sum, p) => sum + p.amount, 0)
 );
 const interestCollected = viewPaymentsCompleted.reduce((sum, p) => sum + p.interest_allocated, 0);
 const feeCollected = viewPaymentsCompleted.reduce((sum, p) => sum + p.fees_allocated, 0);
 const penaltyCollected = viewPaymentsCompleted.reduce((sum, p) => sum + p.penalty_allocated, 0);
 const disbursementChartData = displayLoan
 ? [
 { name: "Disbursed", amount: displayLoan.principal_amount },
 { name: "Collected", amount: totalCollected },
 { name: "Interest", amount: displayLoan.interest_amount },
 { name: "Outstanding", amount: displayLoan.total_outstanding },
 ]
 : [];

 const riskKey = displayLoan?.risk_classification ?? "current";
 const risk = riskConfig[riskKey] ?? riskConfig.current;

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
 filteredLoans.map((loan) => {
 const status = statusConfig[loan.status];
 const riskRow = riskConfig[loan.risk_classification] ?? riskConfig.current;
 const StatusIcon = status.icon;
 const paidPercent = effectivePaidPercent(loan);
 const totalPaidDisplay = effectiveLoanTotalPaid(loan);
 const penaltyOutstanding = loan.penalty_outstanding ?? loan.penalty ?? 0;

 return (
 <div key={loan.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3">
 <div className="flex items-start justify-between gap-2">
 <p className="font-mono text-xs font-medium">{loan.loan_number}</p>
 <Badge variant={status.variant} className="gap-1 shrink-0">
 <StatusIcon className="h-3 w-3" />
 {status.label}
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
 <p className="font-semibold">{formatCurrency(loan.total_outstanding)}</p>
 </div>
 </div>
 {penaltyOutstanding > 0 ? (
 <p className="mt-2 text-xs font-medium text-destructive">
 Penalty {formatCurrency(penaltyOutstanding)}
 {loan.daily_penalty_rate ? ` · ${formatCurrency(loan.daily_penalty_rate)}/day` : ""}
 </p>
 ) : null}
 <div className="mt-3">
 <Progress value={Math.min(100, paidPercent)} className="h-2" />
 <p className="mt-1 text-xs text-muted-foreground">
 {paidPercent.toFixed(0)}% paid
 {totalPaidDisplay > 0 ? ` · ${formatCurrency(totalPaidDisplay)}` : ""}
 </p>
 </div>
 <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <div className={`h-2 w-2 rounded-full ${riskRow.color}`} />
 <span>{riskRow.label}</span>
 {loan.days_in_arrears > 0 ? (
 <span className="text-destructive">({loan.days_in_arrears}d)</span>
 ) : null}
 </div>
 <span>·</span>
 <span>Due {formatDate(loan.maturity_date)}</span>
 </div>
 <div className="mt-3 flex flex-wrap gap-2">
 <Button size="sm" variant="outline" className="h-8 flex-1 min-w-[7rem]" onClick={() => setViewLoan(loan)}>
 <Eye className="mr-1 h-3.5 w-3.5" />
 View Details
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
 filteredLoans.map((loan) => {
 const status = statusConfig[loan.status];
 const riskRow = riskConfig[loan.risk_classification] ?? riskConfig.current;
 const StatusIcon = status.icon;
 const paidPercent = effectivePaidPercent(loan);
 const totalPaidDisplay = effectiveLoanTotalPaid(loan);

 return (
 <TableRow key={loan.id}>
 <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{loanCustomerLabel(loan)}</p>
 <p className="text-sm text-muted-foreground">{loan.customerPhone?.trim() || "—"}</p>
 </div>
 </TableCell>
 <TableCell>{loanProductLabel(loan)}</TableCell>
 <TableCell className="text-right">{formatCurrency(loan.principal_amount)}</TableCell>
 <TableCell className="text-right font-medium">{formatCurrency(loan.total_outstanding)}</TableCell>
 <TableCell className="text-right">
 {(loan.penalty_outstanding ?? loan.penalty ?? 0) > 0 ? (
 <div>
 <p className="font-medium text-destructive">
 {formatCurrency(loan.penalty_outstanding ?? loan.penalty ?? 0)}
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
                        <div className="w-24">
                          <Progress value={Math.min(100, paidPercent)} className="h-2" />
                          <p className="mt-1 text-xs text-muted-foreground leading-tight">
                            {paidPercent.toFixed(0)}% paid
                          </p>
                          {totalPaidDisplay > 0 ? (
                            <p className="text-xs text-muted-foreground leading-tight">
                              {formatCurrency(totalPaidDisplay)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
 <TableCell>
 <Badge variant={status.variant} className="gap-1">
 <StatusIcon className="h-3 w-3" />
 {status.label}
 </Badge>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <div className={`h-2 w-2 rounded-full ${riskRow.color}`} />
 <span className="text-sm">{riskRow.label}</span>
 {loan.days_in_arrears > 0 && (
 <span className="text-xs text-destructive">({loan.days_in_arrears}d)</span>
 )}
 </div>
 </TableCell>
 <TableCell className="text-sm">{formatDate(loan.maturity_date)}</TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end gap-1">
 <Button variant="ghost" size="sm" onClick={() => setViewLoan(loan)}>
 <Eye className="h-4 w-4" />
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
 </CardContent>
 </Card>
 </div>
 </main>

 <Dialog open={Boolean(viewLoan)} onOpenChange={(open) => !open && setViewLoan(null)}>
 <DialogContent className="max-h-[90vh] overflow-hidden border-emerald-200/60 bg-gradient-to-b from-emerald-50/60 via-background to-background sm:max-w-4xl ">
 {viewLoan && displayLoan ? (
 <>
 <DialogHeader className="rounded-md border border-emerald-200/60 bg-emerald-50/50 p-3 ">
 <DialogTitle className="text-xl">Loan Disbursement Details - {displayLoan.loan_number}</DialogTitle>
 <DialogDescription>
 {detailLoading ? (
 <span className="flex items-center gap-2 text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Loading schedule, payments, and customer details…
 </span>
 ) : (
 "Customer, balances, repayment schedule, and payment history."
 )}
 </DialogDescription>
 </DialogHeader>
 <ScrollArea className="max-h-[72vh] pr-4">
 <div className="space-y-5 pb-3">
 <div className="grid gap-4 md:grid-cols-3">
 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background md:col-span-2 ">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Customer Profile</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2">
 <div>
 <p className="text-xs text-muted-foreground">Customer Name</p>
 <p className="font-medium">
 {viewCustomer
 ? `${viewCustomer.first_name} ${viewCustomer.middle_name ? `${viewCustomer.middle_name} ` : ""}${viewCustomer.last_name}`
 : loanCustomerLabel(displayLoan) !== "—"
 ? loanCustomerLabel(displayLoan)
 : "Unknown"}
 </p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Phone</p>
 <p className="font-medium">{viewCustomer?.phone_primary ?? displayLoan.customerPhone ?? "N/A"}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">National ID</p>
 <p className="font-medium">{viewCustomer?.national_id ?? "N/A"}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Address</p>
 <p className="font-medium">{viewCustomer?.physical_address ?? "N/A"}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background ">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Loan &amp; Team</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center gap-2 text-sm">
 <CreditCard className="h-4 w-4 text-muted-foreground" />
 <span className="font-medium">{loanProductLabel(displayLoan)}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <Building2 className="h-4 w-4 text-muted-foreground" />
 <span>{displayLoan.branchName}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <User className="h-4 w-4 text-muted-foreground" />
 <span>{displayLoan.loanOfficerDisplayName}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <CalendarRange className="h-4 w-4 text-muted-foreground" />
 <span>Disbursed: {formatDate(displayLoan.disbursement_date)}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <CalendarRange className="h-4 w-4 text-muted-foreground" />
 <span>Due: {formatDate(displayLoan.maturity_date)}</span>
 </div>
 {displayLoan.repayment_details?.bill_pay_number ? (
 <div className="flex items-center gap-2 text-sm">
 <CreditCard className="h-4 w-4 text-muted-foreground" />
 <span>
 BillPay: <span className="font-mono font-medium">{displayLoan.repayment_details.bill_pay_number}</span>
 {displayLoan.repayment_details.can_accept_payment === false ? (
 <span className="ml-1 text-xs text-destructive">(not accepting payments)</span>
 ) : null}
 </span>
 </div>
 ) : null}
 </CardContent>
 </Card>
 </div>

 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background ">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Financial Distribution</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-4 lg:grid-cols-2">
 <div className="h-64 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart data={disbursementChartData}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="name" tick={{ fontSize: 12 }} />
 <YAxis tickFormatter={(v) => `${Number(v) / 1000000}M`} />
 <Tooltip formatter={(value: number) => formatCurrency(value)} />
 <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
 </BarChart>
 </ResponsiveContainer>
 </div>
 <div className="space-y-3">
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 ">
 <p className="text-xs text-muted-foreground">Disbursed Principal</p>
 <p className="text-lg font-semibold">{formatCurrency(displayLoan.principal_amount)}</p>
 </div>
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 ">
 <p className="text-xs text-muted-foreground">Collections to Date</p>
 <p className="text-lg font-semibold">{formatCurrency(totalCollected)}</p>
 </div>
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 ">
 <p className="text-xs text-muted-foreground">Interest Amount</p>
 <p className="text-lg font-semibold">{formatCurrency(displayLoan.interest_amount)}</p>
 </div>
 <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 ">
 <p className="text-xs text-muted-foreground">Outstanding Balance</p>
 <p className="text-lg font-semibold">{formatCurrency(displayLoan.total_outstanding)}</p>
 </div>
 <div className="rounded-lg border border-red-200/70 bg-red-50 p-3 ">
 <p className="text-xs text-muted-foreground">Outstanding penalty</p>
 <p className="text-lg font-semibold text-destructive">
 {formatCurrency(displayLoan.penalty_outstanding ?? displayLoan.penalty ?? 0)}
 </p>
 </div>
 <div className="rounded-lg border border-amber-200/70 bg-amber-50 p-3 ">
 <p className="text-xs text-muted-foreground">Daily late penalty</p>
 <p className="text-lg font-semibold">
 {formatCurrency(displayLoan.daily_penalty_rate ?? 0)}/day
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4 md:grid-cols-2">
 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background ">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Collection Summary</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm">
 <p className="flex justify-between">
 <span className="text-muted-foreground">Payment records (completed)</span>
 <span className="font-medium">{viewPaymentsCompleted.length}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Interest collected</span>
 <span className="font-medium">{formatCurrency(interestCollected)}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Penalty collected</span>
 <span className="font-medium">{formatCurrency(penaltyCollected)}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Fee collected</span>
 <span className="font-medium">{formatCurrency(feeCollected)}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Last payment date</span>
 <span className="font-medium">
 {viewPaymentsCompleted.length > 0
 ? formatDateTime(
 viewPaymentsCompleted.reduce((latest, p) =>
 new Date(p.payment_date) > new Date(latest.payment_date) ? p : latest
 ).payment_date
 )
 : "No payment yet"}
 </span>
 </p>
 </CardContent>
 </Card>

 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background ">
 <CardHeader className="pb-2">
 <CardTitle className="flex items-center gap-2 text-base">
 <TrendingUp className="h-4 w-4 text-primary" />
 Loan Analysis
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm">
 <p className="flex justify-between">
 <span className="text-muted-foreground">Risk classification</span>
 <span className="font-medium">{risk.label}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Installments paid</span>
 <span className="font-medium">{paidInstallments}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Overdue installments</span>
 <span className="font-medium">{overdueInstallments}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Collection activities (count)</span>
 <span className="font-medium">{collectionActivityCount}</span>
 </p>
 <p className="flex justify-between">
 <span className="text-muted-foreground">Days in arrears</span>
 <span className="font-medium">{displayLoan.days_in_arrears}</span>
 </p>
 </CardContent>
 </Card>
 </div>

 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background ">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Repayment Schedule</CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 {viewSchedule.length === 0 ? (
 <p className="px-4 py-6 text-sm text-muted-foreground">No schedule rows found.</p>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Due date</TableHead>
 <TableHead className="text-right">Days overdue</TableHead>
 <TableHead className="text-right">Penalty</TableHead>
 <TableHead className="text-right">Penalty paid</TableHead>
 <TableHead className="text-right">Penalty left</TableHead>
 <TableHead className="text-right">Balance due</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {viewSchedule.map((row) => (
 <TableRow
 key={row.id}
 className={row.days_overdue > 0 ? "bg-red-50/70 hover:bg-red-50" : undefined}
 >
 <TableCell className="text-sm">{formatDate(row.due_date)}</TableCell>
 <TableCell className="text-right">
 {row.days_overdue > 0 ? (
 <span className="font-medium text-destructive">{row.days_overdue}</span>
 ) : (
 <span className="text-muted-foreground">0</span>
 )}
 </TableCell>
 <TableCell className="text-right">{formatCurrency(row.penalty_due)}</TableCell>
 <TableCell className="text-right">{formatCurrency(row.penalty_paid)}</TableCell>
 <TableCell className="text-right">{formatCurrency(row.penalty_outstanding)}</TableCell>
 <TableCell className="text-right font-medium">
 {formatCurrency(row.balance_due || row.balance)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>

 <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background ">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Payment Allocation</CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 {viewPaymentsCompleted.length === 0 ? (
 <p className="px-4 py-6 text-sm text-muted-foreground">No completed payments yet.</p>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Date</TableHead>
 <TableHead>Reference</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead className="text-right">Penalty paid</TableHead>
 <TableHead className="text-right">Fees</TableHead>
 <TableHead className="text-right">Interest</TableHead>
 <TableHead className="text-right">Principal</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {viewPaymentsCompleted.slice(0, 8).map((payment) => (
 <TableRow key={payment.id}>
 <TableCell className="text-sm">{formatDate(payment.payment_date)}</TableCell>
 <TableCell className="font-mono text-xs">
 {payment.reference_number || payment.payment_number}
 </TableCell>
 <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
 <TableCell className="text-right">{formatCurrency(payment.penalty_allocated)}</TableCell>
 <TableCell className="text-right">{formatCurrency(payment.fees_allocated)}</TableCell>
 <TableCell className="text-right">{formatCurrency(payment.interest_allocated)}</TableCell>
 <TableCell className="text-right">{formatCurrency(payment.principal_allocated)}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 </ScrollArea>
 </>
 ) : null}
 </DialogContent>
 </Dialog>
 </>
 );
}
