"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
 Calculator,
 ClipboardList,
 Clock3,
 HandCoins,
 MapPin,
 Plus,
 Scale,
 TrendingUp,
 UserPlus,
 UserSquare2,
 Users,
 UsersRound,
 Wallet,
} from "lucide-react";
import { OfficerPageHeader } from "@/components/officer-page-header";
import { useOfficerSession } from "@/components/officer-session-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatCurrency } from "@/lib/formatters";
import { loadOfficerDashboardSnapshot } from "@/lib/officer-dashboard-load";
import type { OfficerDashboardSnapshot } from "@/lib/officer-dashboard-load";

function MetricValue({
 loading,
 children,
}: {
 loading: boolean;
 children: React.ReactNode;
}) {
 if (loading) return <Skeleton className="h-8 w-28" />;
 return <>{children}</>;
}

const OFFICER_QUICK_ACTIONS = [
 { href: "/officer/customers/new", label: "New customer", icon: UserPlus, variant: "default" as const },
 { href: "/officer/customers", label: "Customers", icon: UserSquare2, variant: "outline" as const },
 { href: "/officer/applications/new", label: "New application", icon: Plus, variant: "default" as const },
 { href: "/officer/applications", label: "Loan applications", icon: ClipboardList, variant: "outline" as const },
 { href: "/officer/credit-analysis", label: "Credit analysis", icon: Scale, variant: "outline" as const },
 { href: "/officer/loan-calculator", label: "Loan calculator", icon: Calculator, variant: "outline" as const },
 { href: "/officer/leads", label: "Leads", icon: MapPin, variant: "outline" as const },
 { href: "/officer/loans", label: "Active loans", icon: Wallet, variant: "outline" as const },
 { href: "/officer/groups", label: "Vikundi groups", icon: Users, variant: "outline" as const },
];

export default function OfficerDashboardPage() {
 const { t } = useTranslations();
 const user = useOfficerSession();
 const branchId = user.branch_id?.trim() ?? "";

 const [loading, setLoading] = useState(Boolean(branchId));
 const [dataLimited, setDataLimited] = useState(false);
 const [snapshot, setSnapshot] = useState<OfficerDashboardSnapshot | null>(null);

 const branchLabel = branchId ? `${t("common.branch")} ${branchId}` : t("common.branch");

 useEffect(() => {
 if (!branchId) {
 setLoading(false);
 return;
 }
 let cancelled = false;
 setLoading(true);
 setDataLimited(false);
 void loadOfficerDashboardSnapshot(branchId)
 .then((data) => {
 if (!cancelled) setSnapshot(data);
 })
 .catch(() => {
 if (!cancelled) setDataLimited(true);
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => {
 cancelled = true;
 };
 }, [branchId]);

 const metrics = snapshot?.metrics?.metrics ?? null;
 const customerCount = snapshot?.customerCount ?? 0;
 const appCounts = snapshot?.appCounts ?? { pending: 0, approved: 0, total: 0 };
 const originatedCounts = snapshot?.originatedCounts ?? appCounts;

 const outstanding = Number(metrics?.portfolio?.outstanding_amount ?? 0);
 const activeLoans = Number(metrics?.portfolio?.active_loan_count ?? 0);
 const collected = Number(metrics?.collections?.amount ?? 0);
 const par = Number(metrics?.risk?.par_amount ?? 0);

 return (
 <>
 <OfficerPageHeader
 title={t("officer.dashboardTitle")}
 description={t("officer.dashboardDesc")}
 branchLabel={branchLabel}
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-5">
 {dataLimited ? (
 <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
 Some dashboard figures could not be loaded. Try refreshing or contact support if this continues.
 </p>
 ) : null}
 {!branchId ? (
 <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
 Assign a branch to your account to load portfolio metrics.
 </p>
 ) : null}

 <section className="rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
 {t("officer.commandDesk")}
 </p>
 <h2 className="mt-1 text-2xl font-semibold tracking-tight">{user.full_name}</h2>
 <p className="mt-1 text-sm text-emerald-100/90">{t("officer.metricsLoaded")}</p>
 <div className="mt-4 flex flex-wrap gap-2">
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <UsersRound className="mr-1 h-3.5 w-3.5" />
 {loading ? (
 <span className="inline-flex items-center gap-1">
 {t("officer.customers")}
 <Skeleton className="h-3.5 w-6 bg-white/30" />
 </span>
 ) : (
 t("common.assignedCustomers", { count: customerCount })
 )}
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <Clock3 className="mr-1 h-3.5 w-3.5" />
 {loading ? (
 <span className="inline-flex items-center gap-1">
 {t("officer.pendingApplications")}
 <Skeleton className="h-3.5 w-6 bg-white/30" />
 </span>
 ) : (
 t("common.applicationsPending", { count: appCounts.pending })
 )}
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <TrendingUp className="mr-1 h-3.5 w-3.5" />
 {loading ? (
 <Skeleton className="h-3.5 w-16 bg-white/30" />
 ) : (
 t("common.parExposure", { amount: formatCurrency(par) })
 )}
 </Badge>
 </div>
 </section>

 <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("officer.portfolioOutstanding")}</CardDescription>
 <CardTitle className="text-2xl">
 <MetricValue loading={loading}>{formatCurrency(outstanding)}</MetricValue>
 </CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("officer.fromBranchMetrics")}
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("officer.collectionsPeriod")}</CardDescription>
 <CardTitle className="text-2xl">
 <MetricValue loading={loading}>{formatCurrency(collected)}</MetricValue>
 </CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("officer.reportedCollections")}
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("officer.activeLoans")}</CardDescription>
 <CardTitle className="text-2xl">
 <MetricValue loading={loading}>{activeLoans}</MetricValue>
 </CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("officer.activeLoanCount")}
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("officer.applicationsYouCreated")}</CardDescription>
 <CardTitle className="text-2xl">
 <MetricValue loading={loading}>{originatedCounts.total}</MetricValue>
 </CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">
 {t("common.approvedCount", { count: originatedCounts.approved })}
 </CardContent>
 </Card>
 </section>

 <section className="grid gap-4 xl:grid-cols-12">
 <Card className="xl:col-span-6">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("officer.applicationFlow")}</CardTitle>
 <CardDescription>All applications in your branch (same as the applications list)</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="text-muted-foreground">{t("common.pendingReview")}</span>
 {loading ? (
 <Skeleton className="h-5 w-8" />
 ) : (
 <span className="font-semibold">{appCounts.pending}</span>
 )}
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="text-muted-foreground">{t("common.approved")}</span>
 {loading ? (
 <Skeleton className="h-5 w-8" />
 ) : (
 <span className="font-semibold">{appCounts.approved}</span>
 )}
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="text-muted-foreground">{t("common.totalOriginated")}</span>
 {loading ? (
 <Skeleton className="h-5 w-8" />
 ) : (
 <span className="font-semibold">{appCounts.total}</span>
 )}
 </div>
 <Button variant="outline" className="w-full" asChild>
 <Link href="/officer/applications">{t("common.viewAll")} applications</Link>
 </Button>
 </CardContent>
 </Card>

 <Card className="xl:col-span-6">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("officer.quickActions")}</CardTitle>
 <CardDescription>
 Jump to customers, applications, credit analysis, calculator, leads, loans, and groups.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="grid gap-2 sm:grid-cols-2">
 {OFFICER_QUICK_ACTIONS.map((action) => (
 <Button
 key={action.href}
 variant={action.variant}
 className="h-auto justify-start gap-2 py-2.5"
 asChild
 >
 <Link href={action.href}>
 <action.icon className="h-4 w-4 shrink-0" />
 <span className="text-left text-sm">{action.label}</span>
 </Link>
 </Button>
 ))}
 </div>
 <p className="flex items-center gap-2 text-xs text-muted-foreground">
 <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
 {t("officer.recoveryMetrics")}
 </p>
 </CardContent>
 </Card>
 </section>

 <section>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("officer.fieldFocus")}</CardTitle>
 <CardDescription>{t("officer.summaryTiles")}</CardDescription>
 </CardHeader>
 <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{t("officer.pendingApplications")}</p>
 <p className="mt-1 text-xl font-semibold">
 {loading ? <Skeleton className="h-7 w-10" /> : appCounts.pending}
 </p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{t("officer.customers")}</p>
 <p className="mt-1 text-xl font-semibold">
 {loading ? <Skeleton className="h-7 w-10" /> : customerCount}
 </p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{t("officer.portfolioOutstandingShort")}</p>
 <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
 <HandCoins className="h-4 w-4 text-emerald-600" />
 {loading ? <Skeleton className="h-7 w-24" /> : formatCurrency(outstanding)}
 </p>
 </div>
 <div className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{t("officer.activeLoans")}</p>
 <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
 <Wallet className="h-4 w-4 text-blue-600" />
 {loading ? <Skeleton className="h-7 w-10" /> : activeLoans}
 </p>
 </div>
 </CardContent>
 </Card>
 </section>
 </div>
 </main>
 </>
 );
}
