"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatCurrency } from "@/lib/formatters";
import { ArrowUpRight, Loader2, ShieldCheck, WalletCards } from "lucide-react";

const DashboardChartsPanel = dynamic(
 () =>
 import("@/components/dashboard/dashboard-charts-panel").then((m) => ({
 default: m.DashboardChartsPanel,
 })),
 { loading: () => <DashboardSectionSkeleton /> }
);
const RecentActivity = dynamic(
 () => import("@/components/dashboard/recent-activity").then((m) => ({ default: m.RecentActivity })),
 { loading: () => <DashboardSectionSkeleton /> }
);
const LoansAtRisk = dynamic(
 () => import("@/components/dashboard/loans-at-risk").then((m) => ({ default: m.LoansAtRisk })),
 { loading: () => <DashboardSectionSkeleton /> }
);

function DashboardSectionSkeleton() {
 return (
 <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border/60 text-muted-foreground">
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 </div>
 );
}

type MetricsPayload = {
 metrics?: {
 portfolio?: { outstanding_amount?: number; active_loan_count?: number };
 risk?: { npl_rate?: number };
 collections?: { amount?: number };
 };
};

export default function DashboardPage() {
 const { t } = useTranslations();
 const [snapshot, setSnapshot] = useState<MetricsPayload | null>(null);

 useEffect(() => {
 let cancelled = false;
 void fetch("/api/falco/dashboard/metrics")
 .then((r) => r.json())
 .then((json) => {
 if (!cancelled) setSnapshot(json as MetricsPayload);
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, []);

 const portfolio = snapshot?.metrics?.portfolio;
 const risk = snapshot?.metrics?.risk;
 const collections = snapshot?.metrics?.collections;

 const netPosition = Number(collections?.amount ?? 0);
 const nplPct = Number(risk?.npl_rate ?? 0);
 const outstanding = Number(portfolio?.outstanding_amount ?? 0);
 const activeLoans = Number(portfolio?.active_loan_count ?? 0);

 return (
 <>
 <DashboardHeader title={t("dashboard.title")} description={t("dashboard.description")} />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <section className="overflow-hidden rounded-2xl">
 <div className="grid gap-2 rounded-[0.875rem] p-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 lg:p-4">
 <div className="group relative overflow-hidden rounded-xl bg-card p-3.5 shadow-md">
 <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
 {t("dashboard.collectionsPeriod")}
 </p>
 <p className="relative mt-1.5 break-words text-xl font-bold tabular-nums leading-tight tracking-tight text-foreground sm:text-2xl">
 {formatCurrency(netPosition)}
 </p>
 <p className="relative mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700 ">
 <ArrowUpRight className="h-3.5 w-3.5" />
 {t("dashboard.fromLiveMetrics")}
 </p>
 </div>
 <div className="group relative overflow-hidden rounded-xl bg-card p-3.5 shadow-md">
 <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
 {t("dashboard.portfolioHealth")}
 </p>
 <p className="relative mt-1.5 break-words text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
 {t("dashboard.nplLabel", { pct: nplPct.toFixed(1) })}
 </p>
 <p className="relative mt-2 flex items-center gap-1 text-xs font-medium text-sky-700 ">
 <ShieldCheck className="h-3.5 w-3.5" />
 {t("dashboard.riskSnapshot")}
 </p>
 </div>
 <div className="group relative overflow-hidden rounded-xl bg-card p-3.5 shadow-md sm:col-span-1">
 <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
 {t("dashboard.outstandingBook")}
 </p>
 <p className="relative mt-1.5 break-words text-xl font-bold tabular-nums leading-tight tracking-tight text-foreground sm:text-2xl">
 {formatCurrency(outstanding)}
 </p>
 <p className="relative mt-2 flex items-center gap-1 text-xs font-medium text-teal-800 ">
 <WalletCards className="h-3.5 w-3.5 shrink-0" />
 {t("dashboard.activeLoansCount", { count: activeLoans })}
 </p>
 </div>
 </div>
 </section>

 <KPICards />

 <DashboardChartsPanel />

 <RecentActivity />

 <LoansAtRisk />
 </div>
 </main>
 </>
 );
}
