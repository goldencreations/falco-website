"use client";

import { Loader2 } from "lucide-react";
import { branches, formatDateTime } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StaffAccessRequest, StaffProvisioningRequest } from "@/lib/staff-requests-types";
import type { StaffRole } from "@/components/staff-management/types";
import { roleLabel } from "@/components/staff-management/utils";

export function PendingHiresTable({
  rows,
  loading,
  onApprove,
  onReject,
}: {
  rows: StaffProvisioningRequest[];
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Pending hires</CardTitle>
        <CardDescription>
          Approve to create the portal-ready profile in the directory. Reject to dismiss without creating an account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No pending hire requests.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{roleLabel(row.role as StaffRole)}</Badge>
                    </TableCell>
                    <TableCell>
                      {branches.find((b) => b.id === row.branch_id)?.name ?? row.branch_id}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => onReject(row.id)}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => onApprove(row.id)}>
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AccessRequestsTable({
  rows,
  loading,
  resolveStaffName,
  onApprove,
  onReject,
}: {
  rows: StaffAccessRequest[];
  loading: boolean;
  resolveStaffName: (staffId: string) => string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Access requests</CardTitle>
        <CardDescription>
          Branch manager requests to suspend or reinstate staff. Approving suspend sets the user inactive in the directory.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No pending access requests.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Badge variant={row.type === "suspend" ? "destructive" : "default"}>
                        {row.type === "suspend" ? "Suspend" : "Reinstate"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{resolveStaffName(row.staff_id)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {row.reason ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => onReject(row.id)}>
                          Reject
                        </Button>
                        <Button size="sm" onClick={() => onApprove(row.id)}>
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
