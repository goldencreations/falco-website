"use client";

import React, { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { chartDeleteConfirmation, matchingChartNodes, nextChartCode, chartAccountReadiness, compatibleAccountPurposes, type AccountPurpose, type ChartNode } from "@/lib/account-hierarchy";
import { formatApiResponseError } from "@/lib/falco-api";

export function ChartActions({ node, disabled, onEdit, onDelete }: {
  node: ChartNode; disabled: boolean; onEdit: (node: ChartNode) => void;
  onDelete: (node: ChartNode) => void;
}) {
  if (node.parent_id === null || node.origin === "loan_system" || node.deleted_at) return null;
  return <div className="flex shrink-0 flex-wrap items-center gap-1">
    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onEdit(node)} aria-label={`Edit ${node.name}`}><Pencil className="size-3.5" />Edit</Button>
    <Button size="sm" variant="ghost" className="text-destructive" disabled={disabled} onClick={() => onDelete(node)} aria-label={`Delete ${node.name}`}><Trash2 className="size-3.5" />Delete</Button>
  </div>;
}

export function AccountHierarchyWorkspace() {
  const [purposes, setPurposes] = useState<AccountPurpose[]>([]);
  const [purpose, setPurpose] = useState("");
  const [nodes, setNodes] = useState<ChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [unlinked, setUnlinked] = useState(0);
  const [search, setSearch] = useState("");
  const [parent, setParent] = useState<ChartNode | null>(null);
  const [editing, setEditing] = useState<ChartNode | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChartNode | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [response, purposeResponse] = await Promise.all([fetch("/api/general-ledger/account-hierarchy", { cache: "no-store" }), fetch("/api/general-ledger/account-hierarchy/options", { cache: "no-store" })]);
      const [payload, purposePayload] = await Promise.all([response.json(), purposeResponse.json()]);
      if (!purposeResponse.ok) throw new Error(formatApiResponseError(purposePayload, "Unable to load account purposes."));
      setPurposes(purposePayload.data);
      if (!response.ok) throw new Error(formatApiResponseError(payload, "Unable to load accounts."));
      setNodes(payload.data.filter((node: ChartNode) => !node.deleted_at));
      setUnlinked(payload.unlinked_accounts);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : "Unable to load accounts."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const visible = matchingChartNodes(nodes, search);

  function add(node: ChartNode) {
    setEditing(null); setParent(node); setName(""); setDescription(""); setPurpose(""); setFormError(""); setFormOpen(true);
  }
  function edit(node: ChartNode) {
    setEditing(node); setParent(null); setName(node.name); setDescription(node.description ?? ""); setPurpose(node.account?.report_category ?? ""); setFormError(""); setFormOpen(true);
  }
  function confirmDelete(node: ChartNode) {
    setDeleteTarget(node); setDeleteError(""); setDeleteOpen(true);
  }

  async function request(path: string, method: string, body?: unknown) {
    const response = await fetch(`/api/general-ledger/account-hierarchy${path}`, {
      method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(formatApiResponseError(payload, "The account change could not be saved."));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !parent) return;
    setSaving(true); setFormError("");
    try {
      await request(editing ? `/${editing.id}` : "", editing ? "PATCH" : "POST", {
        ...(!editing ? { parent_id: parent!.id } : {}), name, description: description || null, ...(isAccountForm ? { report_category: purpose } : {}),
      });
      setFormOpen(false);
      await load();
    } catch (reason) { setFormError(reason instanceof Error ? reason.message : "Unable to save account."); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!deleteTarget) return;
    setSaving(true); setDeleteError("");
    try {
      await request(`/${deleteTarget.id}`, "DELETE");
      setDeleteOpen(false);
      await load();
    } catch (reason) { setDeleteError(reason instanceof Error ? reason.message : "Unable to delete account."); }
    finally { setSaving(false); }
  }
  function actions(node: ChartNode) {
    return <ChartActions node={node} disabled={saving || loading} onEdit={edit} onDelete={confirmDelete} />;
  }
  function branch(node: ChartNode): React.ReactNode {
    const children = visible.filter(child => child.parent_id === node.id);
    if (node.account_id !== null) return <div key={node.id} className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5 text-sm">
      <div className="min-w-0 flex-1 break-words"><span className="mr-3 font-mono">{node.code}</span>{node.name}{node.origin === "loan_system" ? <span className="ml-3 text-xs text-teal-700">Automatic — Loan Management</span> : null}
        <p className="text-xs text-muted-foreground">{node.account?.is_active === false ? "Inactive · " : ""}Ledger {node.account?.code}</p><p className={`mt-1 text-xs ${chartAccountReadiness(node).includes("Needs") ? "text-amber-800" : "text-teal-700"}`}>{chartAccountReadiness(node)}</p>
      </div>{actions(node)}
    </div>;
    return <details key={node.id} open={node.parent_id === null || Boolean(search)} className="rounded-md border bg-background">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium"><span className="mr-3 font-mono">{node.code}</span>{node.name}{node.origin === "loan_system" ? <span className="ml-3 text-xs text-teal-700">Automatic — Loan Management</span> : null}</summary>
      <div className="flex flex-wrap justify-end gap-1 border-t px-2 py-1">
        <Button size="sm" variant="ghost" disabled={saving || loading || node.origin === "loan_system" || nextChartCode(node, nodes) === null} onClick={() => add(node)}><Plus className="size-4" />{node.parent_id === null ? "Add group" : "Add account"}</Button>
        {actions(node)}
      </div>
      <div className={node.parent_id === null ? "space-y-2 px-3 pb-3" : ""}>{children.map(branch)}</div>
    </details>;
  }

  const isAccountForm = editing ? editing.account_id !== null : Boolean(parent && parent.parent_id !== null);
  const accountType = editing?.type ?? parent?.type ?? "";
  const selectedPurpose = purposes.find(option => option.value === purpose);
  const formTitle = editing ? (editing.account_id === null ? "Edit group" : "Edit account") : parent?.parent_id === null ? "Add account group" : "Add posting account";
  return <div className="min-h-0 flex-1 overflow-auto bg-muted/25">
    <header className="flex min-h-16 items-center gap-3 border-b bg-background px-4"><SidebarTrigger /><div><h1 className="text-base font-semibold">Rules / Chart of Accounts</h1><p className="text-xs text-muted-foreground">Private General Ledger workspace</p></div></header>
    <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <section className="rounded-lg border bg-background p-4">
        <h2 className="font-semibold">Chart of Accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">Add your own groups and accounts under the five fixed headings. Codes are assigned automatically and are not reused after deletion.</p>
        <div className="mt-3 flex gap-2"><Input aria-label="Search accounts" placeholder="Search code or account name" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" disabled={loading || saving} onClick={() => void load()} aria-label="Refresh accounts"><RefreshCcw className="size-4" /></Button></div>
      </section>
      {loadError ? <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{loadError}<Button size="sm" variant="ghost" onClick={() => void load()}>Retry</Button></div> : null}
      {unlinked > 0 ? <p className="rounded-md border border-amber-300 p-3 text-sm">{unlinked} ledger accounts still need hierarchy links. Their balances and journals remain intact.</p> : null}
      {loading ? <p role="status">Loading accounts…</p> : nodes.length === 0 ? <p>The account hierarchy has not been initialized yet.</p> : visible.length === 0 ? <p>No matching accounts.</p> : <div className="space-y-3">{visible.filter(node => node.parent_id === null).map(branch)}</div>}
    </main>
    <Dialog open={formOpen} onOpenChange={open => !saving && setFormOpen(open)}><DialogContent className="max-h-[90vh] overflow-y-auto"><form onSubmit={event => void save(event)}>
      <DialogHeader><DialogTitle>{formTitle}</DialogTitle><DialogDescription>{editing ? "Write the name and description in your own words. Accounts with posted history keep their report placement." : `Under ${parent?.code} — ${parent?.name}. Write the name and description in your own words. Falco assigns the code; the report category connects it to the right statement.`}</DialogDescription></DialogHeader>
      <div className="space-y-4 py-4">
        <div><Label>{editing ? "Code" : "Suggested code"}</Label><p className="font-mono">{editing?.code ?? (parent ? nextChartCode(parent, nodes) ?? "Group full" : "")}</p></div>
        <div><Label htmlFor="chart-account-name">Name</Label><Input id="chart-account-name" className="mt-1" required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></div>
        <div><Label htmlFor="chart-account-description">{isAccountForm ? "What does this account represent? (optional)" : "Description (optional)"}</Label><Textarea id="chart-account-description" className="mt-1" maxLength={2000} placeholder={isAccountForm ? "Type your own description, e.g. laptops used by our staff" : "Describe this group"} value={description} onChange={event => setDescription(event.target.value)} /></div>
        {isAccountForm ? <fieldset className="min-w-0 space-y-2 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Report setup</legend>
          <Label htmlFor="chart-account-purpose">Financial report category *</Label>
          <Select value={purpose} onValueChange={setPurpose} disabled={Boolean(editing?.has_posted_history)}>
            <SelectTrigger id="chart-account-purpose" className="w-full min-w-0 text-left [&_[data-slot=select-value]]:truncate"><SelectValue placeholder="Choose where it appears in reports" /></SelectTrigger>
            <SelectContent className="max-w-[calc(100vw-2rem)]">{compatibleAccountPurposes(purposes, accountType).map(option => <SelectItem key={option.value} value={option.value} className="whitespace-normal">{option.label}{option.mode === "review" ? " — needs review" : ""}</SelectItem>)}</SelectContent>
          </Select>
          {editing?.has_posted_history ? <p className="text-xs text-muted-foreground">This account has posted transactions. Its report category is protected. You can still edit its name and description.</p> : null}
          {selectedPurpose ? <div className={`rounded-md border p-3 text-sm ${selectedPurpose.mode === "review" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-teal-200 bg-teal-50 text-teal-950"}`}>
            <p className="font-medium">{selectedPurpose.mode === "review" ? "Needs accounting review" : selectedPurpose.mode === "settlement" ? "Ready for cash/bank transactions" : `Ready to use in ${selectedPurpose.register === "asset" ? "Assets" : selectedPurpose.register === "expense" ? "Expenses" : selectedPurpose.register === "liability" ? "Liabilities" : selectedPurpose.register === "income" ? "Income" : "Capital"}`}</p>
            <p className="mt-1">{selectedPurpose.help}</p><p className="mt-1 text-xs">Appears in {purpose.startsWith("bs.") ? "Balance Sheet" : "Income & Expense"}: {selectedPurpose.report_label} ({selectedPurpose.report_line}).</p>
          </div> : null}
          <p className="text-xs text-muted-foreground">This category controls report placement, not your description. Creating an account records no money.</p>
        </fieldset> : null}
        {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}
      </div>
      <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || (isAccountForm && !purpose)}>{saving ? "Saving…" : isAccountForm ? "Save account and setup" : "Save group"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
    <Dialog open={deleteOpen} onOpenChange={open => !saving && setDeleteOpen(open)}><DialogContent>
      <DialogHeader><DialogTitle>{deleteTarget ? chartDeleteConfirmation(deleteTarget) : "Confirm deletion"}</DialogTitle><DialogDescription>{deleteTarget?.code} — {deleteTarget?.name}. Recorded transactions and balances will not be deleted.{deleteTarget?.account_id === null ? " Groups must be empty first." : ""}</DialogDescription></DialogHeader>
      {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="destructive" disabled={saving} onClick={() => void remove()}>{saving ? "Deleting…" : "Delete"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
