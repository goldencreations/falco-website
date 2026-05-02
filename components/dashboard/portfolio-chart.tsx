"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const disbursementData = [
  { month: "Aug", disbursements: 12500000, collections: 8200000 },
  { month: "Sep", disbursements: 15800000, collections: 11500000 },
  { month: "Oct", disbursements: 18200000, collections: 14800000 },
  { month: "Nov", disbursements: 14500000, collections: 13200000 },
  { month: "Dec", disbursements: 11200000, collections: 12800000 },
  { month: "Jan", disbursements: 800000, collections: 2915556 },
];

const portfolioTrend = [
  { month: "Aug", portfolio: 45000000, par: 3200000 },
  { month: "Sep", portfolio: 52000000, par: 4100000 },
  { month: "Oct", portfolio: 58000000, par: 3800000 },
  { month: "Nov", portfolio: 54000000, par: 4500000 },
  { month: "Dec", portfolio: 48000000, par: 3952000 },
  { month: "Jan", portfolio: 15866000, par: 3952000 },
];

function formatYAxis(value: number) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

export function PortfolioChart() {
  const latestDisbursements = disbursementData[disbursementData.length - 1];
  const latestPortfolio = portfolioTrend[portfolioTrend.length - 1];

  return (
    <Card className="xl:col-span-2 border border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Portfolio Performance</CardTitle>
        <CardDescription>Monthly disbursements, collections, and portfolio trends</CardDescription>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Latest Disbursement</p>
            <p className="text-sm font-semibold">
              {new Intl.NumberFormat("en-TZ", {
                style: "currency",
                currency: "TZS",
                maximumFractionDigits: 0,
              }).format(latestDisbursements.disbursements)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Latest Collection</p>
            <p className="text-sm font-semibold">
              {new Intl.NumberFormat("en-TZ", {
                style: "currency",
                currency: "TZS",
                maximumFractionDigits: 0,
              }).format(latestDisbursements.collections)}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Portfolio at Month End</p>
            <p className="text-sm font-semibold">
              {new Intl.NumberFormat("en-TZ", {
                style: "currency",
                currency: "TZS",
                maximumFractionDigits: 0,
              }).format(latestPortfolio.portfolio)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="disbursements" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="disbursements">
              Disbursements vs Collections
            </TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio Trend</TabsTrigger>
          </TabsList>

          <TabsContent value="disbursements" className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={disbursementData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("en-TZ", {
                      style: "currency",
                      currency: "TZS",
                      minimumFractionDigits: 0,
                    }).format(value)
                  }
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                <Bar
                  dataKey="disbursements"
                  name="Disbursements"
                  fill="hsl(var(--chart-1))"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="collections"
                  name="Collections"
                  fill="hsl(var(--chart-2))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="portfolio" className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={portfolioTrend}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="parGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("en-TZ", {
                      style: "currency",
                      currency: "TZS",
                      minimumFractionDigits: 0,
                    }).format(value)
                  }
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend 
                  iconType="circle"
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                <Area
                  type="monotone"
                  dataKey="portfolio"
                  name="Total Portfolio"
                  stroke="hsl(var(--chart-1))"
                  fill="url(#portfolioGradient)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="par"
                  name="Portfolio at Risk"
                  stroke="hsl(var(--chart-4))"
                  fill="url(#parGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
