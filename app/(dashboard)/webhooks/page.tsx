"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Clock,
  Copy,
  Inbox,
  Loader2,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatApiResponseError } from "@/lib/falco-api";
import { formatDateTime } from "@/lib/formatters";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { WebhookEvent, WebhookEventStatus, WebhookHealthSummary } from "@/lib/types";
import type { PaymentViewRow } from "@/lib/payment-adapters";
import {
  groupWebhookAttempts,
  hasAuthoritativePaymentsPage,
  resolutionLabelText,
  type ReceiptAttemptGroup,
} from "@/lib/webhook-audit-history";
import { useSessionUser } from "@/lib/use-session-user";

const POLL_INTERVAL_MS = 60_000;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadge(status: WebhookEventStatus) {
  if (status === "processed") {
    return (
      <Badge variant="default" className="gap-1 bg-accent text-accent-foreground">
        <CheckCircle2 className="h-3 w-3" />
        Processed
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="gap-1 text-destructive">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }
  if (status === "duplicate") {
    return (
      <Badge variant="secondary" className="gap-1">
        Duplicate
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

export default function WebhookHealthPage() {
  const { user, loaded: sessionLoaded } = useSessionUser();
  const pathname = usePathname();
  const canAccess =
    user?.role === "super_admin" ||
    user?.role === "accountant" ||
    Boolean(user?.permissions?.includes("webhooks.manage"));
  const canManageWebhooks =
    canAccess || Boolean(user?.permissions?.includes("webhooks.manage"));
  const cashbookUnmatchedHref = pathname.startsWith("/accountant")
    ? "/accountant/cashbook?view=unmatched"
    : "/cashbook?view=unmatched";

  const [hours, setHours] = useState<"24" | "168">("24");
  const [health, setHealth] = useState<WebhookHealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [payments, setPayments] = useState<PaymentViewRow[]>([]);
  const [paymentsAuthoritative, setPaymentsAuthoritative] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setHealthLoading(true);
      try {
        const res = await fetch(`/api/webhook-events/health?gateway=clickpesa&hours=${hours}`, {
          credentials: "include",
        });
        const { data } = await parseJsonResponse<{ health?: WebhookHealthSummary | null; message?: string }>(res);
        if (!res.ok) {
          if (res.status === 401) {
            setError("Your session expired. Please sign in again and retry.");
            return;
          }
          throw new Error(formatApiResponseError(data, "Failed to load webhook health"));
        }
        setHealth(data?.health ?? null);
      } catch (e) {
        if (!opts?.silent) setError(e instanceof Error ? e.message : "Failed to load webhook health");
      } finally {
        if (!opts?.silent) setHealthLoading(false);
      }
    },
    [hours]
  );

  const loadEvents = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setEventsLoading(true);
    try {
      const days = hours === "168" ? 7 : 1;
      const params = new URLSearchParams();
      params.set("gateway", "clickpesa");
      params.set("status", "failed");
      params.set("from", isoDateDaysAgo(days));
      params.set("to", todayIsoDate());
      params.set("page", "1");
      params.set("page_size", "200");
      const res = await fetch(`/api/webhook-events?${params.toString()}`, {
        credentials: "include",
      });
      const { data } = await parseJsonResponse<{ events?: WebhookEvent[]; data?: WebhookEvent[]; message?: string }>(
        res
      );
      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session expired. Please sign in again and retry.");
          return;
        }
        throw new Error(formatApiResponseError(data, "Failed to load webhook events"));
      }
      setEvents(data?.events ?? data?.data ?? []);
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : "Failed to load webhook events");
    } finally {
      if (!opts?.silent) setEventsLoading(false);
    }
  }, [hours]);

  const refetchCashbookUnmatched = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("source", "clickpesa");
      params.set("category", "unclassified_gateway_income");
      params.set("status", "posted");
      params.set("from", isoDateDaysAgo(30));
      params.set("to", todayIsoDate());
      params.set("page", "1");
      params.set("page_size", "50");
      await fetch(`/api/financial-entries?${params.toString()}`, { credentials: "include" });
    } catch {
      // Cashbook will load itself when opened; this is a best-effort refresh after retry.
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments?page=1&page_size=100`, {
        credentials: "include",
      });
      const { data } = await parseJsonResponse<{
        payments?: PaymentViewRow[];
        data?: PaymentViewRow[];
        meta?: { total?: number };
      }>(res);
      if (!res.ok) return;
      const rows = data?.payments ?? data?.data ?? [];
      setPayments(rows);
      setPaymentsAuthoritative(hasAuthoritativePaymentsPage(data?.meta, rows.length));
    } catch {
      // Keep diagnostics conservative: unresolved remains "not checked" if payments fetch fails.
      setPaymentsAuthoritative(false);
    }
  }, []);

  const refreshAll = useCallback(
    async (opts?: { silent?: boolean }): Promise<void> => {
      setError(null);
      await Promise.all([loadHealth(opts), loadEvents(opts), loadPayments()]);
    },
    [loadHealth, loadEvents, loadPayments]
  );

  useEffect(() => {
    if (!canAccess) return;
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, hours]);

  // 60-second poll while the page is open, per the handoff spec.
  useEffect(() => {
    if (!canAccess) return;
    const timer = window.setInterval(() => {
      void refreshAll({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [canAccess, refreshAll]);

  const receiptGroups = useMemo(
    () => groupWebhookAttempts(events, payments, { paymentsAuthoritative }),
    [events, payments, paymentsAuthoritative]
  );
  const failedAttemptsCount = health?.failed ?? events.filter((e) => e.status === "failed").length;

  const retry = async (group: ReceiptAttemptGroup) => {
    const event = group.latest;
    if (event.status !== "failed" || !canManageWebhooks) return;
    const confirmText = `Retry this failed processing event?\n\nEvent reference: ${group.event_reference}\nOrder reference: ${group.order_reference ?? "—"}\n\nFailed means a payload, amount, or processing error — not an unknown customer. Unmatched receipts appear in Cashbook → Unmatched.`;
    if (!window.confirm(confirmText)) return;

    setRetryingIds((prev) => new Set(prev).add(event.id));
    try {
      const res = await fetch(`/api/webhook-events/${encodeURIComponent(event.id)}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      if (res.status === 202) {
        toast.success("Retry queued. If a receipt posts, it will appear in Cashbook → Unmatched — not as a new payment.");
        await Promise.all([refreshAll({ silent: true }), refetchCashbookUnmatched()]);
        return;
      }
      if (res.status === 409) {
        toast.info("This event is already resolved or processing — refreshing the list.");
        await Promise.all([refreshAll({ silent: true }), refetchCashbookUnmatched()]);
        return;
      }
      if (res.status === 401) {
        toast.error("Your session expired. Please sign in again and retry.");
        return;
      }
      if (res.status === 404) {
        toast.error("This event no longer exists — refreshing the list.");
        await refreshAll({ silent: true });
        return;
      }
      toast.error(formatApiResponseError(data, `Retry failed (${res.status})`));
    } catch {
      toast.error("Network error while retrying the event.");
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
    }
  };

  const copyReference = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const healthCards = useMemo(
    () => [
      { label: "Received attempts", value: health?.received ?? 0, icon: Inbox, tone: "text-foreground" },
      { label: "Processed attempts", value: health?.processed ?? 0, icon: CheckCircle2, tone: "text-accent" },
      { label: "Failed attempts", value: health?.failed ?? 0, icon: XCircle, tone: "text-destructive" },
      { label: "Pending attempts", value: health?.pending ?? 0, icon: Clock, tone: "text-amber-600" },
      { label: "Duplicate attempts", value: health?.duplicate ?? 0, icon: Copy, tone: "text-muted-foreground" },
    ],
    [health]
  );

  if (!sessionLoaded) {
    return (
      <>
        <DashboardHeader title="Webhook Health" description="Loading…" />
        <main className="flex-1 p-4 lg:p-6">
          <p className="text-sm text-muted-foreground">Loading session…</p>
        </main>
      </>
    );
  }

  if (!canAccess) {
    return (
      <>
        <DashboardHeader title="Webhook Health" description="Admins with webhook access only." />
        <main className="flex-1 p-4 lg:p-6">
          <Card className="mx-auto max-w-3xl border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Access denied
              </CardTitle>
              <CardDescription>
                Only accountants, the super admin, or staff with webhooks.manage can view ClickPesa webhook health.
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
        title="Webhook Health"
        description="ClickPesa delivery health. Failed events are payload, amount, or processing errors — unmatched BillPay numbers now post to Cashbook as unclassified income."
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {error ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={hours} onValueChange={(v) => setHours(v as "24" | "168")}>
              <TabsList>
                <TabsTrigger value="24">Last 24 hours</TabsTrigger>
                <TabsTrigger value="168">Last 7 days</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button type="button" variant="outline" onClick={() => forceCachedReload(() => refreshAll())}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {healthLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading webhook health…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {healthCards.map((c) => (
                <Card key={c.label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`flex items-center gap-2 text-2xl font-bold ${c.tone}`}>
                      <c.icon className="h-5 w-5" />
                      {c.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {(health?.failed ?? 0) > 0 ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="space-y-1 py-3 text-sm text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {health?.failed} failed event{health?.failed === 1 ? "" : "s"} in this window.
                    Unmatched receipts now appear in Cashbook → Unmatched. Failed events are processing
                    errors.
                  </span>
                </div>
                <p className="pl-6 text-xs">
                  After deploy, unknown or ambiguous ClickPesa receipts are posted as unclassified
                  income. They are not expected to stay in this failed list.{" "}
                  <Link href={cashbookUnmatchedHref} className="underline underline-offset-2">
                    Open unmatched cashbook
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          ) : null}

          {(health?.pending ?? 0) > 0 ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex items-center gap-2 py-3 text-sm text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {health?.pending} event{health?.pending === 1 ? "" : "s"} still queued for processing.
                {health?.oldest_pending_at ? (
                  <span>Oldest pending since {formatDateTime(health.oldest_pending_at)}.</span>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Failed processing events {failedAttemptsCount > 0 ? `(${failedAttemptsCount})` : ""}
              </h2>
              <Button type="button" variant="link" className="h-auto p-0 text-sm" asChild>
                <Link href={cashbookUnmatchedHref}>Cashbook → Unmatched</Link>
              </Button>
            </div>
            {eventsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading events…
              </div>
            ) : (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Attempts</TableHead>
                          <TableHead>Latest attempt</TableHead>
                          <TableHead>Order reference</TableHead>
                          <TableHead>Resolution</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptGroups.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                              No failed ClickPesa processing events in this range. Unmatched receipts
                              appear in Cashbook → Unmatched.
                            </TableCell>
                          </TableRow>
                        ) : (
                          receiptGroups.map((group) => {
                            const expanded = expandedGroups.has(group.key);
                            const latest = group.latest;
                            return (
                              <Fragment key={group.key}>
                                <TableRow>
                                  <TableCell className="font-mono text-xs">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 hover:underline"
                                      onClick={() => void copyReference(group.event_reference)}
                                      title="Copy reference"
                                    >
                                      {group.event_reference || "—"}
                                      {group.event_reference ? <Copy className="h-3 w-3 opacity-50" /> : null}
                                    </button>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                      onClick={() =>
                                        setExpandedGroups((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(group.key)) next.delete(group.key);
                                          else next.add(group.key);
                                          return next;
                                        })
                                      }
                                    >
                                      {group.attempts.length}
                                      <ChevronDown
                                        className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                                      />
                                    </button>
                                  </TableCell>
                                  <TableCell>{statusBadge(latest.status)}</TableCell>
                                  <TableCell className="font-mono text-xs">{group.order_reference ?? "—"}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        group.resolution === "resolved_after_failure"
                                          ? "default"
                                          : group.resolution === "unresolved"
                                            ? "destructive"
                                            : "outline"
                                      }
                                      className="gap-1"
                                    >
                                      {resolutionLabelText(group.resolution)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={latest.error_message}>
                                    {latest.error_message ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {group.resolution === "resolved_after_failure" ? (
                                      <Badge variant="outline">Resolved after failure</Badge>
                                    ) : latest.status === "failed" ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={retryingIds.has(latest.id) || !canManageWebhooks}
                                        onClick={() => void retry(group)}
                                      >
                                        {retryingIds.has(latest.id) ? (
                                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                        )}
                                        Retry
                                      </Button>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                                {expanded
                                  ? group.attempts.map((attempt) => (
                                      <TableRow key={attempt.id} className="bg-muted/30">
                                        <TableCell className="pl-6 text-xs text-muted-foreground">
                                          {attempt.event_type || "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">Attempt</TableCell>
                                        <TableCell>{statusBadge(attempt.status)}</TableCell>
                                        <TableCell className="font-mono text-xs">
                                          {attempt.order_reference ||
                                            String(attempt.metadata?.order_reference ?? "") ||
                                            "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                          {attempt.processed_at ? formatDateTime(attempt.processed_at) : "—"}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={attempt.error_message}>
                                          {attempt.error_message ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                          {attempt.received_at ? formatDateTime(attempt.received_at) : "—"}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  : null}
                              </Fragment>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Unmatched BillPay numbers are posted to Cashbook as unclassified income. This screen does
            not create a payment or a second cashbook row. Retry is only for failed processing events.
          </p>
        </div>
      </main>
    </>
  );
}
