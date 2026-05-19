"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Label, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { DashboardBranchScope } from "@/lib/dashboard-analytics";
import { useBranchAssignment } from "@/components/branch-assignment-context";

const SEGMENT_STYLES: Record<string, { fill: string; stroke: string }> = {
 current: { fill: "hsl(152 55% 42%)", stroke: "hsl(152 55% 32%)" },
 especially_mentioned: { fill: "hsl(38 96% 52%)", stroke: "hsl(28 90% 44%)" },
 substandard: { fill: "hsl(280 55% 52%)", stroke: "hsl(280 50% 38%)" },
 doubtful: { fill: "hsl(0 72% 52%)", stroke: "hsl(0 65% 40%)" },
 loss: { fill: "hsl(220 10% 46%)", stroke: "hsl(220 12% 32%)" },
};

const LABELS: Record<string, string> = {
 current: "Current",
 especially_mentioned: "Watch",
 substandard: "Substandard",
 doubtful: "Doubtful",
 loss: "Loss",
};

const tipStyle = {
 backgroundColor: "var(--card)",
 border: "1px solid var(--border)",
 borderRadius: "8px",
 boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
 color: "var(--card-foreground)",
};

export function AgingChart({ branchScope }: { branchScope: DashboardBranchScope }) {
 const { branches } = useBranchAssignment();
 const [buckets, setBuckets] = useState<{ classification: string; outstanding_amount: number }[]>([]);

 useEffect(() => {
 let cancelled = false;
 const params = new URLSearchParams();
 if (branchScope !== "all") params.set("branch_id", branchScope);
 void fetch(`/api/falco/dashboard/aging-breakdown?${params.toString()}`)
 .then((r) => r.json())
 .then((json: { items?: Record<string, unknown>[]; buckets?: Record<string, unknown>[] }) => {
 if (cancelled) return;
 const raw = Array.isArray(json.items) ? json.items : json.buckets ?? [];
 setBuckets(
 (raw as Record<string, unknown>[]).map((row) => ({
 classification: String(row.classification ?? row.bucket ?? "current"),
 outstanding_amount: Number(row.outstanding_amount ?? row.amount ?? 0),
 }))
 );
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, [branchScope]);

 const pieData = buckets
 .filter((item) => item.outstanding_amount > 0)
 .map((item) => ({
 name: LABELS[item.classification] ?? item.classification,
 value: item.outstanding_amount,
 classification: item.classification,
 }));

 const totalOutstanding = buckets.reduce((sum, item) => sum + item.outstanding_amount, 0);

 const scopeLabel = useMemo(
 () =>
 branchScope === "all"
 ? "All branches"
 : branches.find((b) => b.id === branchScope)?.name ?? "Branch",
 [branchScope, branches]
 );

 return (
 <Card className="flex h-full min-h-0 flex-col border border-border/70 shadow-sm">
 <CardHeader className="pb-2">
 <CardTitle className="text-lg">Portfolio aging (BOT)</CardTitle>
 <CardDescription>
 Outstanding by risk bucket — <span className="font-medium text-foreground">{scopeLabel}</span>.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-5">
 <div className="relative w-full overflow-hidden rounded-xl border border-border/50 bg-muted/20 px-2 pt-4 sm:px-4">
 {pieData.length === 0 ? (
 <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
 No classified exposure in this scope.
 </div>
 ) : (
 <div className="h-[300px] w-full sm:h-[320px]">
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={pieData}
 dataKey="value"
 nameKey="name"
 cx="50%"
 cy="50%"
 innerRadius={68}
 outerRadius={96}
 paddingAngle={2}
 strokeWidth={1}
 labelLine={false}
 label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
 >
 {pieData.map((entry) => {
 const style = SEGMENT_STYLES[entry.classification] ?? SEGMENT_STYLES.current;
 return <Cell key={entry.name} fill={style.fill} stroke={style.stroke} />;
 })}
 <Label
 value={formatCurrency(totalOutstanding)}
 position="center"
 className="fill-foreground text-sm font-semibold"
 />
 </Pie>
 <Tooltip
 formatter={(value: number) => formatCurrency(value)}
 contentStyle={tipStyle}
 />
 <Legend verticalAlign="bottom" height={36} />
 </PieChart>
 </ResponsiveContainer>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 );
}
