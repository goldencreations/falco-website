"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileText,
  Landmark,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatApiResponseError } from "@/lib/falco-api";
import { hasPostingAccounts, isAwaitingAccountingSetup } from "@/lib/general-ledger-draft-state";

type RegisterKind = "rules" | "expenses" | "assets" | "liabilities";
type Row = Record<string, unknown>;
type PageMeta = { current_page: number; last_page: number; per_page: number; total: number; from?: number | null; to?: number | null };
type Preview = { preview_token?: string; entry?: Row; lines?: Row[]; totals?: Row; [key: string]: unknown };
type EntryOptions = { rules: Row[]; accounts: Row[] };
type FieldOption = { value: string; label: string };
type Field = { name: string; label: string; type?: "text" | "number" | "date" | "textarea" | "select"; required?: boolean; placeholder?: string; options?: FieldOption[]; defaultValue?: string; accounting?: boolean; inputMode?: "numeric"; pattern?: string };

const PAGE_SIZE = 15;
const API = "/api/general-ledger";
const RULE_ACCOUNTING_FIELDS_ENABLED = false;
const numberFormatter = new Intl.NumberFormat("en-TZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const registerConfiguration: Record<RegisterKind, {
  title: string;
  description: string;
  singular: string;
  icon: typeof FileText;
  fields: Field[];
}> = {
  rules: {
    title: "Rules",
    description: "Save reusable codes for expenses, assets, and liabilities so the same description does not need to be entered repeatedly.",
    singular: "rule",
    icon: Landmark,
    fields: [
      { name: "code", label: "Rule code", required: true, placeholder: "1000", inputMode: "numeric", pattern: "[0-9]*" },
      { name: "name", label: "Rule name", required: true, placeholder: "Buying office chairs" },
      { name: "category", label: "Group", type: "select", required: true, defaultValue: "expense", options: [{ value: "expense", label: "Expenses" }, { value: "asset", label: "Assets" }, { value: "liability", label: "Liabilities" }] },
      { name: "description", label: "Description", type: "textarea", placeholder: "When this rule should be used" },
      { name: "recognition_account_id", label: "What is being recorded", required: true, placeholder: "Choose the expense, asset, or liability account", accounting: true },
      { name: "settlement_account_id", label: "Cash/bank or other side of the entry", placeholder: "Cash, bank, mobile money, asset, or expense counterpart", accounting: true },
      { name: "payable_account_id", label: "Where unpaid amounts are kept", placeholder: "Accounts payable", accounting: true },
      { name: "grant_counterpart_account_id", label: "Approved grant source", placeholder: "Grant or donation counterpart", accounting: true },
    ],
  },
  expenses: {
    title: "Expense register",
    description: "Draft expense transactions here. Posting is prepared separately and never creates a cashbook entry.",
    singular: "expense",
    icon: CircleDollarSign,
    fields: [
      { name: "rule_id", label: "Posting rule ID", required: true, placeholder: "Search Rules by code, then enter its ID" },
      { name: "transaction_date", label: "Expense date", type: "date", required: true },
      { name: "branch_id", label: "Branch (optional)", placeholder: "Branch ID" },
      { name: "amount", label: "Amount (TZS)", type: "number", required: true, placeholder: "0.00" },
      { name: "payee", label: "Payee", required: true, placeholder: "Supplier or person paid" },
      { name: "reference", label: "Reference", placeholder: "Invoice, receipt, or voucher" },
      { name: "notes", label: "Notes", type: "textarea", placeholder: "Optional supporting notes" },
      { name: "settlement_status", label: "Settlement", type: "select", required: true, defaultValue: "paid", options: [{ value: "paid", label: "Paid now" }, { value: "unpaid", label: "Unpaid / payable" }] },
      { name: "settlement_source", label: "Settlement source", type: "select", defaultValue: "cash", options: [{ value: "cash", label: "Cash" }, { value: "bank", label: "Bank" }, { value: "mobile_money", label: "Mobile money" }] },
      { name: "creditor", label: "Creditor", placeholder: "Required when unpaid" },
      { name: "due_date", label: "Due date", type: "date" },
    ],
  },
  assets: {
    title: "Asset register",
    description: "Record current and fixed assets with their acquisition evidence, valuation, and the resulting journal posting.",
    singular: "asset",
    icon: Package,
    fields: [
      { name: "rule_id", label: "Posting rule ID", required: true, placeholder: "Search Rules by code, then enter its ID" },
      { name: "name", label: "Asset name", required: true, placeholder: "e.g. Dell Latitude laptop" },
      { name: "asset_type", label: "Asset type", type: "select", required: true, defaultValue: "fixed", options: [{ value: "fixed", label: "Fixed asset" }, { value: "current", label: "Current asset" }] },
      { name: "acquisition_type", label: "Received as", type: "select", required: true, defaultValue: "bought", options: [{ value: "bought", label: "Bought" }, { value: "granted", label: "Granted / donated" }] },
      { name: "acquisition_date", label: "Date received", type: "date", required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true, defaultValue: "1" },
      { name: "value", label: "Value (TZS)", type: "number", required: true, placeholder: "0.00" },
      { name: "supplier", label: "Supplier", placeholder: "For bought assets" },
      { name: "donor", label: "Donor", placeholder: "For granted assets" },
      { name: "location", label: "Location", required: true, placeholder: "Branch, room, or custody" },
      { name: "reference", label: "Reference", placeholder: "Invoice, grant letter, or tag" },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "settlement_status", label: "Purchase settlement", type: "select", defaultValue: "paid", options: [{ value: "paid", label: "Bought and paid" }, { value: "unpaid", label: "Bought unpaid" }, { value: "grant_valuation", label: "Grant valuation" }] },
    ],
  },
  liabilities: {
    title: "Liability register",
    description: "Track borrowed and manual obligations, linked payables, repayments, reversals, and their journals.",
    singular: "liability",
    icon: CircleDollarSign,
    fields: [
      { name: "rule_id", label: "Posting rule ID", required: true, placeholder: "Search Rules by code, then enter its ID" },
      { name: "name", label: "Liability name", required: true, placeholder: "e.g. Supplier payable" },
      { name: "liability_type", label: "Liability type", type: "select", required: true, defaultValue: "payable", options: [{ value: "borrowed", label: "Borrowed funds" }, { value: "payable", label: "Manual or linked payable" }] },
      { name: "incurred_date", label: "Incurred date", type: "date", required: true },
      { name: "amount", label: "Amount (TZS)", type: "number", required: true, placeholder: "0.00" },
      { name: "creditor", label: "Creditor / lender", required: true, placeholder: "Name of creditor" },
      { name: "due_date", label: "Due date", type: "date" },
      { name: "reference", label: "Reference", placeholder: "Contract, invoice, or agreement" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
};

function value(row: Row, ...keys: string[]): string {
  for (const key of keys) {
    const candidate = row[key];
    if (candidate !== null && candidate !== undefined && candidate !== "") return String(candidate);
  }
  return "—";
}

function metadataValue(row: Row, key: string): string {
  const metadata = row.metadata;
  if (metadata && typeof metadata === "object" && key in metadata) {
    const candidate = (metadata as Row)[key];
    if (candidate !== null && candidate !== undefined && candidate !== "") return String(candidate);
  }
  return "—";
}

function money(raw: unknown): string {
  const amount = Number(raw ?? 0);
  return `TZS ${numberFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
}

function resourceId(row: Row): string {
  return value(row, "id", "uuid", "code");
}

function dateDefault(): string {
  return new Date().toISOString().slice(0, 10);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    cache: "no-store",
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(formatApiResponseError(json, "General Ledger request failed."));
  return json as T;
}

function newForm(kind: RegisterKind): Record<string, string> {
  return Object.fromEntries(registerConfiguration[kind].fields.map((field) => [field.name, field.defaultValue ?? (field.type === "date" ? dateDefault() : "")]));
}

function rulePayload(form: Record<string, string>): Record<string, string> {
  if (RULE_ACCOUNTING_FIELDS_ENABLED) return form;

  return {
    code: form.code,
    name: form.name,
    category: form.category,
    description: form.description,
  };
}

/** Maps the guided business form to the stable General Ledger draft contract. */
function entryPayload(kind: Exclude<RegisterKind, "rules">, form: Record<string, string>): Record<string, unknown> {
  const isAsset = kind === "assets";
  const isLiability = kind === "liabilities";
  const isExpense = kind === "expenses";
  const paid = form.settlement_status === "paid";
  const acquisitionMethod = form.acquisition_type;

  return {
    rule_id: Number(form.rule_id),
    transaction_date: form.transaction_date || form.acquisition_date || form.incurred_date,
    due_date: form.due_date || null,
    party_name: isExpense ? (form.settlement_status === "unpaid" ? form.creditor || form.payee : form.payee) : isAsset ? (acquisitionMethod === "granted" ? form.donor : form.supplier) : form.creditor,
    reference: form.reference || null,
    description: form.notes || form.name || (isExpense ? `Expense to ${form.payee}` : "General Ledger business entry"),
    amount: form.amount || form.value,
    payment_status: isAsset && acquisitionMethod === "granted" ? "paid" : paid ? "paid" : "unpaid",
    asset_class: isAsset ? form.asset_type : null,
    acquisition_method: isAsset ? acquisitionMethod : null,
    liability_kind: isLiability ? form.liability_type : null,
    branch_id: form.branch_id || null,
    metadata: {
      ...(isExpense ? { settlement_source: form.settlement_source || null, creditor: form.creditor || null } : {}),
      ...(isAsset ? { name: form.name, quantity: Number(form.quantity || 1), location: form.location, grant_valuation: form.settlement_status === "grant_valuation" } : {}),
      ...(isLiability ? { name: form.name } : {}),
    },
  };
}

function normalizedPage(payload: { data?: unknown; meta?: unknown }): { rows: Row[]; meta: PageMeta | null } {
  const rows = Array.isArray(payload.data) ? payload.data as Row[] : [];
  const rawMeta = payload.meta as Partial<PageMeta> | undefined;
  return { rows, meta: rawMeta?.current_page ? { current_page: Number(rawMeta.current_page), last_page: Number(rawMeta.last_page ?? 1), per_page: Number(rawMeta.per_page ?? PAGE_SIZE), total: Number(rawMeta.total ?? rows.length), from: rawMeta.from, to: rawMeta.to } : null };
}

export function GeneralLedgerRegister({ kind }: { kind: RegisterKind }) {
  const config = registerConfiguration[kind];
  const Icon = config.icon;
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => newForm(kind));
  const [saving, setSaving] = useState(false);
  const [accountingOpen, setAccountingOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewPostPath, setPreviewPostPath] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Row | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentsFor, setPaymentsFor] = useState<Row | null>(null);
  const [payments, setPayments] = useState<Row[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [reversing, setReversing] = useState<Row | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalPath, setReversalPath] = useState<string | null>(null);
  const [entryOptions, setEntryOptions] = useState<EntryOptions>({ rules: [], accounts: [] });

  const load = useCallback(async (nextPage = page, nextSearch = activeSearch) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(nextPage), per_page: String(PAGE_SIZE) });
      if (nextSearch) query.set("search", nextSearch);
      const response = await apiRequest<{ data?: unknown; meta?: unknown }>(`${kind}?${query.toString()}`);
      const parsed = normalizedPage(response);
      setRows(parsed.rows);
      setMeta(parsed.meta);
      setPage(nextPage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [activeSearch, config.title, kind, page]);

  useEffect(() => { void load(1, ""); }, [kind]); // Load fresh whenever the register route changes.

  useEffect(() => {
    void apiRequest<{ data: EntryOptions }>("entry-options")
      .then((response) => setEntryOptions(response.data))
      .catch(() => undefined);
  }, []);

  const heading = useMemo(() => `${config.title}${meta ? ` (${meta.total})` : ""}`, [config.title, meta]);

  function openCreate(): void {
    setEditing(null);
    setForm(newForm(kind));
    setAccountingOpen(false);
    setFormOpen(true);
  }

  function openEdit(row: Row): void {
    const aliases: Record<string, string> = {
      payee: "party_name", notes: "description", settlement_status: "payment_status",
      asset_type: "asset_class", acquisition_type: "acquisition_method", acquisition_date: "transaction_date",
      value: "amount", liability_type: "liability_kind", incurred_date: "transaction_date", creditor: "party_name",
    };
    const metadataFields = new Set(["name", "quantity", "location"]);
    const fields = Object.fromEntries(config.fields.map((field) => {
      let current = metadataFields.has(field.name) && kind !== "rules" ? metadataValue(row, field.name) : value(row, aliases[field.name] ?? field.name);
      if (field.name === "supplier" && value(row, "acquisition_method") === "bought") current = value(row, "party_name");
      if (field.name === "donor" && value(row, "acquisition_method") === "granted") current = value(row, "party_name");
      return [field.name, current === "—" ? "" : current];
    }));
    setEditing(row);
    setForm(fields);
    setAccountingOpen(RULE_ACCOUNTING_FIELDS_ENABLED && kind === "rules");
    setFormOpen(true);
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const term = search.trim();
    setActiveSearch(term);
    await load(1, term);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const missing = config.fields.filter((field) => field.required && (!field.accounting || (RULE_ACCOUNTING_FIELDS_ENABLED && accountingOpen)) && !form[field.name]?.trim());
    if (missing.length) {
      setError(`${missing.map((field) => field.label).join(", ")} ${missing.length === 1 ? "is" : "are"} required.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (kind === "rules") {
        await apiRequest(`${kind}${editing ? `/${resourceId(editing)}` : ""}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(rulePayload(form)) });
        toast.success(`Rule ${editing ? "updated" : "created"}.`);
        setFormOpen(false);
        await load(editing ? page : 1, activeSearch);
      } else {
        const draft = await apiRequest<{ data: Row }>(`${kind}${editing ? `/${resourceId(editing)}` : ""}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(entryPayload(kind, form)) });
        const entry = draft.data;
        if (!hasPostingAccounts(entry)) {
          toast.success("Draft saved. Accounting setup is still pending.");
          setFormOpen(false);
          await load(editing ? page : 1, activeSearch);
          return;
        }
        const response = await apiRequest<{ data: Preview }>(`${kind}/${resourceId(entry)}/preview`, { method: "POST" });
        setPreview({ ...response.data, entry });
        setPreviewPostPath(`${kind}/${resourceId(entry)}/post`);
        setPreviewOpen(true);
        setFormOpen(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to save this ${config.singular}.`);
    } finally {
      setSaving(false);
    }
  }

  async function archiveRule(row: Row): Promise<void> {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`rules/${resourceId(row)}/archive`, { method: "POST" });
      toast.success("Rule archived.");
      await load(page, activeSearch);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to archive this rule.");
    } finally {
      setSaving(false);
    }
  }

  async function previewPayment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!paymentFor || !paymentAmount || Number(paymentAmount) <= 0 || !paymentAccountId) {
      setError("Enter a payment amount and settlement account.");
      return;
    }
    setSaving(true);
    try {
      const liabilityId = resourceId(paymentFor);
      const payment = await apiRequest<{ data: Row }>(`liabilities/${liabilityId}/payments`, { method: "POST", body: JSON.stringify({ payment_date: dateDefault(), amount: paymentAmount, settlement_account_id: Number(paymentAccountId), reference: paymentReference || null, description: paymentDescription || null }) });
      const response = await apiRequest<{ data: Preview }>(`liabilities/${liabilityId}/payments/${resourceId(payment.data)}/preview`, { method: "POST" });
      setPreview({ ...response.data, entry: payment.data });
      setPreviewPostPath(`liabilities/${liabilityId}/payments/${resourceId(payment.data)}/post`);
      setPaymentFor(null);
      setPreviewOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to prepare this payment.");
    } finally {
      setSaving(false);
    }
  }

  async function openPaymentHistory(liability: Row): Promise<void> {
    setPaymentsFor(liability);
    setPayments([]);
    setPaymentsLoading(true);
    try {
      const response = await apiRequest<{ data?: unknown }>(`liabilities/${resourceId(liability)}/payments?per_page=${PAGE_SIZE}`);
      setPayments(Array.isArray(response.data) ? response.data as Row[] : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load liability payments.");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function postPreview(): Promise<void> {
    if (!preview) return;
    setPosting(true);
    setError("");
    try {
      await apiRequest(previewPostPath ?? `${kind}/${resourceId(preview.entry ?? {})}/post`, { method: "POST", body: JSON.stringify({ preview_token: preview.preview_token }) });
      toast.success(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} posted to the General Ledger.`);
      setPreviewOpen(false);
      setPreview(null);
      setPreviewPostPath(null);
      await load(1, activeSearch);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Posting could not be completed. The draft has not been changed.");
    } finally {
      setPosting(false);
    }
  }

  async function reverse(): Promise<void> {
    if (!reversing || reversalReason.trim().length < 5) {
      setError("Provide a reversal reason of at least five characters.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(reversalPath ?? `${kind}/${resourceId(reversing)}/reverse`, { method: "POST", body: JSON.stringify({ reason: reversalReason.trim() }) });
      toast.success("Reversal posted.");
      setReversing(null);
      setReversalReason("");
      setReversalPath(null);
      await load(page, activeSearch);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This entry could not be reversed.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/25">
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3"><SidebarTrigger /><div className="min-w-0"><h1 className="flex items-center gap-2 truncate text-base font-semibold"><Icon className="size-4" />{config.title}</h1><p className="truncate text-xs text-muted-foreground">Private General Ledger workspace</p></div></div>
      <Button size="sm" onClick={openCreate}><Plus className="size-4" />Add {config.singular}</Button>
    </header>
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <Card><CardHeader className="gap-2 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle className="text-lg">{heading}</CardTitle><CardDescription className="mt-1 max-w-3xl">{config.description}</CardDescription></div><Badge variant="outline" className="w-fit">{kind === "rules" ? "Reusable reference codes" : "Draft → preview → post"}</Badge></CardHeader><CardContent>
        <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={kind === "rules" ? "Search by rule code or name" : "Search by reference, name, creditor, or code"} className="pl-9" /></div><Button variant="outline" type="submit" disabled={loading}><Search className="size-4" />Search</Button><Button variant="ghost" type="button" disabled={loading} onClick={() => void load(page, activeSearch)}><RefreshCcw className="size-4" />Refresh</Button></form>
      </CardContent></Card>
      {error ? <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div className="flex-1">{error}</div><Button variant="ghost" size="sm" onClick={() => void load(page, activeSearch)}>Retry</Button></div> : null}
      {kind === "rules" ? <RulesList rows={rows} loading={loading} onEdit={openEdit} onArchive={archiveRule} /> : <RegisterTable kind={kind} rows={rows} loading={loading} onEdit={openEdit} onPay={(row) => { setPaymentFor(row); setPaymentAmount(""); setPaymentAccountId(""); setPaymentReference(""); setPaymentDescription(""); }} onPayments={(row) => void openPaymentHistory(row)} onReverse={(row) => { setReversing(row); setReversalReason(""); setReversalPath(`${kind}/${resourceId(row)}/reverse`); }} />}
      <Pagination meta={meta} loading={loading} onPage={(next) => void load(next, activeSearch)} />
    </main>
    <EntryForm open={formOpen} kind={kind} form={form} editing={editing} entryOptions={entryOptions} accountingOpen={accountingOpen} saving={saving} onAccountingOpen={setAccountingOpen} onOpenChange={setFormOpen} onChange={(name, nextValue) => setForm((current) => ({ ...current, [name]: nextValue }))} onSubmit={submitForm} />
    <PreviewDialog open={previewOpen} preview={preview} posting={posting} title={`Review ${config.singular} posting`} onOpenChange={setPreviewOpen} onPost={() => void postPreview()} />
    <Dialog open={Boolean(paymentFor)} onOpenChange={(open) => !open && setPaymentFor(null)}><DialogContent><form onSubmit={previewPayment}><DialogHeader><DialogTitle>Record liability payment</DialogTitle><DialogDescription>Create a partial or full payment draft. A balanced journal preview is required before posting.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div><Label htmlFor="liability-payment">Payment amount (TZS)</Label><Input id="liability-payment" className="mt-2" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></div><div><Label htmlFor="liability-payment-account">Settlement account</Label><Select value={paymentAccountId} onValueChange={setPaymentAccountId}><SelectTrigger id="liability-payment-account" className="mt-2"><SelectValue placeholder="Select cash, bank, or mobile-money account" /></SelectTrigger><SelectContent>{entryOptions.accounts.map((account) => <SelectItem key={resourceId(account)} value={resourceId(account)}>{value(account, "code")} — {value(account, "name")}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="liability-payment-reference">Reference</Label><Input id="liability-payment-reference" className="mt-2" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} /></div><div><Label htmlFor="liability-payment-notes">Notes</Label><Textarea id="liability-payment-notes" className="mt-2" value={paymentDescription} onChange={(event) => setPaymentDescription(event.target.value)} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setPaymentFor(null)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? <Loader2 className="size-4 animate-spin" /> : null}Create & preview payment</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(paymentsFor)} onOpenChange={(open) => !open && setPaymentsFor(null)}><DialogContent className="sm:max-w-3xl"><DialogHeader><DialogTitle>Liability payments</DialogTitle><DialogDescription>Each payment is independently drafted, previewed, posted, and reversible.</DialogDescription></DialogHeader><div className="max-h-[50vh] overflow-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{paymentsLoading ? <TableRow><TableCell colSpan={5} className="py-8 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : payments.length ? payments.map((payment) => <TableRow key={resourceId(payment)}><TableCell>{value(payment, "payment_date")}</TableCell><TableCell>{value(payment, "reference")}</TableCell><TableCell className="text-right tabular-nums">{money(payment.amount)}</TableCell><TableCell><StatusBadge row={payment} /></TableCell><TableCell className="text-right">{["posted", "paid"].includes(value(payment, "status").toLowerCase()) && paymentsFor ? <Button size="sm" variant="ghost" onClick={() => { setReversing(payment); setReversalReason(""); setReversalPath(`liabilities/${resourceId(paymentsFor)}/payments/${resourceId(payment)}/reverse`); }}>Reverse</Button> : null}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No payments have been recorded.</TableCell></TableRow>}</TableBody></Table></div></DialogContent></Dialog>
    <Dialog open={Boolean(reversing)} onOpenChange={(open) => !open && setReversing(null)}><DialogContent><form onSubmit={(event) => { event.preventDefault(); void reverse(); }}><DialogHeader><DialogTitle>Reverse posted entry</DialogTitle><DialogDescription>Reversals preserve the original journal and create an equal-and-opposite entry. They cannot be undone.</DialogDescription></DialogHeader><div className="py-4"><Label htmlFor="reversal-reason">Reason</Label><Textarea id="reversal-reason" className="mt-2" value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="Why should this transaction be reversed?" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setReversing(null)}>Cancel</Button><Button type="submit" variant="destructive" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Confirm reversal</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function EntryForm({ open, kind, form, editing, entryOptions, accountingOpen, saving, onAccountingOpen, onOpenChange, onChange, onSubmit }: { open: boolean; kind: RegisterKind; form: Record<string, string>; editing: Row | null; entryOptions: EntryOptions; accountingOpen: boolean; saving: boolean; onAccountingOpen: (open: boolean) => void; onOpenChange: (open: boolean) => void; onChange: (name: string, value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }) {
  const config = registerConfiguration[kind];
  const visibleFields = config.fields.filter((field) => !field.accounting || (RULE_ACCOUNTING_FIELDS_ENABLED && accountingOpen));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><form onSubmit={(event) => void onSubmit(event)}><DialogHeader><DialogTitle>{editing ? `Edit ${config.singular}` : `Add ${config.singular}`}</DialogTitle><DialogDescription>{kind === "rules" ? "Create a reusable rule with a numeric code, clear name, group, and description." : "Save no transaction directly from this form: the next step is a server-generated, balanced posting preview."}</DialogDescription></DialogHeader><div className="grid gap-4 py-5 sm:grid-cols-2">
    {visibleFields.map((field) => <FormField key={field.name} field={resolvedField(field, kind, entryOptions)} value={form[field.name] ?? ""} onChange={(next) => onChange(field.name, next)} />)}
  </div>{kind === "rules" && RULE_ACCOUNTING_FIELDS_ENABLED ? <button className="mb-4 flex items-center gap-2 text-sm font-medium text-primary" type="button" onClick={() => onAccountingOpen(!accountingOpen)}>{accountingOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}{accountingOpen ? "Hide accounting details" : "Expand accounting details"}</button> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? <Loader2 className="size-4 animate-spin" /> : null}{kind === "rules" ? "Save rule" : "Prepare posting preview"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function resolvedField(field: Field, kind: RegisterKind, entryOptions: EntryOptions): Field {
  if (field.name === "rule_id") {
    const category = kind === "expenses" ? "expense" : kind === "assets" ? "asset" : "liability";
    return { ...field, type: "select", options: entryOptions.rules.filter((rule) => value(rule, "category") === category).map((rule) => ({ value: resourceId(rule), label: `${value(rule, "code")} — ${value(rule, "name")}` })) };
  }

  if (field.name.endsWith("account_id")) {
    return { ...field, type: "select", options: entryOptions.accounts.map((account) => ({ value: resourceId(account), label: `${value(account, "code")} — ${value(account, "name")}` })) };
  }

  return field;
}

function FormField({ field, value: currentValue, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
  const id = `gl-${field.name}`;
  const classes = field.type === "textarea" ? "sm:col-span-2" : "";
  return <div className={classes}><Label htmlFor={id}>{field.label}{field.required ? <span className="text-destructive"> *</span> : null}</Label>{field.type === "select" ? <Select value={currentValue} onValueChange={onChange}><SelectTrigger id={id} className="mt-2"><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger><SelectContent>{field.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : field.type === "textarea" ? <Textarea id={id} className="mt-2" value={currentValue} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} /> : <Input id={id} className="mt-2" type={field.type ?? "text"} inputMode={field.inputMode} pattern={field.pattern} min={field.type === "number" ? "0" : undefined} step={field.type === "number" ? "0.01" : undefined} value={currentValue} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />}</div>;
}

function RulesList({ rows, loading, onEdit, onArchive }: { rows: Row[]; loading: boolean; onEdit: (row: Row) => void; onArchive: (row: Row) => Promise<void> }) {
  const groups = ["expense", "asset", "liability"] as const;
  if (loading) return <LoadingState />;
  if (!rows.length) return <EmptyState title="No rules found" text="Create your first reusable rule for an expense, asset, or liability." />;
  return <div className="space-y-4">{groups.map((group) => {
    const groupRows = rows.filter((row) => value(row, "group", "rule_group", "category").toLowerCase() === group);
    if (!groupRows.length) return null;
    return <Card key={group}><CardHeader className="pb-3"><CardTitle className="text-base">{group === "expense" ? "Expenses" : group === "asset" ? "Assets" : "Liabilities"}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Rule name</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{groupRows.map((row) => <TableRow key={resourceId(row)}><TableCell className="font-mono font-medium">{value(row, "code", "rule_code")}</TableCell><TableCell className="font-medium">{value(row, "name")}</TableCell><TableCell className="max-w-md text-sm text-muted-foreground">{value(row, "description")}</TableCell><TableCell><Badge variant={row.is_active ? "default" : "secondary"}>{row.is_active ? "Active" : "Archived"}</Badge></TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => onEdit(row)}><Pencil className="size-4" />Edit</Button><Button size="sm" variant="ghost" disabled={!row.is_active} onClick={() => void onArchive(row)}><Archive className="size-4" />Archive</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>;
  })}</div>;
}

function RegisterTable({ kind, rows, loading, onEdit, onPay, onPayments, onReverse }: { kind: Exclude<RegisterKind, "rules">; rows: Row[]; loading: boolean; onEdit: (row: Row) => void; onPay: (row: Row) => void; onPayments: (row: Row) => void; onReverse: (row: Row) => void }) {
  if (loading) return <LoadingState />;
  if (!rows.length) return <EmptyState title={`No ${registerConfiguration[kind].title.toLowerCase()} found`} text="Use Add to prepare a new draft." />;
  return <Card><CardContent className="overflow-x-auto pt-5"><Table><TableHeader><TableRow>{kind === "expenses" ? <><TableHead>Date / payee</TableHead><TableHead>Rule / reference</TableHead><TableHead className="text-right">Amount</TableHead></> : kind === "assets" ? <><TableHead>Asset</TableHead><TableHead>Type / location</TableHead><TableHead className="text-right">Value</TableHead></> : <><TableHead>Liability / creditor</TableHead><TableHead>Incurred / due</TableHead><TableHead className="text-right">Outstanding</TableHead></>}<TableHead>Posting</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => {
    const status = value(row, "status").toLowerCase();
    const outstanding = Number(row.outstanding_amount ?? 0);
    return <TableRow key={resourceId(row)}>{kind === "expenses" ? <><TableCell><div className="font-medium">{value(row, "party_name")}</div><p className="text-xs text-muted-foreground">{value(row, "transaction_date")}</p></TableCell><TableCell><p className="font-mono text-sm">{value(row, "rule_code")}</p><p className="text-xs text-muted-foreground">{value(row, "reference")}</p></TableCell><TableCell className="text-right font-medium tabular-nums">{money(row.amount)}</TableCell></> : kind === "assets" ? <><TableCell><div className="font-medium">{metadataValue(row, "name")}</div><p className="text-xs text-muted-foreground">Qty {metadataValue(row, "quantity")}</p></TableCell><TableCell><p className="capitalize">{value(row, "asset_class")} · {value(row, "acquisition_method")}</p><p className="text-xs text-muted-foreground">{metadataValue(row, "location")}</p></TableCell><TableCell className="text-right font-medium tabular-nums">{money(row.amount)}</TableCell></> : <><TableCell><div className="font-medium">{metadataValue(row, "name") !== "—" ? metadataValue(row, "name") : value(row, "description")}</div><p className="text-xs text-muted-foreground">{value(row, "party_name")}</p></TableCell><TableCell><p>{value(row, "transaction_date")}</p><p className="text-xs text-muted-foreground">Due {value(row, "due_date")}</p></TableCell><TableCell className="text-right font-medium tabular-nums">{money(row.outstanding_amount)}</TableCell></>}<TableCell><div className="space-y-1"><StatusBadge row={row} /><p className="font-mono text-xs text-muted-foreground">{value(row, "journal_id")}</p></div></TableCell><TableCell className="text-right whitespace-nowrap">{status === "draft" ? <Button size="sm" variant="ghost" onClick={() => onEdit(row)}><Pencil className="size-4" />Edit</Button> : null}{kind === "liabilities" && status === "posted" && outstanding > 0 ? <Button size="sm" variant="ghost" onClick={() => onPay(row)}>Pay</Button> : null}{kind === "liabilities" ? <Button size="sm" variant="ghost" onClick={() => onPayments(row)}>Payments</Button> : null}{status === "posted" ? <Button size="sm" variant="ghost" onClick={() => onReverse(row)}><RotateCcw className="size-4" />Reverse</Button> : null}</TableCell></TableRow>;
  })}</TableBody></Table></CardContent></Card>;
}

function PreviewDialog({ open, preview, posting, title, onOpenChange, onPost }: { open: boolean; preview: Preview | null; posting: boolean; title: string; onOpenChange: (open: boolean) => void; onPost: () => void }) {
  const lines = preview?.lines ?? [];
  const totals = preview?.totals ?? {};
  const debit = Number(totals.debit ?? totals.debits ?? 0);
  const credit = Number(totals.credit ?? totals.credits ?? 0);
  const balanced = Boolean(totals.is_balanced ?? debit === credit);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>This is a server-generated draft. Confirm only if the accounts, amounts, and evidence are correct.</DialogDescription></DialogHeader><div className={balanced ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950" : "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive"}><div className="flex items-center gap-2 font-semibold">{balanced ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}Debit {money(debit)} <span className="text-lg">{balanced ? "=" : "≠"}</span> Credit {money(credit)}</div><p className="mt-1 text-xs">{balanced ? "Balanced preview — ready for confirmation." : "This preview is not balanced and cannot be posted."}</p></div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Memo</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody>{lines.length ? lines.map((line, index) => <TableRow key={String(line.id ?? index)}><TableCell><span className="font-mono">{value(line, "account_code", "code")}</span> {value(line, "account_name", "name")}</TableCell><TableCell>{value(line, "description", "memo", "narration")}</TableCell><TableCell className="text-right tabular-nums">{Number(line.debit ?? 0) ? money(line.debit) : "—"}</TableCell><TableCell className="text-right tabular-nums">{Number(line.credit ?? 0) ? money(line.credit) : "—"}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">The server did not return journal lines for this preview.</TableCell></TableRow>}</TableBody></Table></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Keep as draft</Button><Button disabled={posting || !balanced} onClick={onPost}>{posting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}Confirm & post</Button></DialogFooter></DialogContent></Dialog>;
}

function Pagination({ meta, loading, onPage }: { meta: PageMeta | null; loading: boolean; onPage: (page: number) => void }) {
  if (!meta || meta.total <= 0) return null;
  return <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Showing {meta.from ?? 1}–{meta.to ?? meta.total} of {meta.total}</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={loading || meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {meta.current_page} of {meta.last_page}</span><Button size="sm" variant="outline" disabled={loading || meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>Next</Button></div></div>;
}

function StatusBadge({ row }: { row: Row }) {
  const status = value(row, "status", "posting_status");
  const normalized = status.toLowerCase();
  const awaitingAccountingSetup = isAwaitingAccountingSetup(row);
  return <Badge variant={normalized.includes("posted") || normalized === "paid" || normalized === "active" ? "default" : normalized.includes("reverse") || normalized.includes("archive") ? "secondary" : "outline"} className={awaitingAccountingSetup ? "border-amber-300 bg-amber-50 text-amber-900" : "capitalize"}>{awaitingAccountingSetup ? "Draft — awaiting accounting setup" : status.replaceAll("_", " ")}</Badge>;
}

function LoadingState() { return <div className="flex justify-center rounded-xl border bg-background py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="rounded-xl border border-dashed bg-background px-6 py-14 text-center"><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>; }
