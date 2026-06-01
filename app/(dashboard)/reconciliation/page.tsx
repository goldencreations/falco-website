"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
 AlertTriangle,
 ArrowDownCircle,
 ArrowUpCircle,
 CheckCircle,
 CreditCard,
 Loader2,
 RefreshCcw,
 Scale,
 Search,
 XCircle,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
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
 }, [user, scopeBranchId, isOfficerView]);

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

 const needsAttention = summary.manual_review + summary.unmatched + summary.underpaid;

 return (
 <>
 <DashboardHeader
 title="Payment Reconciliation"
 description={
 isOfficerView
 ? "Reconciliation summary for payments on loans in your assigned portfolio (GET /payments/reconciliation-summary)."
 : "Branch-scoped payment reconciliation from the Falco API — matched, underpaid, overpaid, manual review, and unmatched."
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
 Counts from <span className="font-mono text-xs">GET /payments/reconciliation-summary</span>
 {isOfficerView ? " (portfolio-filtered on this page)" : ""}.
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

 <Card>
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
 <CardContent className="p-0">
 {loading ? (
 <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading reconciliation…
 </div>
 ) : filteredPayments.length === 0 ? (
 <p className="py-12 text-center text-sm text-muted-foreground">No payments match your filters.</p>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Payment</TableHead>
 <TableHead>Loan / Customer</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Date</TableHead>
 <TableHead>Reconciliation</TableHead>
 <TableHead className="text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredPayments.map((payment) => {
 const reconKey = payment.reconciliation_status ?? "unmatched";
 const recon = reconciliationVariant[reconKey];
 const ReconIcon = recon.icon;
 const loan = loanById.get(payment.loan_id);
 return (
 <TableRow key={payment.id}>
 <TableCell className="font-mono text-xs">{payment.payment_number}</TableCell>
 <TableCell>
 <p className="text-sm font-medium">{loan?.customerDisplayName ?? payment.customer_display_name ?? "—"}</p>
 <p className="text-xs text-muted-foreground">{payment.loan_number ?? loan?.loan_number ?? "—"}</p>
 </TableCell>
 <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
 <TableCell className="text-sm">{formatDateTime(payment.payment_date)}</TableCell>
 <TableCell>
 <Badge variant={recon.variant} className="gap-1">
 <ReconIcon className="h-3 w-3" />
 {recon.label}
 </Badge>
 {payment.reconciliation_note ? (
 <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">{payment.reconciliation_note}</p>
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
 )}
 </CardContent>
 </Card>

 <p className="text-xs text-muted-foreground">
 Gateway and webhook payments appear as matched when the backend confirms them. Manual field collections
 are tagged for review until reconciled. Recording new payments uses the Payments page and does not alter
 reconciliation metadata unless the LMS assigns it on create.
 </p>
 </div>
 </main>
 </>
 );
}
