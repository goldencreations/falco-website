"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/formatters";
import { DISBURSEMENT_CHANNEL_LABELS } from "@/lib/disbursement-types";
import type { DisbursementViewRow } from "@/lib/disbursement-adapters";
import {
  canSubmitDisbursementRetry,
  DisbursementRetryIdempotencySession,
  formatDisbursementRetryValidationError,
  parseDisbursementRetrySuccess,
  RETRY_CHECKBOX_LABEL,
  RETRY_CONFIRMATION_COPY,
  type DisbursementRetrySuccess,
} from "@/lib/disbursement-retry";
import { parseJsonResponse } from "@/lib/parse-json-response";

type DisbursementRetryDialogProps = {
  row: DisbursementViewRow | null;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: (result: DisbursementRetrySuccess) => void;
  onError: (message: string) => void;
};

export function DisbursementRetryDialog({
  row,
  open,
  loading,
  onOpenChange,
  onLoadingChange,
  onSuccess,
  onError,
}: DisbursementRetryDialogProps) {
  const [confirmedNotPaid, setConfirmedNotPaid] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const sessionRef = useRef(new DisbursementRetryIdempotencySession());

  useEffect(() => {
    if (!open) {
      setConfirmedNotPaid(false);
      setLocalError(null);
      sessionRef.current.reset();
    }
  }, [open]);

  const submit = async () => {
    if (!row || !canSubmitDisbursementRetry(confirmedNotPaid, loading)) return;

    const idempotencyKey = sessionRef.current.getOrCreate();
    onLoadingChange(true);
    setLocalError(null);

    try {
      const res = await fetch(`/api/disbursements/${encodeURIComponent(row.id)}/retry`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ confirmed_not_paid: true }),
      });
      const { data } = await parseJsonResponse<Record<string, unknown>>(res);

      if (res.status === 422) {
        const message = formatDisbursementRetryValidationError(data);
        setLocalError(message);
        onError(message);
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          const message = "Your session expired. Please sign in again and retry.";
          setLocalError(message);
          onError(message);
          return;
        }
        const message = formatDisbursementRetryValidationError(data, "Retry failed");
        setLocalError(message);
        onError(message);
        return;
      }

      const parsed = parseDisbursementRetrySuccess(data);
      onSuccess(parsed);
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Retry failed";
      setLocalError(message);
      onError(message);
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 border-emerald-100 sm:max-w-lg">
        <DialogHeader className="space-y-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <RefreshCcw className="h-4 w-4" />
            </span>
            Retry payout
          </DialogTitle>
          <DialogDescription className="sr-only">{RETRY_CONFIRMATION_COPY}</DialogDescription>
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-left"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <p className="text-sm leading-relaxed text-amber-950">{RETRY_CONFIRMATION_COPY}</p>
          </div>
        </DialogHeader>

        {row ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3">
              <p className="text-base font-semibold text-foreground">
                {row.customer_display_name ?? "—"}
              </p>
              <dl className="mt-2 grid gap-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Loan</dt>
                  <dd className="font-mono text-right text-foreground">
                    {row.loan_number ?? row.loan_id}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(row.amount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Channel</dt>
                  <dd className="text-right text-foreground">
                    {DISBURSEMENT_CHANNEL_LABELS[row.method]}
                  </dd>
                </div>
                {(row.order_reference || row.transaction_reference) && (
                  <div className="flex justify-between gap-3 border-t border-emerald-100/80 pt-1.5">
                    <dt className="text-muted-foreground">Prior reference</dt>
                    <dd className="font-mono text-right text-xs text-foreground">
                      {row.order_reference ?? row.transaction_reference}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <label
              htmlFor="confirmed-not-paid"
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3.5 py-3 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-emerald-300 has-[[data-state=checked]]:bg-emerald-50/40"
            >
              <Checkbox
                id="confirmed-not-paid"
                className="mt-0.5"
                checked={confirmedNotPaid}
                disabled={loading}
                onCheckedChange={(checked) => setConfirmedNotPaid(checked === true)}
              />
              <span className="text-sm font-medium leading-snug text-foreground">
                {RETRY_CHECKBOX_LABEL}
              </span>
            </label>

            {localError ? (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{localError}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!canSubmitDisbursementRetry(confirmedNotPaid, loading) || !row}
            onClick={() => void submit()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Retrying…
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry payout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
