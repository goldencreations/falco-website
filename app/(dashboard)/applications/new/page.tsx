import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import NewApplicationPageClient from "./new-application-client";

function NewApplicationPageFallback() {
  return (
    <>
      <DashboardHeader title="New Loan Application" description="Loading…" />
      <main className="min-h-0 flex-1 overflow-auto p-2 sm:p-3">
        <div className="rounded-lg border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
          Loading application form…
        </div>
      </main>
    </>
  );
}

export default function NewApplicationPage() {
  return (
    <Suspense fallback={<NewApplicationPageFallback />}>
      <NewApplicationPageClient />
    </Suspense>
  );
}
