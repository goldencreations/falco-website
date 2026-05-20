/** Normalized aging report from `GET /reports/aging`. */

export type AgingBucketKey =
 | "current"
 | "watch"
 | "especially_mentioned"
 | "substandard"
 | "doubtful"
 | "loss";

export type AgingReportRow = {
 classification: AgingBucketKey;
 label: string;
 daysFrom: number;
 daysTo: number | null;
 loanCount: number;
 outstandingAmount: number;
 provisionAmount: number;
 percentage: number;
 provisionRate: number;
};

export type AgingReportView = {
 rows: AgingReportRow[];
 totalOutstanding: number;
 totalProvision: number;
};

const LABELS: Record<string, { label: string; color: string }> = {
 current: { label: "Current", color: "#22c55e" },
 watch: { label: "Watch (1-30d)", color: "#eab308" },
 especially_mentioned: { label: "Watch (1-30d)", color: "#eab308" },
 substandard: { label: "Substandard (31-60d)", color: "#f97316" },
 doubtful: { label: "Doubtful (61-90d)", color: "#ef4444" },
 loss: { label: "Loss (91+d)", color: "#1f2937" },
};

export function agingLabel(classification: string): string {
 return LABELS[classification]?.label ?? classification.replace(/_/g, " ");
}

export function agingColor(classification: string): string {
 return LABELS[classification]?.color ?? "#94a3b8";
}

function num(value: unknown, fallback = 0): number {
 const n = Number(value);
 return Number.isFinite(n) ? n : fallback;
}

function unwrapReportRoot(payload: unknown): Record<string, unknown> {
 if (!payload || typeof payload !== "object") return {};
 const o = payload as Record<string, unknown>;
 if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
 return o.data as Record<string, unknown>;
 }
 return o;
}

export function normalizeAgingReport(payload: unknown): AgingReportView {
 const root = unwrapReportRoot(payload);
 const rowsRaw = Array.isArray(root.rows) ? root.rows : [];
 const totals =
 typeof root.totals === "object" && root.totals !== null
 ? (root.totals as Record<string, unknown>)
 : {};

 const rows: AgingReportRow[] = rowsRaw.map((row) => {
 const item = typeof row === "object" && row !== null ? (row as Record<string, unknown>) : {};
 const classification = String(item.classification ?? "current") as AgingBucketKey;
 const outstandingAmount = num(item.outstanding_amount);
 const provisionAmount = num(item.provision_amount);
 const daysToRaw = item.days_to;
 return {
 classification,
 label: agingLabel(classification),
 daysFrom: num(item.days_from),
 daysTo: daysToRaw === null || daysToRaw === undefined ? null : num(daysToRaw),
 loanCount: num(item.loan_count),
 outstandingAmount,
 provisionAmount,
 percentage: num(item.percentage),
 provisionRate:
 outstandingAmount > 0 ? (provisionAmount / outstandingAmount) * 100 : num(item.provision_rate),
 };
 });

 const totalOutstanding = num(
 totals.outstanding_amount,
 rows.reduce((s, r) => s + r.outstandingAmount, 0)
 );
 const totalProvision = num(
 totals.provision_amount,
 rows.reduce((s, r) => s + r.provisionAmount, 0)
 );

 return { rows, totalOutstanding, totalProvision };
}
