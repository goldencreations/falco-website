"use client";

import { Shield } from "lucide-react";
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
import type { CustomerCollateralRow } from "@/lib/customer-profile-extras";
import { formatCurrency } from "@/lib/formatters";

export function CustomerCollateralPanel({ rows }: { rows: CustomerCollateralRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collateral</CardTitle>
          <CardDescription>No collateral records linked to this customer&apos;s applications yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Collateral from loan applications will appear here when available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Collateral
        </CardTitle>
        <CardDescription>Collateral declared on this customer&apos;s loan applications.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Application</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.applicationNumber}-${row.type}`}>
                <TableCell className="font-mono text-xs">{row.applicationNumber}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(row.value)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {row.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
