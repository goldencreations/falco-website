import { DashboardHeader } from "@/components/dashboard-header";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { AgingChart } from "@/components/dashboard/aging-chart";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { LoansAtRisk } from "@/components/dashboard/loans-at-risk";

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader
        title="Dashboard"
        description="Overview of loan portfolio and key metrics"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <KPICards />

          <div className="grid gap-6 lg:grid-cols-3">
            <PortfolioChart />
            <AgingChart />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivity />
          </div>

          <LoansAtRisk />
        </div>
      </main>
    </>
  );
}
