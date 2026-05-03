"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, Users, FileText, Wallet, BarChart3 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getGroupById,
  getUserById,
  getCustomerById,
  getProductById,
  loanApplications,
  loans,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);
  const group = getGroupById(resolved.id);

  if (!group) {
    return (
      <>
        <DashboardHeader title="Group Not Found" />
        <main className="flex-1 p-6">
          <Button asChild>
            <Link href="/groups">Back to Groups</Link>
          </Button>
        </main>
      </>
    );
  }

  const officer = getUserById(group.loan_officer_id);
  const members = group.member_customer_ids
    .map((memberId) => getCustomerById(memberId))
    .filter(Boolean);
  const groupLoans = loans.filter((loan) => loan.group_id === group.id || members.some((m) => m?.id === loan.customer_id));
  const groupApplications = loanApplications.filter((app) => app.group_id === group.id);
  const totalOutstanding = groupLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
  const totalPrincipal = groupLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);

  return (
    <>
      <DashboardHeader
        title={group.group_name}
        description="Kikundi profile, members, group lending portfolio, and reports"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/groups">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Groups
            </Link>
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Vikundi Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="font-semibold">{group.group_name}</p>
                <p className="text-muted-foreground font-mono">{group.group_code}</p>
                <Badge variant={group.status === "active" ? "default" : "secondary"}>{group.status}</Badge>
                <p>Meeting day: {group.meeting_day}</p>
                <p>Meeting location: {group.meeting_location}</p>
                <p>Street/Village: {group.village_or_street}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Loan Officer: {officer?.full_name ?? "-"}
                </p>
                <p>Formation date: {formatDate(group.formation_date)}</p>
                <p>Chairperson: {getCustomerById(group.chairperson_customer_id)?.first_name} {getCustomerById(group.chairperson_customer_id)?.last_name}</p>
                <p>Secretary: {group.secretary_customer_id ? `${getCustomerById(group.secretary_customer_id)?.first_name} ${getCustomerById(group.secretary_customer_id)?.last_name}` : "-"}</p>
                <p>Treasurer: {group.treasurer_customer_id ? `${getCustomerById(group.treasurer_customer_id)?.first_name} ${getCustomerById(group.treasurer_customer_id)?.last_name}` : "-"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{members.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Group Loans</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{groupLoans.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Principal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalPrincipal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Kikundi Members
              </CardTitle>
              <CardDescription>View members and each member's loan portfolio.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Risk Grade</TableHead>
                    <TableHead className="text-right">Individual Loans</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Monthly Income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const memberLoans = loans.filter((loan) => loan.customer_id === member!.id);
                    const memberOutstanding = memberLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
                    return (
                      <TableRow key={member!.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {member!.first_name} {member!.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">{member!.customer_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{member!.risk_grade}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{memberLoans.length}</TableCell>
                        <TableCell className="text-right">{formatCurrency(memberOutstanding)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(member!.monthly_income)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Group Loan Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupLoans.map((loan) => {
                      const member = getCustomerById(loan.customer_id);
                      const product = getProductById(loan.product_id);
                      return (
                        <TableRow key={loan.id}>
                          <TableCell className="font-mono text-xs">{loan.loan_number}</TableCell>
                          <TableCell>{member?.first_name} {member?.last_name}</TableCell>
                          <TableCell>{product?.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.total_outstanding)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Group Reports
                </CardTitle>
                <CardDescription>Key aggregated indicators for this vikundi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Applications from this group</span>
                  <span className="font-semibold">{groupApplications.length}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active loans</span>
                  <span className="font-semibold">
                    {groupLoans.filter((loan) => loan.status === "active" || loan.status === "in_arrears").length}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">In-arrears loans</span>
                  <span className="font-semibold">
                    {groupLoans.filter((loan) => loan.status === "in_arrears").length}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Portfolio recovery rate</span>
                  <span className="font-semibold">
                    {totalPrincipal > 0
                      ? `${((groupLoans.reduce((sum, loan) => sum + loan.total_paid, 0) / totalPrincipal) * 100).toFixed(1)}%`
                      : "0.0%"}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span className="text-muted-foreground">Average member exposure</span>
                  <span className="font-semibold">
                    {members.length > 0 ? formatCurrency(totalOutstanding / members.length) : formatCurrency(0)}
                  </span>
                </p>
                <p className="pt-2 text-muted-foreground">
                  {group.notes || "No additional group notes recorded."}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Group Loan Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupApplications.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No applications recorded for this group.
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupApplications.map((application) => (
                      <TableRow key={application.id}>
                        <TableCell className="font-mono text-xs">{application.application_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{application.status.replaceAll("_", " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(application.requested_amount)}</TableCell>
                        <TableCell>{formatDate(application.created_at)}</TableCell>
                      </TableRow>
                    ))
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
