"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
 AlertTriangle,
 ArrowUpRight,
 CreditCard,
 Loader2,
 Scale,
 ShieldCheck,
 Sparkles,
 TrendingUp,
 Wallet,
 WalletCards,
} from "lucide-react";
import {
 Area,
 AreaChart,
 CartesianGrid,
 Legend,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { AccountantAiAssistant } from "@/components/accountant/accountant-ai-assistant";
import { useOptionalBranchAssignment } from "@/components/branch-assignment-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
 buildAccountantDashboardStats,
 loadAccountantFinanceDetails,
 loadAccountantFinanceEssentials,
 type AccountantFinanceSnapshot,
} from "@/lib/accountant-dashboard-metrics";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { formatCurrency } from "@/lib/formatters";
import { useTranslations } from "@/lib/i18n/use-translations";
import { tLabel } from "@/lib/i18n/labels";
import { loginRedirectForRole } from "@/lib/role-portal";
import { useSessionUser } from "@/lib/use-session-user";

export default function AccountantDashboardPage() {
 const router = useRouter();
 const { t, language } = useTranslations();
 const { user, loaded } = useSessionUser();
 const branchCtx = useOptionalBranchAssignment();
 const [snapshot, setSnapshot] = useState<AccountantFinanceSnapshot | null>(null);
 const [loadingEssentials, setLoadingEssentials] = useState(true);
 const [loadingDetails, setLoadingDetails] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [dataVersion, setDataVersion] = useState(0);

 const branchId = user?.branch_id?.trim() ?? "";
 const branchLabel = useMemo(() => {
 if (!branchId) return "Branch";
 const fromCtx = branchCtx?.branches.find((b) => b.id === branchId);
 return fromCtx?.name ?? `Branch ${branchId}`;
 }, [branchId, branchCtx?.branches]);

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
 setSnapshot({
 branchLabel,
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
 });
 setLoadingEssentials(false);
 setLoadingDetails(true);
 const details = await loadAccountantFinanceDetails(branchId);
 setSnapshot((prev) =>
 prev
 ? {
 ...prev,
 ...details,
 branchLabel,
 }
 : null
 );
 setDataVersion((v) => v + 1);
 } catch {
 setError(t("accountant.loadFailed"));
 setSnapshot(null);
 } finally {
 setLoadingEssentials(false);
 setLoadingDetails(false);
 }
 }, [branchId, branchLabel, t]);

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

 const chartData = useMemo(() => {
 if (!snapshot) return [];
 const months = new Set<string>();
 for (const row of snapshot.timeseriesCollections) months.add(row.month);
 for (const row of snapshot.timeseriesDisbursements) months.add(row.month);
 return Array.from(months).map((month) => ({
 month,
 collections:
 snapshot.timeseriesCollections.find((r) => r.month === month)?.amount ?? 0,
 disbursements:
 snapshot.timeseriesDisbursements.find((r) => r.month === month)?.amount ?? 0,
 }));
 }, [snapshot]);

 if (!loaded || !user || user.role !== "accountant") {
 return (
 <div className="flex flex-1 items-center justify-center p-8">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 );
 }

 return (
 <main className="flex-1 overflow-auto">
 <div className="border-b border-border/60 bg-gradient-to-r from-slate-900/[0.04] via-primary/[0.06] to-emerald-600/[0.06] px-4 py-5 lg:px-6">
 <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4">
 <div>
 <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
 {t("accountant.financeOverview", { branch: branchLabel })}
 </p>
 <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
 {t("accountant.dashboardTitle")}
 </h1>
 <p className="mt-1 max-w-xl text-sm text-muted-foreground">{t("accountant.dashboardDesc")}</p>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button variant="outline" size="sm" onClick={() => forceCachedReload(load)} disabled={loadingEssentials || loadingDetails}>
 {t("accountant.refresh")}
 </Button>
 <Button variant="outline" size="sm" asChild>
 <Link href="/accountant/payments">{tLabel("Payments", language)}</Link>
 </Button>
 <Button size="sm" asChild>
 <Link href="/accountant/reconciliation">
 <Scale className="mr-2 h-4 w-4" />
 {tLabel("Reconciliation", language)}
 </Link>
 </Button>
 </div>
 </div>
 </div>

 <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[1fr_320px] lg:p-6 xl:grid-cols-[1fr_360px]">
 <div className="min-w-0 space-y-4">
 {loadingEssentials ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
 </div>
 ) : error ? (
 <Card className="border-destructive/30 bg-destructive/5">
 <CardContent className="flex items-center gap-3 py-6 text-sm text-destructive">
 <AlertTriangle className="h-5 w-5 shrink-0" />
 {error}
 </CardContent>
 </Card>
 ) : stats ? (
 <>
 <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card to-emerald-50/30">
 <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
 <div className="flex items-start gap-3">
 <div className="rounded-xl bg-primary/15 p-2.5 text-primary">
 <Sparkles className="h-5 w-5" />
 </div>
 <div>
 <p className="text-sm font-semibold">{t("accountant.branchInsight")}</p>
 <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{stats.insightText}</p>
 </div>
 </div>
 <Badge variant="outline" className="border-primary/30 text-primary">
 {t("accountant.branchData")}
 </Badge>
 </CardContent>
 </Card>

 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 <Card className="border-emerald-200/60">
 <CardHeader className="pb-2">
 <CardDescription className="flex items-center gap-1.5">
 <Wallet className="h-3.5 w-3.5" />
 {t("accountant.portfolioOutstanding")}
 </CardDescription>
 <CardTitle className="text-2xl tabular-nums">{formatCurrency(stats.outstandingPortfolio)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("accountant.activeLoansRecords", {
 active: stats.activeLoansCount,
 total: stats.totalLoansCount,
 })}
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardDescription className="flex items-center gap-1.5">
 <CreditCard className="h-3.5 w-3.5" />
 {t("accountant.paymentsCollected")}
 </CardDescription>
 <CardTitle className="text-2xl tabular-nums">{formatCurrency(stats.paymentsCollectedTotal)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("accountant.paymentsToday", {
 today: formatCurrency(stats.paymentsCollectedToday),
 count: stats.paymentsCompletedCount,
 })}
 {stats.paymentsPendingCount > 0
 ? t("accountant.paymentsPending", {
 amount: formatCurrency(stats.paymentsPendingAmount),
 })
 : ""}
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardDescription className="flex items-center gap-1.5">
 <ShieldCheck className="h-3.5 w-3.5" />
 {t("accountant.collections")}
 </CardDescription>
 <CardTitle className="text-2xl tabular-nums">{formatCurrency(stats.collectionsAmount)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("accountant.collectionsQueue", {
 count: stats.collectionsQueueCount,
 outstanding: formatCurrency(stats.collectionsQueueOutstanding),
 })}
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardDescription className="flex items-center gap-1.5">
 <WalletCards className="h-3.5 w-3.5" />
 {t("accountant.disbursementsMtd")}
 </CardDescription>
 <CardTitle className="text-2xl tabular-nums">{formatCurrency(stats.disbursementsMtdVolume)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("accountant.disbursementsStatus", {
 completed: stats.disbursementsCompletedCount,
 pending: stats.disbursementsPendingCount,
 })}
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardDescription className="flex items-center gap-1.5">
 <Scale className="h-3.5 w-3.5" />
 {t("accountant.reconciliation")}
 </CardDescription>
 <CardTitle className="text-2xl tabular-nums">
 {t("accountant.reconciliationMatched", { matched: stats.reconciliation.matched })}
 </CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("accountant.reconciliationDetail", {
 review: stats.anomaliesDetected,
 unmatched: stats.reconciliation.unmatched,
 manual: stats.reconciliation.manual_review,
 })}
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="pb-2">
 <CardDescription className="flex items-center gap-1.5">
 <TrendingUp className="h-3.5 w-3.5" />
 {t("accountant.portfolioRisk")}
 </CardDescription>
 <CardTitle className="text-2xl tabular-nums">
 PAR {stats.parRate.toFixed(1)}%
 </CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("accountant.parNpl", {
 npl: stats.nplRate.toFixed(1),
 amount: formatCurrency(stats.parAmount),
 })}
 </CardContent>
 </Card>
 </div>

 {chartData.length > 0 ? (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">{t("accountant.trendTitle")}</CardTitle>
 <CardDescription>{t("accountant.trendDesc", { branch: branchLabel })}</CardDescription>
 </CardHeader>
 <CardContent className="h-[240px]">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={chartData}>
 <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
 <XAxis dataKey="month" tick={{ fontSize: 11 }} />
 <YAxis tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
 <Tooltip formatter={(v: number) => formatCurrency(v)} />
 <Legend />
 <Area
 type="monotone"
 dataKey="collections"
 name={t("accountant.chartCollections")}
 stroke="hsl(var(--primary))"
 fill="hsl(var(--primary))"
 fillOpacity={0.15}
 />
 <Area
 type="monotone"
 dataKey="disbursements"
 name={t("accountant.chartDisbursements")}
 stroke="#0d9488"
 fill="#0d9488"
 fillOpacity={0.12}
 />
 </AreaChart>
 </ResponsiveContainer>
 </CardContent>
 </Card>
 ) : stats.monthlyPaymentTotals.length > 0 ? (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">{t("accountant.paymentsByMonth")}</CardTitle>
 <CardDescription>{t("accountant.paymentsByMonthDesc")}</CardDescription>
 </CardHeader>
 <CardContent className="grid gap-2 sm:grid-cols-3">
 {stats.monthlyPaymentTotals.map((row) => (
 <div key={row.month} className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{row.month}</p>
 <p className="text-lg font-semibold tabular-nums">{formatCurrency(row.amount)}</p>
 </div>
 ))}
 </CardContent>
 </Card>
 ) : null}

 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <Button variant="outline" className="h-auto justify-start gap-2 py-3" asChild>
 <Link href="/accountant/payments">
 <CreditCard className="h-4 w-4 text-primary" />
 <span className="text-left">
 <span className="block font-semibold">{t("accountant.quickPayments")}</span>
 <span className="block text-xs text-muted-foreground">{formatCurrency(stats.paymentsCollectedTotal)}</span>
 </span>
 </Link>
 </Button>
 <Button variant="outline" className="h-auto justify-start gap-2 py-3" asChild>
 <Link href="/accountant/reconciliation">
 <Scale className="h-4 w-4 text-primary" />
 <span className="text-left">
 <span className="block font-semibold">{t("accountant.quickReconciliation")}</span>
 <span className="block text-xs text-muted-foreground">
 {t("accountant.quickReconciliationItems", { count: stats.reconciliationTotal })}
 </span>
 </span>
 </Link>
 </Button>
 <Button variant="outline" className="h-auto justify-start gap-2 py-3" asChild>
 <Link href="/accountant/collections">
 <ShieldCheck className="h-4 w-4 text-primary" />
 <span className="text-left">
 <span className="block font-semibold">{t("accountant.quickCollections")}</span>
 <span className="block text-xs text-muted-foreground">
 {t("accountant.quickCollectionsQueue", { count: stats.collectionsQueueCount })}
 </span>
 </span>
 </Link>
 </Button>
 <Button variant="outline" className="h-auto justify-start gap-2 py-3" asChild>
 <Link href="/accountant/loans">
 <Wallet className="h-4 w-4 text-primary" />
 <span className="text-left">
 <span className="block font-semibold">{t("accountant.quickActiveLoans")}</span>
 <span className="block text-xs text-muted-foreground">
 {t("accountant.quickLoansCount", { count: stats.activeLoansCount })}
 </span>
 </span>
 </Link>
 </Button>
 </div>
 </>
 ) : null}
 </div>

 <div className="lg:sticky lg:top-4 lg:self-start">
 {stats && user ? (
 <AccountantAiAssistant user={user} stats={stats} dataVersion={dataVersion} />
 ) : null}
 </div>
 </div>
 </main>
 );
}
