"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Loader2,
  MapPin,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { VikundiCollectionDetail } from "@/lib/vikundi-collection-summary";
import { useTranslations } from "@/lib/i18n/use-translations";

function resolveCollectionsBase(pathname: string): string {
  if (pathname.startsWith("/accountant/collections")) return "/accountant/collections";
  if (pathname.startsWith("/manager/collections")) return "/manager/collections";
  return "/collections";
}

function riskBadgeClass(classification: string): string {
  const map: Record<string, string> = {
    current: "bg-emerald-100 text-emerald-800",
    especially_mentioned: "bg-amber-100 text-amber-800",
    substandard: "bg-orange-100 text-orange-800",
    doubtful: "bg-red-100 text-red-800",
    loss: "bg-slate-900 text-white",
  };
  return map[classification] ?? "bg-muted text-muted-foreground";
}

export default function CollectionsVikundiDetailPage() {
  const { t } = useTranslations();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const groupId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const base = resolveCollectionsBase(pathname);
  const { users, branches } = useBranchAssignment();

  const [detail, setDetail] = useState<VikundiCollectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!groupId) {
      setError("Group not found");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/collections/vikundi/${encodeURIComponent(groupId)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as { detail?: VikundiCollectionDetail; message?: string };
      if (!res.ok || !json.detail) {
        throw new Error(json.message ?? "Failed to load kikundi summary");
      }
      setDetail(json.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load kikundi summary");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <>
        <DashboardHeader title={t("collections.vikundiDetailTitle")} description={t("collections.vikundiLoading")} />
        <main className="flex flex-1 items-center justify-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t("collections.vikundiLoading")}
        </main>
      </>
    );
  }

  if (!detail || error) {
    return (
      <>
        <DashboardHeader title={t("collections.vikundiDetailTitle")} />
        <main className="flex-1 space-y-4 p-6">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button asChild>
            <Link href={`${base}/vikundi`}>{t("collections.vikundiBack")}</Link>
          </Button>
        </main>
      </>
    );
  }

  const officerName = users.find((user) => user.id === detail.loan_officer_id)?.full_name ?? "—";
  const branchName = branches.find((branch) => branch.id === detail.branch_id)?.name ?? detail.branch_id;

  return (
    <>
      <DashboardHeader
        title={detail.group_name}
        description={t("collections.vikundiDetailDesc")}
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`${base}/vikundi`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("collections.vikundiBack")}
            </Link>
          </Button>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("collections.vikundiCollected")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(detail.total_collected)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("collections.vikundiOutstanding")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrency(detail.total_outstanding)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {detail.loans_in_arrears} {t("collections.vikundiInArrears")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("collections.vikundiPrincipal")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(detail.total_principal)}</div>
                <p className="text-xs text-muted-foreground">
                  {detail.active_loans} {t("collections.vikundiActiveLoans")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{t("collections.vikundiMonthlyIncome")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(detail.total_monthly_income)}</div>
                <p className="text-xs text-muted-foreground">
                  {detail.member_count} {t("collections.vikundiMembers")} · {detail.open_leads} {t("collections.vikundiLeads")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("collections.vikundiProfile")}</CardTitle>
              <CardDescription>{detail.group_code || detail.group_id}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {t("collections.vikundiOfficer")}: {officerName}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {branchName} · {detail.village_or_street}
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {detail.meeting_day} · {detail.meeting_location}
                </p>
              </div>
              <div className="space-y-2">
                <p>{t("collections.vikundiFormation")}: {formatDate(detail.formation_date)}</p>
                <p>
                  {t("collections.vikundiStatus")}:{" "}
                  <Badge variant={detail.status === "active" ? "default" : "secondary"}>
                    {detail.status}
                  </Badge>
                </p>
                {detail.max_days_in_arrears > 0 ? (
                  <p className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {t("collections.vikundiMaxArrears")}: {detail.max_days_in_arrears} days
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-emerald-700">
                    <TrendingUp className="h-4 w-4" />
                    {t("collections.vikundiNoArrears")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("collections.vikundiMemberBreakdown")}</CardTitle>
              <CardDescription>{t("collections.vikundiMemberBreakdownDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("collections.vikundiMember")}</TableHead>
                    <TableHead>{t("collections.vikundiRole")}</TableHead>
                    <TableHead className="text-right">{t("collections.vikundiMonthlyIncome")}</TableHead>
                    <TableHead className="text-center">{t("collections.vikundiLoans")}</TableHead>
                    <TableHead className="text-right">{t("collections.vikundiCollected")}</TableHead>
                    <TableHead className="text-right">{t("collections.vikundiOutstanding")}</TableHead>
                    <TableHead className="text-center">{t("collections.vikundiLeads")}</TableHead>
                    <TableHead>{t("collections.vikundiRisk")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        {t("collections.vikundiNoMembers")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    detail.members.map((member) => (
                      <TableRow key={member.customer_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{member.customer_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.customer_number} · {member.phone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{member.role ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(member.monthly_income)}</TableCell>
                        <TableCell className="text-center tabular-nums">
                          {member.active_loans}/{member.loan_count}
                        </TableCell>
                        <TableCell className="text-right text-emerald-700">
                          {formatCurrency(member.total_collected)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(member.total_outstanding)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{member.open_leads}</TableCell>
                        <TableCell>
                          <Badge className={riskBadgeClass(member.risk_classification)}>
                            {member.days_in_arrears > 0
                              ? `${member.days_in_arrears}d`
                              : member.risk_classification}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-emerald-200/70 bg-emerald-50/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Wallet className="h-5 w-5" />
                {t("collections.vikundiTotals")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("collections.vikundiPrincipal")}</p>
                <p className="text-lg font-semibold">{formatCurrency(detail.total_principal)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("collections.vikundiCollected")}</p>
                <p className="text-lg font-semibold text-emerald-700">
                  {formatCurrency(detail.total_collected)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("collections.vikundiOutstanding")}</p>
                <p className="text-lg font-semibold text-destructive">
                  {formatCurrency(detail.total_outstanding)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("collections.vikundiMonthlyIncome")}</p>
                <p className="text-lg font-semibold">{formatCurrency(detail.total_monthly_income)}</p>
              </div>
            </CardContent>
          </Card>

          {detail.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("collections.vikundiNotes")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{detail.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </>
  );
}
