"use client";

import {
 Building2,
 CalendarRange,
 Copy,
 CreditCard,
 Loader2,
 ShieldAlert,
 TrendingUp,
 User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { loanCustomerLabel, loanProductLabel } from "@/lib/loan-display";
import {
 CONTRACT_PROGRESS_TOOLTIP,
 isSettledPayment,
 resolveLoanRepaymentTruth,
 resolveScheduleInstallmentTruth,
 summarizeCustomerPaymentAllocations,
} from "@/lib/loan-repayment-truth";
import { Progress } from "@/components/ui/progress";
import type { LoanListRow } from "@/lib/loan-adapters";
import type { PaymentViewRow } from "@/lib/payment-adapters";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import type { Customer, RepaymentDetails, RepaymentSchedule, RiskClassification } from "@/lib/types";

const plainCardClass = "border-border bg-card shadow-none";

const riskConfig: Record<RiskClassification, { label: string; color: string }> = {
 current: { label: "Current", color: "bg-accent" },
 especially_mentioned: { label: "Watch", color: "bg-warning" },
 substandard: { label: "Substandard", color: "bg-destructive" },
 doubtful: { label: "Doubtful", color: "bg-destructive" },
 loss: { label: "Loss", color: "bg-foreground" },
};

const DEFAULT_ALLOCATION_ORDER = ["penalty", "fees", "interest", "principal"];

function allocationStepLabel(step: string): string {
 const s = step.trim().toLowerCase();
 if (!s) return step;
 return s[0].toUpperCase() + s.slice(1);
}

function RepaymentInstructionsCard({ repaymentDetails }: { repaymentDetails: RepaymentDetails }) {
 const canAccept =
 repaymentDetails.can_accept_payment !== false && repaymentDetails.bill_pay_active !== false;
 const allocationOrder =
 repaymentDetails.allocation_order && repaymentDetails.allocation_order.length > 0
 ? repaymentDetails.allocation_order
 : DEFAULT_ALLOCATION_ORDER;

 const copyBillPayNumber = async () => {
 const number = repaymentDetails.bill_pay_number ?? "";
 try {
 await navigator.clipboard.writeText(number);
 toast.success("BillPay number copied");
 } catch {
 toast.error("Could not copy — copy it manually instead.");
 }
 };

 return (
 <Card className={plainCardClass}>
 <CardHeader className="pb-2">
 <div className="flex items-center justify-between gap-2">
 <CardTitle className="text-base">Repayment Instructions</CardTitle>
 {!canAccept ? (
 <Badge variant="outline" className="gap-1 text-destructive">
 <ShieldAlert className="h-3 w-3" />
 Not currently accepting payments
 </Badge>
 ) : null}
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <p className="text-xs text-muted-foreground">
 BillPay number — the only number the customer should enter in mobile-money BillPay
 </p>
 <div className="mt-1 flex flex-wrap items-center gap-2">
 <span className="rounded-md border border-border px-3 py-1.5 font-mono text-lg font-semibold tracking-wide">
 {repaymentDetails.bill_pay_number}
 </span>
 <Button type="button" size="sm" variant="outline" onClick={() => void copyBillPayNumber()}>
 <Copy className="mr-1.5 h-3.5 w-3.5" />
 Copy
 </Button>
 </div>
 </div>

 <div className="grid gap-3 sm:grid-cols-2">
 {repaymentDetails.amount_due != null ? (
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Amount due</p>
 <p className="text-lg font-semibold">{formatCurrency(repaymentDetails.amount_due)}</p>
 </div>
 ) : null}
 {repaymentDetails.penalty_outstanding != null && repaymentDetails.penalty_outstanding > 0 ? (
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Penalty outstanding</p>
 <p className="text-lg font-semibold text-destructive">
 {formatCurrency(repaymentDetails.penalty_outstanding)}
 </p>
 </div>
 ) : null}
 </div>

 {repaymentDetails.accepts_partial_payments ? (
 <p className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
 Partial payments are allowed. Money received is applied in order:{" "}
 <span className="font-medium text-foreground">
 {allocationOrder.map(allocationStepLabel).join(" → ")}
 </span>
 .
 </p>
 ) : null}

 {repaymentDetails.channels && repaymentDetails.channels.length > 0 ? (
 <div className="space-y-2">
 <p className="text-xs font-medium text-muted-foreground">Mobile-money channels</p>
 <div className="grid gap-2 sm:grid-cols-2">
 {repaymentDetails.channels.map((channel, i) => (
 <div
 key={`${channel.name ?? "channel"}-${i}`}
 className="rounded-lg border border-border p-3 text-sm"
 >
 <p className="font-medium">{channel.name ?? channel.type ?? "Channel"}</p>
 {channel.ussd_code ? (
 <p className="mt-0.5 font-mono text-xs text-muted-foreground">{channel.ussd_code}</p>
 ) : null}
 {channel.instructions ? (
 <p className="mt-1 text-xs text-muted-foreground">{channel.instructions}</p>
 ) : null}
 </div>
 ))}
 </div>
 </div>
 ) : null}

 {!canAccept ? (
 <p className="text-xs text-destructive">
 This loan is not currently accepting BillPay payments. Do not share this number with the
 customer until it is reactivated.
 </p>
 ) : null}
 </CardContent>
 </Card>
 );
}

export type LoanDetailPanelProps = {
 loan: LoanListRow;
 customer: Customer | null;
 schedule: RepaymentSchedule[];
 payments: PaymentViewRow[];
 collectionActivityCount: number;
 loading?: boolean;
};

export function LoanDetailPanel({
 loan,
 customer,
 schedule,
 payments,
 collectionActivityCount,
 loading = false,
}: LoanDetailPanelProps) {
 const viewPaymentsCompleted = payments.filter((p) => isSettledPayment(p));
 const paidInstallments = schedule.filter((item) => item.is_paid).length;
 const overdueInstallments = schedule.filter((item) => !item.is_paid && item.days_overdue > 0).length;
 const paymentAlloc = summarizeCustomerPaymentAllocations(payments);
 const truth = resolveLoanRepaymentTruth(loan);
 const grossCashReceived = paymentAlloc.cashReceived;
 const interestCollected = viewPaymentsCompleted.reduce((sum, p) => sum + p.interest_allocated, 0);
 const feeCollected = viewPaymentsCompleted.reduce((sum, p) => sum + p.fees_allocated, 0);
 const penaltyCollected = viewPaymentsCompleted.reduce((sum, p) => sum + p.penalty_allocated, 0);
 const risk = riskConfig[loan.risk_classification] ?? riskConfig.current;

 return (
 <div className="space-y-5">
 {loading ? (
 <p className="flex items-center gap-2 text-sm text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Loading schedule, payments, and customer details…
 </p>
 ) : null}

 <div className="grid gap-4 md:grid-cols-3">
 <Card className={`${plainCardClass} md:col-span-2`}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Customer Profile</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2">
 <div>
 <p className="text-xs text-muted-foreground">Customer Name</p>
 <p className="font-medium">
 {customer
 ? `${customer.first_name} ${customer.middle_name ? `${customer.middle_name} ` : ""}${customer.last_name}`
 : loanCustomerLabel(loan) !== "—"
 ? loanCustomerLabel(loan)
 : "Unknown"}
 </p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Phone</p>
 <p className="font-medium">{customer?.phone_primary ?? loan.customerPhone ?? "N/A"}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">National ID</p>
 <p className="font-medium">{customer?.national_id ?? "N/A"}</p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Address</p>
 <p className="font-medium">{customer?.physical_address ?? "N/A"}</p>
 </div>
 </CardContent>
 </Card>
 <Card className={plainCardClass}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Loan &amp; Team</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center gap-2 text-sm">
 <CreditCard className="h-4 w-4 text-muted-foreground" />
 <span className="font-medium">{loanProductLabel(loan)}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <Building2 className="h-4 w-4 text-muted-foreground" />
 <span>{loan.branchName}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <User className="h-4 w-4 text-muted-foreground" />
 <span>{loan.loanOfficerDisplayName}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <CalendarRange className="h-4 w-4 text-muted-foreground" />
 <span>Disbursed: {formatDate(loan.disbursement_date)}</span>
 </div>
 <div className="flex items-center gap-2 text-sm">
 <CalendarRange className="h-4 w-4 text-muted-foreground" />
 <span>Maturity: {formatDate(loan.maturity_date)}</span>
 </div>
 {loan.oldest_overdue_date ? (
 <div className="flex items-center gap-2 text-sm text-destructive">
 <CalendarRange className="h-4 w-4" />
 <span>
 Oldest overdue: {formatDate(loan.oldest_overdue_date)}
 {loan.overdue_amount != null ? ` · ${formatCurrency(loan.overdue_amount)}` : ""}
 </span>
 </div>
 ) : loan.next_due_date ? (
 <div className="flex items-center gap-2 text-sm">
 <CalendarRange className="h-4 w-4 text-muted-foreground" />
 <span>
 Next installment: {formatDate(loan.next_due_date)}
 {loan.next_due_amount != null ? ` · ${formatCurrency(loan.next_due_amount)}` : ""}
 </span>
 </div>
 ) : null}
 </CardContent>
 </Card>
 </div>

 {loan.repayment_details?.bill_pay_number ? (
 <RepaymentInstructionsCard repaymentDetails={loan.repayment_details} />
 ) : null}

 <Card className={plainCardClass}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Loan Pricing</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
 <div>
 <p className="text-xs text-muted-foreground">Installment amount</p>
 <p className="text-2xl font-bold text-primary">
 {formatCurrency(loan.installment_amount)}
 </p>
 </div>
 <div className="text-right">
 <p className="text-xs text-muted-foreground">Total repayment</p>
 <p className="text-2xl font-bold">
 {formatCurrency(loan.total_repayment ?? loan.total_amount)}
 </p>
 </div>
 </div>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Disbursed principal</p>
 <p className="text-lg font-semibold">{formatCurrency(loan.principal_amount)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Interest on principal</p>
 <p className="text-lg font-semibold">
 {formatCurrency(loan.principal_interest_amount ?? loan.interest_amount)}
 </p>
 </div>
 {loan.processing_fee_interest_amount != null && loan.processing_fee_interest_amount > 0 ? (
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Interest on processing fee</p>
 <p className="text-lg font-semibold">
 {formatCurrency(loan.processing_fee_interest_amount)}
 </p>
 </div>
 ) : null}
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Total interest</p>
 <p className="text-lg font-semibold">{formatCurrency(loan.interest_amount)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Total fees</p>
 <p className="text-lg font-semibold">{formatCurrency(loan.total_fees)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Installments</p>
 <p className="text-lg font-semibold">
 {loan.repayment_count ?? (schedule.length > 0 ? schedule.length : "—")}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className={plainCardClass}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Repayment breakdown</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {truth.dataRequiresReview ? (
 <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
 Data requires review — backend status and outstanding balance do not agree on completion.
 </p>
 ) : null}
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Original principal</p>
 <p className="text-lg font-semibold">{formatCurrency(truth.principal)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Contract total</p>
 <p className="text-lg font-semibold">{formatCurrency(truth.contractualTotal)}</p>
 </div>
 <div className="rounded-lg border border-border p-3" title={CONTRACT_PROGRESS_TOOLTIP}>
 <p className="text-xs text-muted-foreground">Contract progress</p>
 <Progress
  value={truth.contractualProgress}
  className={`mt-2 h-2 ${loan.status === "in_arrears" ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : ""}`}
 />
 <p className="mt-1 text-sm font-medium">{truth.contractualProgress.toFixed(2)}%</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Principal paid / outstanding</p>
 <p className="text-lg font-semibold">
 {formatCurrency(truth.principalPaid)} / {formatCurrency(truth.principalOutstanding)}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Interest paid / outstanding</p>
 <p className="text-lg font-semibold">
 {formatCurrency(truth.interestPaid)} / {formatCurrency(truth.interestOutstanding)}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Fees paid / outstanding</p>
 <p className="text-lg font-semibold">
 {formatCurrency(truth.feesPaid)} / {formatCurrency(truth.feesOutstanding)}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Penalties charged / paid / outstanding</p>
 <p className="text-lg font-semibold">
 {formatCurrency(truth.penaltiesCharged)} / {formatCurrency(truth.penaltiesPaid)} /{" "}
 {formatCurrency(truth.penaltyOutstanding)}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Gross cash received</p>
 <p className="text-lg font-semibold">{formatCurrency(grossCashReceived)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Applied to contract</p>
 <p className="text-lg font-semibold">{formatCurrency(truth.contractualPaid)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Total outstanding</p>
 <p className="text-lg font-semibold">{formatCurrency(truth.totalOutstanding)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Backend status</p>
 <p className="text-lg font-semibold">{truth.displayStatus}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Days in arrears</p>
 <p className="text-lg font-semibold">
 {truth.daysInArrears > 0 ? truth.daysInArrears : "—"}
 </p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Daily late penalty</p>
 <p className="text-lg font-semibold">{formatCurrency(loan.daily_penalty_rate ?? 0)}/day</p>
 </div>
 </div>
 {truth.penaltiesCharged > 0 && truth.penaltyOutstanding <= 0.01 ? (
 <p className="text-sm text-muted-foreground">
 All assessed penalties have been paid. These payments did not necessarily reduce principal.
 </p>
 ) : null}
 </CardContent>
 </Card>

 <Card className={plainCardClass}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Balances</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Gross cash received</p>
 <p className="text-lg font-semibold">{formatCurrency(grossCashReceived)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Outstanding balance</p>
 <p className="text-lg font-semibold">{formatCurrency(truth.totalOutstanding)}</p>
 </div>
 <div className="rounded-lg border border-border p-3">
 <p className="text-xs text-muted-foreground">Outstanding penalty</p>
 <p className="text-lg font-semibold text-destructive">
 {formatCurrency(truth.penaltyOutstanding)}
 </p>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4 md:grid-cols-2">
 <Card className={plainCardClass}>
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

 <Card className={plainCardClass}>
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
 <span className="font-medium">{loan.days_in_arrears}</span>
 </p>
 </CardContent>
 </Card>
 </div>

 <Card className={plainCardClass}>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">Repayment Schedule</CardTitle>
 </CardHeader>
 <CardContent className="p-0">
 {schedule.length === 0 ? (
 <p className="px-4 py-6 text-sm text-muted-foreground">No schedule rows found.</p>
 ) : (
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Due date</TableHead>
 <TableHead className="text-right">Contractual installment</TableHead>
 <TableHead className="text-right">Contractual paid</TableHead>
 <TableHead className="text-right">Contractual outstanding</TableHead>
 <TableHead className="text-right">Days overdue</TableHead>
 <TableHead className="text-right">Penalty charged</TableHead>
 <TableHead className="text-right">Penalty paid</TableHead>
 <TableHead className="text-right">Penalty outstanding</TableHead>
 <TableHead className="text-right">Total currently due</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {schedule.map((row) => {
 const installmentTruth = resolveScheduleInstallmentTruth(row);
 return (
 <TableRow key={row.id}>
 <TableCell className="text-sm">{formatDate(row.due_date)}</TableCell>
 <TableCell className="text-right font-medium">
 {formatCurrency(installmentTruth.contractualInstallment)}
 </TableCell>
 <TableCell className="text-right">{formatCurrency(installmentTruth.contractualPaid)}</TableCell>
 <TableCell className="text-right">
 {installmentTruth.contractualOutstanding > 0 ? (
 <span className="font-medium text-destructive">
 {formatCurrency(installmentTruth.contractualOutstanding)}
 </span>
 ) : (
 <span className="text-muted-foreground">{formatCurrency(0)}</span>
 )}
 </TableCell>
 <TableCell className="text-right">
 {row.days_overdue > 0 ? (
 <span className="font-medium text-destructive">{row.days_overdue}</span>
 ) : (
 <span className="text-muted-foreground">0</span>
 )}
 </TableCell>
 <TableCell className="text-right">{formatCurrency(installmentTruth.penaltyCharged)}</TableCell>
 <TableCell className="text-right">{formatCurrency(installmentTruth.penaltyPaid)}</TableCell>
 <TableCell className="text-right">{formatCurrency(installmentTruth.penaltyOutstanding)}</TableCell>
 <TableCell className="text-right font-medium">
 {formatCurrency(installmentTruth.totalCurrentlyDue)}
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 )}
 </CardContent>
 </Card>

 <Card className={plainCardClass}>
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
 );
}
