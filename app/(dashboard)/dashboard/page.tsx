import { DashboardHeader } from "@/components/dashboard-header";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { AgingChart } from "@/components/dashboard/aging-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LoansAtRisk } from "@/components/dashboard/loans-at-risk";
import { dashboardMetrics, formatCurrency } from "@/lib/mock-data";
import { ArrowUpRight, ShieldCheck, WalletCards } from "lucide-react";

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader
        title="Dashboard"
        description="Overview of loan portfolio and key metrics"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 via-background to-success/10 p-4 shadow-sm lg:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/50 bg-background/80 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Net Position</p>
                <p className="mt-1 text-xl font-bold">
                  {formatCurrency(dashboardMetrics.collections_today - dashboardMetrics.expected_collections_today)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-success">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Daily collection variance
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/80 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Portfolio Health</p>
                <p className="mt-1 text-xl font-bold">{dashboardMetrics.npl_ratio}% NPL</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-info">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  PAR monitored by risk class
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-background/80 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Portfolio</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(dashboardMetrics.total_portfolio)}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                  <WalletCards className="h-3.5 w-3.5" />
                  {dashboardMetrics.active_loans} active loans
                </p>
              </div>
            </div>
          </section>

          <KPICards />

          <div className="grid gap-6 xl:grid-cols-3">
            <PortfolioChart />
            <AgingChart />
          </div>

          <RecentActivity />

          <LoansAtRisk />
        </div>
      </main>
    </>
  );
}
