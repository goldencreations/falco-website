"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { LoanDetailPanel } from "@/components/loans/loan-detail-panel";
import { Button } from "@/components/ui/button";
import {
 extractCollectionActivitiesCount,
 extractCustomerFromLoanDetail,
 extractLoanDetail,
 extractScheduleList,
 type LoanListRow,
} from "@/lib/loan-adapters";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { extractPaymentsPayload, type PaymentViewRow } from "@/lib/payment-adapters";
import { resolvePortalPath } from "@/lib/portal-paths";
import type { Customer, RepaymentSchedule } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";

export default function LoanDetailPage() {
 const params = useParams<{ id: string }>();
 const loanId = typeof params?.id === "string" ? params.id : "";
 const { user } = useSessionUser();
 const loansListPath = resolvePortalPath(user?.role, "/loans");

 const [loan, setLoan] = useState<LoanListRow | null>(null);
 const [customer, setCustomer] = useState<Customer | null>(null);
 const [schedule, setSchedule] = useState<RepaymentSchedule[]>([]);
 const [payments, setPayments] = useState<PaymentViewRow[]>([]);
 const [collectionActivityCount, setCollectionActivityCount] = useState(0);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);

 useEffect(() => {
 if (!loanId) {
 setLoading(false);
 setLoadError("Missing loan id");
 return;
 }

 let cancelled = false;
 setLoading(true);
 setLoadError(null);

 const load = async () => {
 try {
 const [dRes, sRes, pRes, cRes] = await Promise.all([
          fetch(`/api/loans/${encodeURIComponent(loanId)}`, { cache: "no-store" }),
          fetch(`/api/loans/${encodeURIComponent(loanId)}/schedule`, { cache: "no-store" }),
          fetch(`/api/payments?loan_id=${encodeURIComponent(loanId)}&page_size=100`, {
            cache: "no-store",
          }),
          fetch(`/api/collections/activities?loan_id=${encodeURIComponent(loanId)}&page_size=100`, {
            cache: "no-store",
          }),
 ]);

 if (cancelled) return;

 if (!dRes.ok) {
 const j = await dRes.json().catch(() => ({}));
 throw new Error(typeof j.message === "string" ? j.message : "Failed to load loan");
 }

 const dJson = await dRes.json();
 const loanRow = extractLoanDetail(dJson);
 if (!loanRow) throw new Error("Loan not found");

 let cust = extractCustomerFromLoanDetail(dJson);
 const resolvedCid = loanRow.customer_id?.trim() || "";
 if (!cust && resolvedCid) {
            const cr = await fetch(`/api/customers/${encodeURIComponent(resolvedCid)}`, {
              cache: "no-store",
            });
 if (cr.ok) {
 const cj = await cr.json();
 const row = extractCustomerDetail(cj);
 if (row) cust = adaptApiCustomerRowToCustomer(row);
 }
 }

 if (cancelled) return;
 setLoan(loanRow);
 setCustomer(cust);

 if (sRes.ok) {
 const sj = await sRes.json();
 setSchedule(extractScheduleList(sj));
 } else {
 setSchedule([]);
 }

 if (pRes.ok) {
 const pj = await pRes.json();
 const paymentRows = extractPaymentsPayload(pj).payments.filter(
 (p) => p.loan_id === loanId || p.loan_id === loanRow.id
 );
 setPayments(paymentRows);
 const paidFromPayments = paymentRows
 .filter((p) => String(p.status ?? "").toLowerCase() === "completed")
 .reduce((sum, p) => sum + p.amount, 0);
 if (paidFromPayments > 0) {
 setLoan({
 ...loanRow,
 payments_recorded_total: paidFromPayments,
 total_paid: Math.max(loanRow.total_paid, paidFromPayments),
 payment_count: paymentRows.length,
 });
 }
 } else {
 setPayments([]);
 }

 if (cRes.ok) {
 const cj = await cRes.json();
 setCollectionActivityCount(extractCollectionActivitiesCount(cj));
 } else {
 setCollectionActivityCount(0);
 }
 } catch (e) {
 if (!cancelled) {
 setLoan(null);
 setLoadError(e instanceof Error ? e.message : "Failed to load loan");
 }
 } finally {
 if (!cancelled) setLoading(false);
 }
 };

 void load();
 return () => {
 cancelled = true;
 };
 }, [loanId]);

 return (
 <>
 <DashboardHeader
 title={loan ? `Loan ${loan.loan_number}` : "Loan details"}
 description="Customer, balances, repayment schedule, and payment history."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-4">
 <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
 <Link href={loansListPath}>
 <ArrowLeft className="mr-1.5 h-4 w-4" />
 Back to loans
 </Link>
 </Button>

 {loadError ? (
 <p className="text-sm text-destructive" role="alert">
 {loadError}
 </p>
 ) : null}

 {loading && !loan ? (
 <div className="flex items-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading loan details…
 </div>
 ) : loan ? (
 <LoanDetailPanel
 loan={loan}
 customer={customer}
 schedule={schedule}
 payments={payments}
 collectionActivityCount={collectionActivityCount}
 loading={loading}
 />
 ) : null}
 </div>
 </main>
 </>
 );
}
