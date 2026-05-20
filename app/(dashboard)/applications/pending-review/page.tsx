"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, RefreshCcw, Search } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { PendingReviewCard } from "@/components/applications/pending-review-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
 extractApplicationsList,
 type ApplicationViewRow,
} from "@/lib/application-adapters";
import {
 enrichApplicationRows,
 fetchApplicationEnrichmentContext,
} from "@/lib/application-enrichment";
import {
 approveApplicationApi,
 assignApplicationOfficerApi,
 resolveApplicationApprovalSuccessMessage,
 reviewApplicationApi,
} from "@/lib/application-workflow";
import {
 canFinalApproveApplication,
 canManagerReviewApplication,
} from "@/lib/application-workflow-permissions";
import { formatCurrency } from "@/lib/formatters";
import { useSessionUser } from "@/lib/use-session-user";
import type { LoanApplicationStatus } from "@/lib/types";

const PENDING_REVIEW_STATUSES: LoanApplicationStatus[] = ["submitted", "under_review"];

function parseApprovedAmount(raw: string, fallback: number): number {
 const cleaned = String(raw ?? "")
 .replace(/,/g, "")
 .replace(/\s/g, "");
 const n = parseFloat(cleaned);
 return Number.isFinite(n) && n > 0 ? n : fallback;
}

function validateApprovalAmount(app: ApplicationViewRow, amount: number): string | null {
 if (!Number.isFinite(amount) || amount <= 0) {
 return "Enter a valid approved amount greater than zero.";
 }
 if (app.requested_amount > 0 && amount > app.requested_amount) {
 return `Approved amount cannot exceed the requested amount (${formatCurrency(app.requested_amount)}).`;
 }
 return null;
}

export default function PendingReviewPage() {
 const { user } = useSessionUser();
 const effectiveRole = user?.role ?? "super_admin";
 const isAdmin = effectiveRole === "super_admin";
 const isManager = effectiveRole === "branch_manager";
 const isOfficer = effectiveRole === "loan_officer";
 const canReview = isAdmin || isManager;
 const scopeBranchId =
 effectiveRole === "branch_manager" || effectiveRole === "loan_officer"
 ? user?.branch_id
 : null;

 const applicationsBasePath =
 effectiveRole === "branch_manager"
 ? "/manager/applications"
 : effectiveRole === "loan_officer"
 ? "/officer/applications"
 : "/applications";

 const [applications, setApplications] = useState<ApplicationViewRow[]>([]);
 const [listLoading, setListLoading] = useState(true);
 const [listError, setListError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [busyId, setBusyId] = useState<string | null>(null);
 const [actionError, setActionError] = useState<string | null>(null);
 const [successMessage, setSuccessMessage] = useState<string | null>(null);
 const [approvedAmounts, setApprovedAmounts] = useState<Record<string, string>>({});

 const reload = useCallback(async () => {
 setListLoading(true);
 setListError(null);
 try {
 const ctx = await fetchApplicationEnrichmentContext(scopeBranchId);
 const params = new URLSearchParams();
 params.set("page_size", "100");
 if (scopeBranchId) params.set("branch_id", scopeBranchId);
 const res = await fetch(`/api/applications?${params.toString()}`, { credentials: "include" });
 const json = await res.json();
 if (!res.ok) {
 throw new Error(typeof json.message === "string" ? json.message : "Failed to load applications");
 }
 const rows = enrichApplicationRows(extractApplicationsList(json), ctx).filter((app) =>
 PENDING_REVIEW_STATUSES.includes(app.status)
 );
 setApplications(rows);
 const amounts: Record<string, string> = {};
 for (const app of rows) {
 amounts[app.id] = String(app.approved_amount ?? app.requested_amount ?? "");
 }
 setApprovedAmounts(amounts);
 } catch (e) {
 setListError(e instanceof Error ? e.message : "Failed to load pending applications");
 } finally {
 setListLoading(false);
 }
 }, [scopeBranchId]);

 useEffect(() => {
 void reload();
 }, [reload]);

 const visibleApplications = useMemo(() => {
 if (!scopeBranchId) return applications;
 return applications.filter((app) => app.branch_id === scopeBranchId);
 }, [applications, scopeBranchId]);

 const filtered = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 if (!q) return visibleApplications;
 return visibleApplications.filter(
 (app) =>
 app.application_number.toLowerCase().includes(q) ||
 app.customerSearchText.includes(q) ||
 (app.productName ?? "").toLowerCase().includes(q) ||
 (app.businessName ?? "").toLowerCase().includes(q)
 );
 }, [visibleApplications, searchQuery]);

 const runAction = async (
 appId: string,
 action: () => Promise<{ ok: boolean; error?: string; message?: string }>
 ) => {
 setBusyId(appId);
 setActionError(null);
 setSuccessMessage(null);
 const result = await action();
 if (!result.ok) {
 setActionError(result.error ?? "Action failed");
 setBusyId(null);
 return;
 }
 setSuccessMessage(
 resolveApplicationApprovalSuccessMessage(
 {
 message: result.message,
 loanId: "loanId" in result ? result.loanId : undefined,
 data: "data" in result ? result.data : undefined,
 },
 { role: effectiveRole, permissions: user?.permissions ?? [] }
 )
 );
 await reload();
 setBusyId(null);
 };

 const getApprovedAmount = (app: ApplicationViewRow) =>
 parseApprovedAmount(approvedAmounts[app.id] ?? "", app.requested_amount);

 return (
 <>
 <DashboardHeader
 title="Pending Review"
 description="Assess submitted applications and approve loans for disbursement"
 />
 <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 pb-8 sm:p-3">
 <div className="mx-auto w-full max-w-6xl space-y-4">
 <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-background to-background p-3 sm:p-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-start gap-3">
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
 <ClipboardCheck className="h-5 w-5" />
 </div>
 <div>
 <h2 className="text-base font-semibold tracking-tight sm:text-lg">Credit decision queue</h2>
 <p className="mt-0.5 max-w-xl text-xs text-muted-foreground sm:text-sm">
 Review amount, product, term, business profile, income, and risk before approving. Super
 admins can activate the loan in one step; managers approve to the next workflow stage.
 </p>
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => void reload()} disabled={listLoading}>
 {listLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
 Refresh
 </Button>
 <Button type="button" variant="secondary" size="sm" className="h-9" asChild>
 <Link href={applicationsBasePath}>All applications</Link>
 </Button>
 </div>
 </div>
 </div>

 {successMessage ? (
 <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
 {successMessage}
 {isAdmin ? (
 <>
 {" "}
 <Link href="/disbursements" className="font-medium underline">
 Open disbursements
 </Link>{" "}
 after activation.
 </>
 ) : null}
 </div>
 ) : null}

{actionError ? (
 <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
 {actionError}
 </div>
) : null}

 <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
 <div className="relative flex-1">
 <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 className="h-9 pl-9"
 placeholder="Search customer, application #, product…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 <p className="shrink-0 text-xs text-muted-foreground sm:text-sm">
 {filtered.length} pending · {visibleApplications.filter((a) => a.status === "under_review").length} in review
 </p>
 </div>

 {listLoading ? (
 <Card>
 <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading pending applications…
 </CardContent>
 </Card>
 ) : listError ? (
 <Card>
 <CardContent className="py-10 text-center text-sm text-destructive">{listError}</CardContent>
 </Card>
 ) : filtered.length === 0 ? (
 <Card>
 <CardContent className="py-12 text-center text-sm text-muted-foreground">
 No applications awaiting review.
 </CardContent>
 </Card>
 ) : (
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
 {filtered.map((app) => {
 const amount = getApprovedAmount(app);
 const canFinalApprove = canFinalApproveApplication({
 role: effectiveRole,
 permissions: user?.permissions ?? [],
 });
 const canManagerReview = canManagerReviewApplication({
 role: effectiveRole,
 permissions: user?.permissions ?? [],
 });
 const canActivate =
 canFinalApprove &&
 ["draft", "submitted", "under_review", "approved"].includes(app.status);
 const canApprove =
 canManagerReview &&
 (app.status === "under_review" || app.status === "submitted") &&
 !canFinalApprove;
 const canReject =
 canReview && (app.status === "submitted" || app.status === "under_review");
 const canQueueReview = isManager && app.status === "submitted";

 return (
 <PendingReviewCard
 key={app.id}
 app={app}
 busy={busyId === app.id}
 applicationsHref={applicationsBasePath}
 approvedAmount={approvedAmounts[app.id] ?? String(app.requested_amount)}
 onApprovedAmountChange={(v) =>
 setApprovedAmounts((prev) => ({ ...prev, [app.id]: v }))
 }
 canActivate={canActivate}
 canApprove={canApprove}
 canReject={canReject}
 canQueueReview={canQueueReview}
 onActivate={() =>
 void runAction(app.id, async () => {
 const validation = validateApprovalAmount(app, amount);
 if (validation) return { ok: false, error: validation };
 const r = await approveApplicationApi(app.id, amount);
 return r.ok
 ? {
 ok: true,
 message: resolveApplicationApprovalSuccessMessage(r, {
 role: effectiveRole,
 permissions: user?.permissions ?? [],
 }),
 loanId: r.loanId,
 data: r.data,
 }
 : { ok: false, error: r.error };
 })
 }
 onApprove={() =>
 void runAction(app.id, async () => {
 const validation = validateApprovalAmount(app, amount);
 if (validation) return { ok: false, error: validation };
 const r = await approveApplicationApi(app.id, amount);
 return r.ok
 ? {
 ok: true,
 message: resolveApplicationApprovalSuccessMessage(r, {
 role: effectiveRole,
 permissions: user?.permissions ?? [],
 }),
 loanId: r.loanId,
 data: r.data,
 }
 : { ok: false, error: r.error };
 })
 }
 onReject={() =>
 void runAction(app.id, async () => {
 const r = await reviewApplicationApi(app.id, {
 decision: "reject",
 rejection_reason: `Rejected from pending review by ${user?.full_name ?? "Reviewer"}.`,
 });
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 })
 }
 onQueueReview={() =>
 void runAction(app.id, async () => {
 const r = await assignApplicationOfficerApi(app.id, { workflow_stage: "manager" });
 return r.ok ? { ok: true } : { ok: false, error: r.error };
 })
 }
 />
 );
 })}
 </div>
 )}
 </div>
 </main>
 </>
 );
}
