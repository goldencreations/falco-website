"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Filter,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/dashboard-header";
import { AllocateToLoanDialog } from "@/components/cashbook/allocate-to-loan-dialog";
import { useOptionalBranchAssignment } from "@/components/branch-assignment-context";
import { ListPaginationBar, paginateItems } from "@/components/list-pagination-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { extractCustomersList } from "@/lib/customer-adapters";
import {
  financialEntryCategoryLabel,
  financialEntryDisplayLabel,
  financialEntryIsReversible,
  financialEntryMethodLabel,
  FINANCIAL_ENTRY_TYPE_OPTIONS,
  financialEntryNeedsClassification,
  financialEntryOrderReference,
  financialEntryPayerHint,
  financialEntrySourceBadgeLabel,
  mergeFinancialEntriesById,
  sortFinancialEntriesChronologically,
} from "@/lib/financial-entry-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import {
  canAllocateCashbookToLoan,
  canClassifyCashbookEntry,
  canManageCashbook,
  canReverseCashbookEntry,
  canViewCashbook,
  canViewUnmatchedCashbookQueue,
  cashbookScopedBranchId,
} from "@/lib/cashbook-access";
import { forceCachedReload, invalidateFetchCache } from "@/lib/client-fetch-cache";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  invalidateUnmatchedClickPesaQueueCache,
  useUnmatchedClickPesaQueue,
} from "@/lib/use-unmatched-clickpesa-queue";
import { cn } from "@/lib/utils";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { CashbookSummary, Customer, FinancialEntry, FinancialEntryDirection, FinancialEntrySource } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";
import {
  listRowRevealClassName,
  listRowRevealStyle,
  useListRevealKey,
} from "@/lib/list-row-reveal";

const PAGE_SIZE = 8;

const MANUAL_CATEGORY_PRESETS = ["office_expense", "bank_deposit", "cash_transfer", "other"];

type CashbookSavedView =
  | "all"
  | "auto_loan_repayments"
  | "auto_registration_fees"
  | "unmatched"
  | "superseded_legacy";

const CASHBOOK_SAVED_VIEWS: { value: CashbookSavedView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unmatched", label: "Unmatched / Needs investigation" },
  { value: "auto_loan_repayments", label: "Automatic loan repayments" },
  { value: "auto_registration_fees", label: "Automatic registration fees" },
  { value: "superseded_legacy", label: "Superseded legacy receipts" },
];

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function directionBadge(direction: FinancialEntryDirection) {
  if (direction === "in") {
    return (
      <Badge variant="default" className="gap-1 bg-accent text-accent-foreground">
        <ArrowDownCircle className="h-3 w-3" />
        Cash in
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-destructive">
      <ArrowUpCircle className="h-3 w-3" />
      Cash out
    </Badge>
  );
}

function sourceBadge(entry: FinancialEntry) {
  if (financialEntryNeedsClassification(entry)) {
    return (
      <Badge
        variant="secondary"
        className="gap-1"
        title="This money was received in ClickPesa but Falco could not match the BillPay number. Classify it as income. This does not repay a loan."
      >
        <Sparkles className="h-3 w-3" />
        ClickPesa unmatched
      </Badge>
    );
  }
  return <Badge variant="outline">{financialEntrySourceBadgeLabel(entry)}</Badge>;
}

export default function CashbookPage() {
  const { user, loaded: sessionLoaded } = useSessionUser();
  const searchParams = useSearchParams();
  const branchCtx = useOptionalBranchAssignment();
  const branches = branchCtx?.branches ?? [];
  const scopedBranchId = user ? cashbookScopedBranchId(user) : null;

  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [cashbook, setCashbook] = useState<CashbookSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [listRevealKey, bumpListReveal] = useListRevealKey();

  const [branchFilter, setBranchFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState<"all" | FinancialEntryDirection>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | FinancialEntrySource>("all");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "loan_repayment" | "registration_fee" | "unclassified_gateway_income"
  >("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "posted" | "reversed">("all");
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(false);
  const [savedView, setSavedView] = useState<CashbookSavedView>("all");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(todayInputDate);

  const ledgerBranchId = scopedBranchId ?? (branchFilter !== "all" ? branchFilter : undefined);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDirection, setCreateDirection] = useState<FinancialEntryDirection>("out");
  const [createCategory, setCreateCategory] = useState("office_expense");
  const [createAmount, setCreateAmount] = useState("");
  const [createDate, setCreateDate] = useState(todayInputDate);
  const [createNotes, setCreateNotes] = useState("");
  const [createBranchId, setCreateBranchId] = useState<string>(scopedBranchId ?? "");
  const [createLoading, setCreateLoading] = useState(false);

  const [classifyEntry, setClassifyEntry] = useState<FinancialEntry | null>(null);
  const [classifyBranchId, setClassifyBranchId] = useState("");
  const [classifyCategory, setClassifyCategory] = useState("");
  const [classifyIncomeType, setClassifyIncomeType] = useState("");
  const [classifyBelongsToCustomer, setClassifyBelongsToCustomer] = useState(false);
  const [classifySelectedCustomer, setClassifySelectedCustomer] = useState<Customer | null>(null);
  const [classifyCustomerQuery, setClassifyCustomerQuery] = useState("");
  const [classifyCustomerResults, setClassifyCustomerResults] = useState<Customer[]>([]);
  const [classifyCustomerSearching, setClassifyCustomerSearching] = useState(false);
  const [classifyCustomerComboOpen, setClassifyCustomerComboOpen] = useState(false);
  const [classifyReason, setClassifyNotes] = useState("");
  const [classifyConfirming, setClassifyConfirming] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyFieldErrors, setClassifyFieldErrors] = useState<Record<string, string>>({});
  const classifySearchToken = useRef(0);

  const [allocateEntry, setAllocateEntry] = useState<FinancialEntry | null>(null);

  const [reverseEntry, setReverseEntry] = useState<FinancialEntry | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reverseLoading, setReverseLoading] = useState(false);

  const canAccess = user ? canViewCashbook(user) : false;
  const canViewUnmatchedQueue = user ? canViewUnmatchedCashbookQueue(user) : false;
  const canManage = user ? canManageCashbook(user) : false;
  const canClassify = user ? canClassifyCashbookEntry(user) : false;
  const canAllocateToLoan = user ? canAllocateCashbookToLoan(user) : false;
  const canReverse = user ? canReverseCashbookEntry(user) : false;
  const canViewPayments =
    user?.role === "super_admin" ||
    user?.role === "accountant" ||
    user?.role === "branch_manager" ||
    Boolean(user?.permissions?.includes("payments.view"));

  const {
    count: unmatchedCount,
    error: unmatchedError,
    refresh: refreshUnmatchedQueue,
  } = useUnmatchedClickPesaQueue({
    fromDate,
    toDate,
    user,
    scopedBranchId,
    enabled: canViewUnmatchedQueue,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (unclassifiedOnly) {
        if (!canViewUnmatchedQueue) {
          setError("You do not have permission to view the unmatched queue.");
          return;
        }
        const unmatchedResult = await refreshUnmatchedQueue();
        if (unmatchedResult.error) {
          setError(unmatchedResult.error);
          return;
        }
        setEntries(unmatchedResult.entries);
        setCashbook(null);
        bumpListReveal();
        return;
      }

      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("page_size", "500");
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (ledgerBranchId) params.set("branch_id", ledgerBranchId);
      if (directionFilter !== "all") params.set("direction", directionFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/financial-entries?${params.toString()}`, { credentials: "include" });
      const { data } = await parseJsonResponse<{
        entries?: FinancialEntry[];
        data?: FinancialEntry[];
        cashbook?: CashbookSummary | null;
        message?: string;
      }>(res);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Please sign in again and retry.");
          setEntries([]);
          setCashbook(null);
          return;
        }
        if (res.status === 403) {
          setError("You do not have permission to view the cashbook.");
          setEntries([]);
          setCashbook(null);
          return;
        }
        throw new Error(formatApiResponseError(data, "Failed to load the cashbook"));
      }

      const mainRows = data?.entries ?? data?.data ?? [];
      let merged = sortFinancialEntriesChronologically(mainRows);
      if (canViewUnmatchedQueue) {
        const unmatchedResult = await refreshUnmatchedQueue();
        if (!unmatchedResult.error) {
          merged = mergeFinancialEntriesById(mainRows, unmatchedResult.entries);
        }
      }
      setEntries(merged);
      setCashbook(data?.cashbook ?? null);
      bumpListReveal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the cashbook");
      if (!unclassifiedOnly) {
        setEntries([]);
        setCashbook(null);
      }
    } finally {
      setLoading(false);
    }
  }, [
    fromDate,
    toDate,
    directionFilter,
    sourceFilter,
    categoryFilter,
    statusFilter,
    unclassifiedOnly,
    ledgerBranchId,
    bumpListReveal,
    canViewUnmatchedQueue,
    refreshUnmatchedQueue,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, directionFilter, sourceFilter, categoryFilter, statusFilter, unclassifiedOnly, ledgerBranchId, savedView]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [page, entries.length]);

  const pagedEntries = useMemo(() => paginateItems(entries, page, PAGE_SIZE), [entries, page]);

  const applySavedView = (view: CashbookSavedView) => {
    setSavedView(view);
    switch (view) {
      case "auto_loan_repayments":
        setUnclassifiedOnly(false);
        setSourceFilter("system");
        setCategoryFilter("loan_repayment");
        setStatusFilter("posted");
        setDirectionFilter("all");
        break;
      case "auto_registration_fees":
        setUnclassifiedOnly(false);
        setSourceFilter("system");
        setCategoryFilter("registration_fee");
        setStatusFilter("posted");
        setDirectionFilter("all");
        break;
      case "unmatched":
        setUnclassifiedOnly(true);
        setSourceFilter("clickpesa");
        setCategoryFilter("unclassified_gateway_income");
        setStatusFilter("posted");
        setDirectionFilter("all");
        break;
      case "superseded_legacy":
        setUnclassifiedOnly(false);
        setSourceFilter("clickpesa");
        setCategoryFilter("all");
        setStatusFilter("reversed");
        setDirectionFilter("all");
        break;
      default:
        setUnclassifiedOnly(false);
        setSourceFilter("all");
        setCategoryFilter("all");
        setStatusFilter("all");
        setDirectionFilter("all");
        break;
    }
  };

  useEffect(() => {
    const view = searchParams.get("view");
    if (
      canViewUnmatchedQueue &&
      (view === "unmatched" || view === "needs_investigation")
    ) {
      applySavedView("unmatched");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canViewUnmatchedQueue]);

  const handleCreate = async () => {
    const amount = Number(createAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setCreateLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        direction: createDirection,
        category: createCategory,
        amount,
        transaction_date: createDate,
        notes: createNotes.trim() || undefined,
      };
      if (createBranchId) body.branch_id = createBranchId;

      const res = await fetch("/api/financial-entries", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Please sign in again and retry.");
          return;
        }
        setError(formatApiResponseError(data, "Failed to record the entry"));
        return;
      }
      setIsCreateOpen(false);
      setCreateAmount("");
      setCreateNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record the entry");
    } finally {
      setCreateLoading(false);
    }
  };

  const openClassify = (entry: FinancialEntry) => {
    setClassifyEntry(entry);
    setClassifyBranchId(scopedBranchId ?? entry.branch_id ?? "");
    setClassifyCategory("");
    setClassifyIncomeType("other_income");
    setClassifyBelongsToCustomer(false);
    setClassifySelectedCustomer(null);
    setClassifyCustomerQuery("");
    setClassifyCustomerResults([]);
    setClassifyNotes(
      entry.reference ? `Confirmed against ClickPesa receipt ${entry.reference}` : ""
    );
    setClassifyConfirming(false);
    setClassifyFieldErrors({});
  };

  /** Maps `PATCH .../classification` validation `details[]` onto the form fields that produced them. */
  const applyClassifyFieldErrors = (details: unknown): boolean => {
    if (!Array.isArray(details)) return false;
    const map: Record<string, string> = {};
    for (const d of details as { field?: string; message?: string }[]) {
      const field = (d.field ?? "").toLowerCase();
      const message = d.message ?? "";
      if (!message) continue;
      if (field.includes("branch")) map.branch = message;
      else if (field.includes("customer")) map.customer = message;
      else if (field.includes("categor")) map.category = message;
      else if (field.includes("entry_type") || field.includes("income")) map.entry_type = message;
      else if (field.includes("note") || field.includes("description") || field.includes("reason")) map.reason = message;
    }
    if (Object.keys(map).length === 0) return false;
    setClassifyFieldErrors(map);
    return true;
  };

  const classifyIsValid = Boolean(
    classifyBranchId.trim() &&
      classifyCategory.trim() &&
      classifyReason.trim() &&
      (!classifyBelongsToCustomer || classifySelectedCustomer?.id)
  );

  const handleClassify = async () => {
    if (!classifyEntry || !classifyIsValid) return;
    setClassifyLoading(true);
    setError(null);
    setClassifyFieldErrors({});
    try {
      const body: Record<string, unknown> = {
        branch_id: classifyBranchId.trim(),
        category: classifyCategory.trim(),
        entry_type: classifyIncomeType.trim() || "other_income",
        customer_id: classifyBelongsToCustomer ? classifySelectedCustomer?.id : undefined,
        description: "ClickPesa unmatched receipt classified after review",
        classification_notes: classifyReason.trim(),
      };
      const res = await fetch(
        `/api/financial-entries/${encodeURIComponent(classifyEntry.id)}/classification`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Please sign in again and retry.");
          return;
        }
        if (res.status === 404) {
          setError("This receipt no longer exists — refreshing the list.");
          setClassifyEntry(null);
          await load();
          return;
        }
        if (res.status === 422 && applyClassifyFieldErrors((data as { details?: unknown })?.details)) {
          setClassifyConfirming(false);
          return;
        }
        if (res.status === 409) {
          setError("This receipt was already allocated or handled.");
          return;
        }
        setError(formatApiResponseError(data, "Failed to classify the entry"));
        return;
      }
      const classifiedId = classifyEntry.id;
      setClassifyEntry(null);
      setEntries((prev) => prev.filter((row) => row.id !== classifiedId));
      toast.success("Receipt classified successfully.");
      invalidateUnmatchedClickPesaQueueCache();
      await Promise.all([load(), refreshUnmatchedQueue()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to classify the entry");
    } finally {
      setClassifyLoading(false);
    }
  };

  // Debounced customer search for the classify dialog's "belongs to a customer" combobox,
  // scoped to the branch selected for this classification (per the handoff spec).
  useEffect(() => {
    if (!classifyBelongsToCustomer || !classifyCustomerComboOpen) return;
    const token = ++classifySearchToken.current;
    const timer = window.setTimeout(async () => {
      setClassifyCustomerSearching(true);
      try {
        const loadCustomers = async (branchId?: string) => {
          const params = new URLSearchParams();
          if (classifyCustomerQuery.trim()) params.set("q", classifyCustomerQuery.trim());
          if (branchId?.trim()) params.set("branch_id", branchId.trim());
          params.set("page_size", "20");
          const res = await fetch(`/api/customers?${params.toString()}`, { credentials: "include" });
          const { data } = await parseJsonResponse<unknown>(res);
          if (!res.ok) return [] as Customer[];
          return extractCustomersList(data);
        };

        const scopedResults = await loadCustomers(classifyBranchId);
        if (classifySearchToken.current !== token) return;
        setClassifyCustomerResults(classifyBranchId.trim() ? scopedResults : []);
      } catch {
        if (classifySearchToken.current === token) {
          setClassifyCustomerResults([]);
        }
      } finally {
        if (classifySearchToken.current === token) setClassifyCustomerSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [classifyBelongsToCustomer, classifyCustomerComboOpen, classifyCustomerQuery, classifyBranchId]);

  const handleReverse = async () => {
    if (!reverseEntry || !reverseReason.trim()) return;
    setReverseLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/financial-entries/${encodeURIComponent(reverseEntry.id)}/reverse`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reverseReason.trim() }),
      });
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Please sign in again and retry.");
          return;
        }
        if (res.status === 404) {
          setError("This entry no longer exists — refreshing the list.");
          setReverseEntry(null);
          await load();
          return;
        }
        setError(formatApiResponseError(data, "Failed to reverse the entry"));
        return;
      }
      setReverseEntry(null);
      setReverseReason("");
      await load();
    } finally {
      setReverseLoading(false);
    }
  };

  const showRowActions = canClassify || canAllocateToLoan || canManage || canViewPayments;

  if (!sessionLoaded) {
    return (
      <>
        <DashboardHeader title="Cashbook" description="Loading…" />
        <main className="flex-1 p-4 lg:p-6">
          <p className="text-sm text-muted-foreground">Loading session…</p>
        </main>
      </>
    );
  }

  if (!canAccess) {
    return (
      <>
        <DashboardHeader title="Cashbook" description="Accountant, branch manager, or super admin access only." />
        <main className="flex-1 p-4 lg:p-6">
          <Card className="mx-auto max-w-3xl border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Access denied
              </CardTitle>
              <CardDescription>
                Branch managers can view the cashbook. Only accountants and the super admin can manage entries.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader
        title="Cashbook"
        description="Posted cash in and out, including unmatched ClickPesa receipts awaiting classification. Totals come from the server cashbook."
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Opening Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(cashbook?.opening_balance ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash In</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{formatCurrency(cashbook?.cash_in ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cash Out</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{formatCurrency(cashbook?.cash_out ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Closing Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <Wallet className="h-5 w-5 text-primary" />
                  {formatCurrency(cashbook?.closing_balance ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {unmatchedError ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-3 text-sm text-destructive">{unmatchedError}</CardContent>
            </Card>
          ) : null}

          {canViewUnmatchedQueue && unmatchedCount > 0 && !unclassifiedOnly ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm text-amber-900">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  {unmatchedCount} unmatched ClickPesa receipt{unmatchedCount === 1 ? "" : "s"} need
                  {unmatchedCount === 1 ? "s" : ""} classification as income. This money is already posted
                  cash in.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 bg-white hover:bg-amber-100"
                  onClick={() => applySavedView("unmatched")}
                >
                  View queue
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              {canViewUnmatchedQueue ? (
                <Tabs
                  value={unclassifiedOnly ? "unmatched" : "all"}
                  onValueChange={(v) => {
                    if (v === "unmatched") applySavedView("unmatched");
                    else if (unclassifiedOnly) applySavedView("all");
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="unmatched">
                      Unmatched / Needs investigation
                      {unmatchedCount > 0 ? ` (${unmatchedCount})` : ""}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              ) : null}
              <Select
                value={savedView}
                onValueChange={(v) => applySavedView(v as CashbookSavedView)}
              >
                <SelectTrigger className="w-[260px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Saved view" />
                </SelectTrigger>
                <SelectContent>
                  {CASHBOOK_SAVED_VIEWS.filter(
                    (view) => view.value !== "unmatched" || canViewUnmatchedQueue
                  ).map((view) => (
                    <SelectItem key={view.value} value={view.value}>
                      {view.label}
                      {view.value === "unmatched" && unmatchedCount > 0 ? ` (${unmatchedCount})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="w-40"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <Input
                type="date"
                className="w-40"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              <Select
                value={directionFilter}
                onValueChange={(v) => {
                  setSavedView("all");
                  setDirectionFilter(v as "all" | FinancialEntryDirection);
                }}
                disabled={unclassifiedOnly}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Direction</SelectItem>
                  <SelectItem value="in">Cash in</SelectItem>
                  <SelectItem value="out">Cash out</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sourceFilter}
                onValueChange={(v) => {
                  setSavedView("all");
                  setSourceFilter(v as "all" | FinancialEntrySource);
                }}
                disabled={unclassifiedOnly}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="clickpesa">ClickPesa</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setSavedView("all");
                  setCategoryFilter(
                    v as "all" | "loan_repayment" | "registration_fee" | "unclassified_gateway_income"
                  );
                }}
                disabled={unclassifiedOnly}
              >
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="loan_repayment">Loan repayment</SelectItem>
                  <SelectItem value="registration_fee">Registration fee</SelectItem>
                  <SelectItem value="unclassified_gateway_income">Unclassified gateway income</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setSavedView("all");
                  setStatusFilter(v as "all" | "posted" | "reversed");
                }}
                disabled={unclassifiedOnly}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
              {!scopedBranchId && branches.length > 0 ? (
                <Select value={branchFilter} onValueChange={setBranchFilter} disabled={unclassifiedOnly}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => forceCachedReload(load)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              {canManage ? (
                <Button type="button" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Entry
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading cashbook…
            </div>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entry #</TableHead>
                        <TableHead>Receipt ref</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Branch / Customer</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Running Balance</TableHead>
                        {showRowActions ? <TableHead className="text-right">Action</TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={showRowActions ? 11 : 10} className="py-8 text-center text-muted-foreground">
                            {unclassifiedOnly
                              ? unmatchedError
                                ? "Could not load unmatched receipts."
                                : "No unmatched ClickPesa receipts in this period."
                              : "No cashbook entries in this range"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedEntries.map((entry, index) => {
                          const unmatched = financialEntryNeedsClassification(entry);
                          const payer = unmatched ? financialEntryPayerHint(entry) : undefined;
                          const paymentId = entry.metadata?.payment_id;
                          return (
                          <TableRow
                            key={`${listRevealKey}-${page}-${entry.id}`}
                            className={listRowRevealClassName(entry.is_reversed ? "opacity-60" : undefined)}
                            style={listRowRevealStyle(index)}
                          >
                            <TableCell className="font-mono text-sm">{entry.entry_number}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {entry.reference ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(entry.transaction_date)}
                            </TableCell>
                            <TableCell>{directionBadge(entry.direction)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {unmatched ? (
                                  <Badge
                                    variant="secondary"
                                    title="This money was received in ClickPesa but Falco could not match the BillPay number. Classify it as income. This does not repay a loan."
                                  >
                                    Needs investigation
                                  </Badge>
                                ) : (
                                  <span>{financialEntryDisplayLabel(entry)}</span>
                                )}
                                {unmatched ? (
                                  <span className="text-xs text-muted-foreground">Unmatched ClickPesa receipt</span>
                                ) : null}
                                {entry.is_reversed ? (
                                  <span className="text-xs text-destructive">Reversed</span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{financialEntryMethodLabel(entry)}</TableCell>
                            <TableCell>{sourceBadge(entry)}</TableCell>
                            <TableCell className="text-sm">
                              <div className="flex flex-col">
                                <span>{entry.branch_name ?? (unmatched ? "Unassigned" : "—")}</span>
                                {entry.customer_name ? (
                                  <span className="text-xs text-muted-foreground">{entry.customer_name}</span>
                                ) : unmatched && (payer?.name || payer?.phone) ? (
                                  <span className="text-xs text-muted-foreground">
                                    {payer.name ?? "ClickPesa payer"}
                                    {payer.phone ? ` · ${payer.phone}` : ""}
                                  </span>
                                ) : null}
                                {unmatched && entry.account_name ? (
                                  <span className="text-xs text-muted-foreground">
                                    Account: {entry.account_name}
                                  </span>
                                ) : null}
                                {unmatched && financialEntryOrderReference(entry) ? (
                                  <span className="text-xs text-muted-foreground">
                                    Order: {financialEntryOrderReference(entry)}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell
                              className={`text-right font-semibold ${
                                entry.direction === "in" ? "text-accent" : "text-destructive"
                              }`}
                            >
                              {entry.direction === "in" ? "+" : "-"}
                              {formatCurrency(entry.amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(entry.running_balance)}
                            </TableCell>
                            {showRowActions ? (
                              <TableCell className="text-right">
                                {unmatched && (canAllocateToLoan || canClassify) ? (
                                  <div className="flex flex-col items-end gap-1">
                                    {canAllocateToLoan ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setAllocateEntry(entry)}
                                      >
                                        <Banknote className="mr-1 h-3.5 w-3.5" />
                                        Allocate repayment
                                      </Button>
                                    ) : null}
                                    {canClassify ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        title="This action classifies accounting income only. It does not credit a loan or update a repayment schedule."
                                        onClick={() => openClassify(entry)}
                                      >
                                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                        Classify as income
                                      </Button>
                                    ) : null}
                                  </div>
                                ) : paymentId && canViewPayments && entry.source === "system" ? (
                                  <Button type="button" size="sm" variant="outline" asChild>
                                    <Link href={`/payments?paymentId=${encodeURIComponent(String(paymentId))}`}>
                                      View payment
                                    </Link>
                                  </Button>
                                ) : financialEntryIsReversible(entry) && canReverse ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      setReverseEntry(entry);
                                      setReverseReason("");
                                    }}
                                  >
                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                    Reverse
                                  </Button>
                                ) : null}
                              </TableCell>
                            ) : null}
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <ListPaginationBar
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={entries.length}
                  loading={loading}
                  onPageChange={setPage}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New manual entry</DialogTitle>
            <DialogDescription>
              Record cash movement that isn&apos;t captured automatically (e.g. an office expense or a
              bank deposit).
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3 py-0">
            <Field>
              <FieldLabel>Direction</FieldLabel>
              <Select
                value={createDirection}
                onValueChange={(v) => setCreateDirection(v as FinancialEntryDirection)}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Cash in</SelectItem>
                  <SelectItem value="out">Cash out</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select value={createCategory} onValueChange={setCreateCategory}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_CATEGORY_PRESETS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {financialEntryCategoryLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Amount (TZS)</FieldLabel>
              <Input
                type="number"
                className="h-9"
                placeholder="Enter amount"
                value={createAmount}
                onChange={(e) => setCreateAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Transaction date</FieldLabel>
              <Input
                type="date"
                className="h-9"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
              />
            </Field>
            {!scopedBranchId && branches.length > 0 ? (
              <Field>
                <FieldLabel>Branch</FieldLabel>
                <Select value={createBranchId} onValueChange={setCreateBranchId}>
                  <SelectTrigger className="h-9 w-full">
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
              </Field>
            ) : null}
            <Field>
              <FieldLabel>Notes (optional)</FieldLabel>
              <Textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="What is this entry for?"
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={createLoading || !createAmount || !createCategory}
            >
              {createLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(classifyEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setClassifyEntry(null);
            setClassifyConfirming(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b pr-10 text-left">
            <SheetTitle>{classifyConfirming ? "Confirm classification" : "Classify as income"}</SheetTitle>
            <SheetDescription>
              {classifyEntry
                ? `Classify ${classifyEntry.entry_number} (${formatCurrency(classifyEntry.amount)}, receipt ${
                    classifyEntry.reference ?? "—"
                  }) as income. This does not create a payment or credit a loan.`
                : "Classify this unmatched ClickPesa receipt as income. This does not create a payment or credit a loan."}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {classifyConfirming && classifyEntry ? (
            <div className="space-y-3">
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This action classifies accounting income only. It does not credit a loan or update a
                repayment schedule.
              </p>
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{formatCurrency(classifyEntry.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider receipt</span>
                  <span className="font-mono">{classifyEntry.reference ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch</span>
                  <span>{branches.find((b) => b.id === classifyBranchId)?.name ?? classifyBranchId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>{financialEntryCategoryLabel(classifyCategory)}</span>
                </div>
                {classifyBelongsToCustomer ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span>
                      {classifySelectedCustomer
                        ? `${classifySelectedCustomer.first_name ?? ""} ${classifySelectedCustomer.last_name ?? ""}`.trim() ||
                          classifySelectedCustomer.id
                        : "—"}
                    </span>
                  </div>
                ) : null}
              </div>
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                “{classifyReason}”
              </p>
              <p className="text-xs text-muted-foreground">
                This only updates the accounting classification. It does not create a payment or change
                the loan&apos;s outstanding balance.
              </p>
            </div>
          ) : (
            <FieldGroup className="gap-3 py-0">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This action classifies accounting income only. It does not credit a loan or update a
                repayment schedule.
              </div>
              <Field>
                <FieldLabel>Branch</FieldLabel>
                <Select
                  value={classifyBranchId}
                  onValueChange={(v) => {
                    setClassifyBranchId(v);
                    setClassifySelectedCustomer(null);
                    setClassifyCustomerQuery("");
                    setClassifyCustomerResults([]);
                  }}
                >
                  <SelectTrigger className={cn("h-9 w-full", classifyFieldErrors.branch && "border-destructive")}>
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
                {classifyFieldErrors.branch ? (
                  <p className="text-xs text-destructive">{classifyFieldErrors.branch}</p>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Category</FieldLabel>
                <Input
                  className={cn("h-9", classifyFieldErrors.category && "border-destructive")}
                  placeholder="e.g. application_fee"
                  value={classifyCategory}
                  onChange={(e) => setClassifyCategory(e.target.value)}
                />
                {classifyFieldErrors.category ? (
                  <p className="text-xs text-destructive">{classifyFieldErrors.category}</p>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Entry type</FieldLabel>
                <Select value={classifyIncomeType} onValueChange={setClassifyIncomeType}>
                  <SelectTrigger
                    className={cn("h-9 w-full", classifyFieldErrors.entry_type && "border-destructive")}
                  >
                    <SelectValue placeholder="Select entry type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FINANCIAL_ENTRY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {classifyFieldErrors.entry_type ? (
                  <p className="text-xs text-destructive">{classifyFieldErrors.entry_type}</p>
                ) : null}
              </Field>
              <Field>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="classify-belongs-to-customer"
                    checked={classifyBelongsToCustomer}
                    onCheckedChange={(v) => {
                      setClassifyBelongsToCustomer(v === true);
                      if (v !== true) setClassifySelectedCustomer(null);
                    }}
                  />
                  <FieldLabel htmlFor="classify-belongs-to-customer" className="cursor-pointer font-normal">
                    This receipt belongs to a customer
                  </FieldLabel>
                </div>
                {classifyBelongsToCustomer ? (
                  <div className="mt-2 space-y-1">
                    <Popover open={classifyCustomerComboOpen} onOpenChange={setClassifyCustomerComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "h-9 w-full justify-between font-normal",
                            classifyFieldErrors.customer && "border-destructive"
                          )}
                        >
                          {classifySelectedCustomer ? (
                            <span className="truncate">
                              {`${classifySelectedCustomer.first_name ?? ""} ${classifySelectedCustomer.last_name ?? ""}`.trim() ||
                                classifySelectedCustomer.id}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Search customer by name or phone…</span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder={classifyBranchId ? "Search customers…" : "Select a branch first…"}
                            value={classifyCustomerQuery}
                            onValueChange={setClassifyCustomerQuery}
                            disabled={!classifyBranchId}
                          />
                          <CommandList>
                            {classifyCustomerSearching ? (
                              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Searching…
                              </div>
                            ) : (
                              <>
                                <CommandEmpty>
                                  {classifyBranchId ? "No customers found." : "Choose a branch to search customers."}
                                </CommandEmpty>
                                <CommandGroup>
                                  {classifyCustomerResults.map((c) => (
                                    <CommandItem
                                      key={c.id}
                                      value={c.id}
                                      onSelect={() => {
                                        setClassifySelectedCustomer(c);
                                        setClassifyCustomerComboOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          classifySelectedCustomer?.id === c.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>
                                          {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.id}
                                        </span>
                                        {c.phone_primary ? (
                                          <span className="text-xs text-muted-foreground">{c.phone_primary}</span>
                                        ) : null}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {classifySelectedCustomer ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => setClassifySelectedCustomer(null)}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Clear customer
                      </Button>
                    ) : null}
                    {classifyFieldErrors.customer ? (
                      <p className="text-xs text-destructive">{classifyFieldErrors.customer}</p>
                    ) : null}
                  </div>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Evidence / reason for classification</FieldLabel>
                <Textarea
                  className={classifyFieldErrors.reason ? "border-destructive" : undefined}
                  value={classifyReason}
                  onChange={(e) => setClassifyNotes(e.target.value)}
                  placeholder="e.g. Confirmed against ClickPesa receipt MP260817.1123.Q86853"
                />
                {classifyFieldErrors.reason ? (
                  <p className="text-xs text-destructive">{classifyFieldErrors.reason}</p>
                ) : null}
              </Field>
            </FieldGroup>
          )}
          </div>

          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            {classifyConfirming ? (
              <>
                <Button type="button" variant="outline" onClick={() => setClassifyConfirming(false)}>
                  Back
                </Button>
                <Button type="button" onClick={() => void handleClassify()} disabled={classifyLoading}>
                  {classifyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Classify as income
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setClassifyEntry(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => setClassifyConfirming(true)}
                  disabled={!classifyIsValid}
                >
                  Review &amp; confirm
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AllocateToLoanDialog
        entry={allocateEntry}
        branches={branches}
        scopedBranchId={scopedBranchId}
        open={Boolean(allocateEntry)}
        onOpenChange={(open) => {
          if (!open) setAllocateEntry(null);
        }}
        onError={setError}
        onAllocated={(allocation) => {
          const allocatedId = allocateEntry?.id;
          if (allocatedId) setEntries((prev) => prev.filter((row) => row.id !== allocatedId));
          invalidateFetchCache();
          invalidateUnmatchedClickPesaQueueCache();
          toast.success("Receipt allocated to loan successfully.");
          void Promise.all([load(), refreshUnmatchedQueue()]);
          const loanId = allocation.loan_id;
          void fetch("/api/payments?page=1&page_size=50", { credentials: "include" });
          if (loanId) {
            void fetch(`/api/loans/${encodeURIComponent(loanId)}`, { credentials: "include" });
            void fetch(`/api/loans/${encodeURIComponent(loanId)}/schedule`, { credentials: "include" });
          }
          if (user?.role === "super_admin" || user?.role === "accountant") {
            void fetch("/api/webhook-events/health?gateway=clickpesa&hours=24", { credentials: "include" });
          }
        }}
      />

      <Dialog open={Boolean(reverseEntry)} onOpenChange={(open) => !open && setReverseEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse entry</DialogTitle>
            <DialogDescription>
              This creates a compensating entry and restores the cashbook balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <FieldLabel htmlFor="cashbook-reversal-reason">Reason</FieldLabel>
            <Textarea
              id="cashbook-reversal-reason"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Why is this entry being reversed?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReverseEntry(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reverseLoading || !reverseReason.trim()}
              onClick={() => void handleReverse()}
            >
              {reverseLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
