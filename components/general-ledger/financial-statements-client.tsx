"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatStatementAmount,
  parseFinancialStatements,
  statementUrl,
  statementWorkspaceActions,
  type FinancialStatementsReport,
  type ReportCategory,
  type StatementRow,
  type UnmappedAccount,
} from "@/lib/financial-statements";
import { downloadBalanceSheet, downloadIncomeStatement } from "@/lib/financial-statements-export";
import { formatApiResponseError } from "@/lib/falco-api";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";
import { FinancialStatementRecordingTools } from "@/components/general-ledger/financial-statement-recording-tools";

type View = "balance" | "income";
const currentEatYear = () => Number(new Intl.DateTimeFormat("en", { timeZone: "Africa/Dar_es_Salaam", year: "numeric" }).format(new Date()));
const currentEatQuarter = () => Math.ceil((Number(new Intl.DateTimeFormat("en", { timeZone: "Africa/Dar_es_Salaam", month: "numeric" }).format(new Date()))) / 3);

export function FinancialStatementsClient() {
  const [year, setYear] = useState(currentEatYear);
  const [quarter, setQuarter] = useState(currentEatQuarter);
  const [view, setView] = useState<View>("balance");
  const [report, setReport] = useState<FinancialStatementsReport | null>(null);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<View | null>(null);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const { user } = useSessionUser();
  const { canExport, canConfigure, canPost } = statementWorkspaceActions(user);

  const loadReport = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(statementUrl(year, quarter), { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(formatApiResponseError(payload, "Unable to load financial statements."));
      if (version === requestVersion.current) setReport(parseFinancialStatements(payload));
    } catch (reason) {
      if (version === requestVersion.current) {
        setError(reason instanceof Error ? reason.message : "Unable to load financial statements.");
        setReport(null);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [quarter, year]);

  useEffect(() => { void loadReport(); }, [loadReport]);
  useEffect(() => {
    if (!canConfigure && !canPost) return;
    void fetch("/api/general-ledger/report-categories", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(formatApiResponseError(payload, "Unable to load report categories."));
        setCategories(parseCategories(payload));
      })
      .catch((reason) => toast.error(reason instanceof Error ? reason.message : "Unable to load report categories."));
  }, [canConfigure, canPost]);

  async function exportStatement(statement: View) {
    if (!canExport || !report) return;
    setExporting(statement);
    try {
      const response = await fetch(statementUrl(report.period.year, report.period.quarter, true), { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(formatApiResponseError(payload, "Export is not authorized."));
      const authorizedReport = parseFinancialStatements(payload);
      if (authorizedReport.period.year !== report.period.year || authorizedReport.period.quarter !== report.period.quarter) {
        throw new Error("The export period no longer matches this preview. Refresh and try again.");
      }
      if (statementFingerprint(authorizedReport) !== statementFingerprint(report)) {
        setReport(authorizedReport);
        throw new Error("Posted ledger data changed after this preview. The preview has been refreshed; review it before downloading.");
      }
      if (statement === "balance") await downloadBalanceSheet(report);
      else await downloadIncomeStatement(report);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to create the workbook.");
    } finally {
      setExporting(null);
    }
  }

  const years = useMemo(() => Array.from({ length: 7 }, (_, index) => currentEatYear() - 5 + index), []);
  return <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-muted/25">
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3"><SidebarTrigger /><div className="min-w-0"><h1 className="truncate text-base font-semibold">Financial Statements</h1><p className="truncate text-xs text-muted-foreground">MSP2 quarterly regulatory statements from posted General Ledger data.</p></div></div>
      <Button size="sm" variant="outline" onClick={() => void loadReport()} disabled={loading}><RefreshCcw className={cn("size-4", loading && "animate-spin")} /><span className="hidden sm:inline">Refresh</span></Button>
    </header>
    <main className="mx-auto w-full max-w-[1600px] space-y-5 p-4 md:p-6">
      <Card><CardHeader className="pb-4"><CardTitle className="text-lg">Reporting period</CardTitle><CardDescription>Quarter boundaries use East Africa Time. The income statement shows both quarter and calendar year-to-date values.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-2 sm:w-44"><Label htmlFor="statement-year">Year</Label><Select value={String(year)} onValueChange={(value) => setYear(Number(value))}><SelectTrigger id="statement-year"><SelectValue /></SelectTrigger><SelectContent>{years.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent></Select></div>
        <div className="w-full space-y-2 sm:w-44"><Label htmlFor="statement-quarter">Quarter</Label><Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value))}><SelectTrigger id="statement-quarter"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4].map((option) => <SelectItem key={option} value={String(option)}>Q{option}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:justify-end"><Button variant={view === "balance" ? "default" : "outline"} onClick={() => setView("balance")}>Balance Sheet</Button><Button variant={view === "income" ? "default" : "outline"} onClick={() => setView("income")}>Income & Expense</Button></div>
      </CardContent></Card>
      {error ? <MessageState tone="error" title="Financial statements could not be loaded" text={error} /> : null}
      {loading ? <div className="flex justify-center rounded-lg border bg-background py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div> : null}
      {!loading && report ? <>
        {canConfigure || canPost ? <FinancialStatementRecordingTools categories={categories} canConfigure={canConfigure} canPost={canPost} onSaved={loadReport} /> : null}
        <CompletenessBanner report={report} />
        {report.warnings.map((warning, index) => <MessageState key={`${typeof warning === "string" ? warning : warning.code ?? warning.message}-${index}`} tone="warning" title="Reporting information" text={typeof warning === "string" ? warning : warning.message} />)}
        {report.unmapped_accounts.length ? <MappingPanel accounts={report.unmapped_accounts} categories={categories} canConfigure={Boolean(canConfigure)} onMapped={loadReport} /> : null}
        <StatementPanel view={view} report={report} canExport={Boolean(canExport)} exporting={exporting} onExport={exportStatement} />
        {report.checks?.length ? <ChecksPanel checks={report.checks} /> : null}
      </> : null}
    </main>
  </div>;
}

function CompletenessBanner({ report }: { report: FinancialStatementsReport }) {
  const complete = report.completeness.status === "complete";
  return <div className={cn("flex items-start gap-3 rounded-lg border p-4", complete ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950")}>{complete ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}<div><p className="font-medium">{complete ? "Posted balances reconcile" : "Report needs review"}</p><p className="mt-1 text-sm">{report.completeness.mapped_accounts} of {report.completeness.total_accounts} active accounts have report categories. {complete ? "The mapped posted balances pass the report checks." : "Review the unmapped balances and validation results below."}</p></div></div>;
}

function StatementPanel({ view, report, canExport, exporting, onExport }: { view: View; report: FinancialStatementsReport; canExport: boolean; exporting: View | null; onExport: (view: View) => void }) {
  const balance = view === "balance";
  const statement = balance ? report.balance_sheet : report.income_statement;
  const checks = statement.checks ?? [];
  return <Card><CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-lg">{balance ? "Balance Sheet" : "Income and Expense Statement"}</CardTitle><Badge variant="outline">{statement.code}</Badge><Badge variant="secondary">{statement.rows.length} lines</Badge></div><CardDescription className="mt-2">{balance ? `As of ${report.period.to}` : `Quarter ${report.period.quarter}: ${report.period.from}–${report.period.to}; calendar YTD from ${report.period.ytd_from}`} · {report.period.currency}</CardDescription></div>{canExport ? <Button variant="outline" onClick={() => onExport(view)} disabled={exporting !== null}><Download className="size-4" />{exporting === view ? "Preparing…" : `Download ${statement.code}.xlsx`}</Button> : null}</CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-28">Code</TableHead><TableHead>Description</TableHead>{balance ? <TableHead className="text-right">Amount</TableHead> : <><TableHead className="text-right">Quarter</TableHead><TableHead className="text-right">Calendar YTD</TableHead></>}</TableRow></TableHeader><TableBody>{statement.rows.map((row, index) => <StatementTableRow key={`${row.code}-${index}`} row={row} balance={balance} />)}</TableBody></Table>{checks.length ? <div className="mt-5 space-y-2 border-t pt-4"><p className="text-sm font-medium">Validation checks</p>{checks.map((check, index) => <CheckRow key={`${check.code ?? "check"}-${index}`} check={check} />)}</div> : null}</CardContent></Card>;
}

function StatementTableRow({ row, balance }: { row: StatementRow; balance: boolean }) {
  const hasSources = row.accounts.length > 0 || (row.ytd_accounts?.length ?? 0) > 0;
  return <TableRow className={cn(row.kind === "heading" && "bg-muted/60", row.kind !== "detail" && "font-semibold")}>
    <TableCell className="font-mono text-xs">{row.code}</TableCell>
    <TableCell style={{ paddingLeft: `${Math.max(0, row.depth) * 20 + 16}px` }}>
      <span>{row.label}</span>
      {row.formula_components?.length ? <span className="ml-2 text-xs font-normal text-muted-foreground">{row.formula_components.map((component, index) => `${component.sign < 0 ? "− " : index ? "+ " : ""}${component.code}`).join(" ")}</span> : null}
      {row.calculation ? <p className="text-xs font-normal text-muted-foreground">{row.calculation}</p> : null}
      {hasSources ? <details className="mt-1 text-xs font-normal">
        <summary className="cursor-pointer text-muted-foreground">View source accounts</summary>
        <div className="space-y-1 py-2">
          {row.accounts.map((account) => <p key={`period-${account.id}`}>{account.code} — {account.name}: {formatStatementAmount(account.amount)}{balance ? "" : " (quarter)"}</p>)}
          {row.ytd_accounts?.map((account) => <p key={`ytd-${account.id}`}>{account.code} — {account.name}: {formatStatementAmount(account.amount)} (YTD)</p>)}
        </div>
      </details> : null}
    </TableCell>
    {balance ? <TableCell className="text-right tabular-nums">{row.kind === "heading" ? "" : formatStatementAmount(row.amount)}</TableCell> : <>
      <TableCell className="text-right tabular-nums">{row.kind === "heading" ? "" : formatStatementAmount(row.quarter_amount)}</TableCell>
      <TableCell className="text-right tabular-nums">{row.kind === "heading" ? "" : formatStatementAmount(row.ytd_amount)}</TableCell>
    </>}
  </TableRow>;
}

function MappingPanel({ accounts, categories, canConfigure, onMapped }: { accounts: UnmappedAccount[]; categories: ReportCategory[]; canConfigure: boolean; onMapped: () => Promise<void> }) {
  const [saving, setSaving] = useState<number | null>(null);
  async function mapAccount(account: UnmappedAccount, reportCategory: string) {
    setSaving(account.id);
    try {
      const response = await fetch(`/api/general-ledger/accounts/${account.id}/report-category`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report_category: reportCategory }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(formatApiResponseError(payload, "Unable to map this account."));
      toast.success(`${account.code} mapped. Statement refreshed.`);
      await onMapped();
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : "Unable to map this account."); }
    finally { setSaving(null); }
  }
  return <Card className="border-amber-200"><CardHeader><CardTitle className="text-base">Unmapped General Ledger accounts</CardTitle><CardDescription>These balances are excluded rather than shown as invented zeroes. Choose the MSP report category only when its treatment is known.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Reason</TableHead>{canConfigure ? <TableHead className="min-w-64">Report category</TableHead> : null}</TableRow></TableHeader><TableBody>{accounts.map((account) => <TableRow key={account.id}><TableCell><p className="font-mono font-medium">{account.code}</p><p className="text-xs text-muted-foreground">{account.name}</p></TableCell><TableCell className="capitalize">{account.type}</TableCell><TableCell className="text-right tabular-nums">{formatStatementAmount(account.balance)}</TableCell><TableCell className="max-w-sm text-sm text-muted-foreground">{account.reason}</TableCell>{canConfigure ? <TableCell><Select disabled={saving === account.id || categories.length === 0} onValueChange={(value) => void mapAccount(account, value)}><SelectTrigger><SelectValue placeholder={categories.length ? "Choose category" : "Categories unavailable"} /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.value} value={category.value}>{category.code ? `${category.code} — ` : ""}{category.label}</SelectItem>)}</SelectContent></Select></TableCell> : null}</TableRow>)}</TableBody></Table></CardContent></Card>;
}

function MessageState({ tone, title, text }: { tone: "error" | "warning"; title: string; text: string }) {
  return <div className={cn("flex items-start gap-3 rounded-lg border p-4", tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-amber-200 bg-amber-50 text-amber-950")}><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><p className="font-medium">{title}</p><p className="mt-1 text-sm">{text}</p></div></div>;
}

function CheckRow({ check }: { check: { code?: string; label?: string; passed?: boolean; difference?: string; actual?: string; message?: string } }) {
  const labels: Record<string, string> = { balance_sheet_equation: "Total assets = Total liabilities + Total capital", msp_profit_cross_check: "Balance Sheet profit/loss = Income Statement year-to-date profit/loss" };
  const difference = check.difference ?? check.actual;
  return <div className="flex items-start gap-2 text-sm">{check.passed === true ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : <AlertTriangle className="mt-0.5 size-4 text-amber-600" />}<span>{check.label ?? check.message ?? labels[check.code ?? ""] ?? check.code ?? "Statement check"}{difference !== undefined ? ` · Difference TZS ${formatStatementAmount(difference)}` : ""}</span></div>;
}

function ChecksPanel({ checks }: { checks: Array<{ code?: string; label?: string; passed?: boolean; difference?: string; message?: string }> }) {
  return <Card><CardHeader><CardTitle className="text-base">Cross-statement checks</CardTitle></CardHeader><CardContent className="space-y-2">{checks.map((check, index) => <CheckRow key={`${check.code ?? "check"}-${index}`} check={check} />)}</CardContent></Card>;
}

function statementFingerprint(report: FinancialStatementsReport): string {
  return JSON.stringify({ metadata: report.metadata, period: { year: report.period.year, quarter: report.period.quarter, from: report.period.from, to: report.period.to, ytd_from: report.period.ytd_from }, balance_sheet: report.balance_sheet, income_statement: report.income_statement, checks: report.checks, warnings: report.warnings, unmapped_accounts: report.unmapped_accounts, completeness: report.completeness });
}

function parseCategories(payload: unknown): ReportCategory[] {
  const root = payload && typeof payload === "object" && "data" in payload ? (payload as { data: unknown }).data : payload;
  const values = Array.isArray(root) ? root : root && typeof root === "object" && "categories" in root && Array.isArray((root as { categories: unknown }).categories) ? (root as { categories: unknown[] }).categories : root && typeof root === "object" ? Object.values(root).flatMap((group) => Array.isArray(group) ? group : []) : [];
  return values.flatMap((item) => {
    if (typeof item === "string") return [{ value: item, label: item.replaceAll("_", " ") }];
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const value = String(row.value ?? row.key ?? row.report_category ?? row.code ?? "");
    return value ? [{ value, label: String(row.label ?? row.name ?? value.replaceAll("_", " ")), code: row.report_line_code ? String(row.report_line_code) : row.code ? String(row.code) : undefined, statement: row.statement ? String(row.statement) : undefined }] : [];
  });
}
