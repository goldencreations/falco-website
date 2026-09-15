"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  FileText,
  Landmark,
  Loader2,
  Plus,
  ShieldAlert,
  Smartphone,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import {
  type DisbursementViewRow,
  type EligibleLoanRow,
  isValidTanzanianMsisdn,
  normalizeTanzanianMsisdn,
} from "@/lib/disbursement-adapters";
import type { EligibleApplicationRow } from "@/lib/disbursement-eligible";
import type { LoanApplicationStatus } from "@/lib/types";
import {
  DISBURSEMENT_CHANNEL_LABELS,
  type DisbursementPaymentChannel,
} from "@/lib/disbursement-types";
import { canPrepareDisbursement as userCanPrepareDisbursement } from "@/lib/disbursement-permissions";
import { canFinalApproveApplication } from "@/lib/application-workflow-permissions";
import { useSessionUser } from "@/lib/use-session-user";
import { resolvePortalHref, resolvePortalPathFromPathname } from "@/lib/portal-paths";
import { formatCurrency } from "@/lib/formatters";
import { formatApiResponseError } from "@/lib/falco-api";
import { parseJsonResponse } from "@/lib/parse-json-response";

const MOBILE_CHANNELS: DisbursementPaymentChannel[] = [
  "mpesa",
  "airtel_money",
  "yas",
  "halopesa",
];
const BANK_CHANNELS: DisbursementPaymentChannel[] = ["crdb", "nmb"];

const APPLICATION_STATUS_LABELS: Record<LoanApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  pending_disbursement: "Pending disbursement",
  rejected: "Rejected",
  disbursed: "Disbursed",
  cancelled: "Cancelled",
};

const CHANNEL_OPTIONS = Object.keys(
  DISBURSEMENT_CHANNEL_LABELS
) as DisbursementPaymentChannel[];

function isTimeoutOrInProgressError(message: string): boolean {
  return /cURL error 28|timed out|timeout|already in progress|already exists|duplicate|in[- ]?flight/i.test(
    message
  );
}

export function DisbursementCreateForm() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loaded: sessionLoaded } = useSessionUser();
  const listHref =
    resolvePortalPathFromPathname(pathname, "/disbursements") ||
    resolvePortalHref(user?.role, "/disbursements");
  const pendingReviewHref = resolvePortalHref(user?.role, "/applications/pending-review");

  const goToDisbursementsList = useCallback(() => {
    router.replace(listHref);
    router.refresh();
  }, [router, listHref]);

  const canPrepareDisbursement = user
    ? userCanPrepareDisbursement({
        role: user.role,
        permissions: user.permissions ?? [],
      })
    : false;
  const canFinalizeApproval = user
    ? canFinalApproveApplication({
        role: user.role,
        permissions: user.permissions ?? [],
      })
    : false;
  const isBranchScoped =
    user?.role === "branch_manager" ||
    user?.role === "loan_officer" ||
    user?.role === "accountant";

  const [eligibleLoans, setEligibleLoans] = useState<EligibleLoanRow[]>([]);
  const [eligibleApplications, setEligibleApplications] = useState<EligibleApplicationRow[]>([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [preparingApplicationId, setPreparingApplicationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formLoan, setFormLoan] = useState("");
  const [formApplicationId, setFormApplicationId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formMethod, setFormMethod] = useState<DisbursementPaymentChannel>("mpesa");
  const [formAccountName, setFormAccountName] = useState("");
  const [formAccountNumber, setFormAccountNumber] = useState("");
  const [formBankName, setFormBankName] = useState("");
  const [formBankBic, setFormBankBic] = useState("");
  const [formBankTransferType, setFormBankTransferType] = useState<"ACH" | "RTGS">("ACH");
  const [formNotes, setFormNotes] = useState("");
  const [loanIdPrefillApplied, setLoanIdPrefillApplied] = useState(false);

  const loadEligibleLoans = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const res = await fetch("/api/disbursements/eligible-loans", {
        credentials: "include",
        cache: "no-store",
      });
      const { data } = await parseJsonResponse<{
        eligible_loans?: EligibleLoanRow[];
        eligible_applications?: EligibleApplicationRow[];
        branch_scope?: string | null;
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : "Failed to load eligible loans"
        );
      }
      if (!data) throw new Error("Eligible loans could not be loaded.");
      setEligibleLoans(data.eligible_loans ?? []);
      setEligibleApplications(data.eligible_applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load eligible loans");
      setEligibleLoans([]);
      setEligibleApplications([]);
    } finally {
      setEligibleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEligibleLoans();
  }, [loadEligibleLoans]);

  useEffect(() => {
    if (loanIdPrefillApplied) return;
    const loanId = searchParams.get("loanId")?.trim();
    if (!loanId) {
      setLoanIdPrefillApplied(true);
      return;
    }
    setFormLoan(loanId);
    setLoanIdPrefillApplied(true);
  }, [searchParams, loanIdPrefillApplied]);

  const selectableApplications = useMemo(
    () =>
      eligibleApplications.filter(
        (a) =>
          (Boolean(a.loan_id) && a.ready_for_disbursement) ||
          (Boolean(a.needs_final_approval) && canFinalizeApproval)
      ),
    [eligibleApplications, canFinalizeApproval]
  );

  const awaitingAdminFinalApproval = useMemo(
    () =>
      eligibleApplications.filter(
        (a) => Boolean(a.needs_final_approval) && !a.loan_id && !canFinalizeApproval
      ),
    [eligibleApplications, canFinalizeApproval]
  );

  const selectableLoans = useMemo(() => {
    const byId = new Map<string, EligibleLoanRow>();
    for (const loan of eligibleLoans) {
      if (loan.id) byId.set(loan.id, loan);
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.loan_number.localeCompare(b.loan_number)
    );
  }, [eligibleLoans, selectableApplications]);

  const approvedAwaitingLoan = selectableApplications.filter(
    (a) => Boolean(a.needs_final_approval) && !a.loan_id && canFinalizeApproval
  );
  const canSelectForDisbursement =
    selectableLoans.length > 0 ||
    selectableApplications.some((a) => a.loan_id && a.ready_for_disbursement) ||
    approvedAwaitingLoan.length > 0;

  useEffect(() => {
    if (!formLoan) return;
    const row = selectableLoans.find((l) => l.id === formLoan);
    if (row && row.remaining > 0) {
      setFormAmount(String(Math.round(row.remaining)));
    }
  }, [formLoan, selectableLoans]);

  const selectedEligible = useMemo(() => {
    if (!formLoan) return undefined;
    const fromLoans = selectableLoans.find((l) => l.id === formLoan);
    if (fromLoans) return fromLoans;
    return undefined;
  }, [formLoan, selectableLoans, eligibleApplications]);

  const addLoanToFormState = useCallback(
    (app: EligibleApplicationRow, loanId: string, loanNumber?: string) => {
      const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
      setEligibleApplications((prev) =>
        prev.map((a) =>
          a.id === app.id
            ? {
                ...a,
                loan_id: loanId,
                loan_number: loanNumber ?? a.loan_number,
                ready_for_disbursement: true,
                needs_final_approval: false,
              }
            : a
        )
      );
      setEligibleLoans((prev) => {
        if (prev.some((l) => l.id === loanId)) return prev;
        return [
          ...prev,
          {
            id: loanId,
            loan_number: loanNumber ?? loanId,
            customer_id: "",
            branch_id: app.branch_id,
            principal_amount: amount,
            remaining: amount,
            customer_display_name: app.customer_display_name,
            application_id: app.id,
            application_number: app.application_number,
            application_status: app.status,
          },
        ];
      });
      setFormLoan(loanId);
      setFormAmount(String(Math.round(amount)));
    },
    []
  );

  const prepareApplicationForDisbursement = useCallback(
    async (app: EligibleApplicationRow): Promise<{ loanId: string; loanNumber?: string }> => {
      const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
      const res = await fetch(
        `/api/applications/${encodeURIComponent(app.id)}/prepare-disbursement`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved_amount: amount }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const detailParts: string[] = [];
        if (typeof data.message === "string") detailParts.push(data.message);
        if (Array.isArray(data.details)) {
          for (const d of data.details) {
            if (d && typeof d === "object" && typeof d.message === "string") {
              detailParts.push(d.field ? `${d.field}: ${d.message}` : d.message);
            }
          }
        }
        throw new Error(
          detailParts.join(" — ") || data.error || "Could not prepare loan for disbursement"
        );
      }
      const loanId =
        typeof data.loan_id === "string" && data.loan_id.trim() ? data.loan_id.trim() : null;
      if (!loanId) throw new Error("The loan account could not be prepared.");
      const loanNumber =
        typeof data.loan_number === "string" && data.loan_number.trim()
          ? data.loan_number.trim()
          : undefined;
      return { loanId, loanNumber };
    },
    []
  );

  const selectApplication = useCallback(
    async (app: EligibleApplicationRow) => {
      setFormApplicationId(app.id);
      setError(null);
      if (app.loan_id) {
        setFormLoan(app.loan_id);
        return;
      }
      const linked = selectableLoans.find(
        (l) =>
          l.application_id === app.id ||
          l.application_number?.toLowerCase() === app.application_number.toLowerCase()
      );
      if (linked) {
        setFormLoan(linked.id);
        return;
      }

      if (app.needs_final_approval && !canFinalizeApproval) {
        setError(
          "This application is manager-approved only. A super admin must give final approval on Pending Review before a loan account can be created for disbursement."
        );
        setFormLoan("");
        return;
      }

      if (
        !app.needs_final_approval &&
        !app.ready_for_disbursement &&
        app.status !== "approved"
      ) {
        return;
      }

      setPreparingApplicationId(app.id);
      try {
        const { loanId, loanNumber } = await prepareApplicationForDisbursement(app);
        addLoanToFormState(app, loanId, loanNumber);
        void loadEligibleLoans();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not prepare application for disbursement"
        );
      } finally {
        setPreparingApplicationId(null);
      }
    },
    [
      selectableLoans,
      prepareApplicationForDisbursement,
      loadEligibleLoans,
      addLoanToFormState,
      canFinalizeApproval,
    ]
  );

  useEffect(() => {
    if (!formApplicationId) return;
    const app = eligibleApplications.find((a) => a.id === formApplicationId);
    if (app?.loan_id) {
      setFormLoan(app.loan_id);
      return;
    }
    const linked = selectableLoans.find(
      (l) =>
        l.application_id === formApplicationId ||
        (app &&
          l.application_number?.toLowerCase() === app.application_number.toLowerCase())
    );
    if (linked) setFormLoan(linked.id);
  }, [formApplicationId, eligibleApplications, selectableLoans]);

  /**
   * On gateway timeout / "already in progress" create errors, look up the loan's existing
   * disbursement via `GET /disbursements?loan_id=` instead of allowing a second create.
   */
  const recoverExistingDisbursement = useCallback(
    async (loanId: string): Promise<DisbursementViewRow | null> => {
      if (!loanId) return null;
      try {
        const res = await fetch(
          `/api/disbursements?loan_id=${encodeURIComponent(loanId)}&include_eligible=0&page_size=10`,
          { credentials: "include", cache: "no-store" }
        );
        const { data } = await parseJsonResponse<{ disbursements?: DisbursementViewRow[] }>(
          res
        );
        if (!res.ok) return null;
        const found = Array.isArray(data?.disbursements) ? data.disbursements : [];
        if (found.length === 0) return null;
        const sorted = [...found].sort(
          (a, b) =>
            new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
        );
        return sorted[0];
      } catch {
        return null;
      }
    },
    []
  );

  const createAmountNum = Number(formAmount);
  const maxDisburseAmount = selectedEligible?.remaining ?? 0;
  const createAmountInvalid =
    Boolean(formLoan) &&
    formAmount !== "" &&
    (!Number.isFinite(createAmountNum) ||
      createAmountNum <= 0 ||
      (maxDisburseAmount > 0 && createAmountNum > maxDisburseAmount));
  const destinationInvalid =
    (MOBILE_CHANNELS.includes(formMethod) &&
      (!formAccountNumber.trim() ||
        !isValidTanzanianMsisdn(normalizeTanzanianMsisdn(formAccountNumber)))) ||
    (BANK_CHANNELS.includes(formMethod) &&
      (!formAccountName.trim() || !formAccountNumber.trim() || !formBankBic.trim()));

  const handleCreate = async () => {
    if (!formLoan) return;
    const amount = Number(formAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const body: Record<string, unknown> = {
      loan_id: formLoan,
      amount,
      method: formMethod,
      notes: formNotes || undefined,
    };
    if (MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)) {
      if (formAccountName) body.account_name = formAccountName;
      if (formAccountNumber) {
        body.account_number = MOBILE_CHANNELS.includes(formMethod)
          ? normalizeTanzanianMsisdn(formAccountNumber)
          : formAccountNumber;
      }
    }
    if (BANK_CHANNELS.includes(formMethod) && formBankName) body.bank_name = formBankName;
    if (BANK_CHANNELS.includes(formMethod)) {
      body.bank_bic = formBankBic.trim();
      body.bank_transfer_type = formBankTransferType;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/disbursements", {
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
        const message = formatApiResponseError(data, "Create failed");
        if (isTimeoutOrInProgressError(message)) {
          const recovered = await recoverExistingDisbursement(formLoan);
          if (recovered) {
            window.alert(
              "This payout may already be in progress. We found an existing disbursement — please confirm its status before creating another one."
            );
            goToDisbursementsList();
            return;
          }
          setError(
            `${message} This looks like a gateway timeout or duplicate payout — check the disbursements list for an existing record before retrying.`
          );
          return;
        }
        setError(message);
        return;
      }
      goToDisbursementsList();
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionLoaded && !canPrepareDisbursement) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2 text-muted-foreground">
          <Link href={listHref}>
            <ArrowLeft className="h-4 w-4" />
            Back to disbursements
          </Link>
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          You do not have permission to create disbursements.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2 text-muted-foreground">
        <Link href={listHref}>
          <ArrowLeft className="h-4 w-4" />
          Back to disbursements
        </Link>
      </Button>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card className="overflow-hidden border-0 bg-transparent py-0 shadow-none">
        <CardContent className="px-0 py-0 sm:px-0 lg:px-0">
          <FieldGroup className="gap-0">
            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <FileText className="h-3.5 w-3.5 text-emerald-700" />
                Loan applications
              </div>
              {eligibleLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading applications…
                </div>
              ) : eligibleApplications.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  No applications awaiting disbursement
                  {isBranchScoped ? " in your branch" : ""}. Manager review → super-admin final
                  approval (creates a pending-disbursement loan), then refresh.
                </p>
              ) : (
                <>
                  {awaitingAdminFinalApproval.length > 0 ? (
                    <div className="mb-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
                      <p className="font-medium text-foreground">
                        {awaitingAdminFinalApproval.length} application
                        {awaitingAdminFinalApproval.length === 1 ? "" : "s"} await super-admin final
                        approval
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Manager approval is done. Final approval on{" "}
                        <Link href={pendingReviewHref} className="text-primary hover:underline">
                          Pending Review
                        </Link>{" "}
                        creates the loan account before you can disburse.
                      </p>
                    </div>
                  ) : null}
                  {selectableApplications.length > 0 ? (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Click a ready row or use the selectors below ({selectableApplications.length}{" "}
                      ready).
                    </p>
                  ) : null}
                  <div className="max-h-[min(28rem,50vh)] overflow-y-auto rounded-xl border bg-muted/20">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8 text-[10px]">Application</TableHead>
                          <TableHead className="h-8 text-[10px]">Customer</TableHead>
                          <TableHead className="h-8 text-[10px]">Status</TableHead>
                          <TableHead className="h-8 text-right text-[10px]">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eligibleApplications.map((app) => {
                          const hasLinkedLoan = selectableLoans.some(
                              (l) =>
                                l.id === app.loan_id ||
                                l.application_id === app.id ||
                                l.application_number?.toLowerCase() ===
                                  app.application_number.toLowerCase()
                            );
                          const waitingForAdmin =
                            Boolean(app.needs_final_approval) &&
                            !hasLinkedLoan &&
                            !canFinalizeApproval;
                          const canSelect =
                            (hasLinkedLoan && app.ready_for_disbursement) ||
                            (Boolean(app.needs_final_approval) && canFinalizeApproval);
                          const isPreparing = preparingApplicationId === app.id;
                          return (
                            <TableRow
                              key={app.id}
                              className={cn(
                                canSelect && "cursor-pointer hover:bg-muted/50",
                                !canSelect && "opacity-70",
                                formApplicationId === app.id &&
                                  "bg-emerald-50/80 dark:bg-emerald-950/40"
                              )}
                              onClick={() => {
                                if (!canSelect && waitingForAdmin) {
                                  setFormApplicationId(app.id);
                                  setError(
                                    "This application is manager-approved only. A super admin must give final approval on Pending Review before a loan account can be created for disbursement."
                                  );
                                  return;
                                }
                                if (canSelect) void selectApplication(app);
                              }}
                              title={
                                isPreparing
                                  ? "Creating loan account…"
                                  : waitingForAdmin
                                    ? "Waiting for super-admin final approval"
                                    : !canSelect
                                      ? "Not ready for disbursement yet"
                                      : app.needs_final_approval && !app.loan_id
                                        ? "Final-approve and create loan account for disbursement"
                                        : "Select this application for disbursement"
                              }
                            >
                              <TableCell className="py-2 text-xs font-medium">
                                {app.application_number}
                              </TableCell>
                              <TableCell className="py-2 text-xs">
                                {app.customer_display_name || "—"}
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge
                                  variant={canSelect ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {isPreparing
                                    ? "Preparing…"
                                    : hasLinkedLoan
                                      ? "Ready for disbursement"
                                      : waitingForAdmin
                                        ? "Awaiting admin approval"
                                        : app.needs_final_approval
                                          ? "Ready to finalize"
                                          : APPLICATION_STATUS_LABELS[app.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2 text-right text-xs tabular-nums">
                                {formatCurrency(app.approved_amount || app.requested_amount)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Wallet className="h-3.5 w-3.5 text-emerald-700" />
                1. Select application / loan & amount
              </div>
              {!canSelectForDisbursement && !eligibleLoading ? (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <p className="font-medium text-foreground">
                    {awaitingAdminFinalApproval.length > 0
                      ? "Waiting for super-admin final approval"
                      : "No applications ready for disbursement"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {awaitingAdminFinalApproval.length > 0 ? (
                      <>
                        These applications are manager-approved. A super admin must finalize them on{" "}
                        <Link href={pendingReviewHref} className="text-primary hover:underline">
                          Pending Review
                        </Link>{" "}
                        before disbursement.
                      </>
                    ) : (
                      <>
                        Approve loan applications first, then{" "}
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => forceCachedReload(loadEligibleLoans)}
                        >
                          refresh
                        </button>
                        .{" "}
                        <Link href={pendingReviewHref} className="text-primary hover:underline">
                          Open pending review
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              ) : null}
              {approvedAwaitingLoan.length > 0 &&
              selectableLoans.length === 0 &&
              !eligibleLoading ? (
                <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/30">
                  <p className="font-medium text-foreground">
                    Select an approved application below
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    As super admin, picking an application runs final approval and creates the loan
                    account.
                  </p>
                </div>
              ) : null}
              <Field>
                <FieldLabel className="text-xs font-medium">Loan application</FieldLabel>
                <Select
                  value={formApplicationId}
                  onValueChange={(appId) => {
                    const app = eligibleApplications.find((a) => a.id === appId);
                    if (!app) return;
                    void selectApplication(app);
                  }}
                  disabled={eligibleLoading || eligibleApplications.length === 0}
                >
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue
                      placeholder={
                        eligibleLoading
                          ? "Loading applications…"
                          : eligibleApplications.length === 0
                            ? "No applications found"
                            : "Select application"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleApplications.map((app) => {
                      const hasLinkedLoan =
                        Boolean(app.loan_id) ||
                        selectableLoans.some(
                          (l) =>
                            l.application_id === app.id ||
                            l.application_number?.toLowerCase() ===
                              app.application_number.toLowerCase()
                        );
                      const canPick =
                        hasLinkedLoan ||
                        app.ready_for_disbursement ||
                        (Boolean(app.needs_final_approval) && canFinalizeApproval);
                      const waitingForAdmin =
                        Boolean(app.needs_final_approval) &&
                        !hasLinkedLoan &&
                        !canFinalizeApproval;
                      return (
                        <SelectItem
                          key={app.id}
                          value={app.id}
                          disabled={!canPick || preparingApplicationId === app.id}
                        >
                          <span className="font-medium">{app.application_number}</span>
                          {app.customer_display_name ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {app.customer_display_name}
                            </span>
                          ) : null}
                          {app.loan_number ? (
                            <span className="text-muted-foreground"> · {app.loan_number}</span>
                          ) : null}
                          {waitingForAdmin ? (
                            <span className="text-muted-foreground"> · awaiting admin</span>
                          ) : null}
                          {preparingApplicationId === app.id ? (
                            <span className="text-muted-foreground"> · preparing…</span>
                          ) : null}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Loan account</FieldLabel>
                <Select
                  value={formLoan}
                  onValueChange={(loanId) => {
                    setFormLoan(loanId);
                    const app = selectableApplications.find((a) => a.loan_id === loanId);
                    if (app) setFormApplicationId(app.id);
                  }}
                  disabled={eligibleLoading || !canSelectForDisbursement}
                >
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue
                      placeholder={
                        eligibleLoading
                          ? "Loading loans…"
                          : selectableLoans.length === 0 && approvedAwaitingLoan.length > 0
                            ? "Select application first (loan is created automatically)"
                            : selectableLoans.length === 0 &&
                                awaitingAdminFinalApproval.length > 0
                              ? "Waiting for super-admin final approval"
                              : selectableLoans.length === 0
                                ? "No loan accounts yet"
                                : "Select loan"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableLoans.length === 0 && approvedAwaitingLoan.length > 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        Pick an application above to run final approval and select the loan account.
                      </div>
                    ) : null}
                    {selectableLoans.length === 0 &&
                    awaitingAdminFinalApproval.length > 0 &&
                    approvedAwaitingLoan.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        No loan accounts yet — waiting for super-admin final approval.
                      </div>
                    ) : null}
                    {selectableLoans.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="font-medium">{l.loan_number}</span>
                        {l.application_number && (
                          <span className="text-muted-foreground">
                            {" "}
                            · {l.application_number}
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {" "}
                          {l.customer_display_name ? ` · ${l.customer_display_name}` : ""}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedEligible && (
                  <div className="mt-2 space-y-2">
                    {selectedEligible.application_number && (
                      <p className="text-xs text-muted-foreground">
                        Application{" "}
                        <span className="font-medium text-foreground">
                          {selectedEligible.application_number}
                        </span>
                        {selectedEligible.application_status && (
                          <>
                            {" "}
                            ·{" "}
                            {APPLICATION_STATUS_LABELS[
                              selectedEligible.application_status as LoanApplicationStatus
                            ] ?? selectedEligible.application_status}
                          </>
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Remaining principal bucket</span>
                      <span className="font-mono font-semibold tabular-nums text-emerald-900">
                        {formatCurrency(selectedEligible.remaining)}
                      </span>
                    </div>
                  </div>
                )}
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Amount (TZS)</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    TZS
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={selectedEligible?.remaining}
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="0"
                    className={cn(
                      "h-11 pl-12 font-mono tabular-nums",
                      createAmountInvalid && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                </div>
                {createAmountInvalid && selectedEligible && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Enter a positive amount up to {formatCurrency(selectedEligible.remaining)}.
                  </p>
                )}
              </Field>
            </div>
            </div>

            <Separator className="my-6" />

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                2. Payout channel
              </div>
              <Field>
                <FieldLabel className="text-xs font-medium">Payment method</FieldLabel>
                <Select
                  value={formMethod}
                  onValueChange={(v) => setFormMethod(v as DisbursementPaymentChannel)}
                >
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {CHANNEL_OPTIONS.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        {DISBURSEMENT_CHANNEL_LABELS[ch]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {MOBILE_CHANNELS.includes(formMethod) &&
                    "Mobile money — capture wallet name and MSISDN."}
                  {BANK_CHANNELS.includes(formMethod) &&
                    "Bank transfer — beneficiary name and account number."}
                  {formMethod === "cash" && "Cash payout — optional payee details in notes."}
                  {formMethod === "other" &&
                    "Other channel — describe details in notes if needed."}
                </p>
              </Field>
            </div>

            {(MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)) ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {MOBILE_CHANNELS.includes(formMethod) ? (
                      <Smartphone className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <Landmark className="h-3.5 w-3.5 text-emerald-700" />
                    )}
                    3. Beneficiary details
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field className="sm:col-span-2">
                      <FieldLabel className="text-xs font-medium">Account / payee name</FieldLabel>
                      <Input
                        value={formAccountName}
                        onChange={(e) => setFormAccountName(e.target.value)}
                        placeholder="As registered with operator or bank"
                        className="h-11"
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel className="text-xs font-medium">
                        {MOBILE_CHANNELS.includes(formMethod)
                          ? "Phone number (MSISDN)"
                          : "Account number"}
                      </FieldLabel>
                      <Input
                        value={formAccountNumber}
                        onChange={(e) => setFormAccountNumber(e.target.value)}
                        placeholder={
                          MOBILE_CHANNELS.includes(formMethod) ? "+255 …" : "Account no."
                        }
                        className="h-11 font-mono"
                      />
                      {MOBILE_CHANNELS.includes(formMethod) && formAccountNumber.trim() ? (
                        isValidTanzanianMsisdn(normalizeTanzanianMsisdn(formAccountNumber)) ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Sent as {normalizeTanzanianMsisdn(formAccountNumber)}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-destructive">
                            Enter a valid Tanzanian number, e.g. 0712345678 or 255712345678.
                          </p>
                        )
                      ) : null}
                    </Field>
                  </div>
                  {BANK_CHANNELS.includes(formMethod) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel className="text-xs font-medium">Bank name</FieldLabel>
                        <Input
                          value={formBankName}
                          onChange={(e) => setFormBankName(e.target.value)}
                          placeholder={DISBURSEMENT_CHANNEL_LABELS[formMethod]}
                          className="h-11"
                        />
                      </Field>
                      <Field>
                        <FieldLabel className="text-xs font-medium">
                          Bank BIC / SWIFT code
                        </FieldLabel>
                        <Input
                          value={formBankBic}
                          onChange={(e) => setFormBankBic(e.target.value)}
                          placeholder="Required by ClickPesa"
                          className="h-11 font-mono"
                        />
                      </Field>
                      <Field className="sm:col-span-2">
                        <FieldLabel className="text-xs font-medium">Transfer type</FieldLabel>
                        <Select
                          value={formBankTransferType}
                          onValueChange={(value) =>
                            setFormBankTransferType(value as "ACH" | "RTGS")
                          }
                        >
                          <SelectTrigger className="h-11 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACH">ACH</SelectItem>
                            <SelectItem value="RTGS">RTGS</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                  )}
                </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-emerald-700" />
                  3. Internal notes
                </div>
                <Field>
                  <FieldLabel className="sr-only">Notes</FieldLabel>
                  <Textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={5}
                    placeholder="Optional context for approvers (branch, tranche, etc.)"
                    className="min-h-[120px] resize-y bg-muted/30"
                  />
                </Field>
              </div>
            )}
            </div>

            {(MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)) && (
              <>
                <Separator className="my-6" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-emerald-700" />
                    4. Internal notes
                  </div>
                  <Field>
                    <FieldLabel className="sr-only">Notes</FieldLabel>
                    <Textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={3}
                      placeholder="Optional context for approvers (branch, tranche, etc.)"
                      className="min-h-[80px] resize-none bg-muted/30"
                    />
                  </Field>
                </div>
              </>
            )}
          </FieldGroup>
        </CardContent>

        <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 lg:px-8">
          <Button asChild type="button" variant="outline" className="sm:min-w-[100px]">
            <Link href={listHref}>Cancel</Link>
          </Button>
          <Button
            type="button"
            className="gap-2 sm:min-w-[160px]"
            onClick={handleCreate}
            disabled={
              !formLoan ||
              submitting ||
              !formAmount.trim() ||
              createAmountInvalid ||
              destinationInvalid ||
              (sessionLoaded && !canPrepareDisbursement)
            }
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Submit for approval
          </Button>
        </div>
      </Card>
    </div>
  );
}
