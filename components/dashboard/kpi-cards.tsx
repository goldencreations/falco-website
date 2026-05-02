"use client";

import { useState } from "react";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dashboardMetrics, formatCurrency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/** Activity-oriented labels — avoids duplicating “total portfolio” from the hero strip. */
const kpiData = [
  {
    title: "Cash collected today",
    value: formatCurrency(dashboardMetrics.collections_today),
    change: `${dashboardMetrics.collection_rate}%`,
    changeType: "positive" as const,
    icon: CreditCard,
    description: `of ${formatCurrency(dashboardMetrics.expected_collections_today)} expected`,
    colorClass: "bg-kpi-collections",
    iconBgClass: "bg-kpi-collections/10",
    iconClass: "text-kpi-collections",
  },
  {
    title: "At-risk exposure (PAR)",
    value: formatCurrency(dashboardMetrics.par_over_90 + dashboardMetrics.par_31_90),
    change: `${dashboardMetrics.npl_ratio}% NPL`,
    changeType: "negative" as const,
    icon: AlertTriangle,
    description: "non-performing vs book",
    colorClass: "bg-kpi-risk",
    iconBgClass: "bg-kpi-risk/10",
    iconClass: "text-kpi-risk",
  },
  {
    title: "Applications in pipeline",
    value: dashboardMetrics.pending_applications.toString(),
    change: "2 new",
    changeType: "neutral" as const,
    icon: FileText,
    description: "awaiting decision",
    colorClass: "bg-kpi-applications",
    iconBgClass: "bg-kpi-applications/10",
    iconClass: "text-kpi-applications",
  },
  {
    title: "Registered customers",
    value: dashboardMetrics.total_customers.toString(),
    change: "+3",
    changeType: "positive" as const,
    icon: Users,
    description: "active relationships",
    colorClass: "bg-kpi-customers",
    iconBgClass: "bg-kpi-customers/10",
    iconClass: "text-kpi-customers",
  },
  {
    title: "Disbursements (MTD)",
    value: formatCurrency(dashboardMetrics.disbursements_this_month),
    change: "+8.2%",
    changeType: "positive" as const,
    icon: TrendingUp,
    description: "vs prior month",
    colorClass: "bg-kpi-disbursements",
    iconBgClass: "bg-kpi-disbursements/10",
    iconClass: "text-kpi-disbursements",
  },
];

function DotGrid() {
  return (
    <div
      className="mt-3 grid w-full max-w-[9rem] grid-cols-8 gap-1.5 opacity-[0.35]"
      aria-hidden
    >
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-primary/40" />
      ))}
    </div>
  );
}

type Period = "today" | "week" | "all";

export function KPICards() {
  const [period, setPeriod] = useState<Period>("today");

  const primary = kpiData[0];
  const gridMetrics = kpiData.slice(1, 5);

  return (
    <>
      {/* Mobile: split hero + 2×2 grid (reference layout) */}
      <Card className="overflow-hidden border border-border/70 bg-card/95 shadow-sm @container/kpi md:hidden">
        <CardContent className="space-y-4 p-4">
          <div className="flex gap-2">
            {(
              [
                { id: "today" as const, label: "Today" },
                { id: "week" as const, label: "This week" },
                { id: "all" as const, label: "All time" },
              ] as const
            ).map(({ id, label }) => (
              <Button
                key={id}
                type="button"
                variant={period === id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-9 flex-1 touch-manipulation rounded-full px-2 text-xs font-medium",
                  period === id && "shadow-sm"
                )}
                onClick={() => setPeriod(id)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/35 p-4">
            <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-[minmax(0,44%)_minmax(0,56%)] min-[400px]:items-start">
              {/* Primary metric */}
              <div className="flex min-w-0 flex-col justify-between gap-2 border-b border-border/40 pb-4 min-[400px]:border-b-0 min-[400px]:pb-0 min-[400px]:pr-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-normal uppercase tracking-[0.12em] text-muted-foreground">
                    {primary.title}
                  </p>
                  <p className="mt-1.5 block w-full min-w-0 whitespace-nowrap font-bold leading-none tracking-tight text-primary tabular-nums text-[clamp(1.125rem,calc(5.5cqw+0.55rem),2rem)]">
                    {primary.value}
                  </p>
                  <p className="mt-2 text-xs leading-snug text-muted-foreground">
                    <span className="font-semibold text-success">{primary.change}</span>{" "}
                    {primary.description}
                  </p>
                  <p className="mt-1 text-[11px] capitalize text-muted-foreground/80">
                    {period === "today" ? "Today" : period === "week" ? "This week" : "All time"} view
                  </p>
                </div>
                <DotGrid />
              </div>

              {/* 2×2 metrics */}
              <div className="grid grid-cols-2 gap-2">
                {gridMetrics.map((kpi) => {
                  const isAlert = kpi.changeType === "negative";
                  return (
                    <div
                      key={kpi.title}
                      className={cn(
                        "@container/cell flex min-w-0 flex-col items-center rounded-xl border bg-background px-1.5 py-3 text-center shadow-sm",
                        isAlert
                          ? "border-destructive/25 bg-destructive/[0.04]"
                          : "border-border/60"
                      )}
                    >
                      <kpi.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isAlert ? "text-destructive" : kpi.iconClass
                        )}
                        aria-hidden
                      />
                      <p
                        className={cn(
                          "mx-auto mt-2 block w-full max-w-full min-w-0 whitespace-nowrap px-0.5 text-center font-bold tabular-nums leading-none text-[clamp(0.875rem,calc(13cqw+0.45rem),1.125rem)]",
                          isAlert ? "text-destructive" : "text-foreground"
                        )}
                      >
                        {kpi.value}
                      </p>
                      <p
                        className={cn(
                          "mt-1 line-clamp-2 text-[9px] font-normal leading-snug",
                          isAlert ? "text-destructive/85" : "text-muted-foreground"
                        )}
                      >
                        {kpi.title}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {kpi.change} · {kpi.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpiData.map((kpi) => (
          <Card
            key={kpi.title}
            className="group @container relative overflow-visible border border-border/70 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={cn("absolute left-0 right-0 top-0 h-1.5 rounded-t-xl", kpi.colorClass)} />
            <div
              className={cn(
                "pointer-events-none absolute inset-0 rounded-xl opacity-[0.03] transition-opacity group-hover:opacity-[0.06]",
                kpi.colorClass
              )}
            />
            <CardContent className="overflow-visible pt-5 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[10px] font-normal uppercase leading-tight tracking-[0.12em] text-muted-foreground">
                    {kpi.title}
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-[clamp(1.125rem,calc(4.5cqw+0.45rem),1.875rem)] font-bold tabular-nums leading-none tracking-tight text-foreground">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-border/40",
                    kpi.iconBgClass
                  )}
                >
                  <kpi.icon className={cn("h-5 w-5", kpi.iconClass)} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs leading-snug">
                {kpi.changeType === "positive" ? (
                  <span className="flex shrink-0 items-center gap-0.5 font-medium text-success">
                    <ArrowUpRight className="h-3 w-3" />
                    {kpi.change}
                  </span>
                ) : kpi.changeType === "negative" ? (
                  <span className="flex shrink-0 items-center gap-0.5 font-medium text-destructive">
                    <ArrowDownRight className="h-3 w-3" />
                    {kpi.change}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-0.5 font-medium text-info">
                    <TrendingUp className="h-3 w-3" />
                    {kpi.change}
                  </span>
                )}
                <span className="min-w-0 text-muted-foreground">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
