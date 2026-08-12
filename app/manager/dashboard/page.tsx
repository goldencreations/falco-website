"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
 Activity,
 AlertCircle,
 ArrowUpRight,
 BriefcaseBusiness,
 CheckCircle2,
 Clock3,
 CreditCard,
 Loader2,
 Target,
 UsersRound,
 Wallet,
} from "lucide-react";
import { ManagerPageHeader } from "@/components/manager-page-header";
import { Badge } from "@/components/ui/badge";
import { useBranchDisplayName } from "@/lib/use-branch-display-name";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
 loadManagerDashboardDetails,
 loadManagerDashboardEssentials,
 type ManagerBranchSnapshot,
} from "@/lib/manager-branch-load";
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatCurrency } from "@/lib/formatters";
import { useSessionUser } from "@/lib/use-session-user";

const emptySnapshot: ManagerBranchSnapshot = {
 metrics: null,
 customers: [],
 applications: [],
 loans: [],
 payments: [],
 team: [],
 collectionsToday: 0,
};

export default function ManagerDashboardPage() {
 const router = useRouter();
 const { t } = useTranslations();
 const { user, loaded } = useSessionUser();
 const [snapshot, setSnapshot] = useState<ManagerBranchSnapshot>(emptySnapshot);
 const [loadingEssentials, setLoadingEssentials] = useState(true);
 const [loadingDetails, setLoadingDetails] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const branchId = user?.branch_id?.trim() ?? "";
 const branchLabel = useBranchDisplayName();

 const load = useCallback(async () => {
 if (!branchId) {
 setError(t("manager.noBranchLinked"));
 setSnapshot(emptySnapshot);
 setLoadingEssentials(false);
 setLoadingDetails(false);
 return;
 }
 setLoadingEssentials(true);
 setError(null);
 try {
 const essentials = await loadManagerDashboardEssentials(branchId);
 setSnapshot((prev) => ({
 ...prev,
 metrics: essentials.metrics,
 applications: essentials.applications,
 collectionsToday: essentials.collectionsToday,
 }));
 if (!essentials.metrics && !essentials.applications.length) {
 setError(t("manager.noBranchData"));
 }
 setLoadingEssentials(false);
 setLoadingDetails(true);
 const details = await loadManagerDashboardDetails(branchId);
 setSnapshot((prev) => ({ ...prev, ...details }));
 } catch {
 setError(t("manager.loadFailed"));
 setSnapshot(emptySnapshot);
 } finally {
 setLoadingEssentials(false);
 setLoadingDetails(false);
 }
 }, [branchId, t]);

 useEffect(() => {
 if (!loaded) return;
 if (!user) {
 router.replace("/");
 return;
 }
 if (user.role !== "branch_manager") {
 router.replace(user.role === "loan_officer" ? "/officer/dashboard" : "/dashboard");
 return;
 }
 void load();
 }, [loaded, user, router, load]);

 const { customers, applications, loans, payments, team, collectionsToday, metrics } = snapshot;
 const m = metrics?.metrics;

 const outstanding = Number(m?.portfolio?.outstanding_amount ?? 0) ||
 loans.reduce((sum, loan) => sum + loan.total_outstanding, 0);
 const principalDisbursed = loans.reduce((sum, loan) => sum + loan.principal_amount, 0);
 const collected =
 Number(m?.collections?.amount ?? 0) ||
 payments
 .filter((payment) => payment.status === "completed")
 .reduce((sum, payment) => sum + payment.amount, 0);

 const pendingReview =
 Number(m?.applications?.submitted ?? 0) + Number(m?.applications?.under_review ?? 0) ||
 applications.filter((item) => item.status === "submitted" || item.status === "under_review").length;
 const approvedApps =
 Number(m?.applications?.approved ?? 0) ||
 applications.filter((item) => item.status === "approved").length;
 const rejectedApps =
 Number(m?.applications?.rejected ?? 0) ||
 applications.filter((item) => item.status === "rejected").length;

 const inArrearsCount = loans.filter((loan) => loan.days_in_arrears > 0).length;
 const completedLoans = loans.filter((loan) => loan.status === "paid_off").length;
 const completionRate = loans.length > 0 ? (completedLoans / loans.length) * 100 : 0;
 const collectionRate = principalDisbursed > 0 ? (collected / principalDisbursed) * 100 : 0;
 const portfolioAtRiskAmount =
 Number(m?.risk?.par_amount ?? 0) ||
 loans
 .filter((loan) => loan.days_in_arrears > 30)
 .reduce((sum, loan) => sum + loan.total_outstanding, 0);

 const officerTeam = team.filter(
 (member) =>
 member.branch_id === branchId &&
 (member.role === "loan_officer" || member.role === "collections_officer") &&
 member.is_active
 );

 const pendingTasks = [
 { label: t("manager.taskPendingReview"), value: pendingReview, tone: "warning" as const },
 { label: t("manager.taskArrears"), value: inArrearsCount, tone: "danger" as const },
 { label: t("manager.taskCollectionsToday"), value: collectionsToday, tone: "neutral" as const },
 ];

 if (!loaded || !user || user.role !== "branch_manager") {
 return null;
 }

 return (
 <>
 <ManagerPageHeader
 title={t("manager.dashboardTitle")}
 description={t("manager.dashboardDesc")}
 branchLabel={branchLabel}
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-5">
 {error ? (
 <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
 {error}
 </div>
 ) : null}

 {loadingEssentials ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 {t("manager.loadingBranch")}
 </div>
 ) : (
 <>
 <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white shadow-sm">
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
 {t("manager.commandDesk")}
 </p>
 <h2 className="mt-1 text-2xl font-semibold tracking-tight">
 {t("manager.operations", { branch: branchLabel ?? t("common.branch") })}
 </h2>
 <p className="mt-1 text-sm text-emerald-100/90">{t("manager.liveMetrics")}</p>
 <div className="mt-4 flex flex-wrap gap-2">
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <UsersRound className="mr-1 h-3.5 w-3.5" />
 {t("common.customersCount", { count: customers.length })}
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <BriefcaseBusiness className="mr-1 h-3.5 w-3.5" />
 {t("common.loanRecords", { count: loans.length })}
 </Badge>
 <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
 <Activity className="mr-1 h-3.5 w-3.5" />
 {t("common.fieldStaff", { count: officerTeam.length })}
 </Badge>
 </div>
 </div>

 <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 <Card className="border-emerald-200/70 bg-emerald-50/50">
 <CardHeader className="pb-2">
 <CardDescription>{t("manager.branchPortfolio")}</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(outstanding)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">{t("manager.outstandingLive")}</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("manager.totalCollected")}</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(collected)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">{t("manager.completedPayments")}</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("manager.reviewQueue")}</CardDescription>
 <CardTitle className="text-2xl">{pendingReview}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">{t("manager.reviewQueueDesc")}</CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardDescription>{t("manager.parExposure")}</CardDescription>
 <CardTitle className="text-2xl">{formatCurrency(portfolioAtRiskAmount)}</CardTitle>
 </CardHeader>
 <CardContent className="text-xs text-muted-foreground">{t("manager.parExposureDesc")}</CardContent>
 </Card>
 </div>

 <div className="grid gap-4 xl:grid-cols-12">
 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("manager.applicationPipeline")}</CardTitle>
 <CardDescription>{t("manager.creditFlow")}</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="inline-flex items-center gap-2 text-muted-foreground">
 <Clock3 className="h-4 w-4" /> {t("common.pendingReview")}
 </span>
 <span className="font-semibold">{pendingReview}</span>
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="inline-flex items-center gap-2 text-muted-foreground">
 <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {t("common.approved")}
 </span>
 <span className="font-semibold">{approvedApps}</span>
 </div>
 <div className="flex items-center justify-between rounded-lg border p-3">
 <span className="inline-flex items-center gap-2 text-muted-foreground">
 <AlertCircle className="h-4 w-4 text-rose-600" /> {t("common.rejected")}
 </span>
 <span className="font-semibold">{rejectedApps}</span>
 </div>
 </CardContent>
 </Card>

 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("manager.collectionEfficiency")}</CardTitle>
 <CardDescription>{t("manager.recoveryVsPrincipal")}</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="rounded-xl border bg-muted/20 p-4">
 <p className="text-3xl font-bold tracking-tight">{collectionRate.toFixed(1)}%</p>
 <p className="text-xs text-muted-foreground">{t("manager.collectionRate")}</p>
 </div>
 <Progress value={Math.min(collectionRate, 100)} className="h-2.5" />
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span className="inline-flex items-center gap-1">
 <Wallet className="h-3.5 w-3.5" /> {t("manager.disbursed", { amount: formatCurrency(principalDisbursed) })}
 </span>
 <span className="inline-flex items-center gap-1">
 <CreditCard className="h-3.5 w-3.5" /> {t("manager.collected", { amount: formatCurrency(collected) })}
 </span>
 </div>
 </CardContent>
 </Card>

 <Card className="xl:col-span-4">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("manager.loanCompletion")}</CardTitle>
 <CardDescription>{t("manager.repaymentProgress")}</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="rounded-xl border bg-muted/20 p-4">
 <p className="text-3xl font-bold tracking-tight">{completionRate.toFixed(1)}%</p>
 <p className="text-xs text-muted-foreground">{t("manager.loansClosedVsTotal")}</p>
 </div>
 <Progress value={completionRate} className="h-2.5" />
 <div className="flex items-center justify-between text-xs text-muted-foreground">
 <span>{t("manager.paidOff", { count: completedLoans })}</span>
 <span>{t("manager.inProgress", { count: loans.length - completedLoans })}</span>
 </div>
 </CardContent>
 </Card>
 </div>

 <div className="grid gap-4 lg:grid-cols-3">
 <Card className="lg:col-span-2">
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("manager.teamWorkload")}</CardTitle>
 <CardDescription>{t("manager.teamFromApi")}</CardDescription>
 </CardHeader>
 <CardContent className="space-y-2">
 {officerTeam.length === 0 ? (
 <p className="text-sm text-muted-foreground">{t("manager.noOfficers")}</p>
 ) : (
 officerTeam.slice(0, 7).map((member) => (
 <div key={member.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
 <div>
 <p className="font-medium">{member.full_name}</p>
 <p className="text-xs text-muted-foreground">{member.employee_id || member.email}</p>
 </div>
 <Badge variant="outline" className="capitalize">
 {member.role.replace("_", " ")}
 </Badge>
 </div>
 ))
 )}
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-base">{t("manager.priorityQueue")}</CardTitle>
 <CardDescription>{t("manager.needsAction")}</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 {pendingTasks.map((task) => (
 <div key={task.label} className="rounded-lg border p-3">
 <p className="text-xs text-muted-foreground">{task.label}</p>
 <div className="mt-1 flex items-center justify-between">
 <p className="text-xl font-semibold">{task.value}</p>
 <ArrowUpRight
 className={`h-4 w-4 ${
 task.tone === "danger"
 ? "text-rose-600"
 : task.tone === "warning"
 ? "text-amber-600"
 : "text-emerald-600"
 }`}
 />
 </div>
 </div>
 ))}
 <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
 <p className="inline-flex items-center gap-1 font-medium text-foreground">
 <Target className="h-3.5 w-3.5 text-emerald-600" />
 {t("manager.weeklyFocus")}
 </p>
 <p className="mt-1">{t("manager.weeklyFocusBody")}</p>
 </div>
 </CardContent>
 </Card>
 </div>
 </>
 )}
 </div>
 </main>
 </>
 );
}
