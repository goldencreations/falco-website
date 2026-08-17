"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  exactActiveGroupMatch,
  extractAllocateToGroupResult,
  extractAllocateToLoanResult,
  financialEntryMethodLabel,
  financialEntryPayerHint,
  hasExactActiveGroupMatch,
  splitReceiptAcrossOutstanding,
  type FinancialEntryLoanAllocation,
} from "@/lib/financial-entry-adapters";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { extractGroupDetail, extractGroupsList } from "@/lib/group-adapters";
import { parseLoansFromApiResponse, type LoanListRow } from "@/lib/loan-adapters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { branchIdsMatch, branchMatchesScope } from "@/lib/branch-scope";
import { cn } from "@/lib/utils";
import type { Branch, Customer, FinancialEntry, LoanGroup } from "@/lib/types";

const PAYABLE_STATUSES = new Set(["active", "in_arrears"]);

type AllocationType = "individual" | "group";

function isPayableLoan(loan: LoanListRow): boolean {
  return PAYABLE_STATUSES.has(loan.status);
}

function catalogBranchForKey(branchKey: string | undefined, branches: Branch[]): Branch | undefined {
  if (!branchKey) return undefined;
  return branches.find(
    (b) =>
      branchIdsMatch(b.id, branchKey) ||
      branchIdsMatch(b.code, branchKey) ||
      branchMatchesScope(b, branchKey)
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

function groupMatchesQuery(group: LoanGroup, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  return [group.group_name, group.group_code]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function memberIdsFromGroup(group: Pick<LoanGroup, "member_customer_ids" | "chairperson_customer_id" | "secretary_customer_id" | "treasurer_customer_id">): string[] {
  const ids = new Set<string>();
  for (const id of group.member_customer_ids ?? []) {
    if (id?.trim()) ids.add(id.trim());
  }
  for (const id of [group.chairperson_customer_id, group.secretary_customer_id, group.treasurer_customer_id]) {
    if (id?.trim()) ids.add(id.trim());
  }
  return [...ids];
}

function idsMatch(left: string | undefined | null, right: string | undefined | null): boolean {
  const a = String(left ?? "").trim();
  const b = String(right ?? "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) === Number(b);
  return false;
}

function loanLinkedToGroup(loan: Pick<LoanListRow, "group_id">, group: Pick<LoanGroup, "id" | "group_code">): boolean {
  return idsMatch(loan.group_id, group.id) || idsMatch(loan.group_id, group.group_code);
}

function customerIsCurrentMember(customerId: string | undefined, memberIds: Set<string>): boolean {
  const id = String(customerId ?? "").trim();
  if (!id) return false;
  if (memberIds.has(id)) return true;
  for (const memberId of memberIds) {
    if (idsMatch(memberId, id)) return true;
  }
  return false;
}

function loanBelongsToSelectedGroup(
  loan: Pick<LoanListRow, "customer_id" | "group_id">,
  group: Pick<LoanGroup, "id" | "group_code">,
  memberIds: Set<string>
): boolean {
  if (loanLinkedToGroup(loan, group)) return true;
  return customerIsCurrentMember(loan.customer_id, memberIds);
}

async function fetchLoansPage(params: URLSearchParams): Promise<LoanListRow[]> {
  const res = await fetch(`/api/loans?${params.toString()}`, { credentials: "include" });
  const { data } = await parseJsonResponse<unknown>(res);
  return res.ok ? parseLoansFromApiResponse(data) : [];
}

async function fetchPayableLoansForGroup(group: LoanGroup): Promise<LoanListRow[]> {
  const byId = new Map<string, LoanListRow>();
  const memberIds = new Set(memberIdsFromGroup(group));

  const detailRes = await fetch(`/api/groups/${encodeURIComponent(group.id)}`, { credentials: "include" });
  const { data: detailJson } = await parseJsonResponse<unknown>(detailRes);
  const detail = detailRes.ok ? extractGroupDetail(detailJson) : null;
  if (detail) {
    for (const id of memberIdsFromGroup(detail)) memberIds.add(id);
    for (const member of detail.members) {
      if (member.customerId?.trim()) memberIds.add(member.customerId.trim());
    }
  }

  for (let page = 1; page <= 10; page += 1) {
    const params = new URLSearchParams({
      group_id: group.id,
      page: String(page),
      page_size: "100",
    });
    const rows = await fetchLoansPage(params);
    for (const loan of rows) byId.set(loan.id, loan);
    if (rows.length < 100) break;
  }

  const memberLists = await Promise.all(
    [...memberIds].map(async (customerId) => {
      const params = new URLSearchParams({ customer_id: customerId, page_size: "50" });
      return fetchLoansPage(params);
    })
  );
  for (const loan of memberLists.flat()) byId.set(loan.id, loan);

  return [...byId.values()].filter(
    (loan) => isPayableLoan(loan) && loanBelongsToSelectedGroup(loan, group, memberIds)
  );
}

function amountsFromLoans(loans: LoanListRow[], receiptAmount: number): Record<string, number> {
  const next: Record<string, number> = {};
  for (const loan of loans) next[loan.id] = 0;
  for (const row of splitReceiptAcrossOutstanding(
    receiptAmount,
    loans.map((loan) => ({ loan_id: loan.id, outstanding: loan.total_outstanding }))
  )) {
    next[row.loan_id] = row.amount;
  }
  return next;
}

async function fetchActiveGroupsFromApi(): Promise<LoanGroup[]> {
  const all: LoanGroup[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const params = new URLSearchParams({
      status: "active",
      page: String(page),
      page_size: "100",
    });
    const res = await fetch(`/api/groups?${params.toString()}`, { credentials: "include" });
    const { data } = await parseJsonResponse<unknown>(res);
    if (!res.ok) break;
    const rows = extractGroupsList(data).filter((group) => group.status === "active");
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
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
  const [allocationType, setAllocationType] = useState<AllocationType>("individual");
  const [branchId, setBranchId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerRoster, setCustomerRoster] = useState<Customer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [group, setGroup] = useState<LoanGroup | null>(null);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupRoster, setGroupRoster] = useState<LoanGroup[]>([]);
  const [groupSearching, setGroupSearching] = useState(false);
  const [suggestedGroup, setSuggestedGroup] = useState<LoanGroup | null>(null);
  const [hasSuggestedMatch, setHasSuggestedMatch] = useState(false);
  const [groupLoans, setGroupLoans] = useState<LoanListRow[]>([]);
  const [groupLoansLoading, setGroupLoansLoading] = useState(false);
  const [groupAmounts, setGroupAmounts] = useState<Record<string, number>>({});
  const [loans, setLoans] = useState<LoanListRow[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanId, setLoanId] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FinancialEntryLoanAllocation | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const typeTouchedRef = useRef(false);
  const branchesRef = useRef(branches);
  branchesRef.current = branches;

  const payer = entry ? financialEntryPayerHint(entry) : undefined;
  const method = entry ? financialEntryMethodLabel(entry) : "";
  const selectedLoan = loans.find((l) => l.id === loanId) ?? null;
  const isGroupMode = allocationType === "group";

  useEffect(() => {
    if (!open || !entry) return;
    typeTouchedRef.current = false;
    setAllocationType("individual");
    setBranchId(scopedBranchId ?? entry.branch_id ?? "");
    setCustomer(null);
    setCustomerQuery("");
    setGroup(null);
    setGroupQuery("");
    setSuggestedGroup(null);
    setHasSuggestedMatch(false);
    setGroupLoans([]);
    setGroupAmounts({});
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGroupSearching(true);
    void fetchActiveGroupsFromApi()
      .then((list) => {
        if (cancelled) return;
        setGroupRoster(list);
        const payerName = entry ? financialEntryPayerHint(entry).name : undefined;
        const anyMatch = hasExactActiveGroupMatch(list, payerName);
        setHasSuggestedMatch(anyMatch);
        if (!anyMatch) {
          setSuggestedGroup(null);
          return;
        }
        const match = exactActiveGroupMatch(list, payerName) ?? null;
        setSuggestedGroup(match);
        if (typeTouchedRef.current) return;
        setAllocationType("group");
        if (match) {
          setGroup(match);
          const matchedBranch = catalogBranchForKey(match.branch_id, branchesRef.current);
          if (matchedBranch) setBranchId(matchedBranch.id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroupRoster([]);
          setSuggestedGroup(null);
          setHasSuggestedMatch(false);
        }
      })
      .finally(() => {
        if (!cancelled) setGroupSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

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

  const groupResults = useMemo(() => {
    const q = groupQuery.trim();
    const matched = groupRoster.filter((g) => groupMatchesQuery(g, q));
    if (!q) {
      if (!selectedBranch) return matched.slice(0, 20);
      return matched
        .filter(
          (g) =>
            branchIdsMatch(g.branch_id, selectedBranch.id) ||
            branchIdsMatch(g.branch_id, selectedBranch.code) ||
            branchMatchesScope(selectedBranch, g.branch_id)
        )
        .slice(0, 20);
    }
    const preferred = selectedBranch
      ? matched.filter(
          (g) =>
            branchIdsMatch(g.branch_id, selectedBranch.id) ||
            branchIdsMatch(g.branch_id, selectedBranch.code) ||
            branchMatchesScope(selectedBranch, g.branch_id)
        )
      : [];
    const others = matched.filter((g) => !preferred.some((p) => p.id === g.id));
    return [...preferred, ...others].slice(0, 20);
  }, [groupRoster, groupQuery, selectedBranch]);

  useEffect(() => {
    if (!open || isGroupMode || !customer?.id) {
      if (!customer?.id) {
        setLoans([]);
        setLoanId("");
      }
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
  }, [open, isGroupMode, customer?.id]);

  useEffect(() => {
    if (!open || !isGroupMode || !group?.id) {
      setGroupLoans([]);
      setGroupAmounts({});
      return;
    }
    let cancelled = false;
    setGroupLoansLoading(true);
    void fetchPayableLoansForGroup(group)
      .then((rows) => {
        if (cancelled) return;
        setGroupLoans(rows);
        setGroupAmounts(amountsFromLoans(rows, Number(entry?.amount) || 0));
      })
      .catch(() => {
        if (!cancelled) {
          setGroupLoans([]);
          setGroupAmounts({});
        }
      })
      .finally(() => {
        if (!cancelled) setGroupLoansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isGroupMode, group, entry?.amount]);

  const applyFieldErrors = (details: unknown): boolean => {
    if (!Array.isArray(details)) return false;
    const map: Record<string, string> = {};
    for (const d of details as { field?: string; message?: string }[]) {
      const field = (d.field ?? "").toLowerCase();
      const message = d.message ?? "";
      if (!message) continue;
      if (field.includes("branch")) map.branch = message;
      else if (field.includes("allocation")) map.allocation = message;
      else if (field.includes("group")) map.group = message;
      else if (field.includes("customer")) map.customer = message;
      else if (field.includes("loan")) map.loan = message;
      else if (field.includes("note")) map.notes = message;
      else map.form = message;
    }
    if (Object.keys(map).length === 0) return false;
    setFieldErrors(map);
    return true;
  };

  const allocationRows = useMemo(
    () =>
      groupLoans
        .map((loan) => ({
          loan,
          amount: Math.max(0, Math.round(Number(groupAmounts[loan.id]) || 0)),
        }))
        .filter((row) => row.amount > 0),
    [groupLoans, groupAmounts]
  );
  const allocationTotal = allocationRows.reduce((sum, row) => sum + row.amount, 0);
  const receiptAmount = Math.round(Number(entry?.amount) || 0);
  const allocationRemaining = receiptAmount - allocationTotal;
  const allocationExceedsLoan = allocationRows.some(
    (row) => row.amount > Math.round(Number(row.loan.total_outstanding) || 0)
  );

  const isValid = isGroupMode
    ? Boolean(
        branchId.trim() &&
          group?.id &&
          notes.trim() &&
          allocationRows.length > 0 &&
          allocationRemaining === 0 &&
          !allocationExceedsLoan
      )
    : Boolean(branchId.trim() && customer?.id && loanId.trim() && notes.trim());

  const showSuggestedMatch =
    isGroupMode &&
    hasSuggestedMatch &&
    (!group || !suggestedGroup || group.id === suggestedGroup.id);

  const submit = async () => {
    if (!entry || !isValid) return;
    setLoading(true);
    setFieldErrors({});
    try {
      const path = isGroupMode
        ? `/api/financial-entries/${encodeURIComponent(entry.id)}/allocate-to-group`
        : `/api/financial-entries/${encodeURIComponent(entry.id)}/allocate-to-loan`;
      const body = isGroupMode
        ? {
            branch_id: branchId.trim(),
            group_id: group?.id,
            notes: notes.trim(),
            allocations: allocationRows.map((row) => ({
              loan_id: row.loan.id,
              customer_id: row.loan.customer_id,
              amount: row.amount,
            })),
          }
        : {
            branch_id: branchId.trim(),
            customer_id: customer?.id,
            loan_id: loanId.trim(),
            notes: notes.trim(),
          };
      const res = await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      const parsed = isGroupMode
        ? extractAllocateToGroupResult(data)
        : extractAllocateToLoanResult(data);
      if (!res.ok) {
        if (res.status === 401) {
          onError("Your session expired. Please sign in again and retry.");
          return;
        }
        if (res.status === 403) {
          onError("You do not have permission to allocate this receipt.");
          return;
        }
        if (res.status === 404 || res.status === 409) {
          onError(
            res.status === 409
              ? "This receipt may already be allocated — refreshing Cashbook."
              : "This receipt no longer exists — refreshing Cashbook."
          );
          onOpenChange(false);
          onAllocated(parsed);
          return;
        }
        if (res.status === 422 && applyFieldErrors((data as { details?: unknown })?.details)) {
          setConfirming(false);
          return;
        }
        onError(
          formatApiResponseError(
            data,
            isGroupMode
              ? "Failed to allocate the receipt to group loans"
              : "Failed to allocate the receipt to a loan"
          )
        );
        return;
      }
      setResult(parsed);
      onAllocated(parsed);
    } catch (e) {
      onError(
        e instanceof Error
          ? e.message
          : isGroupMode
            ? "Failed to allocate the receipt to group loans"
            : "Failed to allocate the receipt to a loan"
      );
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
        <span className="text-muted-foreground">ClickPesa reference</span>
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
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Payer</span>
        <span className="text-right">{payer?.name || "—"}</span>
      </div>
      {payer?.phone ? (
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Payer phone</span>
          <span className="font-mono text-xs">{payer.phone}</span>
        </div>
      ) : null}
    </div>
  ) : null;

  const changeAllocationType = (next: AllocationType) => {
    typeTouchedRef.current = true;
    setAllocationType(next);
    setConfirming(false);
    setFieldErrors({});
    if (next === "individual") {
      setGroup(null);
      setGroupQuery("");
    } else {
      setCustomer(null);
      setCustomerQuery("");
      setLoans([]);
      setLoanId("");
      if (suggestedGroup && !group) {
        setGroup(suggestedGroup);
        const matchedBranch = catalogBranchForKey(suggestedGroup.branch_id, branches);
        if (matchedBranch) setBranchId(matchedBranch.id);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b pr-10 text-left">
          <SheetTitle>
            {result
              ? isGroupMode
                ? "Receipt allocated to group loans"
                : "Receipt allocated to loan"
              : confirming
                ? "Confirm allocation"
                : "Allocate repayment"}
          </SheetTitle>
          <SheetDescription>
            {result
              ? result.already_allocated
                ? "This receipt was already allocated. Cashbook was refreshed — no second payment was created."
                : isGroupMode
                  ? "Verified payment(s) were created from this ClickPesa receipt for the selected group."
                  : "A verified payment was created from this ClickPesa receipt. Penalty, fees, interest, and principal were allocated."
              : entry
                ? `Apply ${entry.entry_number} (${formatCurrency(entry.amount)}, receipt ${
                    entry.reference ?? "—"
                  }) after confirming the allocation type. The amount is taken from the original receipt and cannot be edited.`
                : "Apply this unmatched ClickPesa receipt after confirming the destination."}
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
              {isGroupMode
                ? "This creates verified Payment(s) from the original ClickPesa amount for the selected group. It does not post a second cashbook row from the browser."
                : "This creates one verified Payment from the original ClickPesa amount. It updates the loan schedule, penalties, and amount paid. It does not post a second cashbook row from the browser."}
            </p>
            {receiptSummary}
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{isGroupMode ? "Group loans" : "Individual loan"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch</span>
                <span>{branches.find((b) => b.id === branchId)?.name ?? branchId}</span>
              </div>
              {isGroupMode ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Group</span>
                    <span>{group ? `${group.group_name}${group.group_code ? ` · ${group.group_code}` : ""}` : "—"}</span>
                  </div>
                  {allocationRows.map((row) => (
                    <div key={row.loan.id} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {row.loan.customerDisplayName || row.loan.loan_number}
                      </span>
                      <span>
                        {row.loan.loan_number} · {formatCurrency(row.amount)}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">“{notes}”</p>
          </div>
        ) : (
          <FieldGroup className="gap-3 py-0">
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              The ClickPesa payer name is only a search hint. Confirm the allocation type and
              destination. This credits loan(s). Use Classify as income if this money should not
              reduce a loan.
            </p>
            {receiptSummary}
            <Field>
              <FieldLabel>Allocation type</FieldLabel>
              <RadioGroup
                value={allocationType}
                onValueChange={(value) => changeAllocationType(value as AllocationType)}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="allocate-type-individual"
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal",
                    allocationType === "individual" && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem id="allocate-type-individual" value="individual" />
                  Individual loan
                </Label>
                <Label
                  htmlFor="allocate-type-group"
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-normal",
                    allocationType === "group" && "border-primary bg-primary/5"
                  )}
                >
                  <RadioGroupItem id="allocate-type-group" value="group" />
                  Group loans
                </Label>
              </RadioGroup>
            </Field>
            {showSuggestedMatch ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                Suggested group match — verify before allocating.
                {suggestedGroup ? ` ${suggestedGroup.group_name}` : ""}
              </p>
            ) : null}
            <Field>
              <FieldLabel>Branch</FieldLabel>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v);
                  setCustomer(null);
                  setCustomerQuery("");
                  setGroup(null);
                  setGroupQuery("");
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
                  Salaam). It is not a Falco branch. Choose the branch that owns the
                  {isGroupMode ? " group" : " customer"}, such as Mbagala.
                </p>
              )}
            </Field>
            {isGroupMode ? (
              <>
              <Field>
                <FieldLabel>Group</FieldLabel>
                <Input
                  className={cn("h-9", fieldErrors.group && "border-destructive")}
                  placeholder="Search by group name or code"
                  value={group ? group.group_name : groupQuery}
                  onChange={(e) => {
                    setGroup(null);
                    setGroupQuery(e.target.value);
                  }}
                />
                {groupSearching ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading groups…
                  </p>
                ) : null}
                {!group ? (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {groupResults.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        {groupQuery.trim()
                          ? "No matching active Falco group. The payer name is only a hint — search by the exact group name or code."
                          : "Type a group name or code. Search is not limited to the selected branch."}
                      </p>
                    ) : (
                      groupResults.map((g) => {
                        const assignedBranch = catalogBranchForKey(g.branch_id, branches);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
                            onClick={() => {
                              setGroup(g);
                              setGroupQuery("");
                              const matched = catalogBranchForKey(g.branch_id, branches);
                              if (matched) setBranchId(matched.id);
                            }}
                          >
                            <Check
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0",
                                group?.id === g.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate text-sm">{g.group_name}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {[g.group_code, assignedBranch?.name ?? (g.branch_id || "Unassigned branch")]
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
                      setGroup(null);
                      setGroupQuery("");
                    }}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Clear group
                  </Button>
                )}
                {fieldErrors.group ? <p className="text-xs text-destructive">{fieldErrors.group}</p> : (
                  <p className="text-xs text-muted-foreground">
                    Confirm this is the Falco group that should receive the repayment. Do not rely on
                    the ClickPesa payer name alone.
                  </p>
                )}
              </Field>
              {group ? (
                <Field>
                  <FieldLabel>Split across group loans</FieldLabel>
                  {groupLoansLoading ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading payable group loans…
                    </p>
                  ) : groupLoans.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      This group has no active or in-arrears member loans. Use Classify as income if
                      this money should not reduce a loan.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() =>
                            setGroupAmounts(amountsFromLoans(groupLoans, receiptAmount))
                          }
                        >
                          Split by outstanding
                        </Button>
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-md border">
                        {groupLoans.map((loan) => {
                          const outstanding = Math.round(Number(loan.total_outstanding) || 0);
                          const amount = groupAmounts[loan.id] ?? 0;
                          return (
                            <div
                              key={loan.id}
                              className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm">
                                  {loan.customerDisplayName || loan.loan_number}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {loan.loan_number} · {formatCurrency(outstanding)} outstanding
                                </p>
                              </div>
                              <Input
                                className={cn(
                                  "h-8 w-28 text-right",
                                  amount > outstanding && "border-destructive"
                                )}
                                inputMode="numeric"
                                value={amount || ""}
                                onChange={(e) => {
                                  const next = Math.max(
                                    0,
                                    Math.round(Number(e.target.value.replace(/[^\d]/g, "")) || 0)
                                  );
                                  setGroupAmounts((prev) => ({ ...prev, [loan.id]: next }));
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Allocated</span>
                        <span className={allocationRemaining === 0 ? "text-foreground" : "text-destructive"}>
                          {formatCurrency(allocationTotal)} / {formatCurrency(receiptAmount)}
                          {allocationRemaining === 0
                            ? ""
                            : ` · ${formatCurrency(Math.abs(allocationRemaining))} ${
                                allocationRemaining > 0 ? "left" : "over"
                              }`}
                        </span>
                      </div>
                    </div>
                  )}
                  {fieldErrors.allocation ? (
                    <p className="text-xs text-destructive">{fieldErrors.allocation}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The receipt total must be split across member loans. Amounts cannot exceed each
                      loan’s outstanding balance.
                    </p>
                  )}
                </Field>
              ) : null}
              </>
            ) : (
              <>
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
                        ? "No matching Falco customer. Try the customer number or a shorter name."
                        : "Type a name, phone, or customer number. Search is not limited to the selected branch."}
                    </p>
                  ) : (
                    customerResults.map((c) => {
                      const assignedBranch = catalogBranchForKey(c.branch_id, branches);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full items-start gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
                          onClick={() => {
                            setCustomer(c);
                            setCustomerQuery("");
                            const matched = catalogBranchForKey(c.branch_id, branches);
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
              </>
            )}
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
                Allocate repayment
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
