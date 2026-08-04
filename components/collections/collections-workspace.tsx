"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 Search,
 Filter,
 Phone,
 MessageSquare,
 MapPin,
 FileText,
 AlertTriangle,
 Plus,
 Calendar,
 Loader2,
 Eye,
 UserRound,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ActivityOverviewSheet } from "@/components/collections/activity-overview-sheet";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
 adaptCollectionActivityRow,
 adaptCollectionQueueRow,
 buildCollectionActivityLoanOptions,
 buildCustomerLookup,
 enrichActivitiesForView,
 extractPaginatedData,
 type CollectionActivityView,
} from "@/lib/collection-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import { extractLoansList, type LoanListRow } from "@/lib/loan-adapters";
import type { Customer } from "@/lib/types";
import { formatApiResponseError } from "@/lib/falco-api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { CollectionAction, CollectionActivity, CollectionQueueRow } from "@/lib/types";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useSessionUser } from "@/lib/use-session-user";

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

function matchesClassificationFilter(row: CollectionQueueRow, filter: string): boolean {
 if (filter === "all") return true;
 const d = row.days_in_arrears;
 const rc = row.risk_classification;
 if (filter === "especially_mentioned") return rc === "especially_mentioned" || (d >= 1 && d <= 30);
 if (filter === "substandard") return rc === "substandard" || (d >= 31 && d <= 90);
 if (filter === "doubtful") return rc === "doubtful" || (d >= 91 && d <= 180);
 if (filter === "loss") return rc === "loss" || d > 180;
 return rc === filter;
}

function riskBadgeClass(classification: string, daysInArrears: number): { label: string; className: string } {
 const byApi: Record<string, { label: string; className: string }> = {
 current: { label: "Current", className: "bg-accent text-accent-foreground" },
 especially_mentioned: { label: "Watch (1-30d)", className: "bg-warning text-warning-foreground" },
 substandard: { label: "Substandard (31-90d)", className: "bg-destructive text-destructive-foreground" },
 doubtful: { label: "Doubtful (91-180d)", className: "bg-destructive text-destructive-foreground" },
 loss: { label: "Loss (>180d)", className: "bg-foreground text-background" },
 high: { label: "High risk", className: "bg-destructive text-destructive-foreground" },
 medium: { label: "Medium risk", className: "bg-warning text-warning-foreground" },
 low: { label: "Low risk", className: "bg-accent text-accent-foreground" },
 };
 if (byApi[classification]) return byApi[classification];
 if (daysInArrears <= 0) return { label: "Current", className: "bg-accent text-accent-foreground" };
 if (daysInArrears <= 30) return { label: "Watch (1-30d)", className: "bg-warning text-warning-foreground" };
 if (daysInArrears <= 90) return { label: "Substandard (31-90d)", className: "bg-destructive text-destructive-foreground" };
 if (daysInArrears <= 180) return { label: "Doubtful (91-180d)", className: "bg-destructive text-destructive-foreground" };
 return { label: "Loss (>180d)", className: "bg-foreground text-background" };
}

function actionLabel(action: string): string {
 return actionConfig[action]?.label ?? action.replace(/_/g, " ");
}

function branchScopedQuery(scopeBranchId: string | null, pageSize: string): string {
 const params = new URLSearchParams();
 params.set("page_size", pageSize);
 if (scopeBranchId) params.set("branch_id", scopeBranchId);
 return params.toString();
}

const BRANCH_SCOPED_ROLES = new Set([
 "branch_manager",
 "loan_officer",
 "accountant",
 "collections_officer",
]);

export function CollectionsWorkspace({
 view = "activities",
}: {
 view?: "activities" | "queue";
}) {
 const { t } = useTranslations();
 const pathname = usePathname();
 const basePath = pathname.startsWith("/accountant")
 ? "/accountant"
 : pathname.startsWith("/manager")
 ? "/manager"
 : "";
 const { user, loaded: sessionLoaded } = useSessionUser();
 const [queueLoans, setQueueLoans] = useState<CollectionQueueRow[]>([]);
 const [disbursedLoans, setDisbursedLoans] = useState<LoanListRow[]>([]);
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [activities, setActivities] = useState<CollectionActivity[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [posting, setPosting] = useState(false);
 const [postError, setPostError] = useState<string | null>(null);

 const [searchQuery, setSearchQuery] = useState("");
 const [classificationFilter, setClassificationFilter] = useState<string>("all");
 const [isDialogOpen, setIsDialogOpen] = useState(false);
 const [selectedLoan, setSelectedLoan] = useState("");
 const [selectedAction, setSelectedAction] = useState<CollectionAction>("phone_call");
 const [activityNotes, setActivityNotes] = useState("");
 const [activityOutcome, setActivityOutcome] = useState("");
 const [followUpDate, setFollowUpDate] = useState("");
 const [loanPickerSearch, setLoanPickerSearch] = useState("");
 const [viewActivityId, setViewActivityId] = useState<string | null>(null);

 const scopeBranchId = useMemo(() => {
 if (!user?.branch_id?.trim()) return null;
 if (BRANCH_SCOPED_ROLES.has(user.role)) return user.branch_id.trim();
 return null;
 }, [user]);

 const loadCollections = useCallback(async () => {
 setLoading(true);
 setError(null);
 try {
 const queueQ = branchScopedQuery(scopeBranchId, "200");
 const activityQ = branchScopedQuery(scopeBranchId, "100");
 const loanQ = branchScopedQuery(scopeBranchId, "200");
 const custQ = branchScopedQuery(scopeBranchId, "200");

 const [qRes, aRes, lRes, cRes] = await Promise.all([
 fetch(`/api/collections/queue?${queueQ}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/collections/activities?${activityQ}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/loans?${loanQ}`, { credentials: "include", cache: "no-store" }),
 fetch(`/api/customers?${custQ}`, { credentials: "include", cache: "no-store" }),
 ]);
 const { data: qJson } = await parseJsonResponse<unknown>(qRes);
 const { data: aJson } = await parseJsonResponse<unknown>(aRes);

 if (!qRes.ok) {
 throw new Error(formatApiResponseError(qJson, `Queue request failed (${qRes.status})`));
 }
 if (!aRes.ok) {
 throw new Error(formatApiResponseError(aJson, `Activities request failed (${aRes.status})`));
 }

 const queue = extractPaginatedData<Record<string, unknown>>(qJson).map(adaptCollectionQueueRow);
 setQueueLoans(queue);

 const { data: lJson } = await parseJsonResponse<unknown>(lRes);
 if (lRes.ok) {
 setDisbursedLoans(extractLoansList(lJson));
 } else {
 setDisbursedLoans([]);
 }

 const custJson = await cRes.json().catch(() => null);
 if (cRes.ok && custJson) {
 setCustomers(extractCustomersList(custJson));
 } else {
 setCustomers([]);
 }
 const act = extractPaginatedData<Record<string, unknown>>(aJson)
 .map(adaptCollectionActivityRow)
 .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
 setActivities(act);
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load collections");
 setQueueLoans([]);
 setDisbursedLoans([]);
 setCustomers([]);
 setActivities([]);
 } finally {
 setLoading(false);
 }
 }, [scopeBranchId]);

 useEffect(() => {
 if (!sessionLoaded) return;
 void loadCollections();
 }, [loadCollections, sessionLoaded]);

 const customerLookup = useMemo(() => buildCustomerLookup(customers), [customers]);

 const activityLoanOptions = useMemo(
 () => buildCollectionActivityLoanOptions(disbursedLoans, queueLoans, customerLookup),
 [disbursedLoans, queueLoans, customerLookup]
 );

 const activityViews = useMemo(
 () => enrichActivitiesForView(activities, queueLoans, disbursedLoans, customerLookup),
 [activities, queueLoans, disbursedLoans, customerLookup]
 );

 const viewActivity = useMemo(
 () => activityViews.find((a) => a.id === viewActivityId) ?? null,
 [activityViews, viewActivityId]
 );

 const filteredActivityLoanOptions = useMemo(() => {
 const q = loanPickerSearch.trim().toLowerCase();
 if (!q) return activityLoanOptions;
 return activityLoanOptions.filter(
 (loan) =>
 (loan.loanNumber ?? "").toLowerCase().includes(q) ||
 (loan.customerName ?? "").toLowerCase().includes(q)
 );
 }, [activityLoanOptions, loanPickerSearch]);

 useEffect(() => {
 if (!selectedLoan) return;
 if (
 activityLoanOptions.length > 0 &&
 !activityLoanOptions.some((l) => l.loanId === selectedLoan)
 ) {
 setSelectedLoan("");
 }
 }, [activityLoanOptions, selectedLoan]);

 const openLogActivityDialog = (loanId?: string) => {
 if (loanId) setSelectedLoan(loanId);
 setLoanPickerSearch("");
 setPostError(null);
 setIsDialogOpen(true);
 };

 const selectedLoanDetail = useMemo(
 () => activityLoanOptions.find((l) => l.loanId === selectedLoan) ?? null,
 [activityLoanOptions, selectedLoan]
 );

 const filteredLoans = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 return queueLoans.filter((loan) => {
 const matchesSearch =
 q === "" ||
 (loan.loan_number ?? "").toLowerCase().includes(q) ||
 (loan.customer_name ?? "").toLowerCase().includes(q);
 const matchesClassification = matchesClassificationFilter(loan, classificationFilter);
 return matchesSearch && matchesClassification;
 });
 }, [queueLoans, searchQuery, classificationFilter]);

 const totalOverdue = useMemo(
 () => queueLoans.reduce((sum, l) => sum + (Number(l.total_outstanding) || 0), 0),
 [queueLoans]
 );

 const watchLoans = useMemo(
 () => queueLoans.filter((l) => l.days_in_arrears >= 1 && l.days_in_arrears <= 30),
 [queueLoans]
 );
 const substandardLoans = useMemo(
 () => queueLoans.filter((l) => l.days_in_arrears >= 31 && l.days_in_arrears <= 90),
 [queueLoans]
 );

 const activitiesToday = useMemo(() => {
 const today = new Date().toDateString();
 return activities.filter((a) => new Date(a.performed_at).toDateString() === today).length;
 }, [activities]);

 const handleLogActivity = async () => {
 setPostError(null);
 if (!selectedLoan.trim()) {
 setPostError("Select a loan.");
 return;
 }
 if (!activityNotes.trim()) {
 setPostError("Notes are required.");
 return;
 }
 setPosting(true);
 try {
 const loanIdNum = Number(selectedLoan);
 const body: Record<string, unknown> = {
 loan_id: Number.isFinite(loanIdNum) && loanIdNum > 0 ? loanIdNum : selectedLoan,
 action: selectedAction,
 notes: activityNotes.trim(),
 };
 const outcome = activityOutcome.trim();
 if (outcome) body.outcome = outcome;
 if (followUpDate.trim()) body.follow_up_date = followUpDate.trim();

 const res = await fetch("/api/collections/activities", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 });
 const { data: json } = await parseJsonResponse<unknown>(res);
 if (!res.ok) {
 throw new Error(formatApiResponseError(json, `Request failed (${res.status})`));
 }
 setIsDialogOpen(false);
 setSelectedLoan("");
 setActivityNotes("");
 setActivityOutcome("");
 setFollowUpDate("");
 await loadCollections();
 } catch (e) {
 setPostError(e instanceof Error ? e.message : "Failed to log activity");
 } finally {
 setPosting(false);
 }
 };

 return (
 <>
 <DashboardHeader title={t("collections.title")} description={t("collections.description")} />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 {user?.role && (
 <p className="text-xs text-muted-foreground">
 Signed in as {user.full_name || user.email} ({String(user.role).replace(/_/g, " ")})
 {user.branch_id ? ` · Branch scope applied by the server` : ""}
 </p>
 )}

 {error && (
 <Card className="border-destructive/50 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 )}

 {loading || !sessionLoaded ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 <span>{t("common.loading")}</span>
 </div>
 ) : (
 <>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">{t("collections.totalOverdue")}</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</div>
 <p className="text-sm text-muted-foreground">{t("collections.loansInQueue", { count: queueLoans.length })}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="h-2 w-2 rounded-full bg-warning" />
 {t("collections.watchDays")}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{watchLoans.length}</div>
 <p className="text-sm text-muted-foreground">
 {formatCurrency(watchLoans.reduce((s, l) => s + (Number(l.total_outstanding) || 0), 0))}
 </p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
 <div className="h-2 w-2 rounded-full bg-destructive" />
 {t("collections.substandardDays")}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{substandardLoans.length}</div>
 <p className="text-sm text-muted-foreground">
 {formatCurrency(substandardLoans.reduce((s, l) => s + (Number(l.total_outstanding) || 0), 0))}
 </p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">{t("collections.activitiesToday")}</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{activitiesToday}</div>
 </CardContent>
 </Card>
 </div>

 <Tabs value={view} className="space-y-4">
 <TabsList className="sr-only">
 <TabsTrigger value="activities">{t("collections.activitiesTab")}</TabsTrigger>
 <TabsTrigger value="queue">{t("collections.queueTab")}</TabsTrigger>
 </TabsList>

 <TabsContent value="queue" className="space-y-4">
 <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex flex-1 gap-3">
 <div className="relative flex-1 max-w-sm">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 placeholder="Search loans…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
 />
 </div>
 <Select value={classificationFilter} onValueChange={setClassificationFilter}>
 <SelectTrigger className="w-48">
 <Filter className="mr-2 h-4 w-4" />
 <SelectValue placeholder="Classification" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All classifications</SelectItem>
 <SelectItem value="especially_mentioned">Watch (1–30d)</SelectItem>
 <SelectItem value="substandard">Substandard (31–90d)</SelectItem>
 <SelectItem value="doubtful">Doubtful (91–180d)</SelectItem>
 <SelectItem value="loss">Loss (&gt;180d)</SelectItem>
 </SelectContent>
 </Select>
 </div>
          <Button type="button" onClick={() => openLogActivityDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Log activity
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-center">Days overdue</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No overdue loans in queue
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((loan) => {
                    const risk = riskBadgeClass(loan.risk_classification, loan.days_in_arrears);
                    const productLabel =
                      typeof loan.product_name === "string" && loan.product_name.trim()
                        ? loan.product_name
                        : "—";
                    return (
                      <TableRow key={loan.loan_id}>
                        <TableCell className="font-mono text-sm">{loan.loan_number}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{loan.customer_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>{productLabel}</TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          {formatCurrency(Number(loan.total_outstanding) || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xl font-bold text-destructive">{loan.days_in_arrears}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={risk.className}>{risk.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {loan.last_activity_at ? (
                            <span className="text-sm text-muted-foreground">{formatDateTime(loan.last_activity_at)}</span>
                          ) : (
                            <span className="text-muted-foreground">No activity recorded</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" title="Call" type="button">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="SMS" type="button">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Log activity"
                              type="button"
                              onClick={() => openLogActivityDialog(loan.loan_id)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`${basePath}/loans`}>Loans</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="activities">
        <Card>
          <CardHeader>
            <CardTitle>Recent collection activities</CardTitle>
            <CardDescription>Append-only history — open View for full details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityViews.length === 0 ? (
                <div className="flex flex-col items-start gap-2 py-2">
                  <p className="text-sm text-muted-foreground">
                    No follow-ups have been logged yet. Use &ldquo;Log activity&rdquo; on a loan to
                    record a call, SMS, visit, or promise-to-pay — it will show up here.
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => openLogActivityDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Log activity
                  </Button>
                </div>
              ) : (
                activityViews.map((activity) => {
                  const cfg = actionConfig[String(activity.action)] ?? {
                    label: actionLabel(String(activity.action)),
                    icon: FileText,
                  };
                  const ActionIcon = cfg.icon;
                  const notesText = activity.notes ?? "";
                  const notesPreview =
                    notesText.length > 120 ? `${notesText.slice(0, 120)}…` : notesText;

                  return (
                    <div
                      key={activity.id}
                      className="flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="rounded-full bg-muted p-2 h-fit shrink-0">
                        <ActionIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{cfg.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {activity.customer_name} · {activity.loan_number}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {activity.outcome || "No outcome"}
                          </Badge>
                        </div>
                        <p className="text-sm line-clamp-2">{notesPreview}</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatDateTime(activity.performed_at)}</span>
                          {activity.follow_up_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Follow-up {formatDate(activity.follow_up_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 self-center"
                        onClick={() => setViewActivityId(activity.id)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
        <ActivityOverviewSheet
          open={viewActivityId != null}
          onOpenChange={(open) => {
            if (!open) setViewActivityId(null);
          }}
          activity={viewActivity}
        />
      </TabsContent>
      </Tabs>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setPostError(null);
            setLoanPickerSearch("");
          }
        }}
      >
        <DialogContent className="flex max-h-[min(90dvh,36rem)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md [&>button]:z-10">
 <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-3 text-left">
 <DialogTitle className="text-base">Log collection activity</DialogTitle>
 <DialogDescription className="text-xs leading-relaxed">
 Select a disbursed loan, then record the follow-up.
 </DialogDescription>
 </DialogHeader>
 <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
 <FieldGroup className="gap-4 py-0">
 {postError && <p className="text-sm text-destructive">{postError}</p>}
 <Field>
 <FieldLabel>Loan</FieldLabel>
 {activityLoanOptions.length === 0 ? (
 <p className="text-sm text-muted-foreground">
 No active disbursed loans with an outstanding balance were found.
 </p>
 ) : (
 <div className="space-y-2">
 <Input
 placeholder="Search by loan # or customer…"
 value={loanPickerSearch}
 onChange={(e) => setLoanPickerSearch(e.target.value)}
 />
 <Select
 value={selectedLoan || undefined}
 onValueChange={setSelectedLoan}
 >
 <SelectTrigger className="h-9 w-full *:data-[slot=select-value]:line-clamp-2 *:data-[slot=select-value]:whitespace-normal">
 <SelectValue placeholder="Select disbursed loan" />
 </SelectTrigger>
 <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
 {filteredActivityLoanOptions.map((loan) => (
 <SelectItem
 key={loan.loanId}
 value={loan.loanId}
 textValue={`${loan.customerName} ${loan.loanNumber}`}
 className="items-start py-2"
 >
 <div className="flex flex-col gap-0.5 pr-6">
 <span className="font-medium leading-snug text-foreground">{loan.customerName}</span>
 <span className="text-xs leading-snug text-muted-foreground">
 {loan.loanNumber} · Taken {formatCurrency(loan.principalAmount)} · Out{" "}
 {formatCurrency(loan.totalOutstanding)}
 </span>
 </div>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {selectedLoanDetail && (
 <div className="rounded-md border bg-muted/40 p-3 text-sm">
 <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Customer
 </p>
 <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">
 {selectedLoanDetail.customerName}
 </p>
 {selectedLoanDetail.customerPhone ? (
 <p className="mt-0.5 text-sm text-muted-foreground">{selectedLoanDetail.customerPhone}</p>
 ) : null}
 <p className="mt-1 text-xs text-muted-foreground">Loan {selectedLoanDetail.loanNumber}</p>
 <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/60 pt-2">
 <div>
 <p className="text-[11px] text-muted-foreground">Amount taken</p>
 <p className="text-sm font-semibold">{formatCurrency(selectedLoanDetail.principalAmount)}</p>
 </div>
 <div>
 <p className="text-[11px] text-muted-foreground">Outstanding</p>
 <p className="text-sm font-semibold text-destructive">
 {formatCurrency(selectedLoanDetail.totalOutstanding)}
 </p>
 </div>
 </div>
 {selectedLoanDetail.daysInArrears > 0 && (
 <p className="mt-2 text-xs text-muted-foreground">
 {selectedLoanDetail.daysInArrears} day
 {selectedLoanDetail.daysInArrears === 1 ? "" : "s"} in arrears
 {selectedLoanDetail.inQueue ? " · in collection queue" : ""}
 </p>
 )}
 </div>
 )}
 {filteredActivityLoanOptions.length === 0 && loanPickerSearch.trim() && (
 <p className="text-xs text-muted-foreground">No loans match your search.</p>
 )}
 <p className="text-xs text-muted-foreground">
 {activityLoanOptions.length} disbursed loan
 {activityLoanOptions.length === 1 ? "" : "s"} available
 </p>
 </div>
 )}
 </Field>
 <Field>
 <FieldLabel>Action</FieldLabel>
 <Select value={selectedAction} onValueChange={(v) => setSelectedAction(v as CollectionAction)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="phone_call">Phone call</SelectItem>
 <SelectItem value="sms">SMS</SelectItem>
 <SelectItem value="visit">Visit</SelectItem>
 <SelectItem value="promise_to_pay">Promise to pay</SelectItem>
 <SelectItem value="ussd_push">USSD push</SelectItem>
 <SelectItem value="escalation">Escalation</SelectItem>
 <SelectItem value="restructure_discussion">Restructure discussion</SelectItem>
 <SelectItem value="other">Other</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Notes</FieldLabel>
 <Textarea
 placeholder="What happened on this contact?"
 value={activityNotes}
 onChange={(e) => setActivityNotes(e.target.value)}
 rows={2}
 />
 </Field>
 <Field>
 <FieldLabel>Outcome (optional)</FieldLabel>
 <Input
 placeholder="e.g. PTP accepted, no answer…"
 value={activityOutcome}
 onChange={(e) => setActivityOutcome(e.target.value)}
 />
 </Field>
 <Field>
 <FieldLabel>Follow-up date (optional)</FieldLabel>
 <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
 </Field>
 </FieldGroup>
 </div>
 <DialogFooter className="shrink-0 gap-2 border-t bg-background px-4 py-3 sm:justify-end">
 <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
 Cancel
 </Button>
 <Button type="button" disabled={posting} onClick={() => void handleLogActivity()}>
 {posting ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 "Log activity"
 )}
 </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
 </main>
 </>
 );
}



