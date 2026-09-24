"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatApiResponseError } from "@/lib/falco-api";

type Account = { id: number; code: string; name: string; type: string; normal_balance: string; is_postable: boolean; is_active: boolean };
type MappingLine = { id: number; account_id: number; side: string; amount_source: string; multiplier: string; description?: string; account?: Account };
type Mapping = { id: number; event_type: string; channel?: string | null; product_id?: number | null; effective_from: string; effective_to?: string | null; status: string; lines: MappingLine[] };
type Policy = { id: number; policy_key: string; value: Record<string, unknown>; effective_from: string; effective_to?: string | null; status: string };
type Journal = { id: number; journal_number: string; transaction_date: string; event_type?: string; narration: string; source_module: string; lines_count?: number };
type Period = { id: number; period_year: number; period_month: number; status: string };
type Event = { id: number; event_type: string; aggregate_type: string; aggregate_id: string; transaction_date: string; status: string; attempts: number; last_error?: string };
type TrialRow = { account_code: string; account_name: string; account_type: string; debits: string; credits: string; debit_balance: string; credit_balance: string };
type Dashboard = { accounts: number; approved_mappings: number; draft_mappings: number; posted_journals: number; posting_enabled: boolean; outbox: Record<string, number>; trial_balance: { debits: string; credits: string }; recent_audit: { id: number; action: string; created_at: string }[] };
type Report = { rows?: TrialRow[]; totals?: Record<string, string>; groups?: Record<string, { accounts: { code: string; name: string; balance: string }[]; total: string }> };
type OpeningBatch = { id: number; batch_number: string; status: string; validation_summary: { debits: string; credits: string; difference: string; is_balanced: boolean; principal_ledger_total: string; principal_subledger_total: string; principal_reconciled: boolean; settlement_reconciled: boolean; is_ready_to_post: boolean } };

const api = "/api/general-ledger";
const today = new Date().toISOString().slice(0, 10);
const money = (value: string | number | undefined) => value === undefined ? "—" : new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
const statusVariant = (status: string) => status === "approved" || status === "posted" || status === "open" ? "default" : status === "failed" || status === "dead" ? "destructive" : "secondary";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${api}/${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(formatApiResponseError(json, "General Ledger request failed."));
  return json as T;
}

export function GeneralLedgerWorkspace() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [trial, setTrial] = useState<Report>({});
  const [balanceSheet, setBalanceSheet] = useState<Report>({});
  const [incomeStatement, setIncomeStatement] = useState<Report>({});
  const [openingBatch, setOpeningBatch] = useState<OpeningBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [d, a, m, policyData, j, p, e, tb, bs, is] = await Promise.all([
        requestJson<{ data: Dashboard }>("dashboard"), requestJson<{ data: Account[] }>("accounts"),
        requestJson<{ data: Mapping[] }>("mappings"), requestJson<{ data: Policy[] }>("policies"),
        requestJson<{ data: Journal[] }>("journals?per_page=100"),
        requestJson<{ data: Period[] }>("periods"), requestJson<{ data: Event[] }>("outbox?per_page=100"),
        requestJson<{ data: Report }>(`reports/trial-balance?as_of=${today}`), requestJson<{ data: Report }>(`reports/balance-sheet?as_of=${today}`),
        requestJson<{ data: Report }>(`reports/income-statement?as_of=${today}`),
      ]);
      setDashboard(d.data); setAccounts(a.data); setMappings(m.data); setPolicies(policyData.data); setJournals(j.data); setPeriods(p.data); setEvents(e.data);
      setTrial(tb.data); setBalanceSheet(bs.data); setIncomeStatement(is.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load the General Ledger."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: string, method: "POST" | "PATCH", body?: unknown) {
    setBusy(true); setError("");
    try { await requestJson(path, { method, body: body ? JSON.stringify(body) : undefined }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The action failed."); }
    finally { setBusy(false); }
  }

  async function previewOpeningBalance(body: unknown) {
    setBusy(true); setError("");
    try { const response = await requestJson<{ data: OpeningBatch }>("opening-balance-batches/preview", { method: "POST", body: JSON.stringify(body) }); setOpeningBatch(response.data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Opening-balance validation failed."); }
    finally { setBusy(false); }
  }

  const postable = useMemo(() => accounts.filter((account) => account.is_active && account.is_postable), [accounts]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/25">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
        <div className="flex items-center gap-3"><SidebarTrigger /><div><h1 className="text-base font-semibold">General Ledger</h1><p className="text-xs text-muted-foreground">Private production-shadow workspace · TZS</p></div></div>
        <div className="flex items-center gap-2"><Badge variant={dashboard?.posting_enabled ? "default" : "secondary"}>{dashboard?.posting_enabled ? "Shadow posting on" : "Posting disabled"}</Badge><Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" />Refresh</Button></div>
      </header>
      <main className="space-y-5 p-4 md:p-6">
        {error ? <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div> : null}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-auto max-w-full flex-wrap justify-start bg-background">
            {[["overview","Overview"],["accounts","Accounts"],["mappings","Mappings"],["policies","Policies"],["journals","Journals"],["opening","Opening balances"],["periods","Periods"],["reports","Reports"],["events","Event queue"]].map(([value,label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Chart of accounts" value={dashboard?.accounts} /><Metric label="Approved mappings" value={dashboard?.approved_mappings} /><Metric label="Posted journals" value={dashboard?.posted_journals} /><Metric label="Failed events" value={(dashboard?.outbox.failed ?? 0) + (dashboard?.outbox.dead ?? 0)} danger />
            </div>
            <Card><CardHeader><CardTitle className="text-sm">Ledger health</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm md:grid-cols-3"><Health label="Trial balance" ok={dashboard?.trial_balance.debits === dashboard?.trial_balance.credits} detail={`Dr ${money(dashboard?.trial_balance.debits)} · Cr ${money(dashboard?.trial_balance.credits)}`} /><Health label="Mapping approval" ok={(dashboard?.approved_mappings ?? 0) > 0} detail={`${dashboard?.draft_mappings ?? 0} draft rules remain`} /><Health label="Outbox" ok={((dashboard?.outbox.failed ?? 0) + (dashboard?.outbox.dead ?? 0)) === 0} detail={`${dashboard?.outbox.pending ?? 0} pending`} /></CardContent></Card>
            <DataCard title="Recent audit history" empty="No GL configuration or posting actions yet."><Table><TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{dashboard?.recent_audit.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.action.replaceAll("_", " ")}</TableCell><TableCell>{new Date(row.created_at).toLocaleString()}</TableCell></TableRow>)}</TableBody></Table></DataCard>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <AccountForm busy={busy} onSubmit={(body) => mutate("accounts", "POST", body)} />
            <DataCard title="Tanzania chart of accounts" empty="No accounts have been configured."><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Normal balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{accounts.map((a) => <TableRow key={a.id}><TableCell className="font-mono font-medium">{a.code}</TableCell><TableCell>{a.name}</TableCell><TableCell className="capitalize">{a.type}</TableCell><TableCell className="capitalize">{a.normal_balance}</TableCell><TableCell><Badge variant={a.is_active ? "outline" : "secondary"}>{a.is_active ? "Active" : "Placeholder"}</Badge></TableCell></TableRow>)}</TableBody></Table></DataCard>
          </TabsContent>

          <TabsContent value="mappings"><DataCard title="Event posting rules" empty="No mapping rules have been seeded."><Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Scope</TableHead><TableHead>Lines</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{mappings.map((m) => <TableRow key={m.id}><TableCell className="font-medium">{m.event_type}</TableCell><TableCell>{m.channel ?? (m.product_id ? `Product ${m.product_id}` : "Default")}</TableCell><TableCell>{m.lines.map((l) => `${l.side === "debit" ? "Dr" : "Cr"} ${l.account?.code ?? l.account_id} (${l.amount_source})`).join(" · ")}</TableCell><TableCell><Badge variant={statusVariant(m.status)}>{m.status}</Badge></TableCell><TableCell>{m.status === "draft" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void mutate(`mappings/${m.id}`, "PATCH", { ...m, status: "approved", lines: m.lines.map(({ account, id, ...line }) => line) })}>Approve</Button> : null}</TableCell></TableRow>)}</TableBody></Table></DataCard></TabsContent>

          <TabsContent value="policies"><DataCard title="Effective-dated accounting and statutory policies" empty="No policies have been seeded."><Table><TableHeader><TableRow><TableHead>Policy</TableHead><TableHead>Draft value</TableHead><TableHead>Effective</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{policies.map((policy) => <TableRow key={policy.id}><TableCell className="font-medium">{policy.policy_key}</TableCell><TableCell className="max-w-lg font-mono text-xs">{JSON.stringify(policy.value)}</TableCell><TableCell>{policy.effective_from}</TableCell><TableCell><Badge variant={statusVariant(policy.status)}>{policy.status}</Badge></TableCell><TableCell>{policy.status === "draft" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm("Confirm that a Tanzanian accountant has approved this exact policy value in writing.")) void mutate(`policies/${policy.id}`, "PATCH", { value: policy.value, effective_from: policy.effective_from, effective_to: policy.effective_to, status: "approved" }); }}>Approve signed policy</Button> : null}</TableCell></TableRow>)}</TableBody></Table></DataCard></TabsContent>

          <TabsContent value="journals" className="space-y-4">
            <JournalForm accounts={postable} busy={busy} title="Post manual journal" action="Post journal" onSubmit={(body) => mutate("journals", "POST", body)} />
            <DataCard title="Posted journals" empty="No journals have been posted."><Table><TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Narration</TableHead><TableHead /></TableRow></TableHeader><TableBody>{journals.map((j) => <TableRow key={j.id}><TableCell className="font-mono">{j.journal_number}</TableCell><TableCell>{j.transaction_date}</TableCell><TableCell>{j.event_type ?? j.source_module}</TableCell><TableCell>{j.narration}</TableCell><TableCell><Button size="sm" variant="ghost" onClick={() => { const reason = window.prompt("Mandatory reversal reason"); if (reason) void mutate(`journals/${j.id}/reverse`, "POST", { reason }); }}>Reverse</Button></TableCell></TableRow>)}</TableBody></Table></DataCard>
          </TabsContent>

          <TabsContent value="opening" className="space-y-4"><JournalForm accounts={postable} busy={busy} title="Opening-balance preview" action="Validate batch" opening onSubmit={previewOpeningBalance} />{openingBatch ? <Card><CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{openingBatch.batch_number}</p><p className="text-sm text-muted-foreground">Dr {money(openingBatch.validation_summary.debits)} · Cr {money(openingBatch.validation_summary.credits)} · Difference {money(openingBatch.validation_summary.difference)}</p><p className="mt-1 text-xs text-muted-foreground">Principal GL {money(openingBatch.validation_summary.principal_ledger_total)} / loan subledger {money(openingBatch.validation_summary.principal_subledger_total)} · Settlement {openingBatch.validation_summary.settlement_reconciled ? "reconciled" : "needs statements"}</p></div><div className="flex items-center gap-2"><Badge variant={openingBatch.validation_summary.is_ready_to_post ? "default" : "destructive"}>{openingBatch.validation_summary.is_ready_to_post ? "Ready to post" : "Reconciliation required"}</Badge><Button disabled={busy || !openingBatch.validation_summary.is_ready_to_post || openingBatch.status === "posted"} onClick={() => void mutate(`opening-balance-batches/${openingBatch.id}/post`, "POST")}>Post approved batch</Button></div></CardContent></Card> : null}</TabsContent>

          <TabsContent value="periods"><DataCard title="Accounting periods" empty="No periods exist."><Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{periods.map((p) => <TableRow key={p.id}><TableCell>{new Date(p.period_year, p.period_month - 1).toLocaleString("en", { month: "long", year: "numeric" })}</TableCell><TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell><TableCell><Button size="sm" variant="outline" onClick={() => { const reason = window.prompt(`Reason to ${p.status === "open" ? "close" : "reopen"} this period`); if (reason) void mutate(`periods/${p.id}`, "PATCH", { status: p.status === "open" ? "closed" : "open", reason }); }}>{p.status === "open" ? "Close" : "Reopen"}</Button></TableCell></TableRow>)}</TableBody></Table></DataCard></TabsContent>

          <TabsContent value="reports" className="space-y-4"><ReportCard title="Trial Balance" report={trial} exportPath={`reports/trial-balance?as_of=${today}&format=csv`} /><StatementCard title="Balance Sheet" report={balanceSheet} exportPath={`reports/balance-sheet?as_of=${today}&format=csv`} /><StatementCard title="Income Statement" report={incomeStatement} exportPath={`reports/income-statement?as_of=${today}&format=csv`} /></TabsContent>

          <TabsContent value="events"><DataCard title="Failed-event queue and processing history" empty="No ledger events have been recorded."><Table><TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead /></TableRow></TableHeader><TableBody>{events.map((e) => <TableRow key={e.id}><TableCell><div className="font-medium">{e.event_type}</div>{e.last_error ? <div className="max-w-md truncate text-xs text-destructive">{e.last_error}</div> : null}</TableCell><TableCell>{e.aggregate_type} #{e.aggregate_id}</TableCell><TableCell>{e.transaction_date}</TableCell><TableCell><Badge variant={statusVariant(e.status)}>{e.status}</Badge></TableCell><TableCell>{e.attempts}</TableCell><TableCell>{["failed","dead"].includes(e.status) ? <Button size="sm" variant="outline" onClick={() => void mutate(`outbox/${e.id}/retry`, "POST")}>Retry</Button> : null}</TableCell></TableRow>)}</TableBody></Table></DataCard></TabsContent>
        </Tabs>
        {loading ? <p className="text-center text-sm text-muted-foreground">Loading ledger data…</p> : null}
      </main>
    </div>
  );
}

function Metric({ label, value, danger = false }: { label: string; value?: number; danger?: boolean }) { return <Card><CardContent className="pt-5"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={danger && value ? "mt-2 text-2xl font-semibold text-destructive" : "mt-2 text-2xl font-semibold"}>{value ?? "—"}</p></CardContent></Card>; }
function Health({ label, ok, detail }: { label: string; ok: boolean; detail: string }) { return <div className="flex gap-3">{ok ? <CheckCircle2 className="size-5 text-emerald-600" /> : <AlertCircle className="size-5 text-amber-600" />}<div><p className="font-medium">{label}</p><p className="text-muted-foreground">{detail}</p></div></div>; }
function DataCard({ title, children }: { title: string; empty: string; children: ReactNode }) { return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="overflow-x-auto">{children}</CardContent></Card>; }

function AccountForm({ busy, onSubmit }: { busy: boolean; onSubmit: (body: unknown) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit({ code: f.get("code"), name: f.get("name"), type: f.get("type"), normal_balance: f.get("normal_balance"), is_postable: true, is_active: true, effective_from: today }); e.currentTarget.reset(); }
  return <Card><CardHeader><CardTitle className="text-sm">Add account</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-3 md:grid-cols-5"><Input name="code" placeholder="Code" required /><Input name="name" placeholder="Account name" required /><Select name="type" defaultValue="asset"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["asset","liability","equity","income","expense"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select><Select name="normal_balance" defaultValue="debit"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="debit">Debit</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent></Select><Button disabled={busy}>Add account</Button></form></CardContent></Card>;
}

function JournalForm({ accounts, busy, title, action, opening = false, onSubmit }: { accounts: Account[]; busy: boolean; title: string; action: string; opening?: boolean; onSubmit: (body: unknown) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const amount = Number(f.get("amount")); const debitAccount = Number(f.get("debit_account")); const creditAccount = Number(f.get("credit_account")); const lines = [{ account_id: debitAccount, debit: amount, credit: 0 }, { account_id: creditAccount, debit: 0, credit: amount }]; const settlement_balances = [[debitAccount, f.get("debit_statement_balance")], [creditAccount, f.get("credit_statement_balance")]].filter(([, value]) => value !== null && value !== "").map(([account_id, statement_balance]) => ({ account_id, statement_balance: Number(statement_balance) })); onSubmit(opening ? { cutover_date: f.get("date"), lines, settlement_balances } : { transaction_date: f.get("date"), narration: f.get("narration"), lines }); }
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><div><Label>Date</Label><Input name="date" type="date" defaultValue={today} required /></div>{!opening ? <div><Label>Narration</Label><Input name="narration" placeholder="Business reason" required /></div> : null}<div><Label>Debit account</Label><AccountSelect name="debit_account" accounts={accounts} />{opening ? <Input className="mt-2" name="debit_statement_balance" type="number" step="0.01" placeholder="Statement balance, if cash/bank" /> : null}</div><div><Label>Credit account</Label><AccountSelect name="credit_account" accounts={accounts} />{opening ? <Input className="mt-2" name="credit_statement_balance" type="number" step="0.01" placeholder="Statement balance, if cash/bank" /> : null}</div><div><Label>Amount (TZS)</Label><Input name="amount" type="number" min="0.01" step="0.01" required /></div><div className="flex items-end"><Button className="w-full" disabled={busy}>{action}</Button></div></form>{opening ? <p className="mt-3 text-xs text-muted-foreground">Posting unlocks only after the batch balances, principal matches Falco's active-loan subledger, and every included cash/bank/mobile-money account matches its supplied statement balance.</p> : null}</CardContent></Card>;
}
function AccountSelect({ name, accounts }: { name: string; accounts: Account[] }) { return <Select name={name} required><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select>; }
function ReportCard({ title, report, exportPath }: { title: string; report: Report; exportPath: string }) { return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">{title}</CardTitle><Button size="sm" variant="outline" asChild><a href={`${api}/${exportPath}`}><Download className="size-4" />CSV</a></Button></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debits</TableHead><TableHead className="text-right">Credits</TableHead><TableHead className="text-right">Debit balance</TableHead><TableHead className="text-right">Credit balance</TableHead></TableRow></TableHeader><TableBody>{report.rows?.map((r) => <TableRow key={r.account_code}><TableCell>{r.account_code} · {r.account_name}</TableCell><TableCell className="text-right tabular-nums">{money(r.debits)}</TableCell><TableCell className="text-right tabular-nums">{money(r.credits)}</TableCell><TableCell className="text-right tabular-nums">{money(r.debit_balance)}</TableCell><TableCell className="text-right tabular-nums">{money(r.credit_balance)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>; }
function StatementCard({ title, report, exportPath }: { title: string; report: Report; exportPath: string }) { return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-sm">{title}</CardTitle><Button size="sm" variant="outline" asChild><a href={`${api}/${exportPath}`}><Download className="size-4" />CSV</a></Button></CardHeader><CardContent className="space-y-4">{Object.entries(report.groups ?? {}).map(([type, group]) => <section key={type}><h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{type}</h3>{group.accounts.map((a) => <div key={a.code} className="flex justify-between border-b py-2 text-sm"><span>{a.code} · {a.name}</span><span className="tabular-nums">{money(a.balance)}</span></div>)}<div className="flex justify-between pt-2 text-sm font-semibold"><span>Total {type}</span><span>{money(group.total)}</span></div></section>)}{!Object.keys(report.groups ?? {}).length ? <p className="py-6 text-center text-sm text-muted-foreground">Waiting for posted data.</p> : null}</CardContent></Card>; }
