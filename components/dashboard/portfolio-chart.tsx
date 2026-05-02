"use client";

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

/** Fixed px height — Recharts ResponsiveContainer often renders 0px with height="100%" inside tabs. */
const CHART_H = 260;

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
    <Card className="overflow-hidden border border-border/70 shadow-sm xl:col-span-2">
      <CardHeader className="space-y-4 pb-3">
        <div>
          <CardTitle className="text-lg">Lending & collections activity</CardTitle>
          <CardDescription>
            Scoped to <span className="font-medium text-foreground">{scopeLabel}</span>. Mock series — replace with
            ledger API when connected.
          </CardDescription>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Latest disbursement
            </p>
            <p className="mt-1 break-words text-sm font-semibold tabular-nums leading-snug">
              {tzs(latestDisbursements.disbursements)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">6‑month track</p>
            <MiniSparkBars values={disbSeries} colorClass="bg-[hsl(185_55%_42%)]/90" />
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Latest collections
            </p>
            <p className="mt-1 break-words text-sm font-semibold tabular-nums leading-snug">
              {tzs(latestDisbursements.collections)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">6‑month track</p>
            <MiniSparkBars values={collSeries} colorClass="bg-[hsl(152_55%_42%)]/90" />
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Book vs at‑risk (period end)
            </p>
            <p className="mt-1 break-words text-sm font-semibold tabular-nums leading-snug">
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
      <CardContent className="pt-0">
        <Tabs defaultValue="disbursements" className="flex flex-col gap-3">
          <TabsList className="grid h-auto w-full max-w-lg grid-cols-2 gap-1 p-1">
            <TabsTrigger value="disbursements" className="touch-manipulation text-xs sm:text-sm">
              Disbursements vs collections
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="touch-manipulation text-xs sm:text-sm">
              Outstanding vs PAR trend
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disbursements" className="flex-none outline-none">
            <div
              className="w-full rounded-lg border border-border/40 bg-muted/10"
              style={{ height: CHART_H }}
            >
              <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart
                data={disbursementData}
                barGap={3}
                barCategoryGap="18%"
                margin={{ top: 16, right: 8, left: 4, bottom: 4 }}
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
            </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="flex-none outline-none">
            <div
              className="w-full rounded-lg border border-border/40 bg-muted/10"
              style={{ height: CHART_H }}
            >
              <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart
                data={portfolioTrend}
                barGap={4}
                barCategoryGap="22%"
                margin={{ top: 16, right: 8, left: 4, bottom: 4 }}
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
            </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
