"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  UserCog,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
  FileText,
  CalendarClock,
  TrendingUp,
  Activity,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  users,
  branches,
  customers,
  loanApplications,
  loans,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/mock-data";

type Timeframe = "7d" | "30d" | "90d" | "ytd" | "all";

export default function StaffProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const staff = users.find((user) => user.id === resolvedParams.id);

  const referenceDate = useMemo(() => {
    const timestamps = [
      ...loanApplications.map((app) => new Date(app.updated_at).getTime()),
      ...loans.map((loan) => new Date(loan.updated_at).getTime()),
      ...customers.map((customer) => new Date(customer.updated_at).getTime()),
    ].filter((time) => Number.isFinite(time));
    return new Date(Math.max(...timestamps));
  }, []);

  const inTimeframe = (dateString: string) => {
    if (timeframe === "all") return true;
    const current = new Date(dateString);
    if (Number.isNaN(current.getTime())) return false;

    if (timeframe === "ytd") {
      const yearStart = new Date(referenceDate.getUTCFullYear(), 0, 1);
      return current.getTime() >= yearStart.getTime() && current.getTime() <= referenceDate.getTime();
    }

    const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 90;
    const lowerBound = new Date(referenceDate);
    lowerBound.setUTCDate(lowerBound.getUTCDate() - days);
    return current.getTime() >= lowerBound.getTime() && current.getTime() <= referenceDate.getTime();
  };

  if (!staff) {
    return (
      <>
        <DashboardHeader title="Staff Not Found" />
        <main className="flex-1 p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Staff profile not found.</p>
            <Button asChild className="mt-4">
              <Link href="/users">Back to User Management</Link>
            </Button>
          </div>
        </main>
      </>
    );
  }

  const staffBranch = branches.find((branch) => branch.id === staff.branch_id);

  const linkedCustomers = customers.filter((customer) => customer.created_by === staff.id);
  const linkedCustomersInRange = linkedCustomers.filter((customer) => inTimeframe(customer.created_at));

  const processedApplications = loanApplications.filter(
    (application) =>
      application.created_by === staff.id ||
      application.reviewed_by === staff.id ||
      application.approved_by === staff.id
  );
  const processedApplicationsInRange = processedApplications.filter((application) =>
    inTimeframe(application.updated_at)
  );

  const disbursedLoans = loans.filter((loan) => loan.disbursed_by === staff.id);
  const disbursedLoansInRange = disbursedLoans.filter((loan) => inTimeframe(loan.disbursement_date));

  const totalProcessedVolume = processedApplicationsInRange.reduce(
    (sum, app) => sum + (app.approved_amount ?? app.requested_amount),
    0
  );
  const approvalsInRange = processedApplicationsInRange.filter((app) => app.status === "approved").length;
  const rejectionsInRange = processedApplicationsInRange.filter((app) => app.status === "rejected").length;
  const disbursementVolume = disbursedLoansInRange.reduce((sum, loan) => sum + loan.principal_amount, 0);

  return (
    <>
      <DashboardHeader
        title="Staff Profile"
        description="Admin review of performance, portfolio, and linked entities"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/users">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to User Management
              </Link>
            </Button>
            <div className="w-48">
              <Select value={timeframe} onValueChange={(value) => setTimeframe(value as Timeframe)}>
                <SelectTrigger>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="ytd">Year to date</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Full Staff Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-base">{staff.full_name}</p>
                <p className="text-muted-foreground">Employee ID: {staff.employee_id}</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="capitalize">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {staff.role.replaceAll("_", " ")}
                  </Badge>
                  <Badge variant={staff.is_active ? "default" : "secondary"}>
                    {staff.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {staff.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {staff.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {staffBranch?.name ?? "Unknown Branch"}
                </p>
                <p className="text-muted-foreground">
                  Joined: {formatDate(staff.created_at)} | Last Login:{" "}
                  {staff.last_login ? formatDateTime(staff.last_login) : "Never"}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Processed Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{processedApplicationsInRange.length}</p>
                <p className="text-xs text-muted-foreground">Within selected timeframe</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Approval / Rejection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {approvalsInRange} / {rejectionsInRange}
                </p>
                <p className="text-xs text-muted-foreground">Decision outcomes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Processed Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalProcessedVolume)}</p>
                <p className="text-xs text-muted-foreground">Applications value handled</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Disbursement Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(disbursementVolume)}</p>
                <p className="text-xs text-muted-foreground">Loans disbursed in range</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Loans Processed by Staff
                </CardTitle>
                <CardDescription>
                  Applications created/reviewed/approved and loans disbursed by this staff member
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Loan Applications</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Application</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {processedApplicationsInRange.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No applications in selected timeframe
                          </TableCell>
                        </TableRow>
                      ) : (
                        processedApplicationsInRange.slice(0, 6).map((application) => (
                          <TableRow key={application.id}>
                            <TableCell className="font-mono text-xs">
                              {application.application_number}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{application.status.replaceAll("_", " ")}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(application.approved_amount ?? application.requested_amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Disbursed Loans</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disbursedLoansInRange.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No disbursements in selected timeframe
                          </TableCell>
                        </TableRow>
                      ) : (
                        disbursedLoansInRange.slice(0, 6).map((loan) => (
                          <TableRow key={loan.id}>
                            <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{loan.status.replaceAll("_", " ")}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(loan.principal_amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customers Linked to Staff
                </CardTitle>
                <CardDescription>
                  Customers created and managed by this staff member
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedCustomersInRange.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No linked customers in selected timeframe
                        </TableCell>
                      </TableRow>
                    ) : (
                      linkedCustomersInRange.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {customer.first_name} {customer.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{customer.customer_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{customer.risk_grade}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{customer.customer_type}</TableCell>
                          <TableCell>{formatDate(customer.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Reports
              </CardTitle>
              <CardDescription>
                Filtered performance summary for the selected timeframe ({timeframe.toUpperCase()})
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Customers Linked</p>
                <p className="mt-1 text-xl font-semibold">{linkedCustomersInRange.length}</p>
                <p className="text-xs text-muted-foreground">Total all-time: {linkedCustomers.length}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Applications Handled</p>
                <p className="mt-1 text-xl font-semibold">{processedApplicationsInRange.length}</p>
                <p className="text-xs text-muted-foreground">
                  Total all-time: {processedApplications.length}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Loan Disbursements</p>
                <p className="mt-1 text-xl font-semibold">{disbursedLoansInRange.length}</p>
                <p className="text-xs text-muted-foreground">Total all-time: {disbursedLoans.length}</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Productivity Signal</p>
                <p className="mt-1 text-xl font-semibold">
                  <Activity className="mr-1 inline h-4 w-4" />
                  {processedApplicationsInRange.length + linkedCustomersInRange.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  Combined customer + application activity
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
