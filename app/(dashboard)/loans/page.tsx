"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Eye,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  User,
  CalendarRange,
  TrendingUp,
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
  loans,
  formatDateTime,
  getCustomerById,
  getProductById,
  getBranchById,
  getCollectionsByLoanId,
  getPaymentsByLoanId,
  getScheduleByLoanId,
  getUserById,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";
import type { Loan, LoanStatus, RiskClassification } from "@/lib/types";

const statusConfig: Record<
  LoanStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle }
> = {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewLoan, setViewLoan] = useState<Loan | null>(null);

  const filteredLoans = loans.filter((loan) => {
    const customer = getCustomerById(loan.customer_id);
    const matchesSearch =
      searchQuery === "" ||
      loan.loan_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.last_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || loan.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = loans.reduce((sum, l) => sum + l.total_outstanding, 0);
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal_amount, 0);
  const activeLoans = loans.filter((l) => l.status === "active").length;
  const inArrearsLoans = loans.filter((l) => l.status === "in_arrears").length;
  const recoveryRate = ((1 - totalOutstanding / totalPrincipal) * 100).toFixed(1);
  const viewCustomer = viewLoan ? getCustomerById(viewLoan.customer_id) : null;
  const viewProduct = viewLoan ? getProductById(viewLoan.product_id) : null;
  const viewBranch = viewLoan ? getBranchById(viewLoan.branch_id) : null;
  const viewOfficer = viewLoan ? getUserById(viewLoan.loan_officer_id ?? viewLoan.disbursed_by) : null;
  const viewPayments = viewLoan ? getPaymentsByLoanId(viewLoan.id).filter((p) => p.status === "completed") : [];
  const viewSchedule = viewLoan ? getScheduleByLoanId(viewLoan.id) : [];
  const viewCollections = viewLoan ? getCollectionsByLoanId(viewLoan.id) : [];
  const paidInstallments = viewSchedule.filter((item) => item.is_paid).length;
  const overdueInstallments = viewSchedule.filter((item) => !item.is_paid && item.days_overdue > 0).length;
  const totalCollected = viewPayments.reduce((sum, p) => sum + p.amount, 0);
  const interestCollected = viewPayments.reduce((sum, p) => sum + p.interest_allocated, 0);
  const feeCollected = viewPayments.reduce((sum, p) => sum + p.fees_allocated, 0);
  const disbursementChartData = viewLoan
    ? [
        { name: "Disbursed", amount: viewLoan.principal_amount },
        { name: "Collected", amount: totalCollected },
        { name: "Interest", amount: viewLoan.interest_amount },
        { name: "Outstanding", amount: viewLoan.total_outstanding },
      ]
    : [];

  return (
    <>
      <DashboardHeader
        title="Active Loans"
        description="View and manage all disbursed loans"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Cards */}
          <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-background shadow-sm sm:hidden dark:border-emerald-900/40 dark:from-emerald-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Loan Disbursement Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                  <p className="text-[11px] text-muted-foreground">Loans</p>
                  <p className="text-lg font-semibold">{loans.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                  <p className="text-[11px] text-muted-foreground">Recovery</p>
                  <p className="text-lg font-semibold">{recoveryRate}%</p>
                </div>
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                  <p className="text-[11px] text-muted-foreground">Disbursed</p>
                  <p className="text-sm font-semibold">{formatCurrency(totalPrincipal)}</p>
                </div>
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
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
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Loans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loans.length}</div>
                <p className="text-sm text-muted-foreground">
                  {activeLoans} active, {inArrearsLoans} in arrears
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalOutstanding)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Disbursed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalPrincipal)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recovery Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">
                  {recoveryRate}%
                </div>
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
                  {filteredLoans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        No loans found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLoans.map((loan) => {
                      const customer = getCustomerById(loan.customer_id);
                      const product = getProductById(loan.product_id);
                      const status = statusConfig[loan.status];
                      const risk = riskConfig[loan.risk_classification];
                      const StatusIcon = status.icon;
                      const paidPercent = (loan.total_paid / loan.total_amount) * 100;

                      return (
                        <TableRow key={loan.id}>
                          <TableCell className="font-mono text-sm">
                            {loan.loan_number}
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
                          <TableCell>{product?.name}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(loan.principal_amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(loan.total_outstanding)}
                          </TableCell>
                          <TableCell>
                            <div className="w-24">
                              <Progress value={paidPercent} className="h-2" />
                              <p className="mt-1 text-xs text-muted-foreground">
                                {paidPercent.toFixed(0)}% paid
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
                              <div className={`h-2 w-2 rounded-full ${risk.color}`} />
                              <span className="text-sm">{risk.label}</span>
                              {loan.days_in_arrears > 0 && (
                                <span className="text-xs text-destructive">
                                  ({loan.days_in_arrears}d)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(loan.maturity_date)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setViewLoan(loan)}>
                                  <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/payments?loan=${loan.id}&openPayment=1`}>
                                  <CreditCard className="h-4 w-4" />
                                </Link>
                              </Button>
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
        <DialogContent className="max-h-[90vh] overflow-hidden border-emerald-200/60 bg-gradient-to-b from-emerald-50/60 via-background to-background sm:max-w-4xl dark:border-emerald-900/40 dark:from-emerald-950/15">
          {viewLoan ? (
            <>
              <DialogHeader className="rounded-md border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/10">
                <DialogTitle className="text-xl">
                  Loan Disbursement Details - {viewLoan.loan_number}
                </DialogTitle>
                <DialogDescription>
                  Complete customer, disbursement, collections, and credit analysis view.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[72vh] pr-4">
                <div className="space-y-5 pb-3">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background md:col-span-2 dark:border-emerald-900/35 dark:from-emerald-950/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Customer Profile</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Customer Name</p>
                          <p className="font-medium">
                            {viewCustomer ? `${viewCustomer.first_name} ${viewCustomer.last_name}` : "Unknown"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-medium">{viewCustomer?.phone_primary ?? "N/A"}</p>
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
                    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background dark:border-emerald-900/35 dark:from-emerald-950/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Application Team</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{viewBranch?.name ?? "Unknown Branch"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{viewOfficer?.full_name ?? "Unknown Officer"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarRange className="h-4 w-4 text-muted-foreground" />
                          <span>Disbursed: {formatDate(viewLoan.disbursement_date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarRange className="h-4 w-4 text-muted-foreground" />
                          <span>Due: {formatDate(viewLoan.maturity_date)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background dark:border-emerald-900/35 dark:from-emerald-950/10">
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
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-xs text-muted-foreground">Disbursed Principal</p>
                          <p className="text-lg font-semibold">{formatCurrency(viewLoan.principal_amount)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-xs text-muted-foreground">Collections to Date</p>
                          <p className="text-lg font-semibold">{formatCurrency(totalCollected)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-xs text-muted-foreground">Interest Amount</p>
                          <p className="text-lg font-semibold">{formatCurrency(viewLoan.interest_amount)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200/70 bg-emerald-100/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
                          <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                          <p className="text-lg font-semibold">{formatCurrency(viewLoan.total_outstanding)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background dark:border-emerald-900/35 dark:from-emerald-950/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Collection Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p className="flex justify-between">
                          <span className="text-muted-foreground">Payment records</span>
                          <span className="font-medium">{viewPayments.length}</span>
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
                          <span className="text-muted-foreground">Last collection date</span>
                          <span className="font-medium">
                            {viewPayments[viewPayments.length - 1]
                              ? formatDateTime(viewPayments[viewPayments.length - 1].payment_date)
                              : "No payment yet"}
                          </span>
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/55 to-background dark:border-emerald-900/35 dark:from-emerald-950/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Loan Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p className="flex justify-between">
                          <span className="text-muted-foreground">Risk classification</span>
                          <span className="font-medium">{riskConfig[viewLoan.risk_classification].label}</span>
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
                          <span className="text-muted-foreground">Collection actions logged</span>
                          <span className="font-medium">{viewCollections.length}</span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-muted-foreground">Days in arrears</span>
                          <span className="font-medium">{viewLoan.days_in_arrears}</span>
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
