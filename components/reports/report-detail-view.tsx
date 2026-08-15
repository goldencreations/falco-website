"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Database, Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import {
  exportExpectedCollectionsPdf,
  extractExpectedCollectionRows,
} from "@/lib/expected-collections-pdf";
import { useOptionalBranchAssignment } from "@/components/branch-assignment-context";
import { extractBranchesList } from "@/lib/branch-adapters";
import { resolveReportBranchFields } from "@/lib/branch-display-name";
import type { Branch } from "@/lib/types";

type ReportView =
  | "leads-performance"
  | "customer-demographics"
  | "applications"
  | "expected-collections"
  | "portfolio-aging"
  | "disbursements"
  | "groups-performance"
  | "financial-ledger";

type Props = {
  view: ReportView;
  from: string;
  to: string;
  asOf: string;
  branchId?: string;
  scopeLabel: string;
};

const VIEW_META: Record<ReportView, { title: string; description: string }> = {
  "leads-performance": {
    title: "Lead Performance",
    description: "Lead conversion, staff productivity, stagnation, geography and drop-off analysis.",
  },
  "customer-demographics": {
    title: "Customer Demographics",
    description: "Customer distribution by gender, age group, economic activity and location.",
  },
  applications: {
    title: "Application Analytics",
    description: "Pipeline, turnaround time, SLA breaches, rejections and stalled applications.",
  },
  "expected-collections": {
    title: "Expected Collections",
    description: "Amounts due, verified collections, shortfalls and overdue repayment activity.",
  },
  "portfolio-aging": {
    title: "Portfolio & Aging",
    description: "Backend-calculated portfolio risk, aging classifications and provisions.",
  },
  disbursements: {
    title: "Disbursements",
    description: "Management disbursement register with server-side pagination.",
  },
  "groups-performance": {
    title: "Group Performance",
    description: "Group attendance, collection efficiency, member exposure, PAR and officer data.",
  },
  "financial-ledger": {
    title: "Financial Ledger",
    description: "Financial totals from the reporting API with detailed rows from the cashbook.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrap(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  if (isRecord(value.data)) return value.data;
  if (isRecord(value.report)) return value.report;
  return value;
}

function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (/(^|_)(rate|ratio|percentage|percent|efficiency|recovery)($|_)/i.test(key)) return `${value.toFixed(1)}%`;
    if (/amount|principal|interest|fee|penalty|portfolio|outstanding|provision|collected|expected|shortfall|expense|income|disbursed/i.test(key)) {
      return formatCurrency(value);
    }
    return value.toLocaleString();
  }
  return String(value).replace(/_/g, " ");
}

function flattenScalarCards(root: Record<string, unknown>) {
  return Object.entries(root).filter(([key, value]) => {
    // Null/empty fields (e.g. branch_id on an all-branches aggregate) are not useful KPI cards.
    if (value === null || value === undefined || value === "") return false;
    if (!(typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
      return false;
    }
    if (typeof value === "string" && /^branch[-_][a-z0-9-]+$/i.test(value.trim())) {
      // Orphan catalog keys should not appear as "Branch Id" metrics.
      if (/branch(_?id|_?name)?$/i.test(key) || key === "branch") return false;
    }
    return true;
  });
}

function isScalar(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

/**
 * Turn API lists/maps into table rows.
 * Do not mix scalar map entries (`as_of: "..."`) with nested metric objects in the same
 * table — that produces Category/Value columns plus empty loan_count/etc. cells.
 */
function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];

  const objectRows: Record<string, unknown>[] = [];
  const scalarRows: Record<string, unknown>[] = [];

  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) continue;
    if (isRecord(item)) {
      objectRows.push({ category: key, ...item });
    } else if (isScalar(item)) {
      scalarRows.push({ category: key, value: item });
    }
  }

  if (objectRows.length > 0) return objectRows;
  return scalarRows;
}

function rowLooksLikeBranchBreakdown(row: Record<string, unknown>): boolean {
  return (
    "branch_id" in row ||
    "branch_name" in row ||
    "branchId" in row ||
    "branchName" in row
  );
}

function enrichReportRows(
  rows: Record<string, unknown>[],
  branches: Branch[],
  fallback?: { branchId?: string; branchName?: string }
): Record<string, unknown>[] {
  if (!rows.length) return rows;
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (!rowLooksLikeBranchBreakdown(row)) {
      out.push(row);
      continue;
    }
    const resolved = resolveReportBranchFields({
      branchId: String(row.branch_id ?? row.branchId ?? ""),
      branchName: String(row.branch_name ?? row.branchName ?? row.name ?? ""),
      branches,
      fallbackBranchId: fallback?.branchId,
      fallbackBranchName: fallback?.branchName,
    });
    if (!resolved) continue;
    out.push({
      ...row,
      branch_id: resolved.branch_id,
      branch_name: resolved.branch_name,
    });
  }
  return out;
}

function columnHasDisplayableValue(rows: Record<string, unknown>[], column: string): boolean {
  return rows.some((row) => {
    const value = row[column];
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value) || isRecord(value)) return false;
    return true;
  });
}

function DataTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const columns = useMemo(() => {
    const keys: string[] = [];
    rows.slice(0, 50).forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        if (!keys.includes(key) && !Array.isArray(value) && !isRecord(value)) keys.push(key);
      });
    });
    // Drop sparse columns that are empty for every row (avoids "Loan Count — — —" noise
    // when Category/Value rows were previously mixed with metric objects).
    const populated = keys.filter((key) => columnHasDisplayableValue(rows, key));
    return (populated.length > 0 ? populated : keys).slice(0, 9);
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label(title)}</CardTitle>
        <CardDescription>{rows.length.toLocaleString()} returned row{rows.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length && columns.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  {columns.map((column) => <TableHead key={column}>{label(column)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={String(row.id ?? row.loan_id ?? row.group_id ?? `${title}-${index}`)}>
                    {columns.map((column) => (
                      <TableCell key={column} className="max-w-[280px] whitespace-normal">
                        {displayValue(column, row[column])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            No rows were returned for the selected filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function endpointFor(view: ReportView): string[] {
  switch (view) {
    case "customer-demographics": return ["/api/reports/customer-demographics"];
    case "applications": return ["/api/reports/application-performance"];
    case "expected-collections": return ["/api/reports/expected-collections"];
    case "portfolio-aging": return ["/api/reports/portfolio-summary", "/api/reports/aging"];
    case "disbursements": return ["/api/reports/disbursements"];
    case "groups-performance": return ["/api/reports/group-performance"];
    case "financial-ledger": return ["/api/reports/financial-summary", "/api/financial-entries"];
    default: return [];
  }
}

function exportTypeFor(view: ReportView): string | null {
  const types: Partial<Record<ReportView, string>> = {
    "customer-demographics": "customer-demographics",
    applications: "application-performance",
    "expected-collections": "expected-collections",
    "portfolio-aging": "portfolio-summary",
    disbursements: "disbursements",
    "groups-performance": "group-performance",
    "financial-ledger": "financial-summary",
  };
  return types[view] ?? null;
}

export function ReportDetailView({ view, from, to, asOf, branchId, scopeLabel }: Props) {
  const meta = VIEW_META[view];
  const branchCtx = useOptionalBranchAssignment();
  const [payloads, setPayloads] = useState<Array<{ name: string; data: unknown }>>([]);
  const [loading, setLoading] = useState(view !== "leads-performance");
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("pdf");
  const [exporting, setExporting] = useState(false);
  const [fetchedBranches, setFetchedBranches] = useState<Branch[]>([]);

  const branches = useMemo(() => {
    const merged = new Map<string, Branch>();
    for (const branch of [...(branchCtx?.branches ?? []), ...fetchedBranches]) {
      const id = branch.id?.trim();
      if (!id) continue;
      merged.set(id, branch);
    }
    return Array.from(merged.values());
  }, [branchCtx?.branches, fetchedBranches]);

  useEffect(() => {
    if (branchCtx?.branches?.length) return;
    let cancelled = false;
    void fetch("/api/falco/branches", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const list = extractBranchesList(payload);
        if (list.length > 0) setFetchedBranches(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [branchCtx?.branches?.length]);

  useEffect(() => {
    if (view === "leads-performance") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ from, to, as_of: asOf, page: "1", page_size: "50" });
    if (branchId) params.set("branch_id", branchId);
    setLoading(true);
    setError(null);

    Promise.all(endpointFor(view).map(async (path) => {
      const response = await fetch(`${path}?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = isRecord(data) && typeof data.message === "string" ? data.message : "Report request failed.";
        throw new Error(message);
      }
      return { name: path.split("/").filter(Boolean).pop() ?? "report", data };
    }))
      .then(setPayloads)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setPayloads([]);
        setError(reason instanceof Error ? reason.message : "Could not load this report.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [view, from, to, asOf, branchId]);

  if (view === "leads-performance") {
    return (
      <Card className="border-amber-300 bg-amber-50/60">
        <CardHeader>
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-700" /><CardTitle>{meta.title}</CardTitle></div>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium text-amber-900">Backend report not available yet.</p>
          <p className="text-amber-800">The backend handoff marks `/reports/leads-performance` and its detail endpoint as planned. No substitute calculations are shown.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading {meta.title.toLowerCase()}…</div>;
  if (error) return <Card className="border-destructive/40 bg-destructive/5"><CardContent className="py-6 text-sm text-destructive">{error}</CardContent></Card>;

  const exportReport = async () => {
    const type = exportTypeFor(view);
    if (!type) return;
    setExporting(true);
    setError(null);
    try {
      // Backend PDF for expected-collections is a plain-text dump — build a proper table PDF client-side.
      if (exportFormat === "pdf" && view === "expected-collections") {
        const params = new URLSearchParams({
          from,
          to,
          as_of: asOf,
          page: "1",
          page_size: "500",
        });
        if (branchId) params.set("branch_id", branchId);
        const response = await fetch(`/api/reports/expected-collections?${params.toString()}`, {
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            isRecord(data) && typeof data.message === "string" ? data.message : "Export failed."
          );
        }
        const loadedRows = payloads.flatMap(({ data: payload }) =>
          extractExpectedCollectionRows(payload)
        );
        const freshRows = extractExpectedCollectionRows(data);
        const rows = freshRows.length >= loadedRows.length ? freshRows : loadedRows;
        exportExpectedCollectionsPdf({
          rows,
          scopeLabel,
          from,
          to,
        });
        return;
      }

      const params = new URLSearchParams({ from, to, as_of: asOf, format: exportFormat });
      if (branchId) params.set("branch_id", branchId);
      const response = await fetch(`/api/reports/${type}/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          isRecord(result) && typeof result.message === "string" ? result.message : "Export failed."
        );
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `${type}.${exportFormat}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const sections = payloads.flatMap(({ name, data }) => {
    const root = unwrap(data);
    const scalarCards = flattenScalarCards(root);
    const grouped = Object.entries(root)
      .filter(([, value]) => Array.isArray(value) || isRecord(value))
      .map(([key, value]) => ({
        key: name === "report" ? key : `${name} - ${key}`,
        rows: enrichReportRows(normalizeRows(value), branches, {
          branchId,
          branchName: scopeLabel,
        }),
      }))
      .filter((section) => section.rows.length);
    return [{ name, scalarCards, grouped, root }];
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-2xl font-bold tracking-tight">{meta.title}</h2><p className="text-sm text-muted-foreground">{meta.description}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{scopeLabel}</Badge><Badge variant="outline">{from} to {to}</Badge>
          <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as "csv" | "xlsx" | "pdf")}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="pdf">PDF</SelectItem><SelectItem value="xlsx">Excel</SelectItem><SelectItem value="csv">CSV</SelectItem></SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => void exportReport()} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Export
          </Button>
        </div>
      </div>
      {view === "financial-ledger" ? <Card className="border-blue-200 bg-blue-50/50"><CardContent className="flex gap-2 py-3 text-sm text-blue-900"><Database className="h-4 w-4 shrink-0" />Financial totals come from the reporting API; detailed rows come from the existing financial entries endpoint until the dedicated ledger report is released.</CardContent></Card> : null}
      {sections.some((section) => section.scalarCards.length) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.flatMap((section) => section.scalarCards).map(([key, value], index) => (
            <Card key={`${key}-${index}`}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label(key)}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{displayValue(key, value)}</p></CardContent></Card>
          ))}
        </div>
      ) : null}
      {sections.flatMap((section) => section.grouped).map((section) => <DataTable key={section.key} title={section.key} rows={section.rows} />)}
      {!sections.some((section) => section.scalarCards.length || section.grouped.length) ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No report data is available for the selected filters.</CardContent></Card> : null}
    </div>
  );
}
