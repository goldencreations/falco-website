"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { customerRegistrationDisplayName } from "@/lib/customer-adapters";
import { fetchAllCustomersFromApi } from "@/lib/customer-list-fetch";
import { formatApiResponseError } from "@/lib/falco-api";
import {
  extractAllocateToLoanResult,
  financialEntryMethodLabel,
  financialEntryPayerHint,
  type FinancialEntryLoanAllocation,
} from "@/lib/financial-entry-adapters";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { parseLoansFromApiResponse, type LoanListRow } from "@/lib/loan-adapters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { branchIdsMatch, branchMatchesScope } from "@/lib/branch-scope";
import { cn } from "@/lib/utils";
import type { Branch, Customer, FinancialEntry } from "@/lib/types";

const PAYABLE_STATUSES = new Set(["active", "in_arrears"]);

function isPayableLoan(loan: LoanListRow): boolean {
  return PAYABLE_STATUSES.has(loan.status);
}

function catalogBranchForCustomer(customer: Customer, branches: Branch[]): Branch | undefined {
  return branches.find(
    (b) =>
      branchIdsMatch(b.id, customer.branch_id) ||
      branchIdsMatch(b.code, customer.branch_id) ||
      branchMatchesScope(b, customer.branch_id)
  );
}

function customerMatchesQuery(customer: Customer, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const haystacks = [
    customerRegistrationDisplayName(customer),
    customer.first_name,
    customer.middle_name,
    customer.last_name,
    customer.business_name,
    customer.customer_number,
    customer.phone_primary,
    customer.phone_secondary,
    ...(customer.phone_numbers ?? []),
    customer.national_id,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return haystacks.some((value) => value.includes(q));
}

type AllocateToLoanDialogProps = {
  entry: FinancialEntry | null;
  branches: Branch[];
  scopedBranchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAllocated: (result: FinancialEntryLoanAllocation) => void;
  onError: (message: string) => void;
};

export function AllocateToLoanDialog({
  entry,
  branches,
  scopedBranchId,
  open,
  onOpenChange,
  onAllocated,
  onError,
}: AllocateToLoanDialogProps) {
  const [branchId, setBranchId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerRoster, setCustomerRoster] = useState<Customer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [loans, setLoans] = useState<LoanListRow[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanId, setLoanId] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinancialEntryLoanAllocation | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const payer = entry ? financialEntryPayerHint(entry) : undefined;
  const method = entry ? financialEntryMethodLabel(entry) : "";
  const selectedLoan = loans.find((l) => l.id === loanId) ?? null;

  useEffect(() => {
    if (!open || !entry) return;
    setBranchId(scopedBranchId ?? entry.branch_id ?? "");
    setCustomer(null);
    setCustomerQuery("");
    setLoans([]);
    setLoanId("");
    setNotes(entry.reference ? `Verified against the ClickPesa merchant receipt ${entry.reference}` : "");
    setConfirming(false);
    setResult(null);
    setFieldErrors({});
  }, [open, entry, scopedBranchId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCustomerSearching(true);
    void fetchAllCustomersFromApi(new URLSearchParams(), { pageSize: 100 })
      .then((list) => {
        if (!cancelled) setCustomerRoster(list);
      })
      .catch(() => {
        if (!cancelled) setCustomerRoster([]);
      })
      .finally(() => {
        if (!cancelled) setCustomerSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const customerResults = useMemo(() => {
    const q = customerQuery.trim();
    const matched = customerRoster.filter((c) => customerMatchesQuery(c, q));
    if (!q) {
      if (!selectedBranch) return matched.slice(0, 20);
      return matched
        .filter(
          (c) =>
            branchIdsMatch(c.branch_id, selectedBranch.id) ||
            branchIdsMatch(c.branch_id, selectedBranch.code) ||
            branchMatchesScope(selectedBranch, c.branch_id)
        )
        .slice(0, 20);
    }
    const preferred = selectedBranch
      ? matched.filter(
          (c) =>
            branchIdsMatch(c.branch_id, selectedBranch.id) ||
            branchIdsMatch(c.branch_id, selectedBranch.code) ||
            branchMatchesScope(selectedBranch, c.branch_id)
        )
      : [];
    const others = matched.filter((c) => !preferred.some((p) => p.id === c.id));
    return [...preferred, ...others].slice(0, 20);
  }, [customerRoster, customerQuery, selectedBranch]);

  useEffect(() => {
    if (!open || !customer?.id) {
      setLoans([]);
      setLoanId("");
      return;
    }
    let cancelled = false;
    setLoansLoading(true);
    const params = new URLSearchParams();
    params.set("customer_id", customer.id);
    params.set("page_size", "50");
    void fetch(`/api/loans?${params.toString()}`, { credentials: "include" })
      .then(async (res) => {
        const { data } = await parseJsonResponse<unknown>(res);
        if (cancelled) return;
        const rows = res.ok ? parseLoansFromApiResponse(data).filter(isPayableLoan) : [];
        setLoans(rows);
        setLoanId(rows.length === 1 ? rows[0].id : "");
      })
      .catch(() => {
        if (!cancelled) {
          setLoans([]);
          setLoanId("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customer?.id]);

  const applyFieldErrors = (details: unknown): boolean => {
    if (!Array.isArray(details)) return false;
    const map: Record<string, string> = {};
    for (const d of details as { field?: string; message?: string }[]) {
      const field = (d.field ?? "").toLowerCase();
      const message = d.message ?? "";
      if (!message) continue;
      if (field.includes("branch")) map.branch = message;
      else if (field.includes("customer")) map.customer = message;
      else if (field.includes("loan")) map.loan = message;
      else if (field.includes("note")) map.notes = message;
      else map.form = message;
    }
    if (Object.keys(map).length === 0) return false;
    setFieldErrors(map);
    return true;
  };

  const isValid = Boolean(branchId.trim() && customer?.id && loanId.trim() && notes.trim());

  const submit = async () => {
    if (!entry || !isValid) return;
    setLoading(true);
    setFieldErrors({});
    try {
      const res = await fetch(
        `/api/financial-entries/${encodeURIComponent(entry.id)}/allocate-to-loan`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch_id: branchId.trim(),
            customer_id: customer?.id,
            loan_id: loanId.trim(),
            notes: notes.trim(),
          }),
        }
      );
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      if (!res.ok) {
        if (res.status === 401) {
          onError("Your session expired. Please sign in again and retry.");
          return;
        }
        if (res.status === 403) {
          onError("You do not have permission to allocate this receipt to a loan.");
          return;
        }
        if (res.status === 404 || res.status === 409) {
          onError(
            res.status === 409
              ? "This receipt may already be allocated — refreshing Cashbook."
              : "This receipt no longer exists — refreshing Cashbook."
          );
          onOpenChange(false);
          onAllocated(extractAllocateToLoanResult(data));
          return;
        }
        if (res.status === 422 && applyFieldErrors((data as { details?: unknown })?.details)) {
          setConfirming(false);
          return;
        }
        onError(formatApiResponseError(data, "Failed to allocate the receipt to a loan"));
        return;
      }
      const parsed = extractAllocateToLoanResult(data);
      setResult(parsed);
      onAllocated(parsed);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to allocate the receipt to a loan");
    } finally {
      setLoading(false);
    }
  };

  const receiptSummary = entry ? (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Amount</span>
        <span className="font-semibold">{formatCurrency(entry.amount)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Provider receipt</span>
        <span className="font-mono text-xs">{entry.reference ?? "—"}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Date</span>
        <span>{formatDate(entry.transaction_date)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Provider</span>
        <span>{method || "ClickPesa"}</span>
      </div>
      {payer?.name || payer?.phone ? (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">ClickPesa payer hint</span>
          <span className="text-right text-xs">
            {[payer.name, payer.phone].filter(Boolean).join(" · ")}
          </span>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b pr-10 text-left">
          <SheetTitle>
            {result ? "Receipt allocated to loan" : confirming ? "Confirm allocation" : "Allocate to loan"}
          </SheetTitle>
          <SheetDescription>
            {result
              ? result.already_allocated
                ? "This receipt was already allocated. Cashbook and the loan were refreshed — no second payment was created."
                : "A verified payment was created from this ClickPesa receipt. Penalty, fees, interest, and principal were allocated."
              : entry
                ? `Apply ${entry.entry_number} (${formatCurrency(entry.amount)}, receipt ${
                    entry.reference ?? "—"
                  }) to a verified customer loan. The amount is taken from the original receipt and cannot be edited.`
                : "Apply this unmatched ClickPesa receipt to a verified customer loan."}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {result ? (
          <div className="space-y-3">
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penalty</span>
                <span>{formatCurrency(result.penalty_allocated)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fees</span>
                <span>{formatCurrency(result.fees_allocated)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interest</span>
                <span>{formatCurrency(result.interest_allocated)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal</span>
                <span>{formatCurrency(result.principal_allocated)}</span>
              </div>
              {result.loan_total_paid != null ? (
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-semibold">{formatCurrency(result.loan_total_paid)}</span>
                </div>
              ) : null}
              {result.loan_penalty_outstanding != null ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Penalty outstanding</span>
                  <span>{formatCurrency(result.loan_penalty_outstanding)}</span>
                </div>
              ) : null}
              {result.loan_total_outstanding != null ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan outstanding</span>
                  <span className="font-semibold">{formatCurrency(result.loan_total_outstanding)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : confirming && entry ? (
          <div className="space-y-3">
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This creates one verified Payment from the original ClickPesa amount. It updates the
              loan schedule, penalties, and amount paid. It does not post a second cashbook row from
              the browser.
            </p>
            {receiptSummary}
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch</span>
                <span>{branches.find((b) => b.id === branchId)?.name ?? branchId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span>{customer ? customerRegistrationDisplayName(customer) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan</span>
                <span>
                  {selectedLoan
                    ? `${selectedLoan.loan_number} · ${formatCurrency(selectedLoan.total_outstanding)} outstanding`
                    : loanId}
                </span>
              </div>
            </div>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">“{notes}”</p>
          </div>
        ) : (
          <FieldGroup className="gap-3 py-0">
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Allocate only after verifying the customer and loan. This credits the loan. Use
              Classify as income if this money should not reduce a loan.
            </p>
            {receiptSummary}
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  setCustomer(null);
                  setCustomerQuery("");
                  setLoans([]);
                  setLoanId("");
                }}
              >
                <SelectTrigger className={cn("h-9 w-full", fieldErrors.branch && "border-destructive")}>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.branch ? <p className="text-xs text-destructive">{fieldErrors.branch}</p> : (
                <p className="text-xs text-muted-foreground">
                  Customer list Location is the home/business address (for example Temeke, Dar es
                  Salaam). It is not a Falco branch. Choose the branch that owns the customer, such as
                  Mbagala.
                </p>
              )}
            </Field>
            <Field>
              <FieldLabel>Customer</FieldLabel>
              <Input
                className={cn("h-9", fieldErrors.customer && "border-destructive")}
                placeholder="Search by name, phone, or customer number"
                value={customer ? customerRegistrationDisplayName(customer) : customerQuery}
                onChange={(e) => {
                  setCustomer(null);
                  setCustomerQuery(e.target.value);
                  setLoans([]);
                  setLoanId("");
                }}
              />
              {customerSearching ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading customers…
                </p>
              ) : null}
              {!customer ? (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  {customerResults.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">
                      {customerQuery.trim()
                        ? "No matching Falco customer. Try Amosi, Isdori, or CUS-260807-166758."
                        : "Type a name, phone, or customer number. Search is not limited to the selected branch."}
                    </p>
                  ) : (
                    customerResults.map((c) => {
                      const assignedBranch = catalogBranchForCustomer(c, branches);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
                          onClick={() => {
                            setCustomer(c);
                            setCustomerQuery("");
                            const matched = catalogBranchForCustomer(c, branches);
                            if (matched) setBranchId(matched.id);
                          }}
                        >
                          <Check
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              customer?.id === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm">
                              {customerRegistrationDisplayName(c)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {[
                                c.customer_number,
                                c.phone_primary,
                                assignedBranch?.name ?? (c.branch_id || "Unassigned branch"),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setCustomer(null);
                    setCustomerQuery("");
                    setLoans([]);
                    setLoanId("");
                  }}
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear customer
                </Button>
              )}
              {fieldErrors.customer ? <p className="text-xs text-destructive">{fieldErrors.customer}</p> : null}
            </Field>
            <Field>
              <FieldLabel>Loan</FieldLabel>
              <Select value={loanId} onValueChange={setLoanId} disabled={!customer || loansLoading}>
                <SelectTrigger className={cn("h-9 w-full", fieldErrors.loan && "border-destructive")}>
                  <SelectValue
                    placeholder={
                      !customer
                        ? "Select a customer first"
                        : loansLoading
                          ? "Loading loans…"
                          : loans.length === 0
                            ? "No active or in-arrears loan"
                            : "Select loan"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {loans.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id}>
                      {loan.loan_number} · {formatCurrency(loan.total_outstanding)} outstanding
                      {(loan.penalty_outstanding ?? loan.penalty ?? 0) > 0
                        ? ` · penalty ${formatCurrency(loan.penalty_outstanding ?? loan.penalty ?? 0)}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customer && !loansLoading && loans.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  This customer has no active or in-arrears loan. Use Classify as income if this is a
                  fee or other income.
                </p>
              ) : null}
              {fieldErrors.loan ? <p className="text-xs text-destructive">{fieldErrors.loan}</p> : null}
            </Field>
            <Field>
              <FieldLabel>Verification notes</FieldLabel>
              <Textarea
                className={fieldErrors.notes ? "border-destructive" : undefined}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Verified against the ClickPesa merchant receipt"
              />
              {fieldErrors.notes ? <p className="text-xs text-destructive">{fieldErrors.notes}</p> : null}
            </Field>
            {fieldErrors.form ? <p className="text-xs text-destructive">{fieldErrors.form}</p> : null}
          </FieldGroup>
        )}
        </div>

        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          {result ? (
            <>
              {result.payment_id ? (
                <Button type="button" variant="outline" asChild>
                  <a href={`/payments?paymentId=${encodeURIComponent(result.payment_id)}`}>View payment</a>
                </Button>
              ) : null}
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : confirming ? (
            <>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Back
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Allocate to loan
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => setConfirming(true)} disabled={!isValid}>
                Review &amp; confirm
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
