"use client";

import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { DisbursementCreateForm } from "@/components/disbursements/disbursement-create-form";

function NewDisbursementFormFallback() {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
      Loading create form…
    </div>
  );
}

export default function NewDisbursementPage() {
  return (
    <>
      <DashboardHeader
        title="Create disbursement"
        description="Submit a payout for approval."
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6 lg:pb-8">
        <div className="mx-auto w-full max-w-7xl">
          <Suspense fallback={<NewDisbursementFormFallback />}>
            <DisbursementCreateForm />
          </Suspense>
        </div>
      </main>
    </>
  );
}
