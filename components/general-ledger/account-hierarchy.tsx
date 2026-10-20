"use client";

import React, { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { GeneralLedgerRegister } from "@/components/general-ledger/general-ledger-register";
import { matchingChartNodes, nextChartCode, type ChartNode } from "@/lib/account-hierarchy";
import { formatApiResponseError } from "@/lib/falco-api";

export function AccountHierarchyWorkspace() {
  const [nodes, setNodes] = useState<ChartNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unlinked, setUnlinked] = useState(0);
  const [search, setSearch] = useState("");
  const [parent, setParent] = useState<ChartNode | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/general-ledger/account-hierarchy", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(formatApiResponseError(payload, "Unable to load accounts."));
      setNodes(payload.data);
      setUnlinked(payload.unlinked_accounts);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load accounts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = matchingChartNodes(nodes, search);
  function add(node: ChartNode) { setParent(node); setName(""); setDescription(""); setError(""); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parent) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/general-ledger/account-hierarchy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parent_id: parent.id, name, description: description || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(formatApiResponseError(payload, "Unable to create account."));
      setParent(null);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create account."); }
    finally { setSaving(false); }
  }
  function branch(node: ChartNode) {
    const children = visible.filter(child => child.parent_id === node.id);
    if (node.account_id !== null) return <div key={node.id} className="flex flex-wrap items-center justify-between gap-1 border-t px-3 py-2 text-sm"><span className="min-w-0 break-words"><span className="mr-3 font-mono">{node.code}</span>{node.name}</span><span className="text-xs text-muted-foreground">{node.account?.is_active === false ? "Inactive · " : ""}Ledger {node.account?.code}</span></div>;
    return <details key={node.id} open={node.parent_id === null || Boolean(search)} className="rounded-md border bg-background"><summary className="cursor-pointer px-3 py-2 text-sm font-medium"><span className="mr-3 font-mono">{node.code}</span>{node.name}</summary><div className="flex justify-end border-t px-2 py-1"><Button size="sm" variant="ghost" disabled={saving || nextChartCode(node, nodes) === null} onClick={() => add(node)}><Plus className="size-4" />{node.parent_id === null ? "Add group" : "Add account"}</Button></div><div className={node.parent_id === null ? "space-y-2 px-3 pb-3" : ""}>{children.map(branch)}</div></details>;
  }
  return <div className="min-h-0 flex-1 overflow-auto bg-muted/25"><header className="flex min-h-16 items-center gap-3 border-b bg-background px-4"><SidebarTrigger /><div><h1 className="text-base font-semibold">Rules / Chart of Accounts</h1><p className="text-xs text-muted-foreground">Private General Ledger workspace</p></div></header><main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6"><section className="rounded-lg border bg-background p-4"><h2 className="font-semibold">Chart of Accounts</h2><p className="mt-1 text-sm text-muted-foreground">Choose a main heading to add a group, then add its posting accounts. Codes are assigned automatically. Ledger references preserve existing journals.</p><div className="mt-3 flex gap-2"><Input aria-label="Search accounts" placeholder="Search code or account name" value={search} onChange={event => setSearch(event.target.value)} /><Button variant="outline" disabled={loading} onClick={() => void load()} aria-label="Refresh accounts"><RefreshCcw className="size-4" /></Button></div></section>{error && !parent ? <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}<Button size="sm" variant="ghost" onClick={() => void load()}>Retry</Button></div> : null}{unlinked > 0 ? <p className="rounded-md border border-amber-300 p-3 text-sm">{unlinked} existing ledger accounts still need hierarchy links. Their balances and journals remain intact.</p> : null}{loading ? <p role="status">Loading accounts…</p> : error ? null : nodes.length === 0 ? <p>The account hierarchy has not been initialized yet.</p> : visible.length === 0 ? <p>No matching accounts.</p> : <div className="space-y-3">{visible.filter(node => node.parent_id === null).map(branch)}</div>}<details className="rounded-lg border bg-background"><summary className="cursor-pointer p-4 text-sm font-medium">Posting templates — existing rules</summary><p className="px-4 pb-3 text-sm text-muted-foreground">These templates select the debit and credit accounts used by expenses, assets, liabilities and income. Capital does not need a template.</p><GeneralLedgerRegister kind="rules" embedded /></details></main><Dialog open={parent !== null} onOpenChange={open => !open && setParent(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><form onSubmit={event => void save(event)}><DialogHeader><DialogTitle>{parent?.parent_id === null ? "Add account group" : "Add posting account"}</DialogTitle><DialogDescription>Under {parent?.code} — {parent?.name}. The server assigns the next available code when saved.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div><Label>Suggested code</Label><p className="font-mono">{parent ? nextChartCode(parent, nodes) ?? "Group full" : ""}</p></div><div><Label htmlFor="chart-account-name">Name</Label><Input id="chart-account-name" className="mt-1" required maxLength={255} value={name} onChange={event => setName(event.target.value)} /></div><div><Label htmlFor="chart-account-description">Description (optional)</Label><Textarea id="chart-account-description" className="mt-1" value={description} onChange={event => setDescription(event.target.value)} /></div>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setParent(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter></form></DialogContent></Dialog></div>;
}
