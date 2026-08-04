"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
import { webhookEventStatusLabel } from "@/lib/webhook-event-adapters";
import { useSessionUser } from "@/lib/use-session-user";

const POLL_INTERVAL_MS = 60_000;

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
  const canAccess = user?.role === "super_admin" || user?.role === "accountant";

  const [hours, setHours] = useState<"24" | "168">("24");
  const [health, setHealth] = useState<WebhookHealthSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
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
      const res = await fetch(`/api/webhook-events?gateway=clickpesa&status=failed&page_size=100`, {
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
  }, []);

  const refreshAll = useCallback(
    async (opts?: { silent?: boolean }): Promise<void> => {
      setError(null);
      await Promise.all([loadHealth(opts), loadEvents(opts)]);
    },
    [loadHealth, loadEvents]
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

  const failedCount = health?.failed ?? events.length;

  const retry = async (event: WebhookEvent) => {
    setRetryingIds((prev) => new Set(prev).add(event.id));
    try {
      const res = await fetch(`/api/webhook-events/${encodeURIComponent(event.id)}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);
      if (res.status === 202) {
        toast.success(`Retry queued for ${event.event_reference || event.id}`);
        await refreshAll({ silent: true });
        return;
      }
      if (res.status === 409) {
        toast.info("This event is already resolved or processing — refreshing the list.");
        await refreshAll({ silent: true });
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
      { label: "Received", value: health?.received ?? 0, icon: Inbox, tone: "text-foreground" },
      { label: "Processed", value: health?.processed ?? 0, icon: CheckCircle2, tone: "text-accent" },
      { label: "Failed", value: health?.failed ?? 0, icon: XCircle, tone: "text-destructive" },
      { label: "Pending", value: health?.pending ?? 0, icon: Clock, tone: "text-amber-600" },
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
        <DashboardHeader title="Webhook Health" description="Accountant / super admin access only." />
        <main className="flex-1 p-4 lg:p-6">
          <Card className="mx-auto max-w-3xl border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <ShieldAlert className="h-5 w-5" />
                Access denied
              </CardTitle>
              <CardDescription>
                Only accountants and the super admin can view ClickPesa webhook health.
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
        description="ClickPesa gateway callbacks: delivery health and failed-event retry."
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Failed events {failedCount > 0 ? `(${failedCount})` : ""}
              </h2>
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
                          <TableHead>Event type</TableHead>
                          <TableHead>Event reference</TableHead>
                          <TableHead>Received</TableHead>
                          <TableHead>Processed</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                              No failed ClickPesa webhook events in this range.
                            </TableCell>
                          </TableRow>
                        ) : (
                          events.map((event) => (
                            <TableRow key={event.id}>
                              <TableCell className="text-sm">{event.event_type || "—"}</TableCell>
                              <TableCell className="font-mono text-xs">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 hover:underline"
                                  onClick={() => void copyReference(event.event_reference)}
                                  title="Copy reference"
                                >
                                  {event.event_reference || "—"}
                                  {event.event_reference ? <Copy className="h-3 w-3 opacity-50" /> : null}
                                </button>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {event.received_at ? formatDateTime(event.received_at) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {event.processed_at ? formatDateTime(event.processed_at) : "—"}
                              </TableCell>
                              <TableCell>{statusBadge(event.status)}</TableCell>
                              <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={event.error_message}>
                                {event.error_message ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {event.status === "failed" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={retryingIds.has(event.id)}
                                    onClick={() => void retry(event)}
                                  >
                                    {retryingIds.has(event.id) ? (
                                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    Retry
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Statuses shown here are informational only — this screen never automatically credits a
            receipt to a loan or customer.
          </p>
        </div>
      </main>
    </>
  );
}
