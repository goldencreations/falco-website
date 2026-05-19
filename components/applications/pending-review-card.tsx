"use client";

import Link from "next/link";
import {
 Building2,
 CheckCircle2,
 Clock,
 Eye,
 Loader2,
 ShieldAlert,
 TrendingUp,
 User,
 XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ApplicationViewRow } from "@/lib/application-adapters";
import { formatCurrency, formatCurrencyCompact, formatTermDays } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
 submitted: "Submitted",
 under_review: "Under review",
};

function riskBadgeClass(grade?: string): string {
 switch (grade?.toUpperCase()) {
 case "A":
 return "border-emerald-200 bg-emerald-50 text-emerald-800";
 case "B":
 return "border-sky-200 bg-sky-50 text-sky-800";
 case "C":
 return "border-amber-200 bg-amber-50 text-amber-800";
 case "D":
 return "border-orange-200 bg-orange-50 text-orange-800";
 default:
 return "border-muted bg-muted/50 text-muted-foreground";
 }
}

function MetricCell({
 label,
 value,
 className,
}: {
 label: string;
 value: React.ReactNode;
 className?: string;
}) {
 return (
 <div className={cn("min-w-0 rounded-lg border bg-muted/20 px-2.5 py-2", className)}>
 <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
 <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</p>
 </div>
 );
}

export type PendingReviewCardProps = {
 app: ApplicationViewRow;
 busy?: boolean;
 applicationsHref: string;
 approvedAmount: string;
 onApprovedAmountChange: (value: string) => void;
 canActivate: boolean;
 canApprove: boolean;
 canReject: boolean;
 canQueueReview: boolean;
 onActivate: () => void;
 onApprove: () => void;
 onReject: () => void;
 onQueueReview: () => void;
};

export function PendingReviewCard({
 app,
 busy,
 applicationsHref,
 approvedAmount,
 onApprovedAmountChange,
 canActivate,
 canApprove,
 canReject,
 canQueueReview,
 onActivate,
 onApprove,
 onReject,
 onQueueReview,
}: PendingReviewCardProps) {
 const statusLabel = statusLabels[app.status] ?? app.status.replace(/_/g, " ");
 const installmentRatio =
 app.monthlyIncome && app.monthlyIncome > 0 && app.installment_amount
 ? (app.installment_amount / app.monthlyIncome) * 100
 : null;

 const businessLabel =
 app.businessName?.trim() ||
 (app.purpose?.trim() ? app.purpose.trim().slice(0, 48) : "—");

 return (
 <Card className="flex h-full flex-col overflow-hidden border-border/80 shadow-sm">
 <CardHeader className="space-y-3 p-3 pb-2 sm:p-4">
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <p className="font-mono text-[11px] text-muted-foreground">{app.application_number}</p>
 <h3 className="mt-0.5 truncate text-base font-semibold leading-tight">
 {app.customerDisplayName}
 </h3>
 {app.customerNumber ? (
 <p className="text-xs text-muted-foreground">{app.customerNumber}</p>
 ) : null}
 </div>
 <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
 <Clock className="h-3 w-3" />
 {statusLabel}
 </Badge>
 </div>

 <div className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5">
 <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">
 Amount requested
 </p>
 <p className="text-xl font-bold tracking-tight text-primary sm:text-2xl">
 <span className="sm:hidden">{formatCurrencyCompact(app.requested_amount)}</span>
 <span className="hidden sm:inline">{formatCurrency(app.requested_amount)}</span>
 </p>
 {app.installment_amount ? (
 <p className="mt-1 text-xs text-muted-foreground">
 Est. installment {formatCurrencyCompact(app.installment_amount)}
 {app.total_repayment ? ` · Total ${formatCurrencyCompact(app.total_repayment)}` : ""}
 </p>
 ) : null}
 </div>
 </CardHeader>

 <CardContent className="flex flex-1 flex-col gap-3 p-3 pt-0 sm:p-4 sm:pt-0">
 <div className="grid grid-cols-2 gap-2">
 <MetricCell label="Product" value={app.productName || "—"} />
 <MetricCell label="Term" value={formatTermDays(app.term_days)} />
 <MetricCell
 label="Business"
 value={
 <span className="flex items-center gap-1">
 <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
 <span className="truncate">{businessLabel}</span>
 </span>
 }
 />
 <MetricCell
 label="Monthly income"
 value={
 app.monthlyIncome && app.monthlyIncome > 0
 ? formatCurrencyCompact(app.monthlyIncome)
 : "—"
 }
 />
 <MetricCell
 label="Risk grade"
 value={
 app.riskGrade ? (
 <Badge variant="outline" className={cn("font-semibold", riskBadgeClass(String(app.riskGrade)))}>
 Grade {app.riskGrade}
 </Badge>
 ) : (
 "—"
 )
 }
 />
 <MetricCell
 label="Credit score"
 value={app.creditScore != null && app.creditScore > 0 ? app.creditScore : "—"}
 />
 </div>

 {app.purpose ? (
 <p className="line-clamp-2 text-xs text-muted-foreground">
 <span className="font-medium text-foreground">Purpose: </span>
 {app.purpose}
 </p>
 ) : null}

 <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
 <span className="inline-flex items-center gap-1">
 <User className="h-3.5 w-3.5" />
 {app.officerName || "Unassigned"}
 </span>
 {installmentRatio != null ? (
 <span
 className={cn(
 "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
 installmentRatio > 60
 ? "bg-destructive/10 text-destructive"
 : installmentRatio > 40
 ? "bg-amber-100 text-amber-800"
 : "bg-emerald-50 text-emerald-800"
 )}
 >
 <TrendingUp className="h-3 w-3" />
 {installmentRatio.toFixed(0)}% of income
 </span>
 ) : null}
 </div>

 {(canApprove || canActivate) && (
 <>
 <Separator />
 <div className="space-y-1.5">
 <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
 Approved amount (TZS)
 </label>
 <Input
 type="text"
 inputMode="decimal"
 className="h-9 text-sm"
 value={approvedAmount}
 onChange={(e) => onApprovedAmountChange(e.target.value)}
 disabled={busy}
 placeholder={String(app.requested_amount)}
 />
 </div>
 </>
 )}
 </CardContent>

 <CardFooter className="mt-auto flex flex-col gap-2 border-t bg-muted/20 p-3 sm:p-4">
 <div className="grid w-full grid-cols-2 gap-2">
 {canQueueReview ? (
 <Button
 type="button"
 variant="secondary"
 size="sm"
 className="col-span-2 h-9"
 disabled={busy}
 onClick={onQueueReview}
 >
 {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Move to review queue"}
 </Button>
 ) : null}

 {canActivate ? (
 <Button
 type="button"
 size="sm"
 className="col-span-2 h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
 disabled={busy}
 onClick={onActivate}
 >
 {busy ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <>
 <CheckCircle2 className="h-4 w-4" />
 Approve &amp; create loan
 </>
 )}
 </Button>
 ) : null}

 {canApprove && !canActivate ? (
 <Button type="button" size="sm" className="h-9 gap-1" disabled={busy} onClick={onApprove}>
 {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
 Approve
 </Button>
 ) : null}

 {canReject ? (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className={cn("h-9 gap-1 text-destructive hover:bg-destructive/10", !canApprove && !canActivate && "col-span-2")}
 disabled={busy}
 onClick={onReject}
 >
 {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
 Reject
 </Button>
 ) : null}

 <Button
 type="button"
 variant="ghost"
 size="sm"
 className={cn(
 "h-9 gap-1",
 !canActivate && !canApprove && !canReject && !canQueueReview && "col-span-2"
 )}
 asChild
 >
 <Link href={`${applicationsHref}?id=${encodeURIComponent(app.id)}`}>
 <Eye className="h-4 w-4" />
 View details
 </Link>
 </Button>
 </div>

 {!canActivate && !canApprove && !canReject && !canQueueReview ? (
 <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
 <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
 Read-only — awaiting reviewer action
 </p>
 ) : null}
 </CardFooter>
 </Card>
 );
}
