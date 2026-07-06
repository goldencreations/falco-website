"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
 Plus,
 Search,
 Filter,
 Download,
 CreditCard,
 Smartphone,
 Building2,
 Banknote,
 CheckCircle,
 Clock,
 XCircle,
 AlertTriangle,
 ArrowUpCircle,
 ArrowDownCircle,
 Scale,
 Loader2,
 RefreshCcw,
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
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import type {
 PaymentViewRow,
 ReconciliationStatus,
 ReconciliationSummary,
} from "@/lib/payment-adapters";
import type { PaymentMethod, PaymentStatus } from "@/lib/types";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { isBranchScopedStaffRole, rolePortalBase } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";

const methodConfig: Record<PaymentMethod, { label: string; icon: typeof CreditCard }> = {
 cash: { label: "Cash", icon: Banknote },
 mobile_money: { label: "Mobile Money", icon: Smartphone },
 bank_transfer: { label: "Bank Transfer", icon: Building2 },
 cheque: { label: "Cheque", icon: CreditCard },
};

const statusConfig: Record<
 PaymentStatus,
 { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }
> = {
 pending: { label: "Pending", variant: "secondary", icon: Clock },
 completed: { label: "Completed", variant: "default", icon: CheckCircle },
 failed: { label: "Failed", variant: "destructive", icon: XCircle },
 reversed: { label: "Reversed", variant: "outline", icon: XCircle },
};

const reconciliationVariant: Record<
 ReconciliationStatus,
 { label: string; icon: typeof CheckCircle; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
 matched: { label: "Matched", icon: CheckCircle, variant: "default" },
 underpaid: { label: "Underpaid", icon: ArrowDownCircle, variant: "destructive" },
 overpaid: { label: "Overpaid", icon: ArrowUpCircle, variant: "secondary" },
 manual_review: { label: "Manual Review", icon: AlertTriangle, variant: "outline" },
 unmatched: { label: "Unmatched", icon: XCircle, variant: "destructive" },
};

const emptyReconciliation: ReconciliationSummary = {
 matched: 0,
 underpaid: 0,
 overpaid: 0,
 manual_review: 0,
 unmatched: 0,
};

export default function PaymentsPage() {
 const { user } = useSessionUser();
 const isOfficerView = user?.role === "loan_officer";
 const portalBase = rolePortalBase(user?.role);
 const reconciliationHref = portalBase ? `${portalBase}/reconciliation` : "/reconciliation";
 const scopeBranchId = isBranchScopedStaffRole(user?.role) ? user?.branch_id ?? null : null;

 const [payments, setPayments] = useState<PaymentViewRow[]>([]);
 const [loans, setLoans] = useState<LoanListRow[]>([]);
 const [reconciliationSummary, setReconciliationSummary] =
 useState<ReconciliationSummary>(emptyReconciliation);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [actionLoading, setActionLoading] = useState(false);

 const [searchQuery, setSearchQuery] = useState("");
 const [methodFilter, setMethodFilter] = useState<string>("all");
 const [isDialogOpen, setIsDialogOpen] = useState(false);
 const [selectedLoan, setSelectedLoan] = useState("");
 const [paymentAmount, setPaymentAmount] = useState("");
 const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
 const [referenceNumber, setReferenceNumber] = useState("");
 const [collectionChannel, setCollectionChannel] = useState<"system" | "manual_collection">("system");
 const [mobileProvider, setMobileProvider] = useState("mpesa");
 const [mobileNumber, setMobileNumber] = useState("");
 const [requestedLoanId, setRequestedLoanId] = useState<string | null>(null);
 const [openPaymentForm, setOpenPaymentForm] = useState<string | null>(null);

 const load = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set("page_size", "200");
 const loanParams = new URLSearchParams();
 loanParams.set("page_size", "100");
 if (scopeBranchId) loanParams.set("branch_id", scopeBranchId);

 const [payRes, loanRes, reconRes] = await Promise.all([
 fetch(`/api/payments?${params.toString()}`, { credentials: "include" }),
 fetch(`/api/loans?${loanParams.toString()}`, { credentials: "include" }),
 fetch("/api/payments/reconciliation-summary", { credentials: "include" }),
 ]);

 const { data: payJson } = await parseJsonResponse<{
 payments?: PaymentViewRow[];
 data?: PaymentViewRow[];
 message?: string;
 }>(payRes);
 if (!payRes.ok) {
 throw new Error(formatApiResponseError(payJson, "Failed to load payments"));
 }

 const loanJson = await loanRes.json().catch(() => null);
 if (!loanRes.ok) {
 const msg =
 typeof loanJson === "object" && loanJson && "message" in loanJson
 ? String((loanJson as { message: unknown }).message)
 : "Failed to load loans";
 throw new Error(msg);
 }

 const { data: reconJson } = await parseJsonResponse<{ summary?: ReconciliationSummary }>(reconRes);
 if (reconRes.ok && reconJson?.summary) {
 setReconciliationSummary(reconJson.summary);
 } else {
 setReconciliationSummary(emptyReconciliation);
 }

 setPayments(payJson?.payments ?? payJson?.data ?? []);
 setLoans(extractLoansList(loanJson));
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load payments");
 setPayments([]);
 } finally {
 setLoading(false);
 }
 }, [scopeBranchId]);

 useEffect(() => {
 void load();
 }, [load]);

 const visibleLoans = useMemo(() => {
 if (!scopeBranchId) return loans;
 return loans.filter((loan) => {
 if (loan.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 return loan.loan_officer_id === user.id || loan.disbursed_by === user.id;
 });
 }, [loans, scopeBranchId, isOfficerView, user]);

 const activeLoans = visibleLoans.filter(
 (l) => l.status === "active" || l.status === "in_arrears"
 );

 const loanById = useMemo(() => new Map(visibleLoans.map((l) => [l.id, l])), [visibleLoans]);

 const filteredPayments = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 return payments.filter((payment) => {
 const loan = loanById.get(payment.loan_id);
 const matchesSearch =
 q === "" ||
 (payment.payment_number ?? "").toLowerCase().includes(q) ||
 (payment.reference_number ?? "").toLowerCase().includes(q) ||
 (payment.customer_display_name ?? "").toLowerCase().includes(q) ||
 (loan?.customerDisplayName ?? "").toLowerCase().includes(q);
 const matchesMethod = methodFilter === "all" || payment.payment_method === methodFilter;
 return matchesSearch && matchesMethod;
 });
 }, [payments, searchQuery, methodFilter, loanById]);

 const totalCollected = payments
 .filter((p) => p.status === "completed")
 .reduce((sum, p) => sum + p.amount, 0);

 const todayCollections = payments
 .filter((p) => {
 const paymentDate = new Date(p.payment_date).toDateString();
 return paymentDate === new Date().toDateString() && p.status === "completed";
 })
 .reduce((sum, p) => sum + p.amount, 0);

 const selectedLoanDetails = selectedLoan ? loanById.get(selectedLoan) : undefined;

 const preselectedLoan = useMemo(
 () => (requestedLoanId ? loanById.get(requestedLoanId) : undefined),
 [requestedLoanId, loanById]
 );

 useEffect(() => {
 if (typeof window === "undefined") return;
 const params = new URLSearchParams(window.location.search);
 setRequestedLoanId(params.get("loan"));
 setOpenPaymentForm(params.get("openPayment"));
 }, []);

 useEffect(() => {
 if (!preselectedLoan) return;
 setSelectedLoan(preselectedLoan.id);
 if (!paymentAmount) setPaymentAmount(String(Math.round(preselectedLoan.total_outstanding)));
 if (openPaymentForm === "1") setIsDialogOpen(true);
 }, [preselectedLoan, openPaymentForm, paymentAmount]);

 const handleRecordPayment = async () => {
 if (!selectedLoan || !paymentAmount) return;
 const amount = Number(paymentAmount);
 if (!Number.isFinite(amount) || amount <= 0) return;
 const maxPayable = selectedLoanDetails?.total_outstanding ?? 0;
 if (maxPayable > 0 && amount > maxPayable) {
 setError(`Payment cannot be more than ${formatCurrency(maxPayable)}.`);
 return;
 }

 setActionLoading(true);
 setError(null);
 try {
 const body: Record<string, unknown> = {
 loan_id: selectedLoan,
 amount,
 payment_method: paymentMethod,
 payment_date: new Date().toISOString().slice(0, 10),
 collection_channel: collectionChannel,
 };
 if (referenceNumber.trim()) body.reference_number = referenceNumber.trim();
 if (paymentMethod === "mobile_money") {
 body.mobile_money_provider = mobileProvider;
 body.mobile_money_number = mobileNumber.trim();
 }

 const res = await fetch("/api/payments", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 const { data } = await parseJsonResponse<Record<string, unknown>>(res);
 if (!res.ok) {
 setError(formatApiResponseError(data, "Failed to record payment"));
 return;
 }
 setIsDialogOpen(false);
 setSelectedLoan("");
 setPaymentAmount("");
 setReferenceNumber("");
 setMobileNumber("");
 setCollectionChannel("system");
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to record payment");
 } finally {
 setActionLoading(false);
 }
 };

 return (
 <>
 <DashboardHeader
 title="Payments"
 description="Record and track loan repayments."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 {error && (
 <Card className="border-destructive/50 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 )}

 {loading ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading payments…
 </div>
 ) : (
 <>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{payments.length}</div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-accent">{formatCurrency(totalCollected)}</div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Collections</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{formatCurrency(todayCollections)}</div>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning">
 {payments.filter((p) => p.status === "pending").length}
 </div>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center justify-between gap-2">
 <span className="flex items-center gap-2">
 <Scale className="h-5 w-5" />
 Payment Reconciliation
 </span>
 <Button variant="link" size="sm" className="h-auto px-0" asChild>
 <Link href={reconciliationHref}>
 Full reconciliation page
 </Link>
 </Button>
 </CardTitle>
 </CardHeader>
 <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
 {(
 Object.keys(reconciliationSummary) as ReconciliationStatus[]
 ).map((key) => (
 <div key={key} className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">{reconciliationVariant[key].label}</p>
 <p className="text-xl font-semibold">{reconciliationSummary[key]}</p>
 </div>
 ))}
 </CardContent>
 <p className="px-6 pb-4 text-xs text-muted-foreground">
 Online payments appear here after confirmation. Manual collections are tagged for review until
 reconciled.
 </p>
 </Card>

 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 gap-3">
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search payments..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={methodFilter} onValueChange={setMethodFilter}>
 <SelectTrigger className="w-44">
 <Filter className="mr-2 h-4 w-4" />
 <SelectValue placeholder="Method" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Methods</SelectItem>
 <SelectItem value="cash">Cash</SelectItem>
 <SelectItem value="mobile_money">Mobile Money</SelectItem>
 <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
 <SelectItem value="cheque">Cheque</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="flex gap-2">
 <Button type="button" variant="outline" onClick={() => forceCachedReload(load)}>
 <RefreshCcw className="mr-2 h-4 w-4" />
 Refresh
 </Button>
 <Button variant="outline" type="button" disabled>
 <Download className="mr-2 h-4 w-4" />
 Export
 </Button>
 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 <DialogTrigger asChild>
 <Button type="button">
 <Plus className="mr-2 h-4 w-4" />
 Record Payment
 </Button>
 </DialogTrigger>
 <DialogContent
 className="flex w-[calc(100%-1.5rem)] max-h-[calc(100dvh-1.5rem)] max-w-md scale-100 flex-col gap-0 overflow-hidden p-0 top-[max(0.5rem,env(safe-area-inset-top,0px))] left-[50%] translate-x-[-50%] translate-y-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 sm:max-w-md [&>button]:right-3 [&>button]:top-3 [&>button]:z-10"
 >
 <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 pr-10 text-left">
 <DialogTitle className="text-base">Record New Payment</DialogTitle>
 <DialogDescription className="text-xs leading-relaxed">
 {selectedLoanDetails
 ? `Record repayment for ${selectedLoanDetails.customerDisplayName} (${selectedLoanDetails.loan_number}).`
 : "Record a payment received from a customer"}
 </DialogDescription>
 </DialogHeader>
 <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
 <FieldGroup className="gap-3 py-0">
 <Field>
 <FieldLabel>Select Loan</FieldLabel>
 <Select value={selectedLoan} onValueChange={setSelectedLoan}>
 <SelectTrigger className="h-9 w-full">
 <SelectValue placeholder="Select a loan" />
 </SelectTrigger>
 <SelectContent>
 {activeLoans.map((loan) => (
 <SelectItem key={loan.id} value={loan.id}>
 {loan.loan_number} — {loan.customerDisplayName}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Amount (TZS)</FieldLabel>
 <Input
 type="number"
 className="h-9"
 placeholder="Enter amount"
 max={selectedLoanDetails?.total_outstanding}
 value={paymentAmount}
 onChange={(e) => setPaymentAmount(e.target.value)}
 />
 {selectedLoanDetails ? (
 <p className="text-xs text-muted-foreground">
 Maximum payable: {formatCurrency(selectedLoanDetails.total_outstanding)}
 </p>
 ) : null}
 </Field>
 <Field>
 <FieldLabel>Payment Method</FieldLabel>
 <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
 <SelectTrigger className="h-9 w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="cash">Cash</SelectItem>
 <SelectItem value="mobile_money">Mobile Money</SelectItem>
 <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
 <SelectItem value="cheque">Cheque</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 {paymentMethod === "mobile_money" && (
 <>
 <Field>
 <FieldLabel>Mobile provider</FieldLabel>
 <Select value={mobileProvider} onValueChange={setMobileProvider}>
 <SelectTrigger className="h-9 w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="mpesa">M-Pesa</SelectItem>
 <SelectItem value="tigopesa">Tigo Pesa</SelectItem>
 <SelectItem value="airtel">Airtel Money</SelectItem>
 <SelectItem value="halopesa">Halopesa</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Mobile number</FieldLabel>
 <Input
 className="h-9"
 placeholder="+255…"
 value={mobileNumber}
 onChange={(e) => setMobileNumber(e.target.value)}
 />
 </Field>
 </>
 )}
 <Field>
 <FieldLabel>Collection Channel</FieldLabel>
 <Select
 value={collectionChannel}
 onValueChange={(v) => setCollectionChannel(v as "system" | "manual_collection")}
 >
 <SelectTrigger className="h-9 w-full">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="system">System Captured</SelectItem>
 <SelectItem value="manual_collection">Manual Collection (Loan Officer)</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Reference Number (optional)</FieldLabel>
 <Input
 className="h-9"
 placeholder="Transaction reference"
 value={referenceNumber}
 onChange={(e) => setReferenceNumber(e.target.value)}
 />
 </Field>
 </FieldGroup>
 </div>
 <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 py-3 sm:justify-end">
 <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
 Cancel
 </Button>
 <Button
 type="button"
 onClick={() => void handleRecordPayment()}
 disabled={
 actionLoading ||
 !selectedLoan ||
 !paymentAmount ||
 (paymentMethod === "mobile_money" && !mobileNumber.trim())
 }
 >
 {actionLoading ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 "Record Payment"
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 <Card className="overflow-hidden border-emerald-100">
 <CardContent className="space-y-4 p-0">
 <div className="grid gap-3 p-4 sm:hidden">
 {filteredPayments.length === 0 ? (
 <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
 No payments found
 </p>
 ) : (
 filteredPayments.map((payment) => {
 const loan = loanById.get(payment.loan_id);
 const method = methodConfig[payment.payment_method] ?? methodConfig.cash;
 const status = statusConfig[payment.status] ?? statusConfig.completed;
 const reconKey = payment.reconciliation_status ?? "unmatched";
 const reconciliationUi = reconciliationVariant[reconKey];
 const MethodIcon = method.icon;
 const StatusIcon = status.icon;
 const ReconciliationIcon = reconciliationUi.icon;
 const customerName =
 payment.customer_display_name ?? loan?.customerDisplayName ?? "—";

 return (
 <div
 key={payment.id}
 className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
 >
 <div className="flex items-start justify-between gap-2">
 <p className="font-mono text-xs font-medium">{payment.payment_number}</p>
 <Badge variant={status.variant} className="shrink-0 gap-1">
 <StatusIcon className="h-3 w-3" />
 {status.label}
 </Badge>
 </div>

 <p className="mt-2 font-medium">{customerName}</p>
 {payment.customer_phone ? (
 <p className="text-sm text-muted-foreground">{payment.customer_phone}</p>
 ) : null}
 <p className="font-mono text-xs text-muted-foreground">
 {payment.loan_number ?? loan?.loan_number ?? "—"}
 </p>

 <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
 <div>
 <p className="text-xs text-muted-foreground">Amount</p>
 <p className="font-semibold">{formatCurrency(payment.amount)}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Date</p>
 <p className="font-medium">{formatDateTime(payment.payment_date)}</p>
 </div>
 </div>

 <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
 <div className="flex items-center gap-1.5">
 <MethodIcon className="h-3.5 w-3.5 text-muted-foreground" />
 <span>{method.label}</span>
 {payment.metadata?.gateway ? (
 <span className="text-xs text-muted-foreground">(auto)</span>
 ) : null}
 </div>
 {payment.reference_number ? (
 <span className="font-mono text-xs text-muted-foreground">
 Ref: {payment.reference_number}
 </span>
 ) : null}
 </div>

 <div className="mt-3 rounded-lg border bg-background/80 p-2 text-xs">
 <p className="font-medium text-muted-foreground">Allocation</p>
 <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
 <p>Penalty: {formatCurrency(payment.penalty_allocated)}</p>
 <p>Principal: {formatCurrency(payment.principal_allocated)}</p>
 <p>Interest: {formatCurrency(payment.interest_allocated)}</p>
 <p>Fees: {formatCurrency(payment.fees_allocated)}</p>
 </div>
 </div>

 <div className="mt-3 space-y-1">
 <Badge variant={reconciliationUi.variant} className="gap-1">
 <ReconciliationIcon className="h-3 w-3" />
 {reconciliationUi.label}
 </Badge>
 {payment.reconciliation_note ? (
 <p className="text-xs leading-relaxed text-muted-foreground">
 {payment.reconciliation_note}
 </p>
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
 <TableHead>Payment #</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead>Loan</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Method</TableHead>
 <TableHead>Reference</TableHead>
 <TableHead>Allocation</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Reconciliation</TableHead>
 <TableHead>Date</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredPayments.length === 0 ? (
 <TableRow>
 <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
 No payments found
 </TableCell>
 </TableRow>
 ) : (
 filteredPayments.map((payment) => {
 const loan = loanById.get(payment.loan_id);
 const method = methodConfig[payment.payment_method] ?? methodConfig.cash;
 const status = statusConfig[payment.status] ?? statusConfig.completed;
 const reconKey = payment.reconciliation_status ?? "unmatched";
 const reconciliationUi = reconciliationVariant[reconKey];
 const MethodIcon = method.icon;
 const StatusIcon = status.icon;
 const ReconciliationIcon = reconciliationUi.icon;
 const customerName =
 payment.customer_display_name ?? loan?.customerDisplayName ?? "—";

 return (
 <TableRow key={payment.id}>
 <TableCell className="font-mono text-sm">{payment.payment_number}</TableCell>
 <TableCell>
 <div>
 <p className="font-medium">{customerName}</p>
 {payment.customer_phone ? (
 <p className="text-sm text-muted-foreground">{payment.customer_phone}</p>
 ) : null}
 </div>
 </TableCell>
 <TableCell className="font-mono text-sm">
 {payment.loan_number ?? loan?.loan_number ?? "—"}
 </TableCell>
 <TableCell className="text-right font-bold">{formatCurrency(payment.amount)}</TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <MethodIcon className="h-4 w-4 text-muted-foreground" />
 <span>{method.label}</span>
 {payment.metadata?.gateway ? (
 <span className="text-xs text-muted-foreground">(auto)</span>
 ) : null}
 </div>
 </TableCell>
 <TableCell className="font-mono text-xs">{payment.reference_number || "—"}</TableCell>
 <TableCell>
 <div className="space-y-0.5 text-xs">
 <p>Penalty: {formatCurrency(payment.penalty_allocated)}</p>
 <p>P: {formatCurrency(payment.principal_allocated)}</p>
 <p>I: {formatCurrency(payment.interest_allocated)}</p>
 <p>F: {formatCurrency(payment.fees_allocated)}</p>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant={status.variant} className="gap-1">
 <StatusIcon className="h-3 w-3" />
 {status.label}
 </Badge>
 </TableCell>
 <TableCell>
 <div className="space-y-1">
 <Badge variant={reconciliationUi.variant} className="gap-1">
 <ReconciliationIcon className="h-3 w-3" />
 {reconciliationUi.label}
 </Badge>
 <p className="max-w-56 text-xs text-muted-foreground">
 {payment.reconciliation_note}
 </p>
 </div>
 </TableCell>
 <TableCell className="text-sm text-muted-foreground">
 {formatDateTime(payment.payment_date)}
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
 </>
 )}
 </div>
 </main>
 </>
 );
}
