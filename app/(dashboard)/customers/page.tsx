"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  AlertTriangle,
  Sparkles,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  customers,
  getLoansByCustomerId,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";
import type { RiskGrade } from "@/lib/types";

const riskGradeConfig: Record<RiskGrade, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  A: { label: "Grade A", variant: "default" },
  B: { label: "Grade B", variant: "secondary" },
  C: { label: "Grade C", variant: "outline" },
  D: { label: "Grade D", variant: "destructive" },
  E: { label: "Grade E", variant: "destructive" },
};

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      searchQuery === "" ||
      customer.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.customer_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone_primary.includes(searchQuery) ||
      customer.national_id.includes(searchQuery);

    const matchesType = typeFilter === "all" || customer.customer_type === typeFilter;
    const matchesRisk = riskFilter === "all" || customer.risk_grade === riskFilter;

    return matchesSearch && matchesType && matchesRisk;
  });

  const totalCustomers = customers.length;
  const individualCount = customers.filter((c) => c.customer_type === "individual").length;
  const businessCount = customers.filter((c) => c.customer_type === "business").length;
  const blacklistedCount = customers.filter((c) => c.is_blacklisted).length;

  return (
    <>
      <DashboardHeader
        title="Customer Management"
        description="View and manage customer profiles"
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 pb-10 lg:p-6 lg:pb-8">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-background to-background p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Customer Portfolio
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Monitor and manage customer records</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Search, filter and review customer profiles with branch-ready insights.
                </p>
              </div>
              <Badge className="w-fit shrink-0 border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                <Sparkles className="mr-1 h-3 w-3" />
                Professional View
              </Badge>
            </div>
          </div>

          {/* Summary Cards */}
          <Card className="sm:hidden border-emerald-100 bg-emerald-50/60">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Customer Summary</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-semibold">{totalCustomers}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Individual</p>
                  <p className="text-lg font-semibold">{individualCount}</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Business</p>
                  <p className="text-lg font-semibold">{businessCount}</p>
                </div>
                <div className="rounded-lg border border-destructive/20 bg-background p-3">
                  <p className="text-xs text-muted-foreground">Blacklisted</p>
                  <p className="text-lg font-semibold text-destructive">{blacklistedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-emerald-100 bg-emerald-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCustomers}</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-700" />
                  Individual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{individualCount}</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-700" />
                  Business
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{businessCount}</div>
              </CardContent>
            </Card>
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Blacklisted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{blacklistedCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Actions */}
          <Card className="border-emerald-100">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="relative min-w-0 flex-1 sm:min-w-[200px] sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue placeholder="Risk Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  <SelectItem value="A">Grade A</SelectItem>
                  <SelectItem value="B">Grade B</SelectItem>
                  <SelectItem value="C">Grade C</SelectItem>
                  <SelectItem value="D">Grade D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button asChild className="w-full shrink-0 sm:w-auto">
              <Link href="/customers/new">
                <Plus className="mr-2 h-4 w-4" />
                New Customer
              </Link>
            </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customers Table */}
          <Card className="overflow-hidden border-emerald-100">
            <CardContent className="p-0">
              <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [touch-action:pan-x]">
                <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="bg-emerald-50/70 hover:bg-emerald-50/70">
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Monthly Income</TableHead>
                    <TableHead>Risk Grade</TableHead>
                    <TableHead>Active Loans</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const risk = riskGradeConfig[customer.risk_grade];
                      const customerLoans = getLoansByCustomerId(customer.id);
                      const activeLoans = customerLoans.filter(
                        (l) => l.status === "active" || l.status === "in_arrears"
                      );
                      const totalOutstanding = activeLoans.reduce(
                        (sum, l) => sum + l.total_outstanding,
                        0
                      );

                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                  {customer.first_name[0]}
                                  {customer.last_name[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {customer.first_name} {customer.last_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {customer.customer_number}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {customer.phone_primary}
                              </div>
                              {customer.email && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {customer.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {customer.customer_type === "business" ? (
                                <Building2 className="mr-1 h-3 w-3" />
                              ) : (
                                <User className="mr-1 h-3 w-3" />
                              )}
                              {customer.customer_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {customer.district}, {customer.region}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(customer.monthly_income)}
                            {customer.income_verified && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Verified
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={risk.variant}>{risk.label}</Badge>
                            {customer.credit_score && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({customer.credit_score})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {activeLoans.length > 0 ? (
                              <div>
                                <p className="font-medium">{activeLoans.length} loan(s)</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(totalOutstanding)} outstanding
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(customer.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/customers/${customer.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
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
    </>
  );
}
