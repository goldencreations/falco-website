"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CustomerEditDialog } from "@/components/customers/customer-edit-dialog";
import { DashboardHeader } from "@/components/dashboard-header";
import { useOptionalNavigationTransition } from "@/components/navigation-transition-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { branchIdsMatch } from "@/lib/branch-scope";
import {
 getCachedCustomerDetail,
 invalidateCustomerDetailCache,
 setCachedCustomerDetail,
} from "@/lib/customer-detail-cache";
import { resolvePortalPathFromPathname } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";
import type { Customer } from "@/lib/types";

export function CustomerEditPage() {
 const { id: customerId } = useParams<{ id: string }>();
 const pathname = usePathname();
 const router = useRouter();
 const navigation = useOptionalNavigationTransition();
 const { user } = useSessionUser();
 const customersListPath = resolvePortalPathFromPathname(pathname, "/customers");
 const profilePath = customerId
 ? resolvePortalPathFromPathname(pathname, `/customers/${customerId}`)
 : customersListPath;

 const goToProfile = useCallback(() => {
 if (!customerId) return;
 navigation?.startNavigation(profilePath);
 router.push(profilePath);
 }, [customerId, navigation, profilePath, router]);

 const [customer, setCustomer] = useState<Customer | null>(null);
 const [sourceRow, setSourceRow] = useState<Record<string, unknown> | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");

 useEffect(() => {
 if (!customerId) return;
 let cancelled = false;
 const cached = getCachedCustomerDetail(customerId);
 if (cached) {
  const cachedBranchOk =
   !user?.branch_id ||
   user.role === "super_admin" ||
   cached.row.branch_id == null ||
   branchIdsMatch(String(cached.row.branch_id), user.branch_id);
  if (cachedBranchOk) {
   setCustomer(cached.customer);
   setSourceRow(cached.row);
   setLoading(false);
  } else {
   invalidateCustomerDetailCache(customerId);
  }
 }

 const load = async () => {
 if (!cached) setLoading(true);
 setError("");
 try {
 const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
 credentials: "include",
 });
 const body = (await res.json().catch(() => ({}))) as { message?: string };
 if (cancelled) return;
 if (!res.ok) {
 setError(body.message ?? `Could not load customer (${res.status})`);
 setCustomer(null);
 setSourceRow(null);
 return;
 }
 const row = extractCustomerDetail(body);
 if (!row) {
 setError("Customer details could not be loaded. Please try again.");
 setCustomer(null);
 setSourceRow(null);
 return;
 }
 if (
  user?.branch_id &&
  user.role !== "super_admin" &&
  row.branch_id != null &&
  !branchIdsMatch(String(row.branch_id), user.branch_id)
 ) {
 setError("This customer belongs to another branch. You cannot edit them from your account.");
 setCustomer(null);
 setSourceRow(null);
 invalidateCustomerDetailCache(customerId);
 return;
 }
 const nextCustomer = adaptApiCustomerRowToCustomer(row);
 setCustomer(nextCustomer);
 setSourceRow(row);
 setCachedCustomerDetail(customerId, row, nextCustomer);
 } catch {
 if (!cancelled && !cached) setError("Network error loading customer.");
 } finally {
 if (!cancelled) setLoading(false);
 }
 };

 void load();
 return () => {
 cancelled = true;
 };
 }, [customerId, user?.branch_id, user?.role]);

 return (
 <>
 <DashboardHeader
 title="Edit Customer"
 description={customer ? `${customer.first_name} ${customer.last_name}` : "Update customer details"}
 />
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 pb-10 lg:p-6 lg:pb-8">
 <div className="mx-auto max-w-6xl space-y-6">
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-background p-4">
 <div className="space-y-1">
 <p className="text-sm font-semibold text-emerald-800">Customer Update Workspace</p>
 <p className="text-xs text-muted-foreground">
 Edit KYC, assignment, guarantors, collateral, risk, payment, and attachment details in the same workspace style as customer creation.
 </p>
 </div>
 <Button type="button" variant="outline" onClick={goToProfile} disabled={!customerId}>
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Profile
 </Button>
 </div>

 {loading ? (
 <Card>
 <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Loading customer...
 </CardContent>
 </Card>
 ) : error || !customer ? (
 <Card>
 <CardContent className="space-y-4 py-10">
 <p className="text-sm text-muted-foreground">{error || "Customer not found."}</p>
 <Button variant="outline" asChild>
 <Link href={customersListPath}>Back to Customers</Link>
 </Button>
 </CardContent>
 </Card>
 ) : (
 <Card>
 <CardContent className="p-4 sm:p-6">
 <CustomerEditDialog
 mode="page"
 open
 onOpenChange={(open) => {
 if (!open) goToProfile();
 }}
 customerId={customerId}
 customer={customer}
 sourceRow={sourceRow}
 onSaved={(next, row) => {
 setCustomer(next);
 setSourceRow(row);
 if (row) setCachedCustomerDetail(customerId, row, next);
 goToProfile();
 }}
 />
 </CardContent>
 </Card>
 )}
 </div>
 </main>
 </>
 );
}
