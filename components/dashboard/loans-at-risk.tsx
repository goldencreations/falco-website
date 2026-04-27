"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  loans,
  getCustomerById,
  getProductById,
  formatCurrency,
} from "@/lib/mock-data";
import type { RiskClassification } from "@/lib/types";
import { cn } from "@/lib/utils";

const riskConfig: Record<RiskClassification, { 
  label: string; 
  className: string;
  bgClassName: string;
}> = {
  current: { 
    label: "Current", 
    className: "bg-success/10 text-success border-success/20",
    bgClassName: "bg-success/5",
  },
  especially_mentioned: { 
    label: "Watch", 
    className: "bg-warning/10 text-warning-foreground border-warning/20",
    bgClassName: "bg-warning/5",
  },
  substandard: { 
    label: "Substandard", 
    className: "bg-destructive/10 text-destructive border-destructive/20",
    bgClassName: "bg-destructive/5",
  },
  doubtful: { 
    label: "Doubtful", 
    className: "bg-destructive/15 text-destructive border-destructive/30",
    bgClassName: "bg-destructive/5",
  },
  loss: { 
    label: "Loss", 
    className: "bg-foreground/10 text-foreground border-foreground/20",
    bgClassName: "bg-foreground/5",
  },
};

export function LoansAtRisk() {
  const atRiskLoans = loans
    .filter((loan) => loan.risk_classification !== "current")
    .sort((a, b) => b.days_in_arrears - a.days_in_arrears);

  return (
    <Card className="col-span-full border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Loans Requiring Attention
          </CardTitle>
          <CardDescription>
            {atRiskLoans.length} loans currently at risk requiring follow-up
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <Link href="/collections">
            View All Collections
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Customer</TableHead>
              <TableHead>Loan Number</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-center">Days Overdue</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atRiskLoans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                      <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="font-medium">No loans at risk</p>
                    <p className="text-sm">Great portfolio health!</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              atRiskLoans.map((loan) => {
                const customer = getCustomerById(loan.customer_id);
                const product = getProductById(loan.product_id);
                const config = riskConfig[loan.risk_classification];
                return (
                  <TableRow key={loan.id} className={cn("transition-colors", config.bgClassName)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {customer?.first_name[0]}{customer?.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {customer?.first_name} {customer?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer?.phone_primary}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {loan.loan_number}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{product?.name}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(loan.total_outstanding)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full text-sm font-bold",
                        loan.days_in_arrears > 90 
                          ? "bg-destructive/10 text-destructive" 
                          : loan.days_in_arrears > 30 
                            ? "bg-warning/10 text-warning-foreground"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {loan.days_in_arrears}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-medium", config.className)}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                        <Link href={`/loans/${loan.id}`}>View Details</Link>
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
  );
}
