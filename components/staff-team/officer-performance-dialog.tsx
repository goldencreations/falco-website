"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { branches, formatCurrency, formatDate } from "@/lib/mock-data";
import type { Customer, Loan, LoanApplication, User } from "@/lib/types";
import type { OfficerPerformance } from "@/lib/staff-team-metrics";
import type { StaffRole } from "@/components/staff-management/types";
import { roleLabel } from "@/components/staff-management/utils";

function formatAppStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function OfficerPerformanceDialog({
  open,
  onOpenChange,
  officer,
  perf,
  customers,
  applications,
  loans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer: User | null;
  perf: OfficerPerformance | null;
  customers: Customer[];
  applications: LoanApplication[];
  loans: Loan[];
}) {
  const oid = officer?.id;

  const officerCustomers = useMemo(() => {
    if (!oid) return [];
    return customers.filter((c) => {
      const rm = c.assigned_loan_officer_id ?? c.created_by;
      return rm === oid || c.created_by === oid;
    });
  }, [customers, oid]);

  const officerApplications = useMemo(() => {
    if (!oid) return [];
    return applications.filter((a) => a.created_by === oid);
  }, [applications, oid]);

  const officerLoans = useMemo(() => {
    if (!oid) return [];
    return loans.filter((l) => l.loan_officer_id === oid);
  }, [loans, oid]);

  if (!officer || !perf) return null;

  const branchName = branches.find((b) => b.id === officer.branch_id)?.name ?? officer.branch_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,820px)] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden border border-border/80 p-0 sm:max-w-2xl"
      >
        <div className="relative border-b bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 px-6 pb-6 pt-6 text-primary-foreground">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-emerald-100/90 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <span className="text-lg leading-none">×</span>
          </button>
          <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-100/90">
                Officer performance record
              </p>
              <DialogTitle className="text-left text-xl font-semibold tracking-tight text-white">
                {officer.full_name}
              </DialogTitle>
              <DialogDescription className="text-left text-emerald-100/90">
                <span className="font-mono text-white/95">{officer.employee_id}</span>
                {" · "}
                {roleLabel(officer.role as StaffRole)}
              </DialogDescription>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Badge
                className="border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20"
                variant="outline"
              >
                {officer.is_active ? "Active" : "Suspended"}
              </Badge>
              <p className="text-xs text-emerald-100/80">{branchName}</p>
            </div>
          </div>
          <p className="pointer-events-none absolute bottom-2 right-6 hidden rotate-[-10deg] select-none border-2 border-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/25 sm:block">
            Falco Financial
          </p>
        </div>

        <div className="max-h-[min(52vh,480px)] overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Collections & score
                </h4>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {formatCurrency(perf.collections_tz_sum)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Attributed collections (completed payments)
                </p>
              </div>
              <Separator />
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Composite score</dt>
                  <dd className="text-right font-semibold tabular-nums">{perf.score.toFixed(1)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Customers (assigned)</dt>
                  <dd className="text-right font-medium tabular-nums">{perf.customers_assigned}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Customers (created)</dt>
                  <dd className="text-right font-medium tabular-nums">{perf.customers_created}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Applications</dt>
                  <dd className="text-right font-medium tabular-nums">{perf.applications_count}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Loans handled</dt>
                  <dd className="text-right font-medium tabular-nums">{perf.loans_handled}</dd>
                </div>
              </dl>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Profile & scope
              </h4>
              <dl className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Work email</dt>
                  <dd className="font-medium">{officer.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="font-mono text-sm">{officer.phone}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Branch</dt>
                  <dd>{branchName}</dd>
                </div>
              </dl>
            </div>
          </div>

          <Separator className="my-5" />

          <Tabs defaultValue="customers" className="w-full">
            <TabsList className="mb-3 grid h-auto w-full grid-cols-3 gap-1 sm:w-auto sm:inline-flex">
              <TabsTrigger value="customers" className="text-xs sm:text-sm">
                Customers ({officerCustomers.length})
              </TabsTrigger>
              <TabsTrigger value="applications" className="text-xs sm:text-sm">
                Applications ({officerApplications.length})
              </TabsTrigger>
              <TabsTrigger value="loans" className="text-xs sm:text-sm">
                Loans ({officerLoans.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="customers" className="mt-0">
              <ScrollArea className="h-[min(220px,35vh)] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[120px]">Number</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {officerCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No customers in scope.
                        </TableCell>
                      </TableRow>
                    ) : (
                      officerCustomers.map((c) => {
                        const assigned = (c.assigned_loan_officer_id ?? c.created_by) === oid;
                        const created = c.created_by === oid;
                        const link =
                          assigned && created ? "RM & creator" : assigned ? "Assigned RM" : "Created";
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.customer_number}</TableCell>
                            <TableCell className="font-medium">
                              {c.first_name} {c.last_name}
                            </TableCell>
                            <TableCell className="hidden text-muted-foreground sm:table-cell">
                              {link}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="applications" className="mt-0">
              <ScrollArea className="h-[min(220px,35vh)] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Application</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {officerApplications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No applications.
                        </TableCell>
                      </TableRow>
                    ) : (
                      officerApplications.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <span className="font-mono text-xs">{a.application_number}</span>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(a.created_at)}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(a.requested_amount)}
                          </TableCell>
                          <TableCell className="hidden capitalize sm:table-cell">
                            <Badge variant="outline" className="font-normal">
                              {formatAppStatus(a.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="loans" className="mt-0">
              <ScrollArea className="h-[min(220px,35vh)] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Loan</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {officerLoans.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No loans.
                        </TableCell>
                      </TableRow>
                    ) : (
                      officerLoans.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <span className="font-mono text-xs">{l.loan_number}</span>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {l.status.replace(/_/g, " ")}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(l.total_outstanding)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="secondary" className="font-normal capitalize">
                              {l.risk_classification.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
