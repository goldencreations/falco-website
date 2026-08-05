import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import ReportsPageClient from "./reports-page-client";

function ReportsPageFallback() {
  return (
    <>
      <DashboardHeader title="Reports" description="Loading…" />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="rounded-lg border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
          Loading reports…
        </div>
      </main>
    </>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<ReportsPageFallback />}>
      <ReportsPageClient />
    </Suspense>
  );
}
