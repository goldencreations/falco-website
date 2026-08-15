"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
 AlertTriangle,
 ArrowDownCircle,
 ArrowUpCircle,
 CheckCircle,
 CreditCard,
 Eye,
 Loader2,
 RefreshCcw,
 Scale,
 Search,
 XCircle,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ListPaginationBar, paginateItems } from "@/components/list-pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { extractCustomersList } from "@/lib/customer-adapters";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import { loanMatchesOfficerPortfolio } from "@/lib/loan-officer-portfolio";
import { formatApiResponseError } from "@/lib/falco-api";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import {
 computeReconciliationSummaryFromPayments,
 extractPaymentsPayload,
 extractReconciliationSummary,
 type PaymentViewRow,
 type ReconciliationStatus,
 type ReconciliationSummary,
} from "@/lib/payment-adapters";
import { useSessionUser } from "@/lib/use-session-user";
import {
  listRowRevealClassName,
  listRowRevealStyle,
  useListRevealKey,
} from "@/lib/list-row-reveal";

const PAGE_SIZE = 8;

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

const emptySummary: ReconciliationSummary = {
 matched: 0,
 underpaid: 0,
 overpaid: 0,
 manual_review: 0,
 unmatched: 0,
};

export default function ReconciliationPage() {
 const { user } = useSessionUser();
 const isOfficerView = user?.role === "loan_officer";
 const isManagerView = user?.role === "branch_manager";
 const scopeBranchId =
 user?.role === "branch_manager" || user?.role === "loan_officer" ? user.branch_id : null;

 const paymentsBasePath = isOfficerView
 ? "/officer/payments"
 : isManagerView
 ? "/manager/payments"
 : "/payments";

 const [payments, setPayments] = useState<PaymentViewRow[]>([]);
 const [loans, setLoans] = useState<LoanListRow[]>([]);
 const [apiSummary, setApiSummary] = useState<ReconciliationSummary>(emptySummary);
 const [assignedCustomerIds, setAssignedCustomerIds] = useState<Set<string> | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<ReconciliationStatus | "all">("all");
 const [page, setPage] = useState(1);
 const [listRevealKey, bumpListReveal] = useListRevealKey();

 const load = useCallback(async () => {
 if (!user) return;
 setLoading(true);
 setError(null);
 try {
 const payParams = new URLSearchParams();
 payParams.set("page_size", "200");
 const loanParams = new URLSearchParams();
 loanParams.set("page_size", "100");
 if (scopeBranchId) {
 payParams.set("branch_id", scopeBranchId);
 loanParams.set("branch_id", scopeBranchId);
 }

 const reconUrl = scopeBranchId
 ? `/api/payments/reconciliation-summary?branch_id=${encodeURIComponent(scopeBranchId)}`
 : "/api/payments/reconciliation-summary";

 const tasks: [
 Promise<Response>,
 Promise<Response>,
 Promise<Response>,
 Promise<Response> | Promise<null>
 ] = [
 fetch(`/api/payments?${payParams.toString()}`, { credentials: "include" }),
 fetch(`/api/loans?${loanParams.toString()}`, { credentials: "include" }),
 fetch(reconUrl, { credentials: "include" }),
 isOfficerView
 ? fetch("/api/customers/my-customers?page_size=500", { credentials: "include" })
 : Promise.resolve(null),
 ];

 const [payRes, loanRes, reconRes, custRes] = await Promise.all(tasks);

 const { data: payJson } = await parseJsonResponse<{
 payments?: PaymentViewRow[];
 data?: PaymentViewRow[];
 message?: string;
 }>(payRes);
 if (!payRes.ok) {
 throw new Error(formatApiResponseError(payJson, "Failed to load payments"));
 }

 const loanJson = await loanRes.json().catch(() => ({}));
 if (!loanRes.ok) {
 throw new Error(formatApiResponseError(loanJson, "Failed to load loans"));
 }

 const { data: reconJson } = await parseJsonResponse<{ summary?: ReconciliationSummary }>(reconRes);
 setApiSummary(reconRes.ok && reconJson?.summary ? reconJson.summary : emptySummary);

 setPayments(extractPaymentsPayload(payJson).payments);
 setLoans(extractLoansList(loanJson));
 bumpListReveal();

 if (custRes && custRes.ok) {
 const custJson = await custRes.json();
 const customers = Array.isArray((custJson as { customers?: unknown }).customers)
 ? extractCustomersList(custJson)
 : extractCustomersList(custJson);
 setAssignedCustomerIds(new Set(customers.map((c) => String(c.id).trim()).filter(Boolean)));
 } else {
 setAssignedCustomerIds(null);
 }
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load reconciliation data");
 setPayments([]);
 setApiSummary(emptySummary);
 } finally {
 setLoading(false);
 }
 }, [user, scopeBranchId, isOfficerView, bumpListReveal]);

 useEffect(() => {
 void load();
 }, [load]);

 const loanById = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

 const scopedPayments = useMemo(() => {
 return payments.filter((payment) => {
 const loan = loanById.get(payment.loan_id);
 if (!loan) return !scopeBranchId;
 if (scopeBranchId && loan.branch_id !== scopeBranchId) return false;
 if (isOfficerView && user && assignedCustomerIds) {
 return loanMatchesOfficerPortfolio(loan, assignedCustomerIds, user.id);
 }
 return true;
 });
 }, [payments, loanById, scopeBranchId, isOfficerView, user, assignedCustomerIds]);

 const summary = useMemo(() => {
 if (isOfficerView) return computeReconciliationSummaryFromPayments(scopedPayments);
 const computed = computeReconciliationSummaryFromPayments(scopedPayments);
 const apiTotal = Object.values(apiSummary).reduce((s, n) => s + n, 0);
 return apiTotal > 0 ? apiSummary : computed;
 }, [isOfficerView, scopedPayments, apiSummary]);

 const filteredPayments = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 return scopedPayments.filter((payment) => {
 if (statusFilter !== "all" && (payment.reconciliation_status ?? "unmatched") !== statusFilter) {
 return false;
 }
 if (!q) return true;
 return (
 (payment.payment_number ?? "").toLowerCase().includes(q) ||
 (payment.loan_number ?? "").toLowerCase().includes(q) ||
 (payment.customer_display_name ?? "").toLowerCase().includes(q) ||
 (payment.reference_number ?? "").toLowerCase().includes(q)
 );
 });
 }, [scopedPayments, searchQuery, statusFilter]);

 useEffect(() => {
  setPage(1);
 }, [searchQuery, statusFilter, scopeBranchId]);

 useEffect(() => {
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  if (page > totalPages) setPage(totalPages);
 }, [page, filteredPayments.length]);

 const pagedPayments = useMemo(
  () => paginateItems(filteredPayments, page, PAGE_SIZE),
  [filteredPayments, page]
 );

 const needsAttention = summary.manual_review + summary.unmatched + summary.underpaid;

 return (
 <>
 <DashboardHeader
 title="Payment Reconciliation"
 description={
 isOfficerView
 ? "Review payments on loans in your assigned portfolio."
 : "Review payment matches, exceptions, and manual collections."
 }
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 {error ? (
 <Card className="border-destructive/40 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 ) : null}

 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-sm text-muted-foreground">
 {needsAttention > 0
 ? `${needsAttention} payment(s) need attention in this view.`
 : "All visible payments are matched or reconciled."}
 </p>
 <div className="flex flex-wrap gap-2">
 <Button type="button" variant="outline" size="sm" onClick={() => forceCachedReload(load)} disabled={loading}>
 {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
 Refresh
 </Button>
 <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
 <Link href={paymentsBasePath}>
 <CreditCard className="mr-2 h-4 w-4" />
 Record payment
 </Link>
 </Button>
 </div>
 </div>

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-base">
 <Scale className="h-5 w-5" />
 Reconciliation summary
 </CardTitle>
 <CardDescription>
 Overview of payment matching status{isOfficerView ? " for your assigned portfolio" : ""}.
 </CardDescription>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
 {(Object.keys(reconciliationVariant) as ReconciliationStatus[]).map((key) => {
 const ui = reconciliationVariant[key];
 const Icon = ui.icon;
 const active = statusFilter === key;
 return (
 <button
 key={key}
 type="button"
 onClick={() => setStatusFilter(active ? "all" : key)}
 className={`rounded-lg border p-3 text-left transition-colors ${
 active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"
 }`}
 >
 <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
 <Icon className="h-3.5 w-3.5" />
 {ui.label}
 </p>
 <p className="mt-1 text-2xl font-semibold">{summary[key]}</p>
 </button>
 );
 })}
 </CardContent>
 </Card>

 <Card className="overflow-hidden border-emerald-100">
 <CardHeader className="pb-3">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <CardTitle className="text-base">Payment ledger</CardTitle>
 <CardDescription>
 {filteredPayments.length} of {scopedPayments.length} payments
 {statusFilter !== "all" ? ` · filter: ${reconciliationVariant[statusFilter].label}` : ""}
 </CardDescription>
 </div>
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 className="pl-9"
 placeholder="Search payment #, loan, customer, reference…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4 p-0">
 {loading ? (
 <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading reconciliation…
 </div>
 ) : filteredPayments.length === 0 ? (
 <p className="py-12 text-center text-sm text-muted-foreground">No payments match your filters.</p>
 ) : (
 <>
 <div className="grid gap-3 p-4 sm:hidden">
 {pagedPayments.map((payment, index) => {
 const reconKey = payment.reconciliation_status ?? "unmatched";
 const recon = reconciliationVariant[reconKey];
 const ReconIcon = recon.icon;
 const loan = loanById.get(payment.loan_id);

 return (
 <div
  key={`${listRevealKey}-${page}-${payment.id}`}
  className={listRowRevealClassName(
   "rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
  )}
  style={listRowRevealStyle(index)}
 >
 <div className="flex items-start justify-between gap-2">
 <p className="font-mono text-xs font-medium">{payment.payment_number}</p>
 <Badge variant={recon.variant} className="shrink-0 gap-1">
 <ReconIcon className="h-3 w-3" />
 {recon.label}
 </Badge>
 </div>

 <p className="mt-2 font-medium">
 {loan?.customerDisplayName ?? payment.customer_display_name ?? "—"}
 </p>
 <p className="text-xs text-muted-foreground">
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

 {payment.reconciliation_note ? (
 <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
 {payment.reconciliation_note}
 </p>
 ) : null}

 <div className="mt-3">
 <Button size="sm" variant="outline" className="h-8 w-full" asChild>
 <Link href={`${paymentsBasePath}?loan=${encodeURIComponent(payment.loan_id)}`}>
 <Eye className="mr-1 h-3.5 w-3.5" />
 View Details
 </Link>
 </Button>
 </div>
 </div>
 );
 })}
 </div>

 <div className="hidden sm:block">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Payment</TableHead>
 <TableHead>Loan / Customer</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Date</TableHead>
 <TableHead className="w-[280px]">Reconciliation</TableHead>
 <TableHead className="text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {pagedPayments.map((payment, index) => {
 const reconKey = payment.reconciliation_status ?? "unmatched";
 const recon = reconciliationVariant[reconKey];
 const ReconIcon = recon.icon;
 const loan = loanById.get(payment.loan_id);
 return (
 <TableRow
  key={`${listRevealKey}-${page}-${payment.id}`}
  className={listRowRevealClassName()}
  style={listRowRevealStyle(index)}
 >
 <TableCell className="font-mono text-xs">{payment.payment_number}</TableCell>
 <TableCell>
 <p className="text-sm font-medium">{loan?.customerDisplayName ?? payment.customer_display_name ?? "—"}</p>
 <p className="text-xs text-muted-foreground">{payment.loan_number ?? loan?.loan_number ?? "—"}</p>
 </TableCell>
 <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
 <TableCell className="text-sm">{formatDateTime(payment.payment_date)}</TableCell>
 <TableCell className="max-w-[280px] align-top">
 <Badge variant={recon.variant} className="gap-1">
 <ReconIcon className="h-3 w-3" />
 {recon.label}
 </Badge>
 {payment.reconciliation_note ? (
 <p className="mt-1 max-w-[260px] whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
 {payment.reconciliation_note}
 </p>
 ) : null}
 </TableCell>
 <TableCell className="text-right">
 <Button variant="ghost" size="sm" asChild>
 <Link href={`${paymentsBasePath}?loan=${encodeURIComponent(payment.loan_id)}`}>View</Link>
 </Button>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 <ListPaginationBar
  page={page}
  pageSize={PAGE_SIZE}
  total={filteredPayments.length}
  loading={loading}
  onPageChange={setPage}
 />
 </>
 )}
 </CardContent>
 </Card>

 <p className="text-xs text-muted-foreground">
 Online payments appear as matched after confirmation. Manual field collections stay in review until they
 are reconciled. New payments are recorded from the Payments page.
 </p>
 </div>
 </main>
 </>
 );
}
