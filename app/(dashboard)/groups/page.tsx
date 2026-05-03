"use client";

import Link from "next/link";
import { Users, UserCheck, MapPin, Wallet } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  loanGroups,
  getBranchById,
  getCustomerById,
  getUserById,
  loans,
  formatCurrency,
  formatDate,
} from "@/lib/mock-data";

export default function GroupsPage() {
  const activeGroups = loanGroups.filter((group) => group.status === "active").length;
  const totalMembers = loanGroups.reduce((sum, group) => sum + group.member_customer_ids.length, 0);
  const groupLoans = loans.filter((loan) => loan.loan_mode === "group_based");
  const groupLoanValue = groupLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);

  return (
    <>
      <DashboardHeader
        title="Vikundi / Vikoba"
        description="Manage group-based lending, members, officers, and portfolio"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{loanGroups.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{activeGroups}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Group Loan Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(groupLoanValue)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Loan Officer</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Meeting</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loanGroups.map((group) => {
                    const officer = getUserById(group.loan_officer_id);
                    const branch = getBranchById(group.branch_id);
                    return (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{group.group_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{group.group_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-muted-foreground" />
                            <span>{officer?.full_name ?? "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{branch?.name ?? "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{group.member_customer_ids.length}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{group.meeting_day}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {group.meeting_location}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={group.status === "active" ? "default" : "secondary"}>
                            {group.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(group.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/groups/${group.id}`}>
                              <Wallet className="mr-2 h-4 w-4" />
                              View Group
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
