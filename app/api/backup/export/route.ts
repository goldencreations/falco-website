import { NextResponse } from "next/server";
import { getAllDataSummary, getScopeRows } from "@/lib/mock-backup-data";
import type { BackupScope } from "@/lib/backup-types";

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      const escaped = String(value ?? "").replace(/"/g, '""');
      return `"${escaped}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
}

function toPdfLikeText(scope: BackupScope, rows: Array<Record<string, unknown>>) {
  const summary = getAllDataSummary();
  const body = rows
    .slice(0, 200)
    .map((row) => JSON.stringify(row))
    .join("\n");
  return [
    "Falco Backup Export Report",
    `Scope: ${scope}`,
    `Generated: ${new Date().toISOString()}`,
    `Totals: customers=${summary.totals.customers}, applications=${summary.totals.applications}, payments=${summary.totals.payments}, loans=${summary.totals.loans}`,
    "",
    body || "No rows",
  ].join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();
  const scope = (url.searchParams.get("scope") || "all") as BackupScope;

  const rows =
    scope === "all"
      ? [
          { scope: "customers", count: getScopeRows("customers").length },
          { scope: "applications", count: getScopeRows("applications").length },
          { scope: "payments", count: getScopeRows("payments").length },
          { scope: "loans", count: getScopeRows("loans").length },
          { scope: "users", count: getScopeRows("users").length },
        ]
      : getScopeRows(scope);

  if (format === "pdf") {
    const content = toPdfLikeText(scope, rows);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="backup-${scope}-${Date.now()}.pdf"`,
      },
    });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${scope}-${Date.now()}.csv"`,
    },
  });
}
