"use client";

import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { failedAttemptDate, failedAttemptReason, failedClickPesaAttemptsUrl } from "@/lib/failed-clickpesa-attempts";
import type { WebhookEvent } from "@/lib/types";

export function FailedClickPesaAttempts({ from, to, enabled }: { from: string; to: string; enabled: boolean }) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => { setPage(1); }, [from, to]);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setRevision(value => value + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch(failedClickPesaAttemptsUrl(from, to, page), {
          credentials: "include", cache: "no-store", signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Failed ClickPesa attempts could not be loaded.");
        if (controller.signal.aborted) return;
        const rows: WebhookEvent[] = body.events ?? body.data ?? [];
        setEvents(rows.filter(row => row.event_type === "PAYMENT FAILED" && row.status === "processed" && row.payment_attempt));
        setTotal(body.meta?.total ?? rows.length);
        setError(null);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setEvents([]);
        setTotal(0);
        setError(failure instanceof Error ? failure.message : "Failed ClickPesa attempts could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [enabled, from, to, page, revision]);

  if (!enabled) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base">Failed ClickPesa attempts{total ? ` (${total})` : ""}</CardTitle>
          <p className="text-sm text-muted-foreground">No money received. These attempts do not affect cash totals or loan repayments.</p>
          <p className="text-xs text-muted-foreground">Uses the date filters above, in East Africa Time. Updates every 30 seconds.</p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => setRevision(value => value + 1)}>
          <RefreshCcw className="mr-2 h-4 w-4" />Refresh attempts
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {error ? <p role="alert" className="px-6 pb-4 text-sm text-destructive">{error}</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date / time (EAT)</TableHead><TableHead>Customer / reference</TableHead>
              <TableHead>Status</TableHead><TableHead>Channel</TableHead>
              <TableHead>Attempted amount</TableHead><TableHead>Failure reason</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {events.length === 0 ? <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                {loading ? "Loading failed attempts…" : "No failed ClickPesa attempts for this period."}
              </TableCell></TableRow> : events.map(event => {
                const attempt = event.payment_attempt!;
                return <TableRow key={event.id}>
                  <TableCell className="whitespace-nowrap">{failedAttemptDate(event.received_at)}</TableCell>
                  <TableCell><div className="font-medium">{attempt.customer_name || "Customer unavailable"}</div>
                    <div className="break-all text-xs text-muted-foreground">{attempt.reference || event.event_reference}</div>
                    {attempt.order_reference ? <div className="text-xs text-muted-foreground">Order: {attempt.order_reference}</div> : null}
                  </TableCell>
                  <TableCell><Badge variant="destructive">Failed</Badge><div className="mt-1 text-xs text-muted-foreground">No money received</div></TableCell>
                  <TableCell className="max-w-48 whitespace-normal">{attempt.channel || "Not provided"}</TableCell>
                  <TableCell className="whitespace-nowrap">{attempt.amount == null ? "Not provided" : `${attempt.currency} ${new Intl.NumberFormat("en-TZ", {maximumFractionDigits: 2}).format(Number(attempt.amount))}`}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal break-words">{failedAttemptReason(attempt.reason)}</TableCell>
                </TableRow>;
              })}
            </TableBody>
          </Table>
        )}
        {total > 10 ? <div className="flex items-center justify-end gap-3 border-t p-3 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</Button>
          <span>Page {page} of {Math.ceil(total / 10)}</span>
          <Button variant="outline" size="sm" disabled={page * 10 >= total || loading} onClick={() => setPage(value => value + 1)}>Next</Button>
        </div> : null}
      </CardContent>
    </Card>
  );
}
