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
import { Progress } from "@/components/ui/progress";
import {
  loans,
  currentUser,
  getCustomerById,
  getProductById,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";
import type { LoanStatus, RiskClassification } from "@/lib/types";

type LoanViewRole = "loan_officer" | "branch_manager" | "super_admin";

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
  const roleDefault: LoanViewRole =
    currentUser.role === "super_admin" ||
    currentUser.role === "branch_manager" ||
    currentUser.role === "loan_officer"
      ? currentUser.role
      : "loan_officer";
  const [actingRole, setActingRole] = useState<LoanViewRole>(roleDefault);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const scopedLoans =
    actingRole === "super_admin"
      ? loans
      : loans.filter((loan) => loan.branch_id === currentUser.branch_id);

  const filteredLoans = scopedLoans.filter((loan) => {
    const customer = getCustomerById(loan.customer_id);
    const matchesSearch =
      searchQuery === "" ||
      loan.loan_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.last_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || loan.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = scopedLoans.reduce((sum, l) => sum + l.total_outstanding, 0);
  const totalPrincipal = scopedLoans.reduce((sum, l) => sum + l.principal_amount, 0);
  const activeLoans = scopedLoans.filter((l) => l.status === "active").length;
  const inArrearsLoans = scopedLoans.filter((l) => l.status === "in_arrears").length;

  return (
    <>
      <DashboardHeader
        title="Active Loans"
        description="View and manage all disbursed loans"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Loans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scopedLoans.length}</div>
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
                  {totalPrincipal > 0 ? ((1 - totalOutstanding / totalPrincipal) * 100).toFixed(1) : "0.0"}%
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
              <Select value={actingRole} onValueChange={(value) => setActingRole(value as LoanViewRole)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Loan visibility role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan_officer">Loan Officer View</SelectItem>
                  <SelectItem value="branch_manager">Manager View</SelectItem>
                  <SelectItem value="super_admin">Top Admin View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              {actingRole === "super_admin"
                ? "Top Admin view: showing all loans across all branches."
                : "Branch view: showing loans for your branch only. Switch to Top Admin to view all loans."}
            </CardContent>
          </Card>

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
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/loans/${loan.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/payments?loan=${loan.id}`}>
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
    </>
  );
}
