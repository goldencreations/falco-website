"use client";

import type { ReactNode } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDisbursementsVsCollectionsSeries,
  getPortfolioTrendSeries,
  type DashboardBranchScope,
} from "@/lib/dashboard-analytics";
import { branches } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

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
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

function MiniSparkBars({
  values,
  colorClass,
}: {
  values: number[];
  colorClass: string;
}) {
  const max = Math.max(...values, 1);
  const barMaxPx = 36;
  return (
    <div className="mt-2 flex h-9 items-end gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("flex-1 rounded-sm", colorClass)}
          style={{ height: `${Math.max(4, Math.round((v / max) * barMaxPx))}px` }}
          title={tzs(v)}
        />
      ))}
    </div>
  );
}

/**
 * Renders a bar chart in a box that grows with the card (grid row) so we do not
 * leave a dead band under the graph when the adjacent aging card is taller.
 */
function FilledBarChart({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-[280px] w-full flex-1">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PortfolioChart({ branchScope }: { branchScope: DashboardBranchScope }) {
  const disbursementData = getDisbursementsVsCollectionsSeries(branchScope);
  const portfolioTrend = getPortfolioTrendSeries(branchScope);

  const latestDisbursements = disbursementData[disbursementData.length - 1];
  const latestPortfolio = portfolioTrend[portfolioTrend.length - 1];

  const disbSeries = disbursementData.map((d) => d.disbursements);
  const collSeries = disbursementData.map((d) => d.collections);
  const bookSeries = portfolioTrend.map((d) => d.outstanding);
  const parSeries = portfolioTrend.map((d) => d.atRisk);

  const scopeLabel =
    branchScope === "all"
      ? "All branches"
      : branches.find((b) => b.id === branchScope)?.name ?? "Branch";

  return (
    <Card className="flex h-full min-h-[22rem] flex-col overflow-hidden border border-border/70 shadow-sm xl:col-span-2">
      <CardHeader className="shrink-0 space-y-4 pb-3">
        <div>
          <CardTitle className="text-lg">Lending & collections activity</CardTitle>
          <CardDescription>
            Scoped to <span className="font-medium text-foreground">{scopeLabel}</span>. Mock series — replace with
            ledger API when connected.
          </CardDescription>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
              Latest disbursement
            </p>
            <p className="mt-1 break-words text-base font-bold tabular-nums leading-tight tracking-tight">
              {tzs(latestDisbursements.disbursements)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">6‑month track</p>
            <MiniSparkBars values={disbSeries} colorClass="bg-[hsl(185_55%_42%)]/90" />
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
              Latest collections
            </p>
            <p className="mt-1 break-words text-base font-bold tabular-nums leading-tight tracking-tight">
              {tzs(latestDisbursements.collections)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">6‑month track</p>
            <MiniSparkBars values={collSeries} colorClass="bg-[hsl(152_55%_42%)]/90" />
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
              Book vs at‑risk (period end)
            </p>
            <p className="mt-1 break-words text-base font-bold tabular-nums leading-tight tracking-tight">
              {tzs(latestPortfolio.outstanding)} · PAR {tzs(latestPortfolio.atRisk)}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
              <span>Outstanding</span>
              <span>PAR</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniSparkBars values={bookSeries} colorClass="bg-[hsl(185_55%_45%)]/85" />
              <MiniSparkBars values={parSeries} colorClass="bg-[hsl(0_72%_52%)]/85" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col min-h-0 pt-0 pb-4">
        <Tabs defaultValue="disbursements" className="flex flex-1 flex-col gap-3 min-h-0">
          <TabsList className="grid h-auto w-full max-w-lg shrink-0 grid-cols-2 gap-1 p-1">
            <TabsTrigger value="disbursements" className="touch-manipulation text-xs sm:text-sm">
              Disbursements vs collections
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="touch-manipulation text-xs sm:text-sm">
              Outstanding vs PAR trend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disbursements" className="mt-0 flex flex-1 flex-col outline-none data-[state=inactive]:hidden">
            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/40 bg-muted/10">
              <FilledBarChart>
                <BarChart
                  data={disbursementData}
                  barGap={3}
                  barCategoryGap="18%"
                  margin={{ top: 16, right: 8, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
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
                  <Bar
                    dataKey="disbursements"
                    name="Disbursements"
                    fill="hsl(185 55% 45%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="collections"
                    name="Collections"
                    fill="hsl(152 55% 42%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                  <Bar
                    dataKey="expected"
                    name="Expected collections"
                    fill="hsl(38 92% 50%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                    opacity={0.9}
                  />
                </BarChart>
              </FilledBarChart>
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="mt-0 flex flex-1 flex-col outline-none data-[state=inactive]:hidden">
            <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border/40 bg-muted/10">
              <FilledBarChart>
                <BarChart
                  data={portfolioTrend}
                  barGap={4}
                  barCategoryGap="22%"
                  margin={{ top: 16, right: 8, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
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
                  <Bar
                    dataKey="outstanding"
                    name="Outstanding book"
                    fill="hsl(185 55% 45%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="atRisk"
                    name="Portfolio at risk (PAR)"
                    fill="hsl(0 72% 52%)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </FilledBarChart>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
