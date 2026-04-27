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
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

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
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCustomers}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Individual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{individualCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{businessCount}</div>
              </CardContent>
            </Card>
            <Card>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36">
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
                <SelectTrigger className="w-36">
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
            <Button asChild>
              <Link href="/customers/new">
                <Plus className="mr-2 h-4 w-4" />
                New Customer
              </Link>
            </Button>
          </div>

          {/* Customers Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
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
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
