"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Loader2,
  Medal,
  RefreshCcw,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/formatters";
import { useTranslations } from "@/lib/i18n/use-translations";
import {
  officerPeerDisplayName,
  type OfficerPerformancePeriod,
  type OfficerPeerPerformanceRow,
} from "@/lib/officer-peer-performance";

const PERIOD_OPTIONS: { value: OfficerPerformancePeriod; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "term", label: "Term" },
];

type PeerPerformancePayload = {
  period: OfficerPerformancePeriod;
  range: { from: string; to: string; label: string };
  officers: OfficerPeerPerformanceRow[];
  topPerformer: OfficerPeerPerformanceRow | null;
  totalOfficers: number;
  currentUser: OfficerPeerPerformanceRow | null;
  currentUserId: string;
  currentUserFullName?: string;
};

type Props = {
  branchId: string;
  currentUserId: string;
  currentUserFullName: string;
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Crown className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-700">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-800">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

export function OfficerPeerPerformanceWidget({
  branchId,
  currentUserId,
  currentUserFullName,
}: Props) {
  const { t } = useTranslations();
  const [period, setPeriod] = useState<OfficerPerformancePeriod>("month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<PeerPerformancePayload | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!branchId) return;
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          branch_id: branchId,
          period,
        });
        const res = await apiFetch(`/api/officer/dashboard/peer-performance?${params.toString()}`);
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(json.message ?? "Could not load team performance.");
        }
        const data = (await res.json()) as PeerPerformancePayload;
        setPayload(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load team performance.");
        setPayload(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [branchId, period]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rankedOfficers = payload?.officers ?? [];
  const totalOfficers = payload?.totalOfficers ?? rankedOfficers.length;
  const sessionName = payload?.currentUserFullName?.trim() || currentUserFullName.trim();
  const yourPosition =
    payload?.currentUser ??
    rankedOfficers.find((row) => row.user_id === currentUserId) ??
    null;
  const topPerformer = payload?.topPerformer ?? rankedOfficers.find((row) => row.rank === 1) ?? null;
  const rangeLabel = payload?.range.label ?? "This month";

  const displayName = (row: OfficerPeerPerformanceRow, fallback?: string) =>
    officerPeerDisplayName(row, fallback);

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border-emerald-200/60 shadow-sm">
        <CardHeader className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/80 via-background to-background pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-emerald-700" />
                {t("officer.peerRankingsTitle")}
              </CardTitle>
              <CardDescription>
                All loan officers in your branch ranked by assigned customers, applications,
                loans, and collections. The top performer is the same for everyone in the branch.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-lg border border-emerald-200/70 bg-background p-1">
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={period === option.value ? "default" : "ghost"}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs",
                      period === option.value && "bg-emerald-700 text-white hover:bg-emerald-700/90"
                    )}
                    onClick={() => setPeriod(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => void load({ silent: true })}
                disabled={loading || refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="border-emerald-200 text-emerald-800">
              {rangeLabel}
            </Badge>
            {payload?.range ? (
              <span className="text-xs text-muted-foreground">
                {payload.range.from} to {payload.range.to}
              </span>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 lg:p-6">
          {error ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-52 w-full rounded-xl" />
            </div>
          ) : rankedOfficers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No loan officers were found for your branch. Staff are loaded from the Falco staff
              directory and branch summary API.
            </p>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-2">
                {topPerformer ? (
                  <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-4 text-white shadow-sm">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                      <Crown className="h-4 w-4 text-amber-300" />
                      Top performer · {rangeLabel}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">
                      {displayName(topPerformer)}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/90">
                      Rank #{topPerformer.rank} · Score {topPerformer.score.toFixed(1)} ·{" "}
                      {topPerformer.loans_handled} loans · {topPerformer.applications} applications ·{" "}
                      {formatCurrency(topPerformer.collections_amount)} collected
                    </p>
                  </div>
                ) : null}

                {yourPosition ? (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800/80">
                      {t("officer.yourPosition")} · {rangeLabel}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <RankBadge rank={yourPosition.rank} />
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {displayName(yourPosition, sessionName)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          #{yourPosition.rank} of {totalOfficers} loan officers · Score{" "}
                          {yourPosition.score.toFixed(1)} ·{" "}
                          {formatCurrency(yourPosition.collections_amount)} collected
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-200/80 bg-emerald-50/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800/80">
                      {t("officer.yourPosition")} · {rangeLabel}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {sessionName || "Your"} ranking is being calculated for this period.
                    </p>
                  </div>
                )}
              </div>

              <div className="hidden overflow-hidden rounded-xl border md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-14">Rank</TableHead>
                      <TableHead>Officer</TableHead>
                      <TableHead className="text-right">Assigned cust.</TableHead>
                      <TableHead className="text-right">Created cust.</TableHead>
                      <TableHead className="text-right">Applications</TableHead>
                      <TableHead className="text-right">Loans</TableHead>
                      <TableHead className="text-right">{t("officer.collected")}</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankedOfficers.map((row) => {
                      const isYou = row.user_id === currentUserId;
                      return (
                        <TableRow
                          key={row.user_id}
                          className={cn(
                            isYou && "bg-emerald-50/70 hover:bg-emerald-50/70",
                            row.rank === 1 && !isYou && "bg-amber-50/40 hover:bg-amber-50/40"
                          )}
                        >
                          <TableCell>
                            <RankBadge rank={row.rank} />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{displayName(row)}</div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              {row.employee_id?.trim() ? (
                                <span className="font-mono">{row.employee_id}</span>
                              ) : null}
                              {isYou ? (
                                <Badge className="h-5 bg-emerald-700 px-1.5 text-[10px] hover:bg-emerald-700">
                                  You
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{row.customers_assigned}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.customers_created}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.applications}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.loans_handled}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(row.collections_amount)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {row.score.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {rankedOfficers.map((row) => {
                  const isYou = row.user_id === currentUserId;
                  return (
                    <Card
                      key={row.user_id}
                      className={cn(
                        "border-border/70",
                        isYou && "border-emerald-300 bg-emerald-50/50",
                        row.rank === 1 && !isYou && "border-amber-200/80"
                      )}
                    >
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <RankBadge rank={row.rank} />
                            <div>
                              <p className="font-semibold">{displayName(row)}</p>
                              {row.employee_id?.trim() ? (
                                <p className="text-xs text-muted-foreground font-mono">{row.employee_id}</p>
                              ) : null}
                            </div>
                          </div>
                          {isYou ? (
                            <Badge className="bg-emerald-700 hover:bg-emerald-700">You</Badge>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg border bg-background p-2">
                            <p className="text-[11px] text-muted-foreground">Assigned cust.</p>
                            <p className="font-semibold tabular-nums">{row.customers_assigned}</p>
                          </div>
                          <div className="rounded-lg border bg-background p-2">
                            <p className="text-[11px] text-muted-foreground">Created cust.</p>
                            <p className="font-semibold tabular-nums">{row.customers_created}</p>
                          </div>
                          <div className="rounded-lg border bg-background p-2">
                            <p className="text-[11px] text-muted-foreground">Applications</p>
                            <p className="font-semibold tabular-nums">{row.applications}</p>
                          </div>
                          <div className="rounded-lg border bg-background p-2">
                            <p className="text-[11px] text-muted-foreground">Loans</p>
                            <p className="font-semibold tabular-nums">{row.loans_handled}</p>
                          </div>
                          <div className="rounded-lg border bg-background p-2 col-span-2">
                            <p className="text-[11px] text-muted-foreground">{t("officer.collected")}</p>
                            <p className="font-semibold tabular-nums">
                              {formatCurrency(row.collections_amount)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                          <span className="text-muted-foreground">{t("officer.performanceScore")}</span>
                          <span className="font-semibold tabular-nums">{row.score.toFixed(1)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                {totalOfficers} loan officer{totalOfficers === 1 ? "" : "s"} ranked in your branch.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
