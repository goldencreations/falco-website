"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import {
 findClickPesaBillPayReference,
 registrationFeeProgress,
} from "@/lib/registration-fee";
import { formatCurrency } from "@/lib/formatters";

type Props = {
 customerId: string;
 customersBasePath: string;
 onPaid?: () => void;
};

export function CustomerRegistrationFeePanel({
 customerId,
 customersBasePath,
 onPaid,
}: Props) {
 const [customer, setCustomer] = useState<Record<string, unknown> | null>(null);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const loadCustomer = useCallback(async () => {
 setError(null);
 try {
  const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
   cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) {
   throw new Error("Could not load customer payment status.");
  }
  const row = extractCustomerDetail(body);
  if (!row) throw new Error("Customer payment details could not be loaded.");
  setCustomer(row as unknown as Record<string, unknown>);
  return row as unknown as Record<string, unknown>;
 } catch (loadError) {
  setError(loadError instanceof Error ? loadError.message : "Could not refresh payment status.");
  return null;
 } finally {
  setLoading(false);
  setRefreshing(false);
 }
 }, [customerId]);

 useEffect(() => {
 void loadCustomer();
 }, [loadCustomer]);

 const progress = registrationFeeProgress(customer);
 const billPay = findClickPesaBillPayReference(customer);

 useEffect(() => {
  if (!progress.completed) return;
  onPaid?.();
 }, [progress.completed, onPaid]);

 useEffect(() => {
  if (progress.completed) return;
  const timer = window.setInterval(() => {
   void loadCustomer();
  }, 7000);
  return () => window.clearInterval(timer);
 }, [loadCustomer, progress.completed]);

 const handleRefresh = async () => {
  setRefreshing(true);
  await loadCustomer();
 };

 if (loading) {
  return (
   <Card>
    <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
     <Loader2 className="h-4 w-4 animate-spin" />
     Loading payment instructions…
    </CardContent>
   </Card>
  );
 }

 return (
  <Card className="border-emerald-200 bg-emerald-50/40">
   <CardHeader>
    <CardTitle className="flex items-center gap-2 text-emerald-900">
     {progress.completed ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
     ) : null}
     Registration fee payment
    </CardTitle>
    <CardDescription>
     {progress.completed
      ? "ClickPesa confirmed the registration fee. This customer is ready for onboarding."
      : "Ask the customer to pay using the BillPay number below. Payment status updates automatically."}
    </CardDescription>
   </CardHeader>
   <CardContent className="space-y-4">
    {error ? <p className="text-sm text-destructive">{error}</p> : null}

    <dl className="grid gap-3 rounded-lg border bg-background/80 p-4 text-sm sm:grid-cols-2">
     <div>
      <dt className="text-muted-foreground">Expected</dt>
      <dd className="font-semibold tabular-nums">{formatCurrency(progress.expected)}</dd>
     </div>
     <div>
      <dt className="text-muted-foreground">Paid</dt>
      <dd className="font-semibold tabular-nums">{formatCurrency(progress.paid)}</dd>
     </div>
     <div>
      <dt className="text-muted-foreground">Remaining</dt>
      <dd className="font-semibold tabular-nums">{formatCurrency(progress.remaining)}</dd>
     </div>
     <div>
      <dt className="text-muted-foreground">Status</dt>
      <dd className="font-semibold">{progress.statusLabel}</dd>
     </div>
    </dl>

    {billPay ? (
     <div className="rounded-lg border bg-background p-4 text-sm">
      <p className="font-medium">Registration fee: {formatCurrency(progress.expected)}</p>
      <p className="mt-2">
       BillPay number:{" "}
       <span className="font-mono font-semibold">{billPay.reference}</span>
      </p>
      <p className="mt-1 text-muted-foreground">
       The customer pays using this BillPay reference. ClickPesa will confirm payment automatically.
      </p>
     </div>
    ) : (
     <p className="text-sm text-muted-foreground">
      BillPay instructions will appear here once the backend generates a ClickPesa payment reference.
     </p>
    )}

    <div className="flex flex-wrap gap-2">
     {!progress.completed ? (
      <Button type="button" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
       {refreshing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
       ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
       )}
       Check payment status
      </Button>
     ) : null}
     <Button asChild>
      <Link href={`${customersBasePath}/${customerId}`}>View customer profile</Link>
     </Button>
     <Button variant="outline" asChild>
      <Link href={customersBasePath}>Back to customers</Link>
     </Button>
    </div>
   </CardContent>
  </Card>
 );
}
