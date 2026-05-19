"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Phone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/lib/i18n/use-translations";
import { formatCurrency } from "@/lib/formatters";
import type { RiskClassification } from "@/lib/types";
import { cn } from "@/lib/utils";

function riskLabels(t: (key: string) => string): Record<
 RiskClassification,
 { label: string; className: string; bgClassName: string }
> {
 return {
 current: {
 label: t("risk.current"),
 className: "bg-success/10 text-success border-success/20",
 bgClassName: "bg-success/5",
 },
 especially_mentioned: {
 label: t("risk.watch"),
 className: "bg-warning/10 text-warning-foreground border-warning/20",
 bgClassName: "bg-warning/5",
 },
 substandard: {
 label: t("risk.substandard"),
 className: "bg-destructive/10 text-destructive border-destructive/20",
 bgClassName: "bg-destructive/5",
 },
 doubtful: {
 label: t("risk.doubtful"),
 className: "bg-destructive/15 text-destructive border-destructive/30",
 bgClassName: "bg-destructive/5",
 },
 loss: {
 label: t("risk.loss"),
 className: "bg-foreground/10 text-foreground border-foreground/20",
 bgClassName: "bg-foreground/5",
 },
};
}

type RiskRow = {
 id: string;
 customer_name?: string;
 customer_phone?: string;
 loan_number?: string;
 product_name?: string;
 outstanding_amount?: number;
 days_overdue?: number;
 risk_classification?: string;
};

function mapRows(json: unknown): RiskRow[] {
 if (!json || typeof json !== "object") return [];
 const items = (json as { items?: unknown[]; data?: unknown[] }).items ?? (json as { data?: unknown[] }).data;
 if (!Array.isArray(items)) return [];
 return items.map((raw, index) => {
 const row = raw as Record<string, unknown>;
 const customer =
 row.customer && typeof row.customer === "object"
 ? (row.customer as Record<string, unknown>)
 : null;
 const customerName =
 (row.customer_name ? String(row.customer_name) : "") ||
 (row.customer_display_name ? String(row.customer_display_name) : "") ||
 (customer?.full_name ? String(customer.full_name) : "") ||
 [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
 const customerPhone =
 (row.customer_phone ? String(row.customer_phone) : "") ||
 (customer?.phone_primary ? String(customer.phone_primary) : "") ||
 (customer?.phone_number ? String(customer.phone_number) : "");
 return {
 id: String(row.id ?? row.loan_id ?? `loan-${index}`),
 customer_name: customerName.trim() || undefined,
 customer_phone: customerPhone.trim() || undefined,
 loan_number: row.loan_number ? String(row.loan_number) : String(row.id ?? ""),
 product_name: row.product_name ? String(row.product_name) : undefined,
 outstanding_amount:
 row.outstanding_amount != null
 ? Number(row.outstanding_amount)
 : row.total_outstanding != null
 ? Number(row.total_outstanding)
 : undefined,
 days_overdue:
 row.days_overdue != null
 ? Number(row.days_overdue)
 : row.days_in_arrears != null
 ? Number(row.days_in_arrears)
 : 0,
 risk_classification: row.risk_classification ? String(row.risk_classification) : "especially_mentioned",
 };
 });
}

function classificationKey(raw: string | undefined): RiskClassification {
 if (
 raw === "current" ||
 raw === "especially_mentioned" ||
 raw === "substandard" ||
 raw === "doubtful" ||
 raw === "loss"
 ) {
 return raw;
 }
 return "especially_mentioned";
}

export function LoansAtRisk() {
 const { t } = useTranslations();
 const riskConfig = riskLabels(t);
 const [rows, setRows] = useState<RiskRow[]>([]);

 useEffect(() => {
 let cancelled = false;
 void fetch("/api/falco/dashboard/loans-requiring-attention")
 .then((r) => r.json())
 .then((json) => {
 if (!cancelled) setRows(mapRows(json));
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, []);

 return (
 <Card className="col-span-full border border-border/70 shadow-sm">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <div>
 <CardTitle className="text-lg flex items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-destructive" />
 {t("loansAtRisk.title")}
 </CardTitle>
 <CardDescription>{t("loansAtRisk.description", { count: rows.length })}</CardDescription>
 </div>
 <Button variant="outline" size="sm" asChild className="gap-2">
 <Link href="/collections">
 {t("loansAtRisk.viewCollections")}
 <ExternalLink className="h-4 w-4" />
 </Link>
 </Button>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow className="hover:bg-transparent">
 <TableHead>{t("common.customer")}</TableHead>
 <TableHead>{t("loansAtRisk.loanNumber")}</TableHead>
 <TableHead>{t("loansAtRisk.product")}</TableHead>
 <TableHead className="text-right">{t("loansAtRisk.outstanding")}</TableHead>
 <TableHead className="text-center">{t("loansAtRisk.daysOverdue")}</TableHead>
 <TableHead>{t("loansAtRisk.classification")}</TableHead>
 <TableHead className="text-right">{t("loansAtRisk.actions")}</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {rows.length === 0 ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
 <div className="flex flex-col items-center gap-2">
 <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
 <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 </div>
 <p className="font-medium">{t("loansAtRisk.emptyTitle")}</p>
 <p className="text-sm">{t("loansAtRisk.emptySubtitle")}</p>
 </div>
 </TableCell>
 </TableRow>
 ) : (
 rows.map((loan) => {
 const key = classificationKey(loan.risk_classification);
 const config = riskConfig[key];
 const initials = (loan.customer_name ?? "?")
 .split(/\s+/)
 .filter(Boolean)
 .map((p) => p[0])
 .join("")
 .slice(0, 2);
 return (
 <TableRow key={loan.id} className={cn("transition-colors", config.bgClassName)}>
 <TableCell>
 <div className="flex items-center gap-3">
 <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
 <span className="text-sm font-semibold text-primary">{initials}</span>
 </div>
 <div>
 <p className="font-medium">{loan.customer_name ?? "—"}</p>
 <p className="text-xs text-muted-foreground flex items-center gap-1">
 <Phone className="h-3 w-3" />
 {loan.customer_phone ?? "—"}
 </p>
 </div>
 </div>
 </TableCell>
 <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
 <TableCell>
 <span className="text-sm">{loan.product_name ?? "—"}</span>
 </TableCell>
 <TableCell className="text-right">
 <span className="font-semibold tabular-nums">
 {formatCurrency(loan.outstanding_amount ?? 0)}
 </span>
 </TableCell>
 <TableCell className="text-center">
 <span
 className={cn(
 "inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full text-sm font-bold",
 (loan.days_overdue ?? 0) > 90
 ? "bg-destructive/10 text-destructive"
 : (loan.days_overdue ?? 0) > 30
 ? "bg-warning/10 text-warning-foreground"
 : "bg-muted text-muted-foreground"
 )}
 >
 {loan.days_overdue ?? 0}
 </span>
 </TableCell>
 <TableCell>
 <Badge variant="outline" className={cn("font-medium", config.className)}>
 {config.label}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
 <Link href={`/loans/${loan.id}`}>{t("loansAtRisk.viewDetails")}</Link>
 </Button>
 </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 );
}
