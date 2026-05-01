"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import type { PaymentMethod, PaymentStatus } from "@/lib/types";

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
  const [selectedLoan, setSelectedLoan] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [requestedLoanId, setRequestedLoanId] = useState<string | null>(null);
  const [openPaymentForm, setOpenPaymentForm] = useState<string | null>(null);

  const filteredPayments = payments.filter((payment) => {
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

  const totalCollected = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const todayCollections = payments
    .filter((p) => {
      const paymentDate = new Date(p.payment_date).toDateString();
      const today = new Date().toDateString();
      return paymentDate === today && p.status === "completed";
    })
    .reduce((sum, p) => sum + p.amount, 0);

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
    // In production, this would call an API
    console.log("Recording payment:", {
      loanId: selectedLoan,
      amount: paymentAmount,
      method: paymentMethod,
    });
    setIsDialogOpen(false);
    setSelectedLoan("");
    setPaymentAmount("");
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
                <div className="text-2xl font-bold">{payments.length}</div>
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
                  {payments.filter((p) => p.status === "pending").length}
                </div>
              </CardContent>
            </Card>
          </div>

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
                      <FieldLabel>Reference Number</FieldLabel>
                      <Input placeholder="Transaction reference" />
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleRecordPayment}>Record Payment</Button>
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
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => {
                      const customer = getCustomerById(payment.customer_id);
                      const loan = loans.find((l) => l.id === payment.loan_id);
                      const method = methodConfig[payment.payment_method];
                      const status = statusConfig[payment.status];
                      const MethodIcon = method.icon;
                      const StatusIcon = status.icon;

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
