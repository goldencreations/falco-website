"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
 ChevronDown,
 Loader2,
 Plus,
 RefreshCcw,
 Search,
 ShieldAlert,
 Eye,
 FileDown,
 Wallet,
 Landmark,
 Smartphone,
 Banknote,
 FileText,
 Sparkles,
 MoreHorizontal,
 CheckCircle2,
 XCircle,
} from "lucide-react";
import {
 Bar,
 BarChart,
 CartesianGrid,
 Cell,
 LabelList,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
 Field,
 FieldGroup,
 FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { exportDisbursementToPdf } from "@/lib/disbursement-pdf";
import {
 type DisbursementKpis,
 type DisbursementViewRow,
 type EligibleLoanRow,
 isValidTanzanianMsisdn,
 normalizeTanzanianMsisdn,
} from "@/lib/disbursement-adapters";
import type { EligibleApplicationRow } from "@/lib/disbursement-eligible";
import type { LoanApplicationStatus } from "@/lib/types";
import {
 DISBURSEMENT_CHANNEL_LABELS,
 type Disbursement,
 type DisbursementPaymentChannel,
} from "@/lib/disbursement-types";
import {
 canApproveDisbursement as userCanApproveDisbursement,
 canPrepareDisbursement as userCanPrepareDisbursement,
} from "@/lib/disbursement-permissions";
import { canFinalApproveApplication } from "@/lib/application-workflow-permissions";
import { useSessionUser } from "@/lib/use-session-user";
import { resolvePortalHref } from "@/lib/portal-paths";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { formatApiResponseError } from "@/lib/falco-api";
import { parseJsonResponse } from "@/lib/parse-json-response";

const STATUS_ORDER: Disbursement["status"][] = [
 "pending_approval",
 "approved",
 "processing",
 "completed",
 "rejected",
];

/**
 * Labels mirror the raw contract status values exactly (per Frontend Implementation
 * Guide — "approved" does NOT mean money received). Ambiguity/context is surfaced via
 * separate helper text, not by relabeling the badge itself.
 */
const statusConfig: Record<
 Disbursement["status"],
 { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
 pending_approval: { label: "Pending Approval", variant: "secondary" },
 approved: { label: "Approved", variant: "default" },
 processing: { label: "Processing", variant: "default" },
 completed: { label: "Completed", variant: "default" },
 rejected: { label: "Rejected", variant: "destructive" },
};

const MOBILE_CHANNELS: DisbursementPaymentChannel[] = [
 "mpesa",
 "airtel_money",
 "yas",
 "halopesa",
];
const BANK_CHANNELS: DisbursementPaymentChannel[] = ["crdb", "nmb"];

type EligibleLoan = EligibleLoanRow;

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

const CHANNEL_OPTIONS = Object.keys(DISBURSEMENT_CHANNEL_LABELS) as DisbursementPaymentChannel[];

function staffDisplayLabel(name: string | undefined, userId: string | undefined): string {
 const label = name?.trim();
 if (!label) return "—";
 if (userId && label === userId) return "—";
 if (/^\d+$/.test(label)) return "—";
 return label;
}

function isGatewayChannel(method: DisbursementPaymentChannel): boolean {
 return MOBILE_CHANNELS.includes(method) || BANK_CHANNELS.includes(method);
}

function rawGatewayError(row: DisbursementViewRow): string {
 const value = row.metadata?.gateway_error;
 return typeof value === "string" ? value.trim() : "";
}

/** `metadata.gateway_response` may be a string or a nested object — render either as text. */
function rawGatewayResponse(row: DisbursementViewRow): string {
 const value = row.metadata?.gateway_response;
 if (typeof value === "string") return value.trim();
 if (value && typeof value === "object") {
 try {
 return JSON.stringify(value, null, 2);
 } catch {
 return "";
 }
 }
 return "";
}

/** Timeout / ambiguous gateway outcomes must not be treated as confirmed rejections. */
function isAmbiguousGatewayOutcome(row: DisbursementViewRow): boolean {
 if (row.status !== "rejected") return false;
 return /cURL error 28|timed out|timeout|ambiguous/i.test(rawGatewayError(row));
}

/** Confirmed backend rejection only — timeouts stay as awaiting confirmation. */
function isConfirmedRejection(row: DisbursementViewRow): boolean {
 return row.status === "rejected" && !isAmbiguousGatewayOutcome(row);
}

function isAwaitingClickPesaConfirmation(row: DisbursementViewRow): boolean {
 if (isAmbiguousGatewayOutcome(row)) return true;
 if (row.status === "processing") return true;
 if (row.status === "approved" && (Boolean(row.gateway) || isGatewayChannel(row.method))) {
 return true;
 }
 return false;
}

/** Badge always shows the raw contract status — never an invented label. */
function displayStatus(row: DisbursementViewRow): {
 label: string;
 variant: "default" | "secondary" | "destructive" | "outline";
} {
 return statusConfig[row.status] ?? statusConfig.pending_approval;
}

/** Explanatory helper text shown alongside the status badge — clarifies without relabeling it. */
function statusHelperText(row: DisbursementViewRow): string | null {
 if (isAwaitingClickPesaConfirmation(row)) {
 return "Payout may still be processing with ClickPesa — do not create a duplicate disbursement.";
 }
 if (row.status === "approved" && !row.gateway && !isGatewayChannel(row.method)) {
 return "Approved — mark Completed once the cash has been handed over.";
 }
 return null;
}

/**
 * Detects gateway timeout / "payout already in progress" style errors on `POST /disbursements`
 * create. These must never be retried with a second create — instead recover the existing
 * disbursement for the loan so the operator opens it rather than risking a duplicate payout.
 */
function isTimeoutOrInProgressError(message: string): boolean {
 return /cURL error 28|timed out|timeout|already in progress|already exists|duplicate|in[- ]?flight/i.test(
 message
 );
}

function rejectedExplanation(row: DisbursementViewRow): string {
 const manualReason = row.rejection_reason?.trim();
 if (manualReason) return manualReason;

 const gatewayError = rawGatewayError(row);
 if (gatewayError) {
 return "ClickPesa could not complete this payment. Check this reference in ClickPesa before creating a new disbursement.";
 }

 return "No reason was recorded. Check this reference in ClickPesa before creating a new disbursement.";
}

function DisbursementRowActions({
 row,
 canApprove,
 actionLoading,
 onView,
 onApprove,
 onReject,
 onComplete,
}: {
 row: DisbursementViewRow;
 canApprove: boolean;
 actionLoading: boolean;
 onView: () => void;
 onApprove: () => void;
 onReject: () => void;
 onComplete: () => void;
}) {
 const canApprovePending = canApprove && row.status === "pending_approval";
 const canCompleteCash =
 canApprove &&
 row.status === "approved" &&
 !row.gateway &&
 !isGatewayChannel(row.method);
 const approveLabel = isGatewayChannel(row.method)
 ? "Approve & send"
 : "Approve & activate";

 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 type="button"
 size="icon"
 variant="ghost"
 className="h-8 w-8"
 disabled={actionLoading}
 aria-label="Open actions"
 >
 {actionLoading ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <MoreHorizontal className="h-4 w-4" />
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-48">
 <DropdownMenuLabel>Actions</DropdownMenuLabel>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={onView}>
 <Eye className="mr-2 h-4 w-4" />
 View details
 </DropdownMenuItem>
 {canApprovePending ? (
 <>
 <DropdownMenuItem onClick={onApprove}>
 <CheckCircle2 className="mr-2 h-4 w-4" />
 {approveLabel}
 </DropdownMenuItem>
 <DropdownMenuItem
 className="text-destructive focus:text-destructive"
 onClick={onReject}
 >
 <XCircle className="mr-2 h-4 w-4" />
 Reject
 </DropdownMenuItem>
 </>
 ) : null}
 {canCompleteCash ? (
 <DropdownMenuItem onClick={onComplete}>
 <CheckCircle2 className="mr-2 h-4 w-4" />
 Complete
 </DropdownMenuItem>
 ) : null}
 </DropdownMenuContent>
 </DropdownMenu>
 );
}

function MiniSpark({ className }: { className?: string }) {
 return (
 <svg
 className={cn(
 "pointer-events-none absolute right-1.5 top-2 h-5 w-12 text-foreground/[0.07]",
 className
 )}
 viewBox="0 0 72 24"
 aria-hidden
 >
 <path
 d="M0 16 Q18 4 36 14 T72 8"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.25"
 />
 </svg>
 );
}

function DisbursementDetailPanel({
 row,
 onClose,
 onExportPdf,
}: {
 row: DisbursementViewRow;
 onClose: () => void;
 onExportPdf: (r: DisbursementViewRow) => void;
}) {
 const customerName = row.customer_display_name ?? "";
 const loanNumber = row.loan_number ?? row.loan_id;
 const prepared = staffDisplayLabel(row.prepared_by_name, row.prepared_by);
 const approved = staffDisplayLabel(row.approved_by_name, row.approved_by ?? undefined) || "—";
 const rejectedU = staffDisplayLabel(row.rejected_by_name, row.rejected_by ?? undefined) || "—";
 const sc = displayStatus(row);
 const awaitingClickPesa = isAwaitingClickPesaConfirmation(row);
 const confirmedRejected = isConfirmedRejection(row);

 return (
 <>
 <div className="relative border-b bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 px-6 pb-6 pt-6 text-primary-foreground">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div className="space-y-1">
 <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-100/90">
 Disbursement record
 </p>
 <DialogTitle className="text-left text-xl font-semibold tracking-tight text-white">
 {loanNumber}
 </DialogTitle>
 <DialogDescription className="text-left text-emerald-100/90">
 Ref <span className="font-mono text-white/95">{row.id}</span>
 {" · "}
 {customerName || "Customer unknown"}
 </DialogDescription>
 </div>
 <div className="flex flex-col items-start gap-2 sm:items-end">
 <Badge
 className="border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20"
 variant="outline"
 >
 {sc.label}
 </Badge>
 <p className="text-xs text-emerald-100/80">
 Updated {formatDateTime(row.updated_at)}
 </p>
 </div>
 </div>
 <p className="pointer-events-none absolute bottom-2 right-4 hidden rotate-[-8deg] select-none border-2 border-white/25 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 sm:block">
 {sc.label}
 </p>
 </div>

 <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-6 py-5">
 {awaitingClickPesa ? (
 <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
 <p className="font-medium">ClickPesa confirmation is pending. Do not submit another payout.</p>
 <p className="mt-1 text-sky-900/80">
 Status updates only when ClickPesa confirms via webhook or scheduled reconciliation.
 </p>
 {(row.order_reference || row.transaction_reference) && (
 <p className="mt-2 text-xs text-sky-900/70">
 Reference{" "}
 <span className="font-mono text-sky-950">
 {row.order_reference ?? row.transaction_reference}
 </span>
                </p>
              )}
            </div>
          ) : statusHelperText(row) ? (
            <div className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {statusHelperText(row)}
            </div>
          ) : null}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
 <div>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Amount & channel
 </h4>
 <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
 {formatCurrency(row.amount)}
 </p>
 <p className="mt-1 text-sm text-muted-foreground">
 {DISBURSEMENT_CHANNEL_LABELS[row.method]}
 </p>
 </div>
 <Separator />
 <dl className="grid gap-2 text-sm">
 <div className="flex justify-between gap-4">
 <dt className="text-muted-foreground">Prepared by</dt>
 <dd className="text-right font-medium">{prepared}</dd>
 </div>
 <div className="flex justify-between gap-4">
 <dt className="text-muted-foreground">Approved by</dt>
 <dd className="text-right font-medium">{approved}</dd>
 </div>
 <div className="flex justify-between gap-4">
 <dt className="text-muted-foreground">Rejected by</dt>
 <dd className="text-right font-medium">{rejectedU}</dd>
 </div>
 </dl>
 </div>
 <div className="space-y-4">
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Destination & references
 </h4>
 <dl className="grid gap-2 rounded-xl border bg-muted/30 p-4 text-sm">
 <div>
 <dt className="text-muted-foreground">Account name</dt>
 <dd className="font-medium">{row.account_name ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Account number</dt>
 <dd className="font-mono text-sm">{row.account_number ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Bank</dt>
 <dd>{row.bank_name ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Transaction reference</dt>
 <dd className="font-mono text-sm">{row.transaction_reference ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Gateway</dt>
 <dd className="font-medium capitalize">{row.gateway ?? "—"}</dd>
 </div>
 <div>
 <dt className="text-muted-foreground">Order reference</dt>
 <dd className="font-mono text-sm">{row.order_reference ?? "—"}</dd>
 </div>
 </dl>
 </div>
 </div>

 {rawGatewayResponse(row) || rawGatewayError(row) ? (
 <>
 <Separator className="my-5" />
 <div>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Gateway response
 </h4>
 {rawGatewayError(row) ? (
 <p className="mt-2 text-sm text-destructive">{rawGatewayError(row)}</p>
 ) : null}
 {rawGatewayResponse(row) ? (
 <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
 {rawGatewayResponse(row)}
 </pre>
 ) : null}
 </div>
 </>
 ) : null}

 <Separator className="my-5" />

 <div className="grid gap-3 text-sm sm:grid-cols-2">
 <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2">
 <p className="text-[11px] uppercase text-muted-foreground">Approved</p>
 <p className="font-medium">
 {row.approved_at ? formatDateTime(row.approved_at) : "—"}
 </p>
 </div>
 <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2">
 <p className="text-[11px] uppercase text-muted-foreground">Disbursed</p>
 <p className="font-medium">
 {row.disbursed_at ? formatDateTime(row.disbursed_at) : "—"}
 </p>
 </div>
 <div className="rounded-lg border border-border/60 bg-card/50 px-3 py-2 sm:col-span-2">
 <p className="text-[11px] uppercase text-muted-foreground">Rejected</p>
 <p className="font-medium">
 {confirmedRejected && row.rejected_at ? formatDateTime(row.rejected_at) : "—"}
 </p>
 {confirmedRejected && row.rejection_reason ? (
 <p className="mt-2 text-destructive">{row.rejection_reason}</p>
 ) : null}
 </div>
 </div>

 {row.notes && (
 <>
 <Separator className="my-5" />
 <div>
 <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Notes
 </h4>
 <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{row.notes}</p>
 </div>
 </>
 )}
 </div>

 <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3">
 <Button variant="outline" onClick={onClose}>
 Close
 </Button>
 <Button className="gap-2" onClick={() => onExportPdf(row)}>
 <FileDown className="h-4 w-4" />
 Export PDF
 </Button>
 </div>
 </>
 );
}

export default function DisbursementsPage() {
 const { user, loaded: sessionLoaded } = useSessionUser();
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
 const pendingReviewHref = resolvePortalHref(user?.role, "/applications/pending-review");
 const isBranchScoped =
 user?.role === "branch_manager" ||
 user?.role === "loan_officer" ||
 user?.role === "accountant";
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [rows, setRows] = useState<DisbursementViewRow[]>([]);
 const [kpis, setKpis] = useState<DisbursementKpis | null>(null);
 const [eligibleLoans, setEligibleLoans] = useState<EligibleLoan[]>([]);
 const [eligibleApplications, setEligibleApplications] = useState<EligibleApplicationRow[]>([]);
 const [eligibleBranchScope, setEligibleBranchScope] = useState<string | null>(null);
 const [eligibleLoading, setEligibleLoading] = useState(false);
 const [preparingApplicationId, setPreparingApplicationId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [actionLoading, setActionLoading] = useState<string | null>(null);

 const [createOpen, setCreateOpen] = useState(false);
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

 const [viewRow, setViewRow] = useState<DisbursementViewRow | null>(null);
 const [approveRow, setApproveRow] = useState<DisbursementViewRow | null>(null);
 const [completeRow, setCompleteRow] = useState<DisbursementViewRow | null>(null);
 const [completeRef, setCompleteRef] = useState("");
 const [approveRef, setApproveRef] = useState("");
 const [rejectRow, setRejectRow] = useState<DisbursementViewRow | null>(null);
 const [rejectReason, setRejectReason] = useState("");
 const [expandedRejectedRows, setExpandedRejectedRows] = useState<Set<string>>(new Set());

 const load = useCallback(async (opts?: { silent?: boolean }) => {
 if (!opts?.silent) {
 setLoading(true);
 setError(null);
 }
 try {
 const params = new URLSearchParams();
 params.set("include_eligible", "0");
 if (statusFilter !== "all") params.set("status", statusFilter);
 if (searchQuery.trim()) params.set("search", searchQuery.trim());
 const res = await fetch(`/api/disbursements?${params.toString()}`, {
 credentials: "include",
 cache: "no-store",
 });
 const { data } = await parseJsonResponse<{
 disbursements?: DisbursementViewRow[];
 kpis?: DisbursementKpis | null;
 message?: string;
 error?: string;
 }>(res);
 if (!res.ok) {
 throw new Error(
 typeof data?.message === "string"
 ? data.message
 : typeof data?.error === "string"
 ? data.error
 : "Failed to load disbursements"
 );
 }
 if (!data) throw new Error("Disbursement details could not be loaded.");
 setRows(Array.isArray(data.disbursements) ? data.disbursements : []);
 setKpis(data.kpis && typeof data.kpis === "object" ? data.kpis : null);
 } catch (e) {
 if (!opts?.silent) {
 setError(e instanceof Error ? e.message : "Load failed");
 }
 } finally {
 if (!opts?.silent) setLoading(false);
 }
 }, [statusFilter, searchQuery]);

 useEffect(() => {
 void load();
 }, [load]);

 const shouldPollClickPesa = useMemo(
 () => rows.some((row) => isAwaitingClickPesaConfirmation(row)),
 [rows]
 );

 useEffect(() => {
 if (!shouldPollClickPesa) return;
 const timer = window.setInterval(() => {
 void load({ silent: true });
 }, 12_000);
 return () => window.clearInterval(timer);
 }, [shouldPollClickPesa, load]);

 const loadEligibleLoans = useCallback(async () => {
 setEligibleLoading(true);
 try {
 const res = await fetch("/api/disbursements/eligible-loans", { credentials: "include" });
 const { data } = await parseJsonResponse<{
 eligible_loans?: EligibleLoan[];
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
 setEligibleBranchScope(
 typeof data.branch_scope === "string" && data.branch_scope.trim() ? data.branch_scope : null
 );
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load eligible loans");
 setEligibleLoans([]);
 setEligibleApplications([]);
 } finally {
 setEligibleLoading(false);
 }
 }, []);

 useEffect(() => {
 if (!createOpen) return;
 void loadEligibleLoans();
 }, [createOpen, loadEligibleLoans]);

 useEffect(() => {
 if (typeof window === "undefined") return;
 const loanId = new URLSearchParams(window.location.search).get("loanId")?.trim();
 if (!loanId) return;
 setCreateOpen(true);
 setFormLoan(loanId);
 }, []);

 /** Applications with a loan account, or approved apps that this user can finalize into a loan. */
 const selectableApplications = useMemo(
 () =>
 eligibleApplications.filter(
 (a) =>
 Boolean(a.loan_id) ||
 a.ready_for_disbursement ||
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
 const byId = new Map<string, EligibleLoan>();
 for (const loan of eligibleLoans) {
 if (loan.id) byId.set(loan.id, loan);
 }
 for (const app of selectableApplications) {
 if (!app.loan_id || byId.has(app.loan_id)) continue;
 const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
 byId.set(app.loan_id, {
 id: app.loan_id,
 loan_number: app.loan_number ?? app.loan_id,
 customer_id: "",
 branch_id: app.branch_id,
 principal_amount: amount,
 remaining: amount,
 customer_display_name: app.customer_display_name,
 application_id: app.id,
 application_number: app.application_number,
 application_status: app.status,
 });
 }
 return Array.from(byId.values()).sort((a, b) => a.loan_number.localeCompare(b.loan_number));
 }, [eligibleLoans, selectableApplications]);

 const approvedAwaitingLoan = selectableApplications.filter(
 (a) => Boolean(a.needs_final_approval) && !a.loan_id && canFinalizeApproval
 );
 const canSelectForDisbursement =
 selectableLoans.length > 0 ||
 selectableApplications.some((a) => a.loan_id || a.ready_for_disbursement) ||
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
 const app = eligibleApplications.find((a) => a.loan_id === formLoan);
 if (!app?.loan_id) return undefined;
 const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
 return {
 id: app.loan_id,
 loan_number: app.loan_number ?? app.loan_id,
 customer_id: "",
 branch_id: app.branch_id,
 principal_amount: amount,
 remaining: amount,
 customer_display_name: app.customer_display_name,
 application_id: app.id,
 application_number: app.application_number,
 application_status: app.status,
 };
 }, [formLoan, selectableLoans, eligibleApplications]);

 const addLoanToFormState = useCallback((app: EligibleApplicationRow, loanId: string, loanNumber?: string) => {
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
 }, []);

 const prepareApplicationForDisbursement = useCallback(
 async (app: EligibleApplicationRow): Promise<{ loanId: string; loanNumber?: string }> => {
 const amount = app.approved_amount > 0 ? app.approved_amount : app.requested_amount;
 const res = await fetch(`/api/applications/${encodeURIComponent(app.id)}/prepare-disbursement`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ approved_amount: amount }),
 });
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
 setError(e instanceof Error ? e.message : "Could not prepare application for disbursement");
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
 * disbursement (by `order_reference`/most-recent) via `GET /disbursements?loan_id=` instead
 * of allowing a second create — avoids duplicate payout risk.
 */
 const recoverExistingDisbursement = useCallback(
 async (loanId: string): Promise<DisbursementViewRow | null> => {
 if (!loanId) return null;
 try {
 const res = await fetch(
 `/api/disbursements?loan_id=${encodeURIComponent(loanId)}&include_eligible=0&page_size=10`,
 { credentials: "include", cache: "no-store" }
 );
 const { data } = await parseJsonResponse<{ disbursements?: DisbursementViewRow[] }>(res);
 if (!res.ok) return null;
 const found = Array.isArray(data?.disbursements) ? data.disbursements : [];
 if (found.length === 0) return null;
 const sorted = [...found].sort(
 (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
 );
 await load({ silent: true });
 return sorted[0];
 } catch {
 return null;
 }
 },
 [load]
 );

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

 setActionLoading("create");
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
 setCreateOpen(false);
 setViewRow(recovered);
 setError(
 "This payout may already be in progress. We found the existing disbursement below — please confirm its status before creating another one."
 );
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
 setCreateOpen(false);
 setFormLoan("");
 setFormApplicationId("");
 setFormAmount("");
 setFormNotes("");
 setFormAccountName("");
 setFormAccountNumber("");
 setFormBankName("");
 setFormBankBic("");
 setFormBankTransferType("ACH");
 await load();
 await loadEligibleLoans();
 } finally {
 setActionLoading(null);
 }
 };

 const patch = async (id: string, body: object) => {
 setActionLoading(id);
 setError(null);
 try {
 const res = await fetch(`/api/disbursements/${id}`, {
 method: "PATCH",
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
 setError(formatApiResponseError(data, "Update failed"));
 return;
 }
    setApproveRow(null);
    setCompleteRow(null);
    setRejectRow(null);
    setCompleteRef("");
    setApproveRef("");
    setRejectReason("");
    await load();
    // Signal the Applications page to reload immediately so the status badge
    // flips to "Disbursed" the moment the user navigates back.
    try {
      localStorage.setItem("falco.disbursement.updated", String(Date.now()));
    } catch { /* storage unavailable */ }
    window.dispatchEvent(new CustomEvent("falco:disbursement:updated"));
  } finally {
    setActionLoading(null);
  }
};

 const toggleRejectedExplanation = useCallback((id: string) => {
 setExpandedRejectedRows((current) => {
 const next = new Set(current);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 }, []);

 const canApprove = user
 ? userCanApproveDisbursement({ ...user, permissions: user.permissions ?? [] })
 : false;

 const chartData = useMemo(() => {
 if (!kpis) return [];
 return [
 { name: "Pending", short: "Pend.", count: kpis.pending_approval, fill: "#ea580c" },
 { name: "Processing", short: "Proc.", count: kpis.approved, fill: "#0284c7" },
 { name: "Disbursed", short: "Done", count: kpis.completed, fill: "#059669" },
 { name: "Rejected", short: "Rej.", count: kpis.rejected, fill: "#e11d48" },
 ];
 }, [kpis]);

 const totalRecords = useMemo(() => {
 if (!kpis) return 0;
 return (
 kpis.pending_approval + kpis.approved + kpis.completed + kpis.rejected
 );
 }, [kpis]);

 const shareOfTotal = (n: number) =>
 totalRecords > 0 ? Math.round((n / totalRecords) * 100) : 0;

 /** Compact ops insight — same footprint as previous subtitle line */
 const workflowInsight = useMemo(() => {
 if (!kpis || totalRecords === 0) {
 return "No disbursements yet — analysis appears when records exist.";
 }
 const inFlight = kpis.pending_approval + kpis.approved;
 const settledRate = Math.round((kpis.completed / totalRecords) * 100);
 const declinedRate = Math.round((kpis.rejected / totalRecords) * 100);
 return `Ledger ${totalRecords} · In workflow ${inFlight} · Settled ${settledRate}% · Declined ${declinedRate}%`;
 }, [kpis, totalRecords]);

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
 (!formAccountNumber.trim() || !isValidTanzanianMsisdn(normalizeTanzanianMsisdn(formAccountNumber)))) ||
 (BANK_CHANNELS.includes(formMethod) &&
 (!formAccountName.trim() || !formAccountNumber.trim() || !formBankBic.trim()));

 const handleExportPdf = useCallback((row: DisbursementViewRow) => {
 exportDisbursementToPdf({
 disbursement: row,
 loanNumber: row.loan_number ?? row.loan_id,
 customerName: row.customer_display_name ?? "—",
 channelLabel: DISBURSEMENT_CHANNEL_LABELS[row.method],
 preparedByName: staffDisplayLabel(row.prepared_by_name, row.prepared_by),
 approvedByName: row.approved_by ? row.approved_by_name ?? row.approved_by : null,
 rejectedByName: row.rejected_by ? row.rejected_by_name ?? row.rejected_by : null,
 });
 }, []);

 return (
 <>
 <DashboardHeader
 title="Loan disbursement"
 description="Prepare, approve, and record releases of approved principal to customers"
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6 lg:pb-8">
 <div className="mx-auto w-full max-w-7xl space-y-4">
 {error && (
 <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
 <ShieldAlert className="h-4 w-4 shrink-0" />
 {error}
 </div>
 )}

 {/* Summary: compact chart + side KPIs */}
 <section
 aria-label="Disbursement summary"
 className="flex flex-col-reverse gap-2 lg:flex-row lg:items-start lg:gap-3"
 >
 <Card className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-border/60 py-0 shadow-sm">
 <CardHeader className="space-y-0.5 px-4 pb-1 pt-3">
 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
 <CardTitle className="text-sm font-semibold tracking-tight">
 Workflow mix
 </CardTitle>
 <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
 Pend. · Appr. · Done · Rej.
 </span>
 </div>
 <p className="text-[10px] leading-snug text-muted-foreground">
 {workflowInsight}
 </p>
 </CardHeader>
 <CardContent className="px-4 pb-3 pt-0">
 <div className="h-[112px] w-full sm:h-[120px] lg:h-[128px]">
 {loading || !kpis ? (
 <div className="flex h-full items-center justify-center text-muted-foreground">
 <Loader2 className="h-6 w-6 animate-spin opacity-50" />
 </div>
 ) : (
 <ResponsiveContainer width="100%" height="100%">
 <BarChart
 data={chartData}
 margin={{ top: 12, right: 6, left: 2, bottom: 2 }}
 barCategoryGap="14%"
 >
 <CartesianGrid
 strokeDasharray="4 4"
 vertical={false}
 stroke="hsl(var(--border))"
 strokeOpacity={0.85}
 />
 <XAxis
 dataKey="short"
 tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
 axisLine={{ stroke: "hsl(var(--border))" }}
 tickLine={false}
 interval={0}
 />
 <YAxis
 hide
 domain={[0, (max: number) => Math.max(Math.ceil(max * 1.25), 1)]}
 />
 <Tooltip
 cursor={{ fill: "rgba(0,0,0,0.05)" }}
 content={({ active, payload }) => {
 if (!active || !payload?.length) return null;
 const p = payload[0].payload as (typeof chartData)[0];
 const pct =
 totalRecords > 0
 ? Math.round((p.count / totalRecords) * 100)
 : 0;
 return (
 <div className="min-w-[9rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
 <p className="border-b border-border pb-1 font-semibold text-foreground">
 {p.name}
 </p>
 <p className="mt-1 tabular-nums text-muted-foreground">
 <span className="font-medium text-foreground">{p.count}</span>
 {" "}request{p.count === 1 ? "" : "s"}
 </p>
 <p className="mt-0.5 text-[11px] text-muted-foreground">
 {pct}% of active ledger
 </p>
 </div>
 );
 }}
 />
 <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={34}>
 <LabelList
 dataKey="count"
 position="top"
 fill="hsl(var(--foreground))"
 fontSize={9}
 formatter={(v: number | string) =>
 Number(v) > 0 ? String(v) : ""
 }
 offset={2}
 />
 {chartData.map((entry) => (
 <Cell key={entry.name} fill={entry.fill} />
 ))}
 </Bar>
 </BarChart>
 </ResponsiveContainer>
 )}
 </div>
 </CardContent>
 </Card>

 <div className="flex w-full shrink-0 flex-col gap-2 lg:w-[232px] xl:w-[248px]">
 <div className="grid grid-cols-2 gap-1.5">
 <div className="relative overflow-hidden rounded-lg border border-amber-200/60 bg-gradient-to-br from-amber-50/95 to-background px-2 py-2 shadow-sm">
 <MiniSpark className="text-amber-600/18" />
 <p className="relative text-[9px] font-semibold uppercase tracking-wide text-amber-900/75">
 Pending
 </p>
 <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
 {kpis ? kpis.pending_approval : "—"}
 </p>
 <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
 {totalRecords ? `${shareOfTotal(kpis?.pending_approval ?? 0)}%` : "\u00a0"}
 </p>
 </div>
 <div className="relative overflow-hidden rounded-lg border border-sky-200/60 bg-gradient-to-br from-sky-50/95 to-background px-2 py-2 shadow-sm">
 <MiniSpark className="text-sky-600/18" />
 <p className="relative text-[9px] font-semibold uppercase tracking-wide text-sky-900/75">
 Approved
 </p>
 <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
 {kpis ? kpis.approved : "—"}
 </p>
 <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
 {totalRecords ? `${shareOfTotal(kpis?.approved ?? 0)}%` : "\u00a0"}
 </p>
 </div>
 <div className="relative overflow-hidden rounded-lg border border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 to-background px-2 py-2 shadow-sm">
 <MiniSpark className="text-emerald-600/18" />
 <p className="relative text-[9px] font-semibold uppercase tracking-wide text-emerald-900/75">
 Completed
 </p>
 <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
 {kpis ? kpis.completed : "—"}
 </p>
 <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
 {totalRecords ? `${shareOfTotal(kpis?.completed ?? 0)}%` : "\u00a0"}
 </p>
 </div>
 <div className="relative overflow-hidden rounded-lg border border-rose-200/60 bg-gradient-to-br from-rose-50/95 to-background px-2 py-2 shadow-sm">
 <MiniSpark className="text-rose-600/18" />
 <p className="relative text-[9px] font-semibold uppercase tracking-wide text-rose-900/75">
 Rejected
 </p>
 <p className="relative mt-0.5 text-lg font-bold tabular-nums leading-none tracking-tight">
 {kpis ? kpis.rejected : "—"}
 </p>
 <p className="relative mt-0.5 truncate text-[10px] text-muted-foreground">
 {totalRecords ? `${shareOfTotal(kpis?.rejected ?? 0)}%` : "\u00a0"}
 </p>
 </div>
 </div>
 <div className="rounded-lg border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-background px-2.5 py-2 shadow-sm">
 <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-900/75">
 MTD completed
 </p>
 <p className="mt-0.5 truncate text-base font-bold tabular-nums leading-tight text-emerald-950">
 {kpis ? formatCurrency(kpis.mtd_completed_volume) : "—"}
 </p>
 <p className="mt-0.5 text-[10px] text-emerald-900/55">From live disbursements</p>
 </div>
 </div>
 </section>

 {/* Toolbar */}
 <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
 <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search loan number or customer..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter") void load();
 }}
 className="pl-9"
 />
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full sm:w-[200px]">
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All statuses</SelectItem>
 {STATUS_ORDER.map((st) => (
 <SelectItem key={st} value={st}>
 {statusConfig[st].label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => forceCachedReload(() => load())}
 disabled={loading}
 >
 {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
 <span className="ml-2">Refresh</span>
 </Button>
 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <Button
 type="button"
 size="sm"
 disabled={sessionLoaded && !canPrepareDisbursement}
 title={
 !sessionLoaded
 ? "Loading session…"
 : !canPrepareDisbursement
 ? "You do not have permission to create disbursements"
 : undefined
 }
 onClick={() => setCreateOpen(true)}
 >
 <Plus className="mr-2 h-4 w-4" />
 Create disbursement
 </Button>
 <DialogContent className="gap-0 overflow-hidden border-border/60 p-0 shadow-xl sm:max-w-[480px]">
 <div className="relative border-b bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 px-5 pb-5 pt-5 text-primary-foreground">
 <div className="flex items-start gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
 <Sparkles className="h-5 w-5 text-emerald-100" />
 </div>
 <div className="min-w-0 flex-1 space-y-1">
 <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
 New request
 </p>
 <DialogTitle className="text-left text-lg font-semibold leading-tight tracking-tight text-white">
 Create disbursement
 </DialogTitle>
 <DialogDescription className="text-left text-[13px] leading-snug text-emerald-100/90">
 Submit for approval. Amount cannot exceed the remaining approved principal for the loan.
 {isBranchScoped && eligibleBranchScope ? (
 <> Showing loans for your branch only.</>
 ) : null}
 </DialogDescription>
 </div>
 </div>
 </div>

 <div className="max-h-[min(65vh,520px)] overflow-y-auto overscroll-contain px-5 py-4">
 <FieldGroup className="gap-0">
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
 {isBranchScoped ? " in your branch" : ""}. Manager review → super-admin final approval
 (creates a pending-disbursement loan), then refresh.
 </p>
 ) : (
 <>
 {awaitingAdminFinalApproval.length > 0 ? (
 <div className="mb-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs dark:border-amber-900/50 dark:bg-amber-950/30">
 <p className="font-medium text-foreground">
 {awaitingAdminFinalApproval.length} application
 {awaitingAdminFinalApproval.length === 1 ? "" : "s"} await super-admin final approval
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
 Click a ready row or use the selectors below ({selectableApplications.length} ready).
 </p>
 ) : null}
 <div className="max-h-[180px] overflow-y-auto rounded-xl border bg-muted/20">
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
 const hasLinkedLoan =
 Boolean(app.loan_id) ||
 selectableLoans.some(
 (l) =>
 l.application_id === app.id ||
 l.application_number?.toLowerCase() ===
 app.application_number.toLowerCase()
 );
 const waitingForAdmin =
 Boolean(app.needs_final_approval) && !hasLinkedLoan && !canFinalizeApproval;
 const canSelect =
 hasLinkedLoan ||
 app.ready_for_disbursement ||
 (Boolean(app.needs_final_approval) && canFinalizeApproval);
 const isPreparing = preparingApplicationId === app.id;
 return (
 <TableRow
 key={app.id}
 className={cn(
 canSelect && "cursor-pointer hover:bg-muted/50",
 !canSelect && "opacity-70",
 formApplicationId === app.id && "bg-emerald-50/80 dark:bg-emerald-950/40"
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
 <TableCell className="py-2 text-xs font-medium">{app.application_number}</TableCell>
 <TableCell className="py-2 text-xs">{app.customer_display_name || "—"}</TableCell>
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

 <Separator className="my-5" />

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
 {approvedAwaitingLoan.length > 0 && selectableLoans.length === 0 && !eligibleLoading ? (
 <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/30">
 <p className="font-medium text-foreground">Select an approved application below</p>
 <p className="mt-1 text-xs text-muted-foreground">
 As super admin, picking an application runs final approval and creates the loan account.
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
 l.application_number?.toLowerCase() === app.application_number.toLowerCase()
 );
 const canPick =
 hasLinkedLoan ||
 app.ready_for_disbursement ||
 (Boolean(app.needs_final_approval) && canFinalizeApproval);
 const waitingForAdmin =
 Boolean(app.needs_final_approval) && !hasLinkedLoan && !canFinalizeApproval;
 return (
 <SelectItem key={app.id} value={app.id} disabled={!canPick || preparingApplicationId === app.id}>
 <span className="font-medium">{app.application_number}</span>
 {app.customer_display_name ? (
 <span className="text-muted-foreground"> · {app.customer_display_name}</span>
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
 : selectableLoans.length === 0 && awaitingAdminFinalApproval.length > 0
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
 <span className="text-muted-foreground"> · {l.application_number}</span>
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
 <span className="font-medium text-foreground">{selectedEligible.application_number}</span>
 {selectedEligible.application_status && (
 <>
 {" "}
 · {APPLICATION_STATUS_LABELS[selectedEligible.application_status as LoanApplicationStatus] ??
 selectedEligible.application_status}
 </>
 )}
 </p>
 )}
 <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs">
 <span className="text-muted-foreground">Remaining principal bucket</span>
 <span className="font-mono font-semibold tabular-nums text-emerald-900 ">
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

 <Separator className="my-5" />

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
 {formMethod === "other" && "Other channel — describe details in notes if needed."}
 </p>
 </Field>
 </div>

 {(MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)) && (
 <>
 <Separator className="my-5" />
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
 <FieldLabel className="text-xs font-medium">Bank BIC / SWIFT code</FieldLabel>
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
 onValueChange={(value) => setFormBankTransferType(value as "ACH" | "RTGS")}
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
 </>
 )}

 <Separator className="my-5" />

 <div className="space-y-3">
 <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
 <FileText className="h-3.5 w-3.5 text-emerald-700" />
 {MOBILE_CHANNELS.includes(formMethod) || BANK_CHANNELS.includes(formMethod)
 ? "4. Internal notes"
 : "3. Internal notes"}
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
 </FieldGroup>
 </div>

 <div className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3">
 <Button
 type="button"
 variant="outline"
 className="sm:min-w-[100px]"
 onClick={() => setCreateOpen(false)}
 >
 Cancel
 </Button>
 <Button
 type="button"
 className="gap-2 sm:min-w-[160px]"
 onClick={handleCreate}
 disabled={
 !formLoan ||
 actionLoading === "create" ||
 !formAmount.trim() ||
 createAmountInvalid ||
 destinationInvalid
 }
 >
 {actionLoading === "create" ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <Plus className="h-4 w-4" />
 )}
 Submit for approval
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 {/* Desktop table */}
 <Card className="hidden md:block">
 <CardContent className="p-0">
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Loan</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 <TableHead>Channel</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Prepared by</TableHead>
 <TableHead>Dates</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {loading ? (
 <TableRow>
 <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
 <Loader2 className="mx-auto h-6 w-6 animate-spin" />
 </TableCell>
 </TableRow>
 ) : rows.length === 0 ? (
 <TableRow>
 <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
 No disbursements match your filters.
 </TableCell>
 </TableRow>
 ) : (
 rows.map((row) => {
 const sc = displayStatus(row);
 const rejectedOpen = expandedRejectedRows.has(row.id);
 const awaitingClickPesa = isAwaitingClickPesaConfirmation(row);
 const confirmedRejected = isConfirmedRejection(row);
 return (
 <Fragment key={row.id}>
 <TableRow>
 <TableCell className="font-medium">
 <Link className="text-primary hover:underline" href="/loans">
 {row.loan_number ?? row.loan_id}
 </Link>
 </TableCell>
 <TableCell>{row.customer_display_name ?? "—"}</TableCell>
 <TableCell className="text-right tabular-nums">
 {formatCurrency(row.amount)}
 </TableCell>
 <TableCell>{DISBURSEMENT_CHANNEL_LABELS[row.method]}</TableCell>
 <TableCell>
 <div className="flex flex-col items-start gap-1">
 <div className="flex items-center gap-1.5">
 <Badge variant={sc.variant}>{sc.label}</Badge>
 {confirmedRejected && (
 <Button
 type="button"
 size="icon"
 variant="ghost"
 className="h-6 w-6 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
 aria-expanded={rejectedOpen}
 aria-label={rejectedOpen ? "Hide rejection reason" : "Show rejection reason"}
 onClick={() => toggleRejectedExplanation(row.id)}
 >
 <ChevronDown
 className={cn("h-3.5 w-3.5 transition-transform", rejectedOpen && "rotate-180")}
 />
 </Button>
 )}
 </div>
                  {awaitingClickPesa ? (
                    <p className="max-w-[16rem] text-[11px] leading-snug text-muted-foreground">
                      ClickPesa confirmation is pending. Do not submit another payout.
                    </p>
                  ) : statusHelperText(row) ? (
                    <p className="max-w-[16rem] text-[11px] leading-snug text-muted-foreground">
                      {statusHelperText(row)}
                    </p>
                  ) : null}
                </div>
              </TableCell>
 <TableCell className="text-sm">
 {staffDisplayLabel(row.prepared_by_name, row.prepared_by)}
 </TableCell>
 <TableCell className="text-xs text-muted-foreground">
 <div className="space-y-0.5">
 {row.approved_at && <div>Approved {formatDate(row.approved_at)}</div>}
 {confirmedRejected && row.rejected_at && (
 <div>Rejected {formatDate(row.rejected_at)}</div>
 )}
 {row.disbursed_at && <div>Disbursed {formatDateTime(row.disbursed_at)}</div>}
 {!row.approved_at && !(confirmedRejected && row.rejected_at) && !row.disbursed_at && "—"}
 </div>
 </TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end">
 <DisbursementRowActions
 row={row}
 canApprove={canApprove}
 actionLoading={actionLoading === row.id}
 onView={() => setViewRow(row)}
 onApprove={() => setApproveRow(row)}
 onReject={() => {
 setRejectRow(row);
 setRejectReason("");
 }}
 onComplete={() => {
 setCompleteRow(row);
 setCompleteRef(row.transaction_reference ?? "");
 }}
 />
 </div>
 </TableCell>
 </TableRow>
 {confirmedRejected && rejectedOpen && (
 <TableRow className="bg-destructive/5 hover:bg-destructive/5">
 <TableCell colSpan={8} className="sticky left-0 px-4 py-3">
 <div className="box-border w-[calc(100vw-20rem)] min-w-0 max-w-[calc(100vw-20rem)] overflow-hidden rounded-md border border-destructive/20 bg-background px-4 py-3 text-sm">
 <p className="font-medium text-destructive">Why this was rejected</p>
 <p className="mt-1 max-w-3xl whitespace-normal break-words leading-5 text-muted-foreground [overflow-wrap:anywhere]">
 {rejectedExplanation(row)}
 </p>
 {(row.order_reference || row.transaction_reference) && (
 <p className="mt-2 whitespace-normal break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
 Reference{" "}
 <span className="font-mono text-foreground">
 {row.order_reference ?? row.transaction_reference}
 </span>
 </p>
 )}
 </div>
 </TableCell>
 </TableRow>
 )}
 </Fragment>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>

 {/* Mobile cards */}
 <div className="space-y-3 md:hidden">
 {loading ? (
 <div className="flex justify-center py-12 text-muted-foreground">
 <Loader2 className="h-8 w-8 animate-spin" />
 </div>
 ) : rows.length === 0 ? (
 <p className="py-10 text-center text-sm text-muted-foreground">
 No disbursements match your filters.
 </p>
 ) : (
 rows.map((row) => {
 const sc = displayStatus(row);
 const rejectedOpen = expandedRejectedRows.has(row.id);
 const awaitingClickPesa = isAwaitingClickPesaConfirmation(row);
 const confirmedRejected = isConfirmedRejection(row);
 return (
 <Card key={row.id}>
 <CardHeader className="pb-2">
 <div className="flex items-start justify-between gap-2">
 <div>
 <CardTitle className="text-base">{row.loan_number ?? row.loan_id}</CardTitle>
 <p className="text-sm text-muted-foreground">{row.customer_display_name ?? "—"}</p>
 </div>
 <div className="flex items-center gap-1.5">
 <Badge variant={sc.variant}>{sc.label}</Badge>
 {confirmedRejected && (
 <Button
 type="button"
 size="icon"
 variant="ghost"
 className="h-6 w-6 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
 aria-expanded={rejectedOpen}
 aria-label={rejectedOpen ? "Hide rejection reason" : "Show rejection reason"}
 onClick={() => toggleRejectedExplanation(row.id)}
 >
 <ChevronDown
 className={cn("h-3.5 w-3.5 transition-transform", rejectedOpen && "rotate-180")}
 />
 </Button>
 )}
 <DisbursementRowActions
 row={row}
 canApprove={canApprove}
 actionLoading={actionLoading === row.id}
 onView={() => setViewRow(row)}
 onApprove={() => setApproveRow(row)}
 onReject={() => {
 setRejectRow(row);
 setRejectReason("");
 }}
 onComplete={() => {
 setCompleteRow(row);
 setCompleteRef(row.transaction_reference ?? "");
 }}
 />
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
                {awaitingClickPesa ? (
                  <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                    ClickPesa confirmation is pending. Do not submit another payout.
                  </p>
                ) : statusHelperText(row) ? (
                  <p className="text-xs text-muted-foreground">{statusHelperText(row)}</p>
                ) : null}
 <div className="flex justify-between">
 <span className="text-muted-foreground">Amount</span>
 <span className="font-semibold">{formatCurrency(row.amount)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Channel</span>
 <span>{DISBURSEMENT_CHANNEL_LABELS[row.method]}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Prepared by</span>
 <span>{staffDisplayLabel(row.prepared_by_name, row.prepared_by)}</span>
 </div>
 {confirmedRejected && rejectedOpen && (
 <div className="min-w-0 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
 <p className="font-medium text-destructive">Why this was rejected</p>
 <p className="mt-1 whitespace-normal break-words leading-5 text-muted-foreground [overflow-wrap:anywhere]">
 {rejectedExplanation(row)}
 </p>
 {(row.order_reference || row.transaction_reference) && (
 <p className="mt-2 whitespace-normal break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
 Reference{" "}
 <span className="font-mono text-foreground">
 {row.order_reference ?? row.transaction_reference}
 </span>
 </p>
 )}
 </div>
 )}
 </CardContent>
 </Card>
 );
 })
 )}
 </div>
 </div>
 </main>

 <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
 <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
 {viewRow ? (
 <DisbursementDetailPanel
 row={viewRow}
 onClose={() => setViewRow(null)}
 onExportPdf={handleExportPdf}
 />
 ) : null}
 </DialogContent>
 </Dialog>

 <Dialog
 open={!!approveRow}
 onOpenChange={(o) => {
 if (!o) {
 setApproveRow(null);
 setApproveRef("");
 }
 }}
 >
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Confirm disbursement</DialogTitle>
 <DialogDescription>
 {approveRow && isGatewayChannel(approveRow.method)
 ? "Review the payout details below. Continuing will send this amount via ClickPesa. After that, wait for confirmation — do not submit another payout."
 : "Review the disbursement details below before approving."}
 </DialogDescription>
 </DialogHeader>
 {approveRow ? (
 <div className="space-y-4 py-2">
 <div className="rounded-lg border bg-muted/30 p-4">
 <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Recipient
 </p>
 <p className="mt-1 text-base font-semibold">
 {approveRow.customer_display_name ?? "—"}
 </p>
 <p className="text-sm text-muted-foreground">
 Loan {approveRow.loan_number ?? approveRow.loan_id}
 </p>
 </div>
 <div className="rounded-lg border bg-muted/30 p-4">
 <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Amount
 </p>
 <p className="mt-1 text-2xl font-bold tabular-nums">
 {formatCurrency(approveRow.amount)}
 </p>
 <p className="mt-1 text-sm text-muted-foreground">
 {DISBURSEMENT_CHANNEL_LABELS[approveRow.method]}
 </p>
 </div>
 {(approveRow.account_name ||
 approveRow.account_number ||
 approveRow.bank_name) && (
 <dl className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
 {approveRow.account_name && (
 <div>
 <dt className="text-muted-foreground">Account name</dt>
 <dd className="font-medium">{approveRow.account_name}</dd>
 </div>
 )}
 {approveRow.account_number && (
 <div>
 <dt className="text-muted-foreground">Account number</dt>
 <dd className="font-mono">{approveRow.account_number}</dd>
 </div>
 )}
 {approveRow.bank_name && (
 <div>
 <dt className="text-muted-foreground">Bank</dt>
 <dd>{approveRow.bank_name}</dd>
 </div>
 )}
 </dl>
 )}
 {!isGatewayChannel(approveRow.method) && (
 <div>
 <Label htmlFor="approve-ref">Transaction reference (optional)</Label>
 <Input
 id="approve-ref"
 value={approveRef}
 onChange={(e) => setApproveRef(e.target.value)}
 placeholder="e.g. cash receipt or bank slip number"
 />
 </div>
 )}
 </div>
 ) : null}
 <DialogFooter>
 <Button
 variant="outline"
 onClick={() => {
 setApproveRow(null);
 setApproveRef("");
 }}
 >
 Cancel
 </Button>
 <Button
 onClick={() =>
 approveRow &&
 patch(approveRow.id, {
 action: "approve",
 ...(approveRef.trim() ? { transaction_reference: approveRef.trim() } : {}),
 })
 }
 disabled={!approveRow || actionLoading === approveRow?.id}
 >
 {approveRow && isGatewayChannel(approveRow.method)
 ? "Continue & send"
 : "Continue"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 <Dialog open={!!completeRow} onOpenChange={(o) => !o && setCompleteRow(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Mark disbursed</DialogTitle>
 <DialogDescription>
 Record completion and optional bank / MNO reference.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-3 py-2">
 <div>
 <Label htmlFor="cref">Transaction reference</Label>
 <Input
 id="cref"
 value={completeRef}
 onChange={(e) => setCompleteRef(e.target.value)}
 placeholder="e.g. FT-123456"
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setCompleteRow(null)}>
 Cancel
 </Button>
 <Button
 onClick={() =>
 completeRow &&
 patch(completeRow.id, {
 action: "complete",
 transaction_reference: completeRef || null,
 })
 }
 disabled={!completeRow || actionLoading === completeRow?.id}
 >
 Confirm complete
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 <Dialog open={!!rejectRow} onOpenChange={(o) => !o && setRejectRow(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Reject disbursement</DialogTitle>
 <DialogDescription>Optional reason (visible on the record).</DialogDescription>
 </DialogHeader>
 <Textarea
 value={rejectReason}
 onChange={(e) => setRejectReason(e.target.value)}
 placeholder="Reason for rejection"
 rows={3}
 />
 <DialogFooter>
 <Button variant="outline" onClick={() => setRejectRow(null)}>
 Cancel
 </Button>
 <Button
 variant="destructive"
 onClick={() =>
 rejectRow &&
 patch(rejectRow.id, { action: "reject", rejection_reason: rejectReason || null })
 }
 disabled={!rejectRow || actionLoading === rejectRow?.id}
 >
 Reject
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
