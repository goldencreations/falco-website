"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCcw, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatApiResponseError } from "@/lib/falco-api";
import { eatIncomeDates, loanIncomeSummaryUrl, loanIncomeReviewHref, type LoanIncomeSummary } from "@/lib/loan-income-summary";

const money = (amount: string) => `TZS ${new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 2 }).format(Number(amount))}`;
const labels: Record<string, string> = { interest: "Interest collected", penalties: "Penalties collected", fees: "Falco-owned fees collected" };

export function LoanIncomeSummaryPanel() {
  const [dates, setDates] = useState(eatIncomeDates);
  const [allTime, setAllTime] = useState(false);
  const [data, setData] = useState<LoanIncomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(loanIncomeSummaryUrl(dates.from, dates.to, allTime), { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(formatApiResponseError(result, "Unable to load loan income."));
      if (!signal.aborted) setData(result.data);
    } catch (reason) {
      if (!signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load loan income.");
    } finally { if (!signal.aborted) setLoading(false); }
  }, [dates.from, dates.to, allTime]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, refresh]);
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) setRefresh(value => value + 1); }, 30000); return () => clearInterval(timer); }, []);
  return <section className="space-y-4 px-4 pt-5 md:px-6" aria-label="Automatic loan income" aria-busy={loading}>
    <Card className="gap-3 py-4"><CardHeader className="gap-3 px-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Landmark className="size-4" />Automatic loan income</CardTitle><p className="mt-1 text-sm text-muted-foreground">Money collected from verified payments. Principal and third-party fees are excluded.</p></div><Button variant="outline" size="sm" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCcw className="size-4" />Refresh totals</Button></div>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 text-sm">From<Input aria-label="Loan income from" type="date" disabled={allTime} value={dates.from} onChange={event => setDates(current => ({ ...current, from: event.target.value }))} /></label><label className="min-w-0 text-sm">To<Input aria-label="Loan income to" type="date" value={dates.to} onChange={event => setDates(current => ({ ...current, to: event.target.value }))} /></label><label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" checked={allTime} onChange={event => setAllTime(event.target.checked)} />All time</label></div>
    </CardHeader><CardContent className="space-y-4 px-4">
      {loading && data ? <p role="status" className="text-xs text-muted-foreground">Updating totals…</p> : null}
      {loading && !data ? <p role="status" className="text-sm">Loading loan income…</p> : error ? <div role="alert" className="text-sm text-destructive">{error}<Button size="sm" variant="ghost" onClick={() => setRefresh(value => value + 1)}>Retry</Button></div> : data ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.rows.map(row => <div key={row.category} className="min-w-0 rounded-lg border p-3"><p className="text-sm text-muted-foreground">{labels[row.category]}</p><p className="mt-2 break-words text-xl font-semibold tabular-nums">{money(row.net_collections)}</p><p className="mt-1 text-xs text-muted-foreground">Received {money(row.gross_collections)} · Reversed {money(row.reversals)}</p></div>)}<div className="min-w-0 rounded-lg border bg-primary/5 p-3"><p className="text-sm">Total collected income</p><p className="mt-2 break-words text-xl font-semibold tabular-nums">{money(data.totals.net_collections)}</p><p className="mt-1 text-xs text-muted-foreground">{data.from} – {data.to} · EAT</p></div></div>
        {data.synchronization.status !== "up_to_date" ? <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-medium">Ledger connection needs review</p><p>{!data.synchronization.posting_enabled ? "Automatic ledger posting is currently disabled. " : ""}{data.synchronization.unposted_events} events await ledger posting; {data.synchronization.payments_without_events} payments need source-event reconciliation.</p>{data.synchronization.review_records?.length ? <ul className="my-2 space-y-2">{data.synchronization.review_records.map(record => {
          const href = loanIncomeReviewHref(record);
          return <li key={record.event_id} className="flex flex-wrap items-center gap-2"><span>{record.payment_number ?? `Ledger event ${record.event_id}`}{record.loan_number ? ` · ${record.loan_number}` : ""}</span>{href ? <Button asChild variant="outline" size="sm"><Link href={href}>{record.loan_id ? "Review affected loan" : "Review customer account"}</Link></Button> : <span className="text-xs">Source record unavailable — contact support.</span>}</li>;
        })}</ul> : null}{data.synchronization.unposted_events > 20 ? <p className="text-xs">Showing the first 20 events requiring review.</p> : null}{data.issues.ambiguous_fee_payments > 0 ? <p>{data.issues.ambiguous_fee_payments} fee payments ({money(data.issues.ambiguous_fee_amount)}) need classification and are excluded from the fees total.</p> : null}{data.issues.historical_interest_loans > 0 ? <p>{data.issues.historical_interest_loans} older loans need their interest-recognition history reviewed before the financial reports can be considered complete.</p> : null}{data.issues.missing_reversal_dates > 0 ? <p>{data.issues.missing_reversal_dates} reversals have no reliable date and need review.</p> : null}</div> : null}
        <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Compare collections with posted ledger income</summary><p className="my-3 text-muted-foreground">{data.reconciliation_note} A difference is not automatically an error.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2 pr-4">Category</th><th className="p-2 text-right">Net collected</th><th className="p-2 text-right">Posted ledger income</th><th className="p-2 text-right">Collected minus ledger</th></tr></thead><tbody>{data.rows.map(row => <tr key={row.category} className="border-b"><td className="py-2 pr-4">{labels[row.category]}</td><td className="p-2 text-right tabular-nums">{money(row.net_collections)}</td><td className="p-2 text-right tabular-nums">{money(row.posted_ledger_income)}</td><td className="p-2 text-right tabular-nums">{money(row.difference)}</td></tr>)}</tbody></table></div></details>
        <p className="text-xs text-muted-foreground">Automatic — Loan Management · Updated {new Intl.DateTimeFormat("en-TZ", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" }).format(new Date(data.generated_at))} EAT</p>
      </> : null}
    </CardContent></Card>
    <div className="px-1"><h2 className="font-semibold">Other / manual income</h2><p className="text-sm text-muted-foreground">Use the register below for income outside automatic loan payments. Do not record loan collections again.</p></div>
  </section>;
}
