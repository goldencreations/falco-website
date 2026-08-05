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
import { DisbursementRetryDialog } from "@/components/disbursements/disbursement-retry-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { exportDisbursementToPdf } from "@/lib/disbursement-pdf";
import {
 adaptApiDisbursementRow,
 type DisbursementKpis,
 type DisbursementViewRow,
} from "@/lib/disbursement-adapters";
import {
 DISBURSEMENT_CHANNEL_LABELS,
 type Disbursement,
 type DisbursementPaymentChannel,
} from "@/lib/disbursement-types";
import {
 canApproveDisbursement as userCanApproveDisbursement,
 canPrepareDisbursement as userCanPrepareDisbursement,
} from "@/lib/disbursement-permissions";
import {
 canShowRetryPayout,
 mergeDisbursementRetryIntoList,
 type DisbursementRetrySuccess,
} from "@/lib/disbursement-retry";
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
 * Labels follow the safe ClickPesa workflow guide.
 * `payout_authorized` is not a success — display stays on processing until final ClickPesa success.
 */
const statusConfig: Record<
 Disbursement["status"],
 { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
 pending_approval: { label: "Pending approval", variant: "secondary" },
 approved: { label: "Approved", variant: "default" },
 processing: { label: "Awaiting ClickPesa confirmation", variant: "outline" },
 completed: { label: "Completed", variant: "default" },
 rejected: { label: "Rejected/Reversed", variant: "destructive" },
};

const MOBILE_CHANNELS: DisbursementPaymentChannel[] = [
 "mpesa",
 "airtel_money",
 "yas",
 "halopesa",
];
const BANK_CHANNELS: DisbursementPaymentChannel[] = ["crdb", "nmb"];

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

/** ClickPesa (or any gateway) payout — never invent order refs; never manual-complete. */
function isClickPesaDisbursement(row: DisbursementViewRow): boolean {
 if (row.gateway) return true;
 return isGatewayChannel(row.method);
}

function rawGatewayError(row: DisbursementViewRow): string {
 const value = row.metadata?.gateway_error;
 return typeof value === "string" ? value.trim() : "";
}

/** `metadata.gateway_response` may be a string or nested object. */
function parseGatewayResponse(row: DisbursementViewRow): Record<string, unknown> | null {
  const value = row.metadata?.gateway_response;
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function gatewayStatusCode(row: DisbursementViewRow): string {
  const parsed = parseGatewayResponse(row);
  if (!parsed) return "";
  const payload =
    parsed.payload && typeof parsed.payload === "object" && !Array.isArray(parsed.payload)
      ? (parsed.payload as Record<string, unknown>)
      : null;
  return String(parsed.status ?? payload?.status ?? "").trim().toLowerCase();
}

/** ClickPesa accepted the order but cash may not have left yet (open statuses only). */
function isPayoutAuthorizedOnly(row: DisbursementViewRow): boolean {
  if (row.status === "completed" || row.disbursed_at) return false;
  if (row.status === "rejected") return false;
  const code = gatewayStatusCode(row);
  return code === "payout_authorized" || code === "authorized" || code === "pending";
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

/** True only while a gateway payout is still open — never for completed/paid rows. */
function isAwaitingClickPesaConfirmation(row: DisbursementViewRow): boolean {
 if (row.status === "completed" || Boolean(row.disbursed_at)) return false;
 if (row.status === "rejected" && !isAmbiguousGatewayOutcome(row)) return false;
 if (!isClickPesaDisbursement(row) && row.status !== "processing") return false;
 if (isAmbiguousGatewayOutcome(row)) return true;
 if (row.status === "processing") return true;
 if (isPayoutAuthorizedOnly(row)) return true;
 if (row.status === "approved" && isClickPesaDisbursement(row)) return true;
 return false;
}

/** Badge always shows the mapped workflow label. */
function displayStatus(row: DisbursementViewRow): {
 label: string;
 variant: "default" | "secondary" | "destructive" | "outline";
} {
 return statusConfig[row.status] ?? statusConfig.pending_approval;
}

/** Short label for list/table rows — avoid duplicating the processing badge text. */
function statusListHint(row: DisbursementViewRow): string | null {
 if (row.status === "processing" || isAwaitingClickPesaConfirmation(row)) return null;
 if (row.status === "approved" && !isClickPesaDisbursement(row)) {
 return "Mark when paid";
 }
 return null;
}

/** Longer copy for the detail dialog only. */
function statusHelperText(row: DisbursementViewRow): string | null {
 if (isAwaitingClickPesaConfirmation(row)) {
 return "ClickPesa has not confirmed cash-out yet. Do not create another disbursement for this loan.";
 }
 if (row.status === "approved" && !isClickPesaDisbursement(row)) {
 return "Approved — mark Completed once the cash has been handed over.";
 }
 return null;
}

/**
 * Detects gateway timeout / "payout already in progress" style errors on `POST /disbursements`
 * create. These must never be retried with a second create — instead recover the existing
 * disbursement for the loan so the operator opens it rather than risking a duplicate payout.
 */
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
 onRetry,
}: {
 row: DisbursementViewRow;
 canApprove: boolean;
 actionLoading: boolean;
 onView: () => void;
 onApprove: () => void;
 onReject: () => void;
 onComplete: () => void;
 onRetry: () => void;
}) {
 const canApprovePending = canApprove && row.status === "pending_approval";
 const canCompleteCash =
 canApprove &&
 row.status === "approved" &&
 !isClickPesaDisbursement(row) &&
 !isAwaitingClickPesaConfirmation(row);
 const canRetry = canApprove && canShowRetryPayout(row);
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
 {canRetry ? (
 <DropdownMenuItem onClick={onRetry} disabled={actionLoading}>
 <RefreshCcw className="mr-2 h-4 w-4" />
 Retry payout
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
 <p className="font-medium">Waiting for ClickPesa cash-out confirmation.</p>
 <p className="mt-1 text-sky-900/80">
 Reconciliation updates this when ClickPesa reports a final result. Do not create another
 payout for this loan.
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

 {rawGatewayError(row) ? (
 <>
 <Separator className="my-5" />
 <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
 <p className="font-medium text-destructive">Payment could not be completed</p>
 <p className="mt-1 text-muted-foreground">
 Check this reference in ClickPesa before creating a new disbursement.
 </p>
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
 {awaitingClickPesa
 ? "Not confirmed yet"
 : row.disbursed_at
 ? formatDateTime(row.disbursed_at)
 : "—"}
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
 const createHref = resolvePortalHref(user?.role, "/disbursements/new");
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState<string>("all");
 const [rows, setRows] = useState<DisbursementViewRow[]>([]);
 const [kpis, setKpis] = useState<DisbursementKpis | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [actionLoading, setActionLoading] = useState<string | null>(null);

 const [viewRow, setViewRow] = useState<DisbursementViewRow | null>(null);
 const [approveRow, setApproveRow] = useState<DisbursementViewRow | null>(null);
 const [completeRow, setCompleteRow] = useState<DisbursementViewRow | null>(null);
 const [completeRef, setCompleteRef] = useState("");
 const [approveRef, setApproveRef] = useState("");
 const [rejectRow, setRejectRow] = useState<DisbursementViewRow | null>(null);
 const [rejectReason, setRejectReason] = useState("");
 const [retryRow, setRetryRow] = useState<DisbursementViewRow | null>(null);
 const [successMessage, setSuccessMessage] = useState<string | null>(null);
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

 const handleRetrySuccess = useCallback(
  async (result: DisbursementRetrySuccess, originalId: string) => {
   setError(null);
   const orderPart = result.orderReference
    ? ` New order reference: ${result.orderReference}.`
    : "";
   setSuccessMessage(`${result.message}${orderPart}`);

   if (result.disbursement) {
    const adapted = adaptApiDisbursementRow(result.disbursement);
    // Never invent completed — only use backend-adapted status.
    setRows((prev) => mergeDisbursementRetryIntoList(prev, originalId, adapted));
   }

   await load();
   try {
    localStorage.setItem("falco.disbursement.updated", String(Date.now()));
   } catch {
    /* storage unavailable */
   }
   window.dispatchEvent(new CustomEvent("falco:disbursement:updated"));
  },
  [load]
 );

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
 {successMessage && (
 <div className="flex items-center gap-2 rounded-lg border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
 <CheckCircle2 className="h-4 w-4 shrink-0" />
 {successMessage}
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
 {sessionLoaded && !canPrepareDisbursement ? (
 <Button
 type="button"
 size="sm"
 disabled
 title="You do not have permission to create disbursements"
 >
 <Plus className="mr-2 h-4 w-4" />
 Create disbursement
 </Button>
 ) : (
 <Button asChild size="sm" title={!sessionLoaded ? "Loading session…" : undefined}>
 <Link href={createHref}>
 <Plus className="mr-2 h-4 w-4" />
 Create disbursement
 </Link>
 </Button>
 )}
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
 <div className="flex flex-wrap items-center gap-1.5">
 <Badge variant={sc.variant}>{sc.label}</Badge>
 {statusListHint(row) ? (
 <Badge variant="outline" className="font-normal text-muted-foreground">
 {statusListHint(row)}
 </Badge>
 ) : null}
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
 if (isClickPesaDisbursement(row)) return;
 setCompleteRow(row);
 setCompleteRef(row.transaction_reference ?? "");
 }}
 onRetry={() => {
 setSuccessMessage(null);
 setError(null);
 setRetryRow(row);
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
 if (isClickPesaDisbursement(row)) return;
 setCompleteRow(row);
 setCompleteRef(row.transaction_reference ?? "");
 }}
 onRetry={() => {
 setSuccessMessage(null);
 setError(null);
 setRetryRow(row);
 }}
 />
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 {statusListHint(row) ? (
 <Badge variant="outline" className="font-normal text-muted-foreground">
 {statusListHint(row)}
 </Badge>
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

 <Dialog
 open={!!completeRow && !isClickPesaDisbursement(completeRow)}
 onOpenChange={(o) => !o && setCompleteRow(null)}
 >
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

 <DisbursementRetryDialog
  row={retryRow}
  open={!!retryRow}
  loading={Boolean(retryRow && actionLoading === retryRow.id)}
  onOpenChange={(open) => {
   if (!open) setRetryRow(null);
  }}
  onLoadingChange={(loading) => {
   if (!retryRow) return;
   setActionLoading(loading ? retryRow.id : null);
  }}
  onSuccess={(result) => {
   const originalId = retryRow?.id ?? "";
   setRetryRow(null);
   void handleRetrySuccess(result, originalId);
  }}
  onError={(message) => {
   setError(message);
   setSuccessMessage(null);
  }}
 />
 </>
 );
}
