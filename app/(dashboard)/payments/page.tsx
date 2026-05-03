"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  payments,
  loans,
  getCustomerById,
  formatCurrency,
  formatDateTime,
} from "@/lib/mock-data";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/types";

type PaymentRow = Payment & { updated_at?: string };

type ReconciliationStatus = "matched" | "underpaid" | "overpaid" | "manual_review" | "unmatched";

interface BankRecord {
  id: string;
  reference_number: string;
  amount: number;
  payment_method: PaymentMethod;
  source: "bank_statement" | "mobile_settlement" | "cash_sheet";
}

const methodConfig: Record<PaymentMethod, { label: string; icon: typeof CreditCard }> = {
  cash: { label: "Cash", icon: Banknote },
  mobile_money: { label: "Mobile Money", icon: Smartphone },
  bank_transfer: { label: "Bank Transfer", icon: Building2 },
  cheque: { label: "Cheque", icon: CreditCard },
};

const statusConfig: Record<PaymentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  completed: { label: "Completed", variant: "default", icon: CheckCircle },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  reversed: { label: "Reversed", variant: "outline", icon: XCircle },
};

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReconDialogOpen, setIsReconDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [requestedLoanId, setRequestedLoanId] = useState<string | null>(null);
  const [openPaymentForm, setOpenPaymentForm] = useState<string | null>(null);
  const [recordedPayments, setRecordedPayments] = useState<PaymentRow[]>(() => [...payments]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [collectionChannel, setCollectionChannel] = useState<"system" | "manual_collection">("system");
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [selectedBankRecordId, setSelectedBankRecordId] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");

  const bankRecords: BankRecord[] = [
    {
      id: "bank-rec-001",
      reference_number: "MM-TIG-123456789",
      amount: 793334,
      payment_method: "mobile_money",
      source: "mobile_settlement",
    },
    {
      id: "bank-rec-002",
      reference_number: "MM-MPESA-987654321",
      amount: 793334,
      payment_method: "mobile_money",
      source: "mobile_settlement",
    },
    {
      id: "bank-rec-003",
      reference_number: "NMB-TXN-2024-001",
      amount: 823333,
      payment_method: "bank_transfer",
      source: "bank_statement",
    },
    {
      id: "bank-rec-004",
      reference_number: "CASH-2024-001",
      amount: 510000,
      payment_method: "cash",
      source: "cash_sheet",
    },
    {
      id: "bank-rec-005",
      reference_number: "MM-AIRTEL-NEW-404",
      amount: 650000,
      payment_method: "mobile_money",
      source: "mobile_settlement",
    },
  ];

  const filteredPayments = recordedPayments.filter((payment) => {
    const customer = getCustomerById(payment.customer_id);
    const matchesSearch =
      searchQuery === "" ||
      payment.payment_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.last_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMethod = methodFilter === "all" || payment.payment_method === methodFilter;

    return matchesSearch && matchesMethod;
  });

  const totalCollected = recordedPayments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const todayCollections = recordedPayments
    .filter((p) => {
      const paymentDate = new Date(p.payment_date).toDateString();
      const today = new Date().toDateString();
      return paymentDate === today && p.status === "completed";
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const getReconciliationStatus = (
    payment: PaymentRow
  ): {
    status: ReconciliationStatus;
    variance: number;
    matchedAmount: number | null;
    note: string;
  } => {
    const bankMatch = bankRecords.find((record) => record.reference_number === payment.reference_number);
    const expectedAmount = payment.principal_allocated + payment.interest_allocated + payment.fees_allocated;

    if (payment.notes?.includes("[MANUAL_COLLECTION]")) {
      if (!bankMatch) {
        return {
          status: "manual_review",
          variance: 0,
          matchedAmount: null,
          note: "Manual collection recorded by loan officer; bank verification pending.",
        };
      }
    }

    if (!bankMatch) {
      return {
        status: "unmatched",
        variance: payment.amount,
        matchedAmount: null,
        note: "No bank/account record found for this payment reference.",
      };
    }

    const variance = bankMatch.amount - payment.amount;
    if (variance < 0) {
      return {
        status: "overpaid",
        variance,
        matchedAmount: bankMatch.amount,
        note: `Recorded amount is higher than bank record by ${formatCurrency(Math.abs(variance))}.`,
      };
    }
    if (variance > 0) {
      return {
        status: "underpaid",
        variance,
        matchedAmount: bankMatch.amount,
        note: `Recorded amount is lower than bank record by ${formatCurrency(variance)}.`,
      };
    }

    const expectedVariance = payment.amount - expectedAmount;
    return {
      status: "matched",
      variance: expectedVariance,
      matchedAmount: bankMatch.amount,
      note:
        expectedVariance === 0
          ? "Recorded payment matches both allocation and bank/account records."
          : `Bank matched; allocation variance is ${formatCurrency(expectedVariance)}.`,
    };
  };

  const reconciliationSummary = recordedPayments.reduce(
    (acc, payment) => {
      const result = getReconciliationStatus(payment);
      acc[result.status] += 1;
      return acc;
    },
    { matched: 0, underpaid: 0, overpaid: 0, manual_review: 0, unmatched: 0 } as Record<
      ReconciliationStatus,
      number
    >
  );

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

  const activeLoans = loans.filter(
    (l) => l.status === "active" || l.status === "in_arrears"
  );
  const selectedLoanDetails = selectedLoan
    ? loans.find((loan) => loan.id === selectedLoan)
    : undefined;
  const selectedCustomer = selectedLoanDetails
    ? getCustomerById(selectedLoanDetails.customer_id)
    : undefined;
  const preselectedLoan = useMemo(
    () => (requestedLoanId ? loans.find((loan) => loan.id === requestedLoanId) : undefined),
    [requestedLoanId]
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
    if (!paymentAmount) {
      setPaymentAmount(String(preselectedLoan.installment_amount));
    }
    if (openPaymentForm === "1") {
      setIsDialogOpen(true);
    }
  }, [preselectedLoan, openPaymentForm, paymentAmount]);

  const handleRecordPayment = () => {
    if (!selectedLoan || !paymentAmount || !referenceNumber) return;
    const selectedLoanData = loans.find((loan) => loan.id === selectedLoan);
    if (!selectedLoanData) return;
    const amount = Number(paymentAmount);
    const customerId = selectedLoanData.customer_id;
    // In production, this would call an API
    console.log("Recording payment:", {
      loanId: selectedLoan,
      amount: paymentAmount,
      method: paymentMethod,
      reference: referenceNumber,
      channel: collectionChannel,
    });
    setRecordedPayments((prev) => [
      {
        id: `pay-new-${prev.length + 1}`,
        payment_number: `PAY-NEW-${String(prev.length + 1).padStart(4, "0")}`,
        loan_id: selectedLoan,
        customer_id: customerId,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        principal_allocated: Math.round(amount * 0.8),
        interest_allocated: Math.round(amount * 0.17),
        fees_allocated: amount - Math.round(amount * 0.8) - Math.round(amount * 0.17),
        penalty_allocated: 0,
        status: "completed",
        payment_date: new Date().toISOString(),
        notes:
          collectionChannel === "manual_collection"
            ? "[MANUAL_COLLECTION] Captured by loan officer in the field."
            : "Captured through standard system flow.",
        received_by: "usr-003",
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setIsDialogOpen(false);
    setSelectedLoan("");
    setPaymentAmount("");
    setReferenceNumber("");
    setCollectionChannel("system");
  };

  const handleManualReconciliation = () => {
    if (!selectedPaymentId || !selectedBankRecordId) return;
    const bankRecord = bankRecords.find((record) => record.id === selectedBankRecordId);
    if (!bankRecord) return;
    setRecordedPayments((prev) =>
      prev.map((payment) =>
        payment.id === selectedPaymentId
          ? {
              ...payment,
              reference_number: bankRecord.reference_number,
              notes: `${payment.notes ?? ""} [RECONCILED] ${reconciliationNote || "Manually matched with bank statement."}`.trim(),
              updated_at: new Date().toISOString(),
            }
          : payment
      )
    );
    setIsReconDialogOpen(false);
    setSelectedPaymentId("");
    setSelectedBankRecordId("");
    setReconciliationNote("");
  };

  return (
    <>
      <DashboardHeader
        title="Payments"
        description="Record and track loan payments"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recordedPayments.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">
                  {formatCurrency(totalCollected)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today&apos;s Collections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(todayCollections)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {recordedPayments.filter((p) => p.status === "pending").length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Payment Reconciliation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Matched</p>
                <p className="text-xl font-semibold">{reconciliationSummary.matched}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Underpaid</p>
                <p className="text-xl font-semibold text-destructive">
                  {reconciliationSummary.underpaid}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Overpaid</p>
                <p className="text-xl font-semibold">{reconciliationSummary.overpaid}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Manual Review</p>
                <p className="text-xl font-semibold">{reconciliationSummary.manual_review}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Unmatched Bank Record</p>
                <p className="text-xl font-semibold text-destructive">
                  {reconciliationSummary.unmatched}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filters and Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 gap-3">
              <div className="relative flex-1 max-w-sm">
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
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Dialog open={isReconDialogOpen} onOpenChange={setIsReconDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Reconcile Manual Collections</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manual Reconciliation</DialogTitle>
                    <DialogDescription>
                      Match manual/exception payments to bank or account records and save an audit note.
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup className="py-4">
                    <Field>
                      <FieldLabel>Recorded Payment</FieldLabel>
                      <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select recorded payment" />
                        </SelectTrigger>
                        <SelectContent>
                          {recordedPayments.map((payment) => (
                            <SelectItem key={payment.id} value={payment.id}>
                              {payment.payment_number} ({formatCurrency(payment.amount)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Bank / Account Record</FieldLabel>
                      <Select value={selectedBankRecordId} onValueChange={setSelectedBankRecordId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select bank/account record" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankRecords.map((record) => (
                            <SelectItem key={record.id} value={record.id}>
                              {record.reference_number} ({formatCurrency(record.amount)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Reconciliation Note</FieldLabel>
                      <Input
                        value={reconciliationNote}
                        onChange={(e) => setReconciliationNote(e.target.value)}
                        placeholder="Reason / evidence for reconciliation"
                      />
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsReconDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleManualReconciliation}
                      disabled={!selectedPaymentId || !selectedBankRecordId}
                    >
                      Confirm Reconciliation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record New Payment</DialogTitle>
                    <DialogDescription>
                      {selectedCustomer
                        ? `Record payment for ${selectedCustomer.first_name} ${selectedCustomer.last_name} (${selectedLoanDetails?.loan_number}).`
                        : "Record a payment received from a customer"}
                    </DialogDescription>
                  </DialogHeader>
                  <FieldGroup className="py-4">
                    <Field>
                      <FieldLabel>Select Loan</FieldLabel>
                      <Select value={selectedLoan} onValueChange={setSelectedLoan}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a loan" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeLoans.map((loan) => {
                            const customer = getCustomerById(loan.customer_id);
                            return (
                              <SelectItem key={loan.id} value={loan.id}>
                                {loan.loan_number} - {customer?.first_name} {customer?.last_name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Amount (TZS)</FieldLabel>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Payment Method</FieldLabel>
                      <Select
                        value={paymentMethod}
                        onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                      >
                        <SelectTrigger>
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
                    <Field>
                      <FieldLabel>Collection Channel</FieldLabel>
                      <Select
                        value={collectionChannel}
                        onValueChange={(v) => setCollectionChannel(v as "system" | "manual_collection")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">System Captured</SelectItem>
                          <SelectItem value="manual_collection">Manual Collection (Loan Officer)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Reference Number</FieldLabel>
                      <Input
                        placeholder="Transaction reference"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRecordPayment} disabled={!selectedLoan || !paymentAmount || !referenceNumber}>
                      Record Payment
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Payments Table */}
          <Card>
            <CardContent className="p-0">
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
                      const customer = getCustomerById(payment.customer_id);
                      const loan = loans.find((l) => l.id === payment.loan_id);
                      const method = methodConfig[payment.payment_method];
                      const status = statusConfig[payment.status];
                      const reconciliation = getReconciliationStatus(payment);
                      const reconciliationUi = reconciliationVariant[reconciliation.status];
                      const MethodIcon = method.icon;
                      const StatusIcon = status.icon;
                      const ReconciliationIcon = reconciliationUi.icon;

                      return (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-sm">
                            {payment.payment_number}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {customer?.first_name} {customer?.last_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {customer?.phone_primary}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {loan?.loan_number}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MethodIcon className="h-4 w-4 text-muted-foreground" />
                              <span>{method.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.reference_number}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
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
                              <p className="text-xs text-muted-foreground max-w-56">
                                {reconciliation.note}
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
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
