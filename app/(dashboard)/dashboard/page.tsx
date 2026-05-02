import { DashboardHeader } from "@/components/dashboard-header";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { DashboardChartsPanel } from "@/components/dashboard/dashboard-charts-panel";
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
          <section className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-gradient-to-br from-slate-900/[0.04] via-primary/[0.06] to-emerald-600/[0.08] p-1 shadow-md ring-1 ring-emerald-950/5 dark:border-emerald-900/20 dark:from-emerald-950/30 dark:via-slate-900/50 dark:to-slate-950/80 dark:ring-emerald-900/20">
            <div className="grid gap-2 rounded-[0.875rem] bg-card/40 p-3 backdrop-blur-[2px] sm:grid-cols-3 sm:gap-3 lg:p-4 dark:bg-card/30">
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-emerald-50/90 via-card to-card p-3.5 shadow-sm ring-1 ring-emerald-600/10 transition-shadow hover:shadow-md dark:from-emerald-950/40 dark:via-card dark:to-slate-950/50 dark:ring-emerald-500/10">
                <div className="absolute right-0 top-0 h-16 w-16 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/10 blur-2xl" />
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Net position
                </p>
                <p className="relative mt-1.5 break-words text-2xl font-bold tabular-nums leading-tight tracking-tight text-foreground">
                  {formatCurrency(dashboardMetrics.collections_today - dashboardMetrics.expected_collections_today)}
                </p>
                <p className="relative mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Daily collection variance
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-sky-50/80 via-card to-card p-3.5 shadow-sm ring-1 ring-sky-500/10 transition-shadow hover:shadow-md dark:from-sky-950/35 dark:via-card dark:to-slate-950/50 dark:ring-sky-500/10">
                <div className="absolute right-0 top-0 h-16 w-16 translate-x-1/3 -translate-y-1/3 rounded-full bg-sky-500/10 blur-2xl" />
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Portfolio health
                </p>
                <p className="relative mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                  {dashboardMetrics.npl_ratio}% NPL
                </p>
                <p className="relative mt-2 flex items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  PAR monitored by risk class
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-teal-50/85 via-card to-card p-3.5 shadow-sm ring-1 ring-teal-500/10 transition-shadow hover:shadow-md dark:from-teal-950/35 dark:via-card dark:to-slate-950/50 dark:ring-teal-500/10 sm:col-span-1">
                <div className="absolute right-0 top-0 h-16 w-16 translate-x-1/3 -translate-y-1/3 rounded-full bg-teal-500/10 blur-2xl" />
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Outstanding book
                </p>
                <p className="relative mt-1.5 break-words text-2xl font-bold tabular-nums leading-tight tracking-tight text-foreground">
                  {formatCurrency(dashboardMetrics.total_portfolio)}
                </p>
                <p className="relative mt-2 flex items-center gap-1 text-xs font-medium text-teal-800 dark:text-teal-400">
                  <WalletCards className="h-3.5 w-3.5 shrink-0" />
                  {dashboardMetrics.active_loans} active loans
                </p>
              </div>
            </div>
          </section>

          <KPICards />

          <DashboardChartsPanel />

          <RecentActivity />

          <LoansAtRisk />
        </div>
      </main>
    </>
  );
}
