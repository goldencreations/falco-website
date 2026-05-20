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
 loanCustomerLabel,
 loanProductLabel,
} from "@/lib/loan-display";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import type { PaymentViewRow } from "@/lib/payment-adapters";
import type { Customer, LoanStatus, RepaymentSchedule, RiskClassification } from "@/lib/types";
import { loanMatchesOfficerPortfolio } from "@/lib/loan-officer-portfolio";
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
 const scopeBranchId = isManagerView || isOfficerView ? user?.branch_id : null;
 const paymentsBasePath = isOfficerView ? "/officer/payments" : isManagerView ? "/manager/payments" : "/payments";

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
 loan.loan_number.toLowerCase().includes(q) ||
 loanCustomerLabel(loan).toLowerCase().includes(q) ||
 (loan.productName ?? "").toLowerCase().includes(q) ||
 (loan.customerPhone && loan.customerPhone.toLowerCase().includes(q));

 const matchesStatus = statusFilter === "all" || loan.status === statusFilter;

 return matchesSearch && matchesStatus;
 });

 const totalOutstanding = visibleLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
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
 .filter((p) => {
 const s = String(p.status ?? "").toLowerCase();
 if (s === "reversed" || s === "failed") return false;
 if (s === "completed") return true;
 const ledger = String(p.ledger_status ?? "").toLowerCase();
 return ledger === "verified" || ledger === "posted" || p.reconciliation_status === "matched";
 })
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
 : "Loans from the Falco API. Open a row for schedule, payments, and collections."
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
 </div>
 <p className="text-xs text-muted-foreground">
 {activeLoans} active loans and {inArrearsLoans} in arrears.
 </p>
 </CardContent>
 </Card>

 <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
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

 {/* Loans Table */}
 <Card>
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Loan #</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead>Product</TableHead>
 <TableHead className="text-right">Principal</TableHead>
 <TableHead className="text-right">Outstanding</TableHead>
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
 <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
 <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-label="Loading loans" />
 </TableCell>
 </TableRow>
 ) : filteredLoans.length === 0 ? (
 <TableRow>
 <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
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
 <TableCell>
 <div className="w-24">
 <Progress value={Math.min(100, paidPercent)} className="h-2" />
 <p className="mt-1 text-xs text-muted-foreground">
 {paidPercent.toFixed(0)}% paid
 {totalPaidDisplay > 0 ? ` · ${formatCurrency(totalPaidDisplay)}` : ""}
 </p>
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
 <Button variant="ghost" size="sm" asChild>
 <Link href={`${paymentsBasePath}?loan=${loan.id}&openPayment=1`}>
 <CreditCard className="h-4 w-4" />
 </Link>
 </Button>
 {loan.application_id ? (
 <Button variant="ghost" size="sm" asChild title="Credit analysis for originating application">
 <Link href={`/credit-analysis?applicationId=${loan.application_id}`}>
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
 Loading schedule, payments, and customer from API…
 </span>
 ) : (
 "Customer, balances, repayment schedule, and payments from the backend."
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
 </div>
 </ScrollArea>
 </>
 ) : null}
 </DialogContent>
 </Dialog>
 </>
 );
}
