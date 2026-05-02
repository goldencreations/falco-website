"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, branches } from "@/lib/mock-data";
import { getAgingBucketsForScope, type DashboardBranchScope } from "@/lib/dashboard-analytics";

/**
 * Distinct segment fills so each BOT bucket reads clearly (not one blended hue).
 * Falls back to theme chart tokens where possible.
 */
const SEGMENT_STYLES: Record<
  string,
  { fill: string; stroke: string }
> = {
  current: {
    fill: "hsl(152 55% 42%)",
    stroke: "hsl(152 55% 32%)",
  },
  especially_mentioned: {
    fill: "hsl(38 96% 52%)",
    stroke: "hsl(28 90% 44%)",
  },
  substandard: {
    fill: "hsl(280 55% 52%)",
    stroke: "hsl(280 50% 38%)",
  },
  doubtful: {
    fill: "hsl(0 72% 52%)",
    stroke: "hsl(0 65% 40%)",
  },
  loss: {
    fill: "hsl(220 10% 46%)",
    stroke: "hsl(220 12% 32%)",
  },
};

const tipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export function AgingChart({ branchScope }: { branchScope: DashboardBranchScope }) {
  const buckets = getAgingBucketsForScope(branchScope);
  const pieData = buckets
    .filter((item) => item.outstanding_amount > 0)
    .map((item) => ({
      name: item.label,
      value: item.outstanding_amount,
      classification: item.classification,
    }));

  const totalOutstanding = buckets.reduce((sum, item) => sum + item.outstanding_amount, 0);

  const scopeLabel =
    branchScope === "all"
      ? "All branches"
      : branches.find((b) => b.id === branchScope)?.name ?? "Branch";

  return (
    <Card className="flex h-full min-h-0 flex-col border border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Portfolio aging (BOT)</CardTitle>
        <CardDescription>
          Outstanding by risk bucket from the loan register —{" "}
          <span className="font-medium text-foreground">{scopeLabel}</span>.
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
                <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="48%"
                    innerRadius={68}
                    outerRadius={108}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={2}
                    cornerRadius={3}
                  >
                    {pieData.map((entry) => {
                      const s = SEGMENT_STYLES[entry.classification] ?? {
                        fill: "hsl(var(--chart-1))",
                        stroke: "hsl(var(--border))",
                      };
                      return <Cell key={entry.classification} fill={s.fill} stroke={s.stroke} />;
                    })}
                  </Pie>
                  <text
                    x="50%"
                    y="44%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    Total exposure
                  </text>
                  <text
                    x="50%"
                    y="54%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-sm font-semibold"
                  >
                    {formatCurrency(totalOutstanding)}
                  </text>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={tipStyle}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ paddingTop: 12, paddingBottom: 8 }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">Breakdown</p>
          {buckets.map((item) => {
            const seg = SEGMENT_STYLES[item.classification];
            return (
              <div
                key={item.classification}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/50 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
                    style={{
                      backgroundColor: seg?.fill ?? "hsl(var(--chart-1))",
                    }}
                  />
                  <span className="truncate font-medium text-foreground">{item.label}</span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-4">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {item.loan_count} loans · {item.percentage}%
                  </span>
                  <span className="min-w-[7rem] text-right font-semibold tabular-nums">
                    {formatCurrency(item.outstanding_amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
