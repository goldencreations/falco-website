"use client";

import { Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
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
import type { StaffProvisioningRequest } from "@/lib/staff-requests-types";
import type { StaffRole } from "@/components/staff-management/types";
import { roleLabel } from "@/components/staff-management/utils";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
 pending: "secondary",
 approved: "default",
 rejected: "destructive",
};

export function ManagerPendingHiresTable({
 rows,
 loading,
}: {
 rows: StaffProvisioningRequest[];
 loading: boolean;
}) {
 const pending = rows.filter((r) => r.status === "pending");
 const resolved = rows.filter((r) => r.status !== "pending");

 return (
 <Card className="border-emerald-100/80">
 <CardHeader>
 <CardTitle className="text-lg">Hire requests</CardTitle>
 <CardDescription>
 Proposals sent to Head Office. Staff cannot sign in until a super administrator approves and issues a password.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {loading ? (
 <div className="flex justify-center py-10">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 ) : rows.length === 0 ? (
 <p className="py-6 text-center text-sm text-muted-foreground">
 No hire requests yet. Use &quot;Propose new hire&quot; to submit one.
 </p>
 ) : (
 <div className="overflow-x-auto rounded-md border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Name</TableHead>
 <TableHead>Email</TableHead>
 <TableHead>Role</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Submitted</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {[...pending, ...resolved].map((row) => (
 <TableRow key={row.id}>
 <TableCell className="font-medium">{row.full_name}</TableCell>
 <TableCell className="text-muted-foreground">{row.email}</TableCell>
 <TableCell>
 <Badge variant="outline">{roleLabel(row.role as StaffRole)}</Badge>
 </TableCell>
 <TableCell>
 <Badge variant={statusVariant[row.status] ?? "outline"} className="capitalize">
 {row.status}
 </Badge>
 </TableCell>
 <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
 {formatDateTime(row.created_at)}
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}
 {pending.length > 0 ? (
 <p className="mt-3 text-xs text-muted-foreground">
 {pending.length} request{pending.length === 1 ? "" : "s"} awaiting super admin approval.
 </p>
 ) : null}
 </CardContent>
 </Card>
 );
}
