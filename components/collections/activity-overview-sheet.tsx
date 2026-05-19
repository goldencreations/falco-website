"use client";

import {
 AlertTriangle,
 Calendar,
 FileText,
 MapPin,
 MessageSquare,
 Phone,
 UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
 Sheet,
 SheetContent,
 SheetDescription,
 SheetHeader,
 SheetTitle,
} from "@/components/ui/sheet";
import type { CollectionActivityView } from "@/lib/collection-adapters";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import type { ReactNode } from "react";

const actionConfig: Record<string, { label: string; icon: typeof Phone }> = {
 phone_call: { label: "Phone call", icon: Phone },
 sms: { label: "SMS", icon: MessageSquare },
 visit: { label: "Visit", icon: MapPin },
 promise_to_pay: { label: "Promise to pay", icon: Calendar },
 ussd_push: { label: "USSD push", icon: MessageSquare },
 escalation: { label: "Escalation", icon: AlertTriangle },
 restructure_discussion: { label: "Restructure discussion", icon: FileText },
 other: { label: "Other", icon: FileText },
};

function actionLabel(action: string): string {
 return actionConfig[action]?.label ?? action.replace(/_/g, " ");
}

function OverviewRow({ label, value }: { label: string; value: ReactNode }) {
 return (
 <div>
 <p className="text-xs text-muted-foreground">{label}</p>
 <div className="text-sm font-medium text-foreground">{value}</div>
 </div>
 );
}

function ActivityOverviewBody({ activity }: { activity: CollectionActivityView }) {
 const cfg = actionConfig[String(activity.action)] ?? {
 label: actionLabel(String(activity.action)),
 icon: FileText,
 };
 const ActionIcon = cfg.icon;
 const meta = activity.metadata ?? {};
 const statusAtActivity =
 meta.loan_status_at_activity != null ? String(meta.loan_status_at_activity) : null;
 const arrearsAtActivity =
 meta.days_in_arrears_at_activity != null ? String(meta.days_in_arrears_at_activity) : null;

 return (
 <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
 <div className="rounded-lg border bg-muted/40 p-4">
 <div className="flex items-start gap-3">
 <div className="rounded-full bg-background p-2.5">
 <ActionIcon className="h-5 w-5 text-muted-foreground" />
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Action
 </p>
 <p className="text-lg font-semibold">{cfg.label}</p>
 <Badge variant="secondary" className="mt-2">
 {activity.outcome || "No outcome recorded"}
 </Badge>
 </div>
 </div>
 </div>

 <Separator className="my-4" />

 <div className="flex items-start gap-2">
 <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
 <div className="min-w-0 flex-1 space-y-1">
 <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Customer
 </p>
 <p className="text-base font-semibold">{activity.customer_name}</p>
 {activity.customer_phone ? (
 <p className="text-sm text-muted-foreground">{activity.customer_phone}</p>
 ) : null}
 </div>
 </div>

 <Separator className="my-4" />

 <div className="grid gap-3 sm:grid-cols-2">
 <OverviewRow label="Loan number" value={activity.loan_number} />
 <OverviewRow
 label="Loan status"
 value={activity.loan_status?.replace(/_/g, " ") ?? "—"}
 />
 <OverviewRow
 label="Amount taken"
 value={
 activity.principal_amount != null && activity.principal_amount > 0
 ? formatCurrency(activity.principal_amount)
 : "—"
 }
 />
 <OverviewRow
 label="Outstanding"
 value={
 activity.total_outstanding != null && activity.total_outstanding > 0
 ? formatCurrency(activity.total_outstanding)
 : "—"
 }
 />
 <OverviewRow
 label="Days in arrears"
 value={
 activity.days_in_arrears != null && activity.days_in_arrears > 0
 ? String(activity.days_in_arrears)
 : "0"
 }
 />
 <OverviewRow label="Activity ID" value={activity.id} />
 </div>

 <Separator className="my-4" />

 <div>
 <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Notes
 </p>
 <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{activity.notes}</p>
 </div>

 <Separator className="my-4" />

 <div className="grid gap-3 sm:grid-cols-2">
 <OverviewRow label="Performed at" value={formatDateTime(activity.performed_at)} />
 <OverviewRow label="Performed by" value={activity.performed_by || "—"} />
 <OverviewRow
 label="Follow-up date"
 value={activity.follow_up_date ? formatDate(activity.follow_up_date) : "—"}
 />
 <OverviewRow label="Customer ID" value={activity.customer_id} />
 <OverviewRow label="Loan ID" value={activity.loan_id} />
 </div>

 {(statusAtActivity || arrearsAtActivity) && (
 <>
 <Separator className="my-4" />
 <div>
 <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Snapshot at log time
 </p>
 <div className="mt-2 grid gap-2 sm:grid-cols-2">
 {statusAtActivity && (
 <OverviewRow label="Loan status then" value={statusAtActivity.replace(/_/g, " ")} />
 )}
 {arrearsAtActivity && (
 <OverviewRow label="Days overdue then" value={arrearsAtActivity} />
 )}
 </div>
 </div>
 </>
 )}
 </div>
 );
}

type ActivityOverviewSheetProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 activity: CollectionActivityView | null;
};

export function ActivityOverviewSheet({
 open,
 onOpenChange,
 activity,
}: ActivityOverviewSheetProps) {
 return (
 <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
 <SheetHeader className="shrink-0 border-b px-4 py-4 text-left">
 <SheetTitle className="text-base">Activity overview</SheetTitle>
 <SheetDescription className="text-xs">Full log record (read-only)</SheetDescription>
 </SheetHeader>
 {activity ? (
 <ActivityOverviewBody activity={activity} />
 ) : (
 <p className="p-4 text-sm text-muted-foreground">Activity not found.</p>
 )}
 </SheetContent>
 </Sheet>
 );
}
