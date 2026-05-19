"use client";

import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  Activity,
  Clock3,
  HandCoins,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";

import { OfficerPageHeader } from "@/components/officer-page-header";

import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { extractApplicationsList } from "@/lib/application-adapters";

import { extractCustomersList } from "@/lib/customer-adapters";

import { useTranslations } from "@/lib/i18n/use-translations";

import { formatCurrency } from "@/lib/formatters";

import { useSessionUser } from "@/lib/use-session-user";

type MetricsPayload = {
  metrics?: {
    portfolio?: { outstanding_amount?: number; active_loan_count?: number };

    applications?: {
      submitted?: number;
      under_review?: number;
      approved?: number;
      total?: number;
    };

    collections?: { amount?: number };

    risk?: { par_amount?: number };
  };
};

export default function OfficerDashboardPage() {
  const router = useRouter();

  const { t } = useTranslations();

  const { user, loaded } = useSessionUser();

  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);

  const [customerCount, setCustomerCount] = useState(0);

  const [appCounts, setAppCounts] = useState({
    pending: 0,
    approved: 0,
    total: 0,
  });

  useEffect(() => {
    if (!loaded) return;

    if (!user) {
      router.replace("/");

      return;
    }

    if (user.role !== "loan_officer") {
      router.replace(
        user.role === "branch_manager" ? "/manager/dashboard" : "/dashboard",
      );
    }
  }, [loaded, user, router]);

  useEffect(() => {
    if (!user || user.role !== "loan_officer") return;

    let cancelled = false;

    const params = new URLSearchParams();

    params.set("branch_id", user.branch_id);

    void fetch(`/api/falco/dashboard/metrics?${params.toString()}`)
      .then((r) => r.json())

      .then((json) => {
        if (!cancelled) setMetrics(json as MetricsPayload);
      })

      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "loan_officer") return;

    let cancelled = false;

    const p = new URLSearchParams();

    p.set("branch_id", user.branch_id);

    p.set("page_size", "200");

    void fetch(`/api/customers?${p.toString()}`)
      .then((r) => r.json())

      .then((json) => {
        if (cancelled) return;

        const list = extractCustomersList(json);

        const mine = list.filter(
          (c) =>
            c.assigned_loan_officer_id === user.id || c.created_by === user.id,
        );

        setCustomerCount(mine.length);
      })

      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== "loan_officer") return;

    let cancelled = false;

    const p = new URLSearchParams();

    p.set("branch_id", user.branch_id);

    p.set("page_size", "200");

    void fetch(`/api/applications?${p.toString()}`)
      .then((r) => r.json())

      .then((json) => {
        if (cancelled) return;

        const apps = extractApplicationsList(json).filter(
          (a) => a.created_by === user.id,
        );

        const pending = apps.filter(
          (a) => a.status === "submitted" || a.status === "under_review",
        ).length;

        const approved = apps.filter((a) => a.status === "approved").length;

        setAppCounts({ pending, approved, total: apps.length });
      })

      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  const branchLabel = useMemo(
    () =>
      user?.branch_id
        ? `${t("common.branch")} ${user.branch_id}`
        : t("common.branch"),

    [user?.branch_id, t],
  );

  if (!loaded || !user || user.role !== "loan_officer") {
    return null;
  }

  const m = metrics?.metrics;

  const outstanding = Number(m?.portfolio?.outstanding_amount ?? 0);

  const activeLoans = Number(m?.portfolio?.active_loan_count ?? 0);

  const collected = Number(m?.collections?.amount ?? 0);

  const par = Number(m?.risk?.par_amount ?? 0);

  return (
    <>
      <OfficerPageHeader
        title={t("officer.dashboardTitle")}
        description={t("officer.dashboardDesc")}
        branchLabel={branchLabel}
      />

      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {t("officer.commandDesk")}
            </p>

            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {user.full_name}
            </h2>

            <p className="mt-1 text-sm text-emerald-100/90">
              {t("officer.metricsLoaded")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
                <UsersRound className="mr-1 h-3.5 w-3.5" />

                {t("common.assignedCustomers", { count: customerCount })}
              </Badge>

              <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
                <Clock3 className="mr-1 h-3.5 w-3.5" />

                {t("common.applicationsPending", { count: appCounts.pending })}
              </Badge>

              <Badge className="border-white/30 bg-white/20 text-white hover:bg-white/20">
                <Activity className="mr-1 h-3.5 w-3.5" />

                {t("common.parExposure", { amount: formatCurrency(par) })}
              </Badge>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {t("officer.portfolioOutstanding")}
                </CardDescription>

                <CardTitle className="text-2xl">
                  {formatCurrency(outstanding)}
                </CardTitle>
              </CardHeader>

              <CardContent className="text-xs text-muted-foreground">
                {t("officer.fromBranchMetrics")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {t("officer.collectionsPeriod")}
                </CardDescription>

                <CardTitle className="text-2xl">
                  {formatCurrency(collected)}
                </CardTitle>
              </CardHeader>

              <CardContent className="text-xs text-muted-foreground">
                {t("officer.reportedCollections")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("officer.activeLoans")}</CardDescription>

                <CardTitle className="text-2xl">{activeLoans}</CardTitle>
              </CardHeader>

              <CardContent className="text-xs text-muted-foreground">
                {t("officer.activeLoanCount")}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  {t("officer.applicationsYouCreated")}
                </CardDescription>

                <CardTitle className="text-2xl">{appCounts.total}</CardTitle>
              </CardHeader>

              <CardContent className="text-xs text-muted-foreground">
                {t("common.approvedCount", { count: appCounts.approved })}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("officer.applicationFlow")}
                </CardTitle>

                <CardDescription>
                  {t("officer.applicationsOriginated")}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">
                    {t("common.pendingReview")}
                  </span>

                  <span className="font-semibold">{appCounts.pending}</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">
                    {t("common.approved")}
                  </span>

                  <span className="font-semibold">{appCounts.approved}</span>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-muted-foreground">
                    {t("common.totalOriginated")}
                  </span>

                  <span className="font-semibold">{appCounts.total}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("officer.quickActions")}
                </CardTitle>

                <CardDescription>
                  {t("officer.quickActionsDesc")}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>{t("officer.quickActionsBody")}</p>

                <div className="flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />

                  <span className="text-sm font-medium">
                    {t("officer.recoveryMetrics")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {t("officer.fieldFocus")}
                </CardTitle>

                <CardDescription>{t("officer.summaryTiles")}</CardDescription>
              </CardHeader>

              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("officer.pendingApplications")}
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    {appCounts.pending}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("officer.customers")}
                  </p>

                  <p className="mt-1 text-xl font-semibold">{customerCount}</p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("officer.portfolioOutstandingShort")}
                  </p>

                  <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
                    <HandCoins className="h-4 w-4 text-emerald-600" />

                    {formatCurrency(outstanding)}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("officer.activeLoans")}
                  </p>

                  <p className="mt-1 inline-flex items-center gap-1 text-xl font-semibold">
                    <Wallet className="h-4 w-4 text-blue-600" />

                    {activeLoans}
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
