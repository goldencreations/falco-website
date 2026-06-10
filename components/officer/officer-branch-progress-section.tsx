"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  HandCoins,
  MapPin,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import {
  buildOfficerDashboardMetrics,
  lastSixMonthRange,
  mapTimeseriesPoints,
  officerDashboardFallback,
  type OfficerDashboardMetrics,
} from "@/lib/officer-dashboard-metrics";
import { formatCurrency } from "@/lib/formatters";

const tipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  color: "var(--card-foreground)",
};

type Props = {
  branchId: string;
  officerId: string;
};

export function OfficerBranchProgressSection({ branchId, officerId }: Props) {
  const [metrics, setMetrics] = useState<OfficerDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId || !officerId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { from, to } = lastSixMonthRange();
      const params = new URLSearchParams({ branch_id: branchId });

      let branchName = branchId;
      let zoneName = "—";
      let portfolioSummary: Record<string, unknown> | null = null;
      let disbursementSeries = mapTimeseriesPoints([]);
      let collectionSeries = mapTimeseriesPoints([]);
      let loans: LoanListRow[] = [];
      let apiOk = false;

      try {
        const [branchRes, portfolioRes, disbRes, collRes, loansRes] = await Promise.all([
          fetch("/api/falco/branches", { credentials: "include" }),
          fetch(`/api/reports/portfolio-summary?${params.toString()}`, { credentials: "include" }),
          fetch(
            `/api/falco/dashboard/timeseries?${new URLSearchParams({
              branch_id: branchId,
              metric: "disbursements",
              from,
              to,
            }).toString()}`,
            { credentials: "include" }
          ),
          fetch(
            `/api/falco/dashboard/timeseries?${new URLSearchParams({
              branch_id: branchId,
              metric: "collections",
              from,
              to,
            }).toString()}`,
            { credentials: "include" }
          ),
          fetch(`/api/loans?${new URLSearchParams({ branch_id: branchId, page_size: "500" }).toString()}`, {
            credentials: "include",
          }),
        ]);

        if (branchRes.ok) {
          const bJson = (await branchRes.json()) as { branches?: Array<{ id: string; name: string; region?: string }> };
          const match = (bJson.branches ?? []).find((b) => b.id === branchId);
          if (match) {
            branchName = match.name;
            zoneName = match.region ?? "—";
          }
        }

        if (portfolioRes.ok) {
          portfolioSummary = (await portfolioRes.json()) as Record<string, unknown>;
          apiOk = true;
        }

        if (disbRes.ok) {
          const dJson = (await disbRes.json()) as { points?: Array<{ period?: string; amount?: number }> };
          disbursementSeries = mapTimeseriesPoints(dJson.points);
          apiOk = true;
        }

        if (collRes.ok) {
          const cJson = (await collRes.json()) as { points?: Array<{ period?: string; amount?: number }> };
          collectionSeries = mapTimeseriesPoints(cJson.points);
          apiOk = true;
        }

        if (loansRes.ok) {
          const lJson = await loansRes.json();
          loans = extractLoansList(lJson);
          apiOk = true;
        }
      } catch {
        apiOk = false;
      }

      if (cancelled) return;

      const built =
        apiOk && (portfolioSummary || loans.length > 0)
          ? buildOfficerDashboardMetrics({
              branchId,
              branchName,
              zoneName,
              portfolioSummary,
              disbursementSeries,
              collectionSeries,
              loans,
              usingFallback: false,
            })
          : officerDashboardFallback(branchId, branchName, zoneName);

      setMetrics(built);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [branchId, officerId]);

  if (loading || !metrics) {
    return (
      <section className="space-y-4">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Loading branch progress for your assigned customers…
          </CardContent>
        </Card>
      </section>
    );
  }

  const { branch, trend, disbursementByMonth, defaultedByMonth, defaultComparison } = metrics;
  const disbProgress = branch.totalDisbursed > 0 ? 100 : 0;
  const collProgress = Math.min(100, branch.collectionPercentage);
  const changeUp = defaultComparison.changeAmount >= 0;

  return (
    <section className="space-y-4">
      {metrics.usingFallback ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Showing sample branch progress layout. Live figures appear when portfolio and loan APIs return data
          for your assigned customers.
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-emerald-600" />
            Branch progress — assigned customers only
          </CardTitle>
          <CardDescription>
            Disbursement and collection performance for your current branch portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{branch.branchName}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Zone / area: {branch.zoneName}
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Your portfolio
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total disbursed</p>
                <p className="text-lg font-semibold">{formatCurrency(branch.totalDisbursed)}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total collected</p>
                <p className="text-lg font-semibold text-emerald-700">{formatCurrency(branch.totalCollected)}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Expected collection</p>
                <p className="text-lg font-semibold">{formatCurrency(branch.expectedCollection)}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Defaulted amount</p>
                <p className="text-lg font-semibold text-red-700">{formatCurrency(branch.defaultedAmount)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <HandCoins className="h-3.5 w-3.5" />
                  Total disbursement by branch
                </span>
                <span className="font-medium">{formatCurrency(branch.totalDisbursed)}</span>
              </div>
              <Progress value={disbProgress} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Collection progress by branch
                </span>
                <span className="font-medium">{collProgress.toFixed(1)}%</span>
              </div>
              <Progress value={collProgress} className="h-2" />
              <p className="text-[11px] text-muted-foreground">
                {formatCurrency(branch.totalCollected)} collected of {formatCurrency(branch.expectedCollection)}{" "}
                expected
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Collection & disbursement trend
            </CardTitle>
            <CardDescription>Monthly progress for your assigned customers (last 6 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tipStyle} />
                <Legend />
                <Line type="monotone" dataKey="disbursements" name="Disbursements" stroke="#0d9488" strokeWidth={2} />
                <Line type="monotone" dataKey="collections" name="Collections" stroke="#0891b2" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Disbursement by branch & month</CardTitle>
            <CardDescription>{branch.branchName} — monthly disbursements</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={disbursementByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tipStyle} />
                <Bar dataKey="amount" name="Disbursed" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Defaulted amount by branch & month
            </CardTitle>
            <CardDescription>Outstanding exposure on defaulted loans in your portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={defaultedByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tipStyle} />
                <Bar dataKey="amount" name="Defaulted" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Defaulted comparison</CardTitle>
            <CardDescription>Current month vs previous month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{defaultComparison.currentLabel} (current)</p>
              <p className="text-xl font-semibold text-red-700">{formatCurrency(defaultComparison.currentMonth)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{defaultComparison.previousLabel} (previous)</p>
              <p className="text-xl font-semibold">{formatCurrency(defaultComparison.previousMonth)}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm">
              {changeUp ? (
                <ArrowUpRight className="h-4 w-4 text-red-600" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-emerald-600" />
              )}
              <span>
                {changeUp ? "+" : ""}
                {formatCurrency(defaultComparison.changeAmount)} ({defaultComparison.changePercent.toFixed(1)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
