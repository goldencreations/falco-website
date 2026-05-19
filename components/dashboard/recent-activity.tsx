"use client";

import { useEffect, useState } from "react";
import { CreditCard, FileText, AlertCircle, CheckCircle, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ActivityType = "payment" | "application" | "disbursement" | "overdue";

interface Activity {
 id: string;
 type: ActivityType;
 title: string;
 description: string;
 amount?: number;
 status?: string;
 timestamp: string;
}

function mapRemoteType(t: string): ActivityType {
 const s = t.toLowerCase();
 if (s.includes("payment")) return "payment";
 if (s.includes("application")) return "application";
 if (s.includes("overdue") || s.includes("arrear")) return "overdue";
 return "disbursement";
}

function mapItems(json: unknown): Activity[] {
 if (!json || typeof json !== "object") return [];
 const items = (json as { items?: unknown[] }).items;
 if (!Array.isArray(items)) return [];
 return items.map((raw, index) => {
 const row = raw as Record<string, unknown>;
 const id = String(row.id ?? `row-${index}`);
 const type = mapRemoteType(String(row.type ?? ""));
 const title = String(row.title ?? "Activity");
 const description = String(row.description ?? "");
 const created = String(row.created_at ?? new Date().toISOString());
 const status = row.status != null ? String(row.status) : undefined;
 return {
 id,
 type,
 title,
 description,
 status,
 timestamp: created,
 };
 });
}

const typeConfig = {
 payment: {
 icon: CreditCard,
 bgColor: "bg-success/10",
 iconColor: "text-success",
 ringColor: "ring-success/20",
 },
 application: {
 icon: FileText,
 bgColor: "bg-info/10",
 iconColor: "text-info",
 ringColor: "ring-info/20",
 },
 disbursement: {
 icon: CheckCircle,
 bgColor: "bg-primary/10",
 iconColor: "text-primary",
 ringColor: "ring-primary/20",
 },
 overdue: {
 icon: AlertCircle,
 bgColor: "bg-destructive/10",
 iconColor: "text-destructive",
 ringColor: "ring-destructive/20",
 },
};

export function RecentActivity() {
 const { t } = useTranslations();
 const [activities, setActivities] = useState<Activity[]>([]);

 useEffect(() => {
 let cancelled = false;
 void fetch("/api/falco/dashboard/recent-activity?limit=20")
 .then((r) => r.json())
 .then((json) => {
 if (!cancelled) setActivities(mapItems(json));
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, []);

 return (
 <Card className="border border-border/70 shadow-sm">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <div>
 <CardTitle className="text-lg">{t("recentActivity.title")}</CardTitle>
 <CardDescription>{t("recentActivity.description")}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant="outline" className="hidden text-xs sm:inline-flex">
 {t("common.updates", { count: activities.length })}
 </Badge>
 <Button variant="ghost" size="sm" asChild className="gap-1 text-primary">
 <Link href="/payments">
 {t("common.viewAll")}
 <ArrowUpRight className="h-4 w-4" />
 </Link>
 </Button>
 </div>
 </CardHeader>
 <CardContent className="p-0">
 <div className="overflow-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-border/60 bg-muted/30">
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 {t("recentActivity.activity")}
 </th>
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 {t("recentActivity.details")}
 </th>
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
 {t("recentActivity.status")}
 </th>
 <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground whitespace-nowrap">
 {t("recentActivity.date")}
 </th>
 </tr>
 </thead>
 <tbody>
 {activities.length === 0 ? (
 <tr>
 <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
 {t("recentActivity.empty")}
 </td>
 </tr>
 ) : (
 activities.map((activity, i) => {
 const config = typeConfig[activity.type];
 const Icon = config.icon;
 return (
 <tr
 key={activity.id}
 className={cn(
 "transition-colors hover:bg-muted/30",
 i !== activities.length - 1 && "border-b border-border/40"
 )}
 >
 <td className="px-4 py-3 font-medium whitespace-nowrap">
 <div className="flex items-center gap-2.5">
 <div
 className={cn(
 "rounded-lg p-1.5 ring-1",
 config.bgColor,
 config.iconColor,
 config.ringColor
 )}
 >
 <Icon className="h-3.5 w-3.5" />
 </div>
 {activity.title}
 </div>
 </td>

 <td className="max-w-xs px-4 py-3 text-muted-foreground">
 <span className="line-clamp-1">{activity.description}</span>
 </td>

 <td className="px-4 py-3">
 {activity.status ? (
 <Badge
 variant="outline"
 className={cn(
 "text-[10px] font-medium",
 activity.type === "overdue"
 ? "border-destructive/20 bg-destructive/10 text-destructive"
 : activity.status === "completed" || activity.status === "approved"
 ? "border-success/20 bg-success/10 text-success"
 : "bg-muted text-muted-foreground"
 )}
 >
 {activity.status.replace(/_/g, " ")}
 </Badge>
 ) : (
 <span className="text-muted-foreground/50">—</span>
 )}
 </td>

 <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
 {formatDateTime(activity.timestamp)}
 </td>
 </tr>
 );
 })
 )}
 </tbody>
 </table>
 </div>
 </CardContent>
 </Card>
 );
}
