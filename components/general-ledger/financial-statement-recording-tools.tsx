"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatApiResponseError } from "@/lib/falco-api";
import { formatStatementAmount, type ReportCategory } from "@/lib/financial-statements";
import { decimalToMinorUnits, eatDateKey } from "@/lib/trial-balance";

type Account = { id: number; code: string; name: string; type: string; report_category: string | null; is_active: boolean; is_postable: boolean };
const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const types = ["asset", "liability", "equity", "income", "expense"];

export function categoryAccountType(category: string): string {
  if (category.startsWith("bs.capital.")) return "equity";
  if (category.startsWith("bs.borrowings.") || category.startsWith("bs.liabilities.")) return "liability";
  if (category.startsWith("is.interest_income.") || category.startsWith("is.noninterest_income.")) return "income";
  return category.startsWith("is.") ? "expense" : "asset";
}

async function request(url: string, init?: RequestInit) {
  const response = await fetch(`/api/general-ledger/${url}`, { cache: "no-store", ...init });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(formatApiResponseError(body, "Unable to save this accounting entry."));
  return body.data;
}

export function FinancialStatementRecordingTools({ categories, canConfigure, canPost, onSaved }: {
  categories: ReportCategory[]; canConfigure: boolean; canPost: boolean; onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"accounts" | "adjustment" | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [newAccount, setNewAccount] = useState({ code: "", name: "", type: "asset", normal_balance: "debit", report_category: "" });
  const [adjustment, setAdjustment] = useState({ date: eatDateKey(), narration: "", debit: "", credit: "", amount: "" });
  const [preview, setPreview] = useState(false);
  const [key, setKey] = useState("");
  const [posted, setPosted] = useState(false);

  if (!canConfigure && !canPost) return null;

  async function open(next: "accounts" | "adjustment") {
    setMode(next); setError(""); setBusy(true); setPreview(false); setPosted(false);
    try { setAccounts(await request("accounts")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load accounts."); }
    finally { setBusy(false); }
  }

  async function saveAccount() {
    setBusy(true); setError("");
    try {
      await request("accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newAccount, report_category: newAccount.report_category || null, is_active: true, is_postable: true }) });
      setAccounts(await request("accounts"));
      setNewAccount({ code: "", name: "", type: "asset", normal_balance: "debit", report_category: "" });
      await onSaved(); toast.success("Account added. It is available when creating a rule.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to add account."); }
    finally { setBusy(false); }
  }

  async function mapAccount(account: Account, category: string) {
    setBusy(true); setError("");
    try {
      await request(`accounts/${account.id}/report-category`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report_category: category || null }) });
      setAccounts(await request("accounts")); await onSaved(); toast.success("Report category saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to map account."); }
    finally { setBusy(false); }
  }

  function previewAdjustment() {
    try {
      if (!adjustment.date || !adjustment.narration.trim() || !adjustment.debit || !adjustment.credit) throw new Error("Enter a date, description, debit account and credit account.");
      if (adjustment.debit === adjustment.credit) throw new Error("Choose two different accounts.");
      if (decimalToMinorUnits(adjustment.amount) <= BigInt(0)) throw new Error("Enter a positive amount with no more than two decimal places.");
      setKey(crypto.randomUUID()); setPreview(true); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Check the adjustment amount."); }
  }

  async function postAdjustment() {
    setBusy(true); setError("");
    try {
      const journal = await request("journals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        transaction_date: adjustment.date, narration: adjustment.narration, idempotency_key: `MSP-ADJUSTMENT:${key}`,
        lines: [{ account_id: Number(adjustment.debit), debit: adjustment.amount, credit: "0.00" }, { account_id: Number(adjustment.credit), debit: "0.00", credit: adjustment.amount }],
      }) });
      setPosted(true); await onSaved(); toast.success(`Adjustment posted: ${journal.journal_number}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to post adjustment."); }
    finally { setBusy(false); }
  }

  const activeAccounts = accounts.filter((account) => account.is_active && account.is_postable);
  const visibleAccounts = accounts.filter((account) => `${account.code} ${account.name}`.toLowerCase().includes(search.toLowerCase()));
  const accountName = (id: string) => { const account = accounts.find((item) => String(item.id) === id); return account ? `${account.code} — ${account.name}` : ""; };

  return <>
    <div className="flex flex-wrap gap-2">
      {canConfigure ? <Button variant="outline" onClick={() => void open("accounts")}>Configure report accounts</Button> : null}
      {canPost ? <Button variant="outline" onClick={() => void open("adjustment")}>Record accounting adjustment</Button> : null}
    </div>
    <Dialog open={mode !== null} onOpenChange={(isOpen) => { if (!isOpen && !busy) setMode(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>{mode === "accounts" ? "Report accounts" : "Accounting adjustment"}</DialogTitle><DialogDescription>{mode === "accounts" ? "Create accounts for report categories, then use them in Rules. Reclassifying an account changes the reports that include its history." : "Record depreciation, allowances, accruals or another adjustment. Review both sides before posting."}</DialogDescription></DialogHeader>
        {error ? <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}
        {mode === "accounts" ? <>
          <form className="grid gap-3 rounded-md border p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void saveAccount(); }}>
            <div className="space-y-1"><Label htmlFor="report-account-code">Account code</Label><Input id="report-account-code" required maxLength={20} value={newAccount.code} onChange={(event) => setNewAccount({ ...newAccount, code: event.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="report-account-name">Account name</Label><Input id="report-account-name" required maxLength={255} value={newAccount.name} onChange={(event) => setNewAccount({ ...newAccount, name: event.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="report-account-type">Account type</Label><select id="report-account-type" className={selectClass} value={newAccount.type} onChange={(event) => setNewAccount({ ...newAccount, type: event.target.value, normal_balance: ["asset", "expense"].includes(event.target.value) ? "debit" : "credit", report_category: "" })}>{types.map((type) => <option key={type}>{type}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="report-account-side">Normal balance</Label><select id="report-account-side" className={selectClass} value={newAccount.normal_balance} onChange={(event) => setNewAccount({ ...newAccount, normal_balance: event.target.value })}><option value="debit">Debit</option><option value="credit">Credit (also used for asset deductions)</option></select></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="new-report-category">Report category</Label><select id="new-report-category" required className={selectClass} value={newAccount.report_category} onChange={(event) => setNewAccount({ ...newAccount, report_category: event.target.value })}><option value="">Choose category</option>{categories.filter((category) => categoryAccountType(category.value) === newAccount.type).map((category) => <option key={category.value} value={category.value}>{category.value.startsWith("bs.") ? "Balance Sheet" : "Income & Expense"} {category.code} — {category.label}</option>)}</select></div>
            <Button className="sm:col-span-2" disabled={busy || categories.length === 0}>Add account</Button>
          </form>
          <Input aria-label="Search report accounts" placeholder="Search account code or name" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="max-h-80 overflow-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Report category</TableHead></TableRow></TableHeader><TableBody>{visibleAccounts.map((account) => <TableRow key={account.id}><TableCell>{account.code} — {account.name}{!account.is_active ? " (inactive)" : ""}</TableCell><TableCell>{account.type}</TableCell><TableCell><select aria-label={`Report category for ${account.code}`} className={selectClass} disabled={busy} value={account.report_category ?? ""} onChange={(event) => void mapAccount(account, event.target.value)}><option value="">Unmapped</option>{categories.filter((category) => categoryAccountType(category.value) === account.type).map((category) => <option key={category.value} value={category.value}>{category.code} — {category.label}</option>)}</select></TableCell></TableRow>)}</TableBody></Table></div>
        </> : <>
          {posted ? <p className="rounded-md border p-4">The adjustment has been posted. Refresh the report for its accounting quarter to see its effect.</p> : preview ? <div className="space-y-4">
            <p className="text-sm">{adjustment.date} · {adjustment.narration}</p>
            <Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>{accountName(adjustment.debit)}</TableCell><TableCell className="text-right">{formatStatementAmount(adjustment.amount)}</TableCell><TableCell className="text-right">—</TableCell></TableRow><TableRow><TableCell>{accountName(adjustment.credit)}</TableCell><TableCell className="text-right">—</TableCell><TableCell className="text-right">{formatStatementAmount(adjustment.amount)}</TableCell></TableRow></TableBody></Table>
            <p className="text-sm font-medium">Debit TZS {formatStatementAmount(adjustment.amount)} = Credit TZS {formatStatementAmount(adjustment.amount)}</p>
            <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setPreview(false)}>Edit</Button><Button disabled={busy} onClick={() => void postAdjustment()}>Confirm and post</Button></div>
          </div> : <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); previewAdjustment(); }}>
            <div className="space-y-1"><Label htmlFor="adjustment-date">Accounting date</Label><Input id="adjustment-date" type="date" required value={adjustment.date} onChange={(event) => setAdjustment({ ...adjustment, date: event.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="adjustment-amount">Amount (TZS)</Label><Input id="adjustment-amount" inputMode="decimal" required value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="adjustment-description">Description</Label><Input id="adjustment-description" required maxLength={1000} value={adjustment.narration} onChange={(event) => setAdjustment({ ...adjustment, narration: event.target.value })} /></div>
            {(["debit", "credit"] as const).map((side) => <div key={side} className="space-y-1"><Label htmlFor={`adjustment-${side}`}>{side === "debit" ? "Debit account" : "Credit account"}</Label><select id={`adjustment-${side}`} className={selectClass} required value={adjustment[side]} onChange={(event) => setAdjustment({ ...adjustment, [side]: event.target.value })}><option value="">Choose account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></div>)}
            <Button className="sm:col-span-2" disabled={busy}>Preview debit and credit</Button>
          </form>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
