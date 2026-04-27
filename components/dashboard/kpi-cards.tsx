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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpiData.map((kpi) => (
        <Card key={kpi.title} className="relative overflow-hidden border-0 shadow-sm">
          {/* Top color bar */}
          <div className={cn("absolute top-0 left-0 right-0 h-1", kpi.colorClass)} />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {kpi.title}
                </p>
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", kpi.iconBgClass)}>
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
  );
}
