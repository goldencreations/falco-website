"use client";

import Link from "next/link";
import {
 ArrowDownRight,
 ArrowUpRight,
 BookOpen,
 ChevronRight,
 CreditCard,
 Loader2,
 Scale,
 ShieldCheck,
 Wallet,
 WalletCards,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AccountantPageHeader } from "@/components/accountant/accountant-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
 AccountantDashboardStats,
 AccountantFinanceSnapshot,
} from "@/lib/accountant-dashboard-metrics";
import {
 buildAccountantStatCards,
 buildFinanceActivityRows,
 buildReconciliationDonut,
 type AccountantStatCard,
} from "@/lib/accountant-dashboard-ui";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useTranslations } from "@/lib/i18n/use-translations";
import { tLabel } from "@/lib/i18n/labels";
import { cn } from "@/lib/utils";

const STAT_ICONS = {
 wallet: Wallet,
 payments: CreditCard,
 reconciliation: Scale,
 disbursements: WalletCards,
} as const;

function StatCard({ card, vsLastMonth }: { card: AccountantStatCard; vsLastMonth: string }) {
 const Icon = STAT_ICONS[card.icon];
 return (
 <Card className={cn("border shadow-sm", card.accent)}>
 <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-1 pt-3 px-3">
 <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", card.iconBg)}>
 <Icon className={cn("h-4 w-4", card.iconColor)} />
 </div>
 <CardDescription className="text-[10px] font-medium uppercase tracking-wide leading-tight">
 {card.title}
 </CardDescription>
 </CardHeader>
 <CardContent className="px-3 pb-3 pt-0">
 <p className="text-xl font-bold tabular-nums tracking-tight text-foreground">{card.value}</p>
 {card.subValue ? <p className="mt-0.5 text-[11px] text-muted-foreground">{card.subValue}</p> : null}
 <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
 {card.trend.up ? (
 <ArrowUpRight className="h-3 w-3 text-emerald-600" />
 ) : (
 <ArrowDownRight className="h-3 w-3 text-rose-600" />
 )}
 <span className={card.trend.up ? "font-medium text-emerald-700" : "font-medium text-rose-700"}>
 {card.trend.label}
 </span>
 <span>{vsLastMonth}</span>
 </div>
 </CardContent>
 </Card>
 );
}

function statusBadgeClass(tone: string) {
 if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
 if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
 if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-800";
 if (tone === "info") return "border-blue-200 bg-blue-50 text-blue-800";
 return "border-border bg-muted text-muted-foreground";
}

export function AccountantDashboardView({
 branchLabel,
 stats,
 snapshot,
 loadingEssentials,
 loadingDetails,
 error,
 onRefresh,
}: {
 branchLabel: string;
 stats: AccountantDashboardStats | null;
 snapshot: AccountantFinanceSnapshot | null;
 loadingEssentials: boolean;
 loadingDetails: boolean;
 error: string | null;
 onRefresh: () => void;
}) {
 const { t, language } = useTranslations();
 const refreshing = loadingEssentials || loadingDetails;

 const statCards = stats && snapshot ? buildAccountantStatCards(stats, snapshot, formatCurrency) : [];
 const donut = stats ? buildReconciliationDonut(stats) : [];
 const donutTotal = donut.reduce((sum, s) => sum + s.value, 0);
 const activities = snapshot ? buildFinanceActivityRows(snapshot) : [];

 const vsLastMonth =
 language === "sw" ? "ikilinganishwa na mwezi uliopita" : "vs last month";

 return (
 <>
 <AccountantPageHeader branchLabel={branchLabel} onRefresh={onRefresh} refreshing={refreshing} />

 <main className="flex-1 overflow-auto p-3 lg:p-5">
 <div className="mx-auto max-w-7xl space-y-4">
 {loadingEssentials ? (
 <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 </div>
 ) : error ? (
 <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
 {error}
 </div>
 ) : stats && snapshot ? (
 <>
 <Card className="border-violet-200/70 bg-gradient-to-r from-violet-600 via-violet-700 to-indigo-800 p-4 text-white shadow-sm">
 <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-100">
 {language === "sw" ? "Muhtasari wa fedha" : "Finance overview"}
 </p>
 <h2 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
 {language === "sw" ? `Shughuli za ${branchLabel}` : `${branchLabel} operations`}
 </h2>
 <p className="mt-0.5 text-xs text-violet-100/90">{stats.insightText}</p>
 </Card>

 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
 {statCards.map((card) => (
 <StatCard key={card.key} card={card} vsLastMonth={vsLastMonth} />
 ))}
 </div>

 <div className="grid gap-4 xl:grid-cols-3">
 <Card className="overflow-hidden xl:col-span-2">
 <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b px-4 py-3">
 <div>
 <CardTitle className="text-sm font-semibold">
 {language === "sw" ? "Shughuli za fedha" : "Finance activity"}
 </CardTitle>
 <CardDescription className="text-xs">
 {language === "sw"
 ? "Malipo, ugavi, na mikopo iliyochelewa"
 : "Recent payments, disbursements, and overdue loans"}
 </CardDescription>
 </div>
 <Button variant="outline" size="sm" asChild>
 <Link href="/accountant/payments">
 {t("common.viewAll")}
 <ChevronRight className="ml-1 h-3.5 w-3.5" />
 </Link>
 </Button>
 </CardHeader>

 <div className="overflow-x-auto">
 <table className="w-full text-left text-xs">
 <thead>
 <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
 <th className="px-3 py-2 font-medium">{language === "sw" ? "Maelezo" : "Description"}</th>
 <th className="hidden px-2 py-2 font-medium sm:table-cell">
 {language === "sw" ? "Aina" : "Type"}
 </th>
 <th className="px-2 py-2 font-medium text-right">{language === "sw" ? "Kiasi" : "Amount"}</th>
 <th className="hidden px-2 py-2 font-medium md:table-cell">
 {language === "sw" ? "Tarehe" : "Date"}
 </th>
 <th className="px-2 py-2 font-medium">{language === "sw" ? "Hali" : "Status"}</th>
 <th className="w-8 px-1 py-2" />
 </tr>
 </thead>
 <tbody>
 {loadingDetails && activities.length === 0 ? (
 <tr>
 <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
 <Loader2 className="mx-auto h-5 w-5 animate-spin" />
 </td>
 </tr>
 ) : activities.length === 0 ? (
 <tr>
 <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
 {language === "sw" ? "Hakuna shughuli za hivi karibuni." : "No recent finance activity yet."}
 </td>
 </tr>
 ) : (
 activities.map((row) => (
 <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
 <td className="max-w-[140px] truncate px-3 py-2 font-medium sm:max-w-none">{row.name}</td>
 <td className="hidden px-2 py-2 capitalize text-muted-foreground sm:table-cell">
 {row.category}
 </td>
 <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.amount)}</td>
 <td className="hidden px-2 py-2 text-muted-foreground md:table-cell">
 {row.date ? formatDate(row.date) : "—"}
 </td>
 <td className="px-2 py-2">
 <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadgeClass(row.statusTone))}>
 {row.status}
 </Badge>
 </td>
 <td className="px-1 py-2">
 <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
 <Link href={row.href} aria-label="Open">
 <ChevronRight className="h-3.5 w-3.5" />
 </Link>
 </Button>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 <div className="flex flex-wrap justify-center gap-1 border-t px-3 py-2">
 <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
 <Link href="/accountant/cashbook">
 <BookOpen className="mr-1 h-3.5 w-3.5" />
 {tLabel("Cashbook", language)}
 </Link>
 </Button>
 <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
 <Link href="/accountant/reconciliation">
 {tLabel("Reconciliation", language)}
 <ChevronRight className="ml-1 h-3.5 w-3.5" />
 </Link>
 </Button>
 <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
 <Link href="/accountant/collections">
 <ShieldCheck className="mr-1 h-3.5 w-3.5" />
 {tLabel("Collections", language)}
 </Link>
 </Button>
 </div>
 </Card>

 <Card>
 <CardHeader className="space-y-0 px-4 py-3">
 <CardTitle className="text-sm font-semibold">
 {language === "sw" ? "Utendaji wa upatanisho" : "Reconciliation performance"}
 </CardTitle>
 <CardDescription className="text-xs">
 {language === "sw"
 ? "Mgawanyo wa hali za malipo"
 : "Payment status mix from branch summary"}
 </CardDescription>
 </CardHeader>
 <CardContent className="px-4 pb-4 pt-0">
 <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="relative h-[130px] w-[130px] shrink-0">
 {donut.length > 0 ? (
 <ResponsiveContainer width="100%" height="100%">
 <PieChart>
 <Pie
 data={donut}
 dataKey="value"
 nameKey="label"
 cx="50%"
 cy="50%"
 innerRadius={38}
 outerRadius={58}
 paddingAngle={2}
 stroke="transparent"
 >
 {donut.map((entry) => (
 <Cell key={entry.key} fill={entry.color} />
 ))}
 </Pie>
 <Tooltip
 contentStyle={{
 background: "hsl(var(--card))",
 border: "1px solid hsl(var(--border))",
 borderRadius: 8,
 fontSize: 12,
 }}
 formatter={(value: number, name: string) => [value, name]}
 />
 </PieChart>
 </ResponsiveContainer>
 ) : (
 <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
 No data
 </div>
 )}
 <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-lg font-bold">{donutTotal}</span>
 <span className="text-[10px] text-muted-foreground">
 {language === "sw" ? "Jumla" : "Total"}
 </span>
 </div>
 </div>
 <ul className="w-full space-y-1.5 text-xs">
 {donut.map((seg) => (
 <li key={seg.key} className="flex items-center justify-between gap-2">
 <span className="flex items-center gap-1.5 text-muted-foreground">
 <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
 {seg.label}
 </span>
 <span className="font-medium tabular-nums">{seg.pct}%</span>
 </li>
 ))}
 </ul>
 </div>
 <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-center text-xs">
 <div className="rounded-md bg-amber-50 py-1.5">
 <p className="text-muted-foreground">PAR</p>
 <p className="font-semibold text-amber-700">{stats.parRate.toFixed(1)}%</p>
 </div>
 <div className="rounded-md bg-rose-50 py-1.5">
 <p className="text-muted-foreground">NPL</p>
 <p className="font-semibold text-rose-700">{stats.nplRate.toFixed(1)}%</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </>
 ) : null}
 </div>
 </main>
 </>
 );
}
