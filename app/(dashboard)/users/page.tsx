"use client";

import { useState } from "react";
import { UserCog, ShieldCheck, FileText, Plus, Download } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { users, branches } from "@/lib/mock-data";

const availableReports = [
  "Portfolio Summary",
  "Aging Analysis",
  "Disbursement Report",
  "Collection Report",
  "Credit Scoring Report",
  "CRB Status Report",
];

type ReportAccess = Record<string, string[]>;

const initialAccess: ReportAccess = {
  super_admin: availableReports,
  branch_manager: availableReports,
  loan_officer: ["Portfolio Summary", "Collection Report", "Credit Scoring Report"],
  credit_analyst: [
    "Portfolio Summary",
    "Aging Analysis",
    "Credit Scoring Report",
    "CRB Status Report",
  ],
  collections_officer: ["Collection Report", "Portfolio Summary"],
  accountant: ["Portfolio Summary", "Disbursement Report", "Collection Report"],
  customer_service: ["Portfolio Summary"],
};

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [reportAccess, setReportAccess] = useState<ReportAccess>(initialAccess);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.employee_id.toLowerCase().includes(search.toLowerCase());
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <>
      <DashboardHeader
        title="User Management"
        description="Manage users, roles, and report access permissions"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{users.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{users.filter((u) => u.is_active).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{new Set(users.map((u) => u.role)).size}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Reports Configured</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{availableReports.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="users" className="space-y-4">
            <TabsList>
              <TabsTrigger value="users" className="gap-2">
                <UserCog className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2">
                <FileText className="h-4 w-4" />
                Reports Access
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>System Users</CardTitle>
                  <CardDescription>
                    Add or review users who create and manage loan applications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                      <Input
                        placeholder="Search by name, email, employee ID"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="sm:w-80"
                      />
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger className="sm:w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Roles</SelectItem>
                          {Array.from(new Set(users.map((u) => u.role))).map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.replaceAll("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Add User
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                            <p className="text-xs text-muted-foreground">{user.employee_id}</p>
                          </TableCell>
                          <TableCell className="capitalize">
                            {user.role.replaceAll("_", " ")}
                          </TableCell>
                          <TableCell>
                            {branches.find((branch) => branch.id === user.branch_id)?.name ?? "-"}
                          </TableCell>
                          <TableCell>{user.phone}</TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? "default" : "secondary"}>
                              {user.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              Manage
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Report Permissions by Role</CardTitle>
                  <CardDescription>
                    Control which reports each role can access inside the system
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export Report Access Matrix
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {Object.entries(reportAccess).map(([role, reports]) => (
                      <div
                        key={role}
                        className="rounded-lg border border-border p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <p className="flex items-center gap-2 font-semibold capitalize">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            {role.replaceAll("_", " ")}
                          </p>
                          <Badge variant="outline">{reports.length} reports</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {availableReports.map((report) => {
                            const enabled = reports.includes(report);
                            return (
                              <Button
                                key={report}
                                type="button"
                                variant={enabled ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                  setReportAccess((prev) => {
                                    const current = prev[role] ?? [];
                                    return {
                                      ...prev,
                                      [role]: enabled
                                        ? current.filter((item) => item !== report)
                                        : [...current, report],
                                    };
                                  })
                                }
                              >
                                {report}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
