"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Search, Scale } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatApiResponseError } from "@/lib/falco-api";

type Balance = { debits: string; credits: string; difference: string; is_balanced: boolean; journal_count: number };
type LoanSummary = {
  id: number; loan_number: string; status: string; principal: string; total_outstanding: string;
  customer: { id: number; customer_number: string; full_name: string; phone_number: string } | null;
  application: { id: number; application_number: string } | null;
  product: { id: number; name: string } | null;
};
type SearchResult = LoanSummary & { ledger: Balance };
type JournalLine = { id: number; line_number: number; account_code: string; account_name: string; debit: string; credit: string; description?: string | null };
type Journal = { id: number; journal_number: string; transaction_date: string; event_type?: string | null; narration: string; status: string; totals: Balance; lines: JournalLine[] };
type PendingEvent = { id: number; event_type: string; transaction_date: string; status: string; last_error?: string | null };
type LoanLedger = { loan: LoanSummary; totals: Balance; journals: Journal[]; pending_events: PendingEvent[] };
type PageMeta = { current_page: number; per_page: number; total: number; last_page: number; from: number | null; to: number | null };

const api = "/api/general-ledger";
const money = (value: string | number) => `TZS ${new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${api}/${path}`, { cache: "no-store" });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(formatApiResponseError(json, "General Ledger request failed."));
  return json as T;
}

export function GeneralLedgerWorkspace() {
  const [postingEnabled, setPostingEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [activeSearch, setActiveSearch] = useState("");
  const [selected, setSelected] = useState<LoanLedger | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const loadLoans = useCallback(async (page: number, term: string) => {
    setLoading(true); setError(""); setSelected(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (term) params.set("search", term);
      const response = await requestJson<{ data: SearchResult[]; meta: PageMeta }>(`loan-ledgers?${params.toString()}`);
      setResults(response.data); setMeta(response.meta); setActiveSearch(term); setSearched(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load active loan ledgers."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void requestJson<{ data: { posting_enabled: boolean } }>("dashboard")
      .then((response) => setPostingEnabled(response.data.posting_enabled))
      .catch(() => undefined);
    void loadLoans(1, "");
  }, [loadLoans]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = search.trim();
    if (term.length === 1) {
      setError("Enter at least two letters, a loan number, an application number, or a phone number.");
      return;
    }
    await loadLoans(1, term);
  }

  async function openLedger(loanId: number) {
    setLoading(true); setError("");
    try {
      const response = await requestJson<{ data: LoanLedger }>(`loan-ledgers/${loanId}`);
      setSelected(response.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load this loan ledger."); }
    finally { setLoading(false); }
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/25">
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-3"><SidebarTrigger /><div><h1 className="text-base font-semibold">Customer Loan Ledger</h1><p className="text-xs text-muted-foreground">Browse active loans and confirm that every debit equals its credit.</p></div></div>
      <Badge variant={postingEnabled ? "default" : "secondary"}>{postingEnabled ? "Automatic posting on" : "Automatic posting off"}</Badge>
    </header>
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Find a customer loan</CardTitle><p className="text-sm text-muted-foreground">Search by customer name, customer number, phone, loan number, or application number.</p></CardHeader><CardContent>
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Example: Amina Mushi, LN-000123, or 2557…" /></div><Button disabled={loading} className="sm:min-w-32">{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}Search</Button></form>
      </CardContent></Card>
      {error ? <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
      {selected ? <LoanLedgerDetail ledger={selected} onBack={() => setSelected(null)} /> : <SearchResults results={results} meta={meta} searched={searched} loading={loading} activeSearch={activeSearch} onOpen={openLedger} onPage={(page) => loadLoans(page, activeSearch)} />}
    </main>
  </div>;
}

function SearchResults({ results, meta, searched, loading, activeSearch, onOpen, onPage }: { results: SearchResult[]; meta: PageMeta | null; searched: boolean; loading: boolean; activeSearch: string; onOpen: (loanId: number) => void; onPage: (page: number) => void }) {
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!searched) return null;
  if (!results.length) return <div className="rounded-xl border bg-background px-6 py-12 text-center text-sm text-muted-foreground">{activeSearch ? "No active customer loans matched that search." : "There are no active customer loans to display."}</div>;

  return <Card><CardHeader><CardTitle className="text-base">{activeSearch ? "Matching active loans" : "All active customer loans"} ({meta?.total ?? results.length})</CardTitle><p className="text-sm text-muted-foreground">Showing {meta?.from ?? 1}–{meta?.to ?? results.length} of {meta?.total ?? results.length} loans.</p></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Loan / application</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="w-10 text-center text-lg">=</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Balance check</TableHead><TableHead /></TableRow></TableHeader><TableBody>{results.map((result) => <TableRow key={result.id}>
    <TableCell><div className="font-medium">{result.customer?.full_name ?? "Unknown customer"}</div><div className="text-xs text-muted-foreground">{result.customer?.customer_number} · {result.customer?.phone_number}</div></TableCell>
    <TableCell><div className="font-mono text-sm">{result.loan_number}</div><div className="text-xs text-muted-foreground">{result.application?.application_number ?? "No application number"} · {result.product?.name ?? "Product unavailable"}</div></TableCell>
    <TableCell className="text-right font-medium tabular-nums">{money(result.ledger.debits)}</TableCell><TableCell className={result.ledger.is_balanced ? "text-center text-lg font-bold text-emerald-700" : "text-center text-lg font-bold text-destructive"}>{result.ledger.is_balanced ? "=" : "≠"}</TableCell><TableCell className="text-right font-medium tabular-nums">{money(result.ledger.credits)}</TableCell><TableCell><BalanceBadge balance={result.ledger} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => onOpen(result.id)}>View ledger</Button></TableCell>
  </TableRow>)}</TableBody></Table></div>{meta && meta.last_page > 1 ? <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row"><p className="text-sm text-muted-foreground">Page {meta.current_page} of {meta.last_page}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>Next</Button></div></div> : null}</CardContent></Card>;
}

function LoanLedgerDetail({ ledger, onBack }: { ledger: LoanLedger; onBack: () => void }) {
  return <div className="space-y-5">
    <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" />Back to results</Button>
    <Card><CardContent className="grid gap-5 pt-6 lg:grid-cols-[1.4fr_1fr]"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</p><h2 className="mt-1 text-xl font-semibold">{ledger.loan.customer?.full_name ?? "Unknown customer"}</h2><p className="mt-1 text-sm text-muted-foreground">{ledger.loan.customer?.customer_number} · {ledger.loan.customer?.phone_number}</p><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">Loan {ledger.loan.loan_number}</Badge><Badge variant="outline">Application {ledger.loan.application?.application_number ?? "—"}</Badge><Badge variant="secondary">{ledger.loan.status.replaceAll("_", " ")}</Badge></div></div><div className={ledger.totals.is_balanced ? "rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" : "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive"}><div className="flex items-center gap-2 font-semibold">{ledger.totals.is_balanced ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}{ledger.totals.is_balanced ? "Debit and credit match" : "Debit and credit do not match"}</div><BalanceEquation balance={ledger.totals} className="mt-3" /><p className="mt-2 text-sm">Difference: <span className="font-semibold tabular-nums">{money(ledger.totals.difference)}</span></p><p className="mt-1 text-xs opacity-75">Across {ledger.totals.journal_count} posted journal{ledger.totals.journal_count === 1 ? "" : "s"}</p></div></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Total debit" value={money(ledger.totals.debits)} /><Metric label="Total credit" value={money(ledger.totals.credits)} /><Metric label="Current loan outstanding" value={money(ledger.loan.total_outstanding)} /></div>
    {ledger.pending_events.length ? <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-5"><div className="flex items-start gap-3"><Scale className="mt-0.5 size-5 text-amber-700" /><div><p className="font-medium text-amber-950">{ledger.pending_events.length} transaction{ledger.pending_events.length === 1 ? " is" : "s are"} waiting for ledger posting</p><p className="mt-1 text-sm text-amber-800">Pending transactions are not included in the debit and credit totals below.</p><div className="mt-3 flex flex-wrap gap-2">{ledger.pending_events.map((event) => <Badge key={event.id} variant="outline">{event.transaction_date} · {event.event_type.replaceAll(".", " ")} · {event.status}</Badge>)}</div></div></div></CardContent></Card> : null}
    <div className="space-y-4"><div><h2 className="text-lg font-semibold">Posted journal entries</h2><p className="text-sm text-muted-foreground">Every entry below belongs to this loan application.</p></div>{!ledger.journals.length ? <div className="rounded-xl border border-dashed bg-background px-6 py-12 text-center text-sm text-muted-foreground">No journal has been posted for this loan yet.</div> : ledger.journals.map((journal) => <Card key={journal.id}><CardHeader className="gap-3 border-b sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="font-mono text-sm">{journal.journal_number}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{journal.transaction_date} · {(journal.event_type ?? "journal").replaceAll(".", " ")}</p><p className="mt-2 text-sm">{journal.narration}</p></div><div className="space-y-2 sm:text-right"><BalanceBadge balance={journal.totals} /><BalanceEquation balance={journal.totals} /></div></CardHeader><CardContent className="overflow-x-auto pt-4"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{journal.lines.map((line) => <TableRow key={line.id}><TableCell><span className="font-mono font-medium">{line.account_code}</span><span className="ml-2">{line.account_name}</span></TableCell><TableCell className="text-muted-foreground">{line.description ?? "—"}</TableCell><TableCell className="text-right tabular-nums">{Number(line.debit) ? money(line.debit) : "—"}</TableCell><TableCell className="text-right tabular-nums">{Number(line.credit) ? money(line.credit) : "—"}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>)}</div>
  </div>;
}

function BalanceBadge({ balance }: { balance: Balance }) {
  return balance.is_balanced ? <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="size-3" />Balanced</Badge> : <Badge variant="destructive" className="gap-1"><AlertCircle className="size-3" />Difference {money(balance.difference)}</Badge>;
}

function BalanceEquation({ balance, className = "" }: { balance: Balance; className?: string }) {
  return <p className={`text-sm font-semibold tabular-nums ${className}`}><span>Debit {money(balance.debits)}</span><span className={balance.is_balanced ? "mx-2 text-lg text-emerald-700" : "mx-2 text-lg text-destructive"}>{balance.is_balanced ? "=" : "≠"}</span><span>Credit {money(balance.credits)}</span></p>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="pt-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></CardContent></Card>;
}
