"use client";

import { useEffect, useMemo, useState } from "react";
import {
 Bar,
 BarChart,
 CartesianGrid,
 Legend,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import type { DashboardBranchScope } from "@/lib/dashboard-analytics";

function formatYAxis(value: number) {
 if (value >= 1_000_000) {
 return `${(value / 1_000_000).toFixed(1)}M`;
 }
 if (value >= 1_000) {
 return `${(value / 1_000).toFixed(0)}K`;
 }
 return value.toString();
}

const tzs = (value: number) =>
 new Intl.NumberFormat("en-TZ", {
 style: "currency",
 currency: "TZS",
 minimumFractionDigits: 0,
 }).format(value);

const tipStyle = {
 backgroundColor: "var(--card)",
 border: "1px solid var(--border)",
 borderRadius: "8px",
 boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
 color: "var(--card-foreground)",
};

export function PortfolioChart({ branchScope }: { branchScope: DashboardBranchScope }) {
 const { branches } = useBranchAssignment();
 const [rows, setRows] = useState<{ name: string; outstanding: number; par: number }[]>([]);

 useEffect(() => {
 let cancelled = false;
 const params = new URLSearchParams();
 if (branchScope !== "all") params.set("branch_id", branchScope);
 void fetch(`/api/falco/dashboard/portfolio-by-product?${params.toString()}`)
 .then((r) => r.json())
 .then((json: { items?: Record<string, unknown>[] }) => {
 if (cancelled) return;
 const items = Array.isArray(json.items) ? json.items : [];
 setRows(
 items.map((it) => ({
 name: String(it.product_name ?? it.name ?? "Product"),
 outstanding: Number(it.outstanding_amount ?? 0),
 par: Number(it.par_amount ?? 0),
 }))
 );
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, [branchScope]);

 const scopeLabel = useMemo(
 () =>
 branchScope === "all"
 ? "All branches"
 : branches.find((b) => b.id === branchScope)?.name ?? "Branch",
 [branchScope, branches]
 );

 return (
 <Card className="flex h-full min-h-[22rem] flex-col overflow-hidden border border-border/70 shadow-sm xl:col-span-2">
 <CardHeader className="shrink-0 space-y-2 pb-3">
 <CardTitle className="text-lg">Outstanding by product</CardTitle>
 <CardDescription>
 Scoped to <span className="font-medium text-foreground">{scopeLabel}</span> — live portfolio mix.
 </CardDescription>
 </CardHeader>
 <CardContent className="flex flex-1 flex-col min-h-0 pb-4">
 <div className="relative min-h-[280px] w-full flex-1">
 <div className="absolute inset-0">
 <ResponsiveContainer width="100%" height="100%">
 <BarChart
 data={rows}
 barGap={4}
 margin={{ top: 16, right: 8, left: 4, bottom: 8 }}
 >
 <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
 <XAxis
 dataKey="name"
 tick={{ fontSize: 10 }}
 tickLine={false}
 axisLine={false}
 className="text-muted-foreground"
 interval={0}
 angle={-18}
 textAnchor="end"
 height={56}
 />
 <YAxis
 tickFormatter={formatYAxis}
 tick={{ fontSize: 11 }}
 tickLine={false}
 axisLine={false}
 className="text-muted-foreground"
 width={48}
 />
 <Tooltip formatter={(value: number) => tzs(value)} contentStyle={tipStyle} />
 <Legend iconType="rect" wrapperStyle={{ paddingTop: 8 }} />
 <Bar dataKey="outstanding" name="Outstanding" fill="hsl(185 55% 45%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
 <Bar dataKey="par" name="PAR" fill="hsl(0 72% 52%)" radius={[4, 4, 0, 0]} maxBarSize={36} />
 </BarChart>
 </ResponsiveContainer>
 </div>
 </div>
 </CardContent>
 </Card>
 );
}
