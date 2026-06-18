"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Eye,
  Loader2,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import type { VikundiCollectionSummary } from "@/lib/vikundi-collection-summary";
import { useTranslations } from "@/lib/i18n/use-translations";

type VikundiListPayload = {
  summaries: VikundiCollectionSummary[];
  totals: {
    group_count: number;
    active_groups: number;
    total_members: number;
    total_collected: number;
    total_outstanding: number;
    total_monthly_income: number;
    open_leads: number;
    loans_in_arrears: number;
  };
};

function resolveCollectionsBase(pathname: string): string {
  if (pathname.startsWith("/accountant/collections")) return "/accountant/collections";
  if (pathname.startsWith("/manager/collections")) return "/manager/collections";
  return "/collections";
}

export default function CollectionsVikundiPage() {
  const { t } = useTranslations();
  const pathname = usePathname();
  const base = resolveCollectionsBase(pathname);
  const [payload, setPayload] = useState<VikundiListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/collections/vikundi", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as VikundiListPayload & { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Failed to load vikundi collections");
      setPayload(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vikundi collections");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summaries = useMemo(() => {
    const rows = payload?.summaries ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.group_name.toLowerCase().includes(q) ||
        row.group_code.toLowerCase().includes(q) ||
        row.meeting_location.toLowerCase().includes(q)
    );
  }, [payload?.summaries, search]);

  const totals = payload?.totals;

  return (
    <>
      <DashboardHeader
        title={t("collections.vikundiTitle")}
        description={t("collections.vikundiDesc")}
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {error ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("collections.vikundiGroups")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals?.group_count ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {totals?.active_groups ?? 0} {t("collections.vikundiActive")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  {t("collections.vikundiCollected")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(totals?.total_collected ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {t("collections.vikundiOutstanding")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(totals?.total_outstanding ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totals?.loans_in_arrears ?? 0} {t("collections.vikundiInArrears")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("collections.vikundiMembers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totals?.total_members ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totals?.total_monthly_income ?? 0)} {t("collections.vikundiMonthlyIncome")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>{t("collections.vikundiListTitle")}</CardTitle>
                <CardDescription>{t("collections.vikundiListDesc")}</CardDescription>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("collections.vikundiSearch")}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t("collections.vikundiLoading")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("collections.vikundiGroup")}</TableHead>
                      <TableHead className="text-center">{t("collections.vikundiMembers")}</TableHead>
                      <TableHead className="text-right">{t("collections.vikundiCollected")}</TableHead>
                      <TableHead className="text-right">{t("collections.vikundiOutstanding")}</TableHead>
                      <TableHead className="text-center">{t("collections.vikundiLeads")}</TableHead>
                      <TableHead>{t("collections.vikundiStatus")}</TableHead>
                      <TableHead className="text-right">{t("collections.vikundiActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          {t("collections.vikundiEmpty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      summaries.map((row) => (
                        <TableRow key={row.group_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.group_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {row.group_code || row.group_id} · {row.meeting_day} · {row.meeting_location}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{row.member_count}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-700">
                            {formatCurrency(row.total_collected)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            {formatCurrency(row.total_outstanding)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{row.open_leads}</TableCell>
                          <TableCell>
                            <Badge variant={row.status === "active" ? "default" : "secondary"}>
                              {row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`${base}/vikundi/${row.group_id}`}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                {t("collections.vikundiView")}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {!loading && summaries.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summaries.map((row) => (
                <Card key={`card-${row.group_id}`} className="overflow-hidden">
                  <CardHeader className="border-b bg-muted/20 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{row.group_name}</CardTitle>
                        <CardDescription>{row.group_code || row.group_id}</CardDescription>
                      </div>
                      <Badge variant={row.status === "active" ? "default" : "secondary"}>
                        {row.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 pt-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("collections.vikundiMembers")}</span>
                      <span className="font-semibold">{row.member_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("collections.vikundiCollected")}</span>
                      <span className="font-semibold text-emerald-700">
                        {formatCurrency(row.total_collected)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("collections.vikundiOutstanding")}</span>
                      <span className="font-semibold text-destructive">
                        {formatCurrency(row.total_outstanding)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("collections.vikundiMonthlyIncome")}</span>
                      <span className="font-semibold">{formatCurrency(row.total_monthly_income)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("collections.vikundiLeads")}</span>
                      <span className="font-semibold">{row.open_leads}</span>
                    </div>
                    <Button className="mt-2 w-full" variant="outline" asChild>
                      <Link href={`${base}/vikundi/${row.group_id}`}>
                        <Wallet className="mr-2 h-4 w-4" />
                        {t("collections.vikundiViewSummary")}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
