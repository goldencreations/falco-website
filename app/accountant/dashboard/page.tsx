"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AccountantDashboardView } from "@/components/accountant/accountant-dashboard-view";
import {
 buildAccountantDashboardStats,
 loadAccountantFinanceDetails,
 loadAccountantFinanceEssentials,
 type AccountantFinanceSnapshot,
} from "@/lib/accountant-dashboard-metrics";
import { useBranchDisplayName } from "@/lib/use-branch-display-name";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { useTranslations } from "@/lib/i18n/use-translations";
import { loginRedirectForRole } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";

export default function AccountantDashboardPage() {
 const router = useRouter();
 const { t, language } = useTranslations();
 const { user, loaded } = useSessionUser();
 const [snapshot, setSnapshot] = useState<AccountantFinanceSnapshot | null>(null);
 const [loadingEssentials, setLoadingEssentials] = useState(true);
 const [loadingDetails, setLoadingDetails] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const branchId = user?.branch_id?.trim() ?? "";
 const branchLabel = useBranchDisplayName() ?? t("common.branch");

 const load = useCallback(async () => {
 if (!branchId) {
 setError(t("accountant.noBranch"));
 setSnapshot(null);
 setLoadingEssentials(false);
 return;
 }
 setLoadingEssentials(true);
 setError(null);
 try {
 const essentials = await loadAccountantFinanceEssentials(branchId);
 setSnapshot((prev) => ({
 branchLabel: prev?.branchLabel ?? branchLabel,
 metrics: essentials.metrics,
 reconciliation: essentials.reconciliation,
 payments: [],
 loans: [],
 disbursements: [],
 disbursementKpis: null,
 collectionsQueueCount: 0,
 collectionsQueueOutstanding: 0,
 timeseriesCollections: [],
 timeseriesDisbursements: [],
 }));
 setLoadingEssentials(false);
 setLoadingDetails(true);
 const details = await loadAccountantFinanceDetails(branchId);
 setSnapshot((prev) =>
 prev
 ? {
 ...prev,
 ...details,
 }
 : null
 );
 } catch {
 setError(t("accountant.loadFailed"));
 setSnapshot(null);
 } finally {
 setLoadingEssentials(false);
 setLoadingDetails(false);
 }
 }, [branchId, t]);

 useEffect(() => {
 setSnapshot((prev) => (prev ? { ...prev, branchLabel } : prev));
 }, [branchLabel]);

 useEffect(() => {
 if (!loaded) return;
 if (!user) {
 router.replace("/");
 return;
 }
 if (user.role !== "accountant") {
 router.replace(loginRedirectForRole(user.role));
 return;
 }
 void load();
 }, [loaded, user, router, load]);

 const stats = useMemo(
 () => (snapshot ? buildAccountantDashboardStats(snapshot, language) : null),
 [snapshot, language]
 );

 if (!loaded || !user || user.role !== "accountant") {
 return (
 <div className="flex flex-1 items-center justify-center p-8">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <AccountantDashboardView
 branchLabel={branchLabel}
 stats={stats}
 snapshot={snapshot}
 loadingEssentials={loadingEssentials}
 loadingDetails={loadingDetails}
 error={error}
 onRefresh={() => forceCachedReload(load)}
 />
 );
}
