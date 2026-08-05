import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import NewCustomerPageClient from "./new-customer-client";

function NewCustomerPageFallback() {
  return (
    <>
      <DashboardHeader title="New Customer" description="Loading…" />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="rounded-lg border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
          Loading customer form…
        </div>
      </main>
    </>
  );
}

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<NewCustomerPageFallback />}>
      <NewCustomerPageClient />
    </Suspense>
  );
}
