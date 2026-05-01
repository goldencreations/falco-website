"use client";

import {
  Wallet,
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardMetrics, formatCurrency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const kpiData = [
  {
    title: "Total Portfolio",
    value: formatCurrency(dashboardMetrics.total_portfolio),
    change: "+12.5%",
    changeType: "positive" as const,
    icon: Wallet,
    description: `${dashboardMetrics.active_loans} active loans`,
    colorClass: "bg-kpi-portfolio",
    iconBgClass: "bg-kpi-portfolio/10",
    iconClass: "text-kpi-portfolio",
  },
  {
    title: "Collections Today",
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
    title: "PAR > 30 Days",
    value: formatCurrency(dashboardMetrics.par_over_90 + dashboardMetrics.par_31_90),
    change: `${dashboardMetrics.npl_ratio}%`,
    changeType: "negative" as const,
    icon: AlertTriangle,
    description: "Non-performing loans ratio",
    colorClass: "bg-kpi-risk",
    iconBgClass: "bg-kpi-risk/10",
    iconClass: "text-kpi-risk",
  },
  {
    title: "Pending Applications",
    value: dashboardMetrics.pending_applications.toString(),
    change: "2 new",
    changeType: "neutral" as const,
    icon: FileText,
    description: "Awaiting review",
    colorClass: "bg-kpi-applications",
    iconBgClass: "bg-kpi-applications/10",
    iconClass: "text-kpi-applications",
  },
  {
    title: "Total Customers",
    value: dashboardMetrics.total_customers.toString(),
    change: "+3",
    changeType: "positive" as const,
    icon: Users,
    description: "This month",
    colorClass: "bg-kpi-customers",
    iconBgClass: "bg-kpi-customers/10",
    iconClass: "text-kpi-customers",
  },
  {
    title: "Disbursements MTD",
    value: formatCurrency(dashboardMetrics.disbursements_this_month),
    change: "+8.2%",
    changeType: "positive" as const,
    icon: TrendingUp,
    description: "vs last month",
    colorClass: "bg-kpi-disbursements",
    iconBgClass: "bg-kpi-disbursements/10",
    iconClass: "text-kpi-disbursements",
  },
];

export function KPICards() {
  return (
    <>
      <Card className="border border-border/70 bg-card/95 shadow-sm md:hidden">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Dashboard Summary</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Live Metrics
            </span>
          </div>

          <div className="space-y-2">
            {kpiData.map((kpi) => (
              <div
                key={kpi.title}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", kpi.iconBgClass)}>
                    <kpi.icon className={cn("h-4 w-4", kpi.iconClass)} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {kpi.title}
                    </p>
                    <p className="truncate text-sm font-semibold">{kpi.value}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  {kpi.changeType === "positive" ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                      <ArrowUpRight className="h-3 w-3" />
                      {kpi.change}
                    </span>
                  ) : kpi.changeType === "negative" ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                      <ArrowDownRight className="h-3 w-3" />
                      {kpi.change}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                      <TrendingUp className="h-3 w-3" />
                      {kpi.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiData.map((kpi) => (
          <Card
            key={kpi.title}
            className="group relative overflow-hidden border border-border/70 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={cn("absolute left-0 right-0 top-0 h-1.5", kpi.colorClass)} />
            <div className={cn("absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.06]", kpi.colorClass)} />
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                </div>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-border/40",
                    kpi.iconBgClass
                  )}
                >
                  <kpi.icon className={cn("h-5 w-5", kpi.iconClass)} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs">
                {kpi.changeType === "positive" ? (
                  <span className="flex items-center gap-0.5 text-success font-medium">
                    <ArrowUpRight className="h-3 w-3" />
                    {kpi.change}
                  </span>
                ) : kpi.changeType === "negative" ? (
                  <span className="flex items-center gap-0.5 text-destructive font-medium">
                    <ArrowDownRight className="h-3 w-3" />
                    {kpi.change}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-info font-medium">
                    <TrendingUp className="h-3 w-3" />
                    {kpi.change}
                  </span>
                )}
                <span className="text-muted-foreground">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
