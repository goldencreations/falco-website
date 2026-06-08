"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Scale, Plus, Trash2, CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { MoneyInput } from "@/components/forms/money-input";
import { Input } from "@/components/ui/input";
import { parseMoneyInput } from "@/lib/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { extractApplicationsList, extractApplicationDetail, type ApplicationViewRow } from "@/lib/application-adapters";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { adaptApiProductRow, extractProductsList } from "@/lib/product-adapters";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
 buildCreditAnalysisPostBody,
 extractAnalysisFromSaveResponse,
 extractAttachmentIdFromUploadResponse,
 extractLatestAnalysisRecord,
 overlayFromSavedAnalysis,
 parseCreditAnalysisEnvelope,
 prefillFromApplicationCustomerProduct,
 readServerMetricsFromAnalysis,
 type CashFlowFormState,
 type CommitteeRow,
 type CrbFormState,
 type LoanProposalFormState,
 type RiskRow,
} from "@/lib/credit-analysis-prefill";
import {
 amountDecisionText,
 buildPolicyIndicators,
 committeeVoteStats,
 computeCashFlowMetrics,
 computeRatioMetrics,
 formatCommitteeDecision,
 formatRatioPercent,
 previewCommitteeDecision,
} from "@/lib/credit-analysis-metrics";
import type { LoanProduct } from "@/lib/types";
import { apiFetch, apiErrorMessage, isSessionExpiredResponse } from "@/lib/api-client";
import { resolvePortalPathFromPathname } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";

const QUEUE_STATUSES = ["submitted", "under_review"] as const;

function CreditAnalysisPageContent() {
 const router = useRouter();
 const pathname = usePathname();
 const searchParams = useSearchParams();
 const creditAnalysisBase = resolvePortalPathFromPathname(pathname, "/credit-analysis");
 const applicationId = searchParams.get("applicationId");
 const { user, loaded: sessionLoaded } = useSessionUser();
 const scopeBranchId = user?.role === "branch_manager" || user?.role === "loan_officer" ? user.branch_id : null;
 const isOfficerView = user?.role === "loan_officer";

 const [applications, setApplications] = useState<ApplicationViewRow[]>([]);
 const [listLoading, setListLoading] = useState(true);
 const [listError, setListError] = useState<string | null>(null);

 const [contextLoading, setContextLoading] = useState(false);
 const [contextError, setContextError] = useState<string | null>(null);
 const [customerApiRow, setCustomerApiRow] = useState<Record<string, unknown> | null>(null);
 const [applicationApiRow, setApplicationApiRow] = useState<Record<string, unknown> | null>(null);

 const [creditScore, setCreditScore] = useState("");
 const [cashFlow, setCashFlow] = useState<CashFlowFormState>({
 salesRevenue: "",
 purchasesCogs: "",
 businessExpenses: "",
 existingMonthlyDebtRepayments: "",
 householdExpenses: "",
 otherIncome: "",
 });
 const [loanProposal, setLoanProposal] = useState<LoanProposalFormState>({
 amountRequested: "",
 amountApproved: "",
 bccApprovedAmount: "",
 loanCycle: "1",
 loanOfficerName: "",
 maturityMonths: "",
 proposedInstallment: "",
 interestRate: "6.00",
 loanPurpose: "",
 totalLoans: "",
 equity: "",
 inventory: "",
 currentAssets: "",
 currentLiabilities: "",
 });
 const [risks, setRisks] = useState<RiskRow[]>([
 { description: "", severity: "low", mitigationPlan: "" },
 { description: "", severity: "low", mitigationPlan: "" },
 { description: "", severity: "low", mitigationPlan: "" },
 ]);
 const [crbDetails, setCrbDetails] = useState<CrbFormState>({
 source: "",
 scoreStatus: "",
 checkDate: "",
 remarks: "",
 attachment: null,
 });
 const [committeeVotes, setCommitteeVotes] = useState<CommitteeRow[]>([
 { memberName: "", vote: "pending", comments: "" },
 ]);
 const [existingAnalyses, setExistingAnalyses] = useState<Record<string, unknown>[]>([]);
 const [selectedProduct, setSelectedProduct] = useState<LoanProduct | null>(null);
 const [riskGradeRecommendation, setRiskGradeRecommendation] = useState("");
 const [savedAnalysisRecord, setSavedAnalysisRecord] = useState<Record<string, unknown> | null>(null);
 const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
 const [saveLoading, setSaveLoading] = useState(false);
 const [saveError, setSaveError] = useState<string | null>(null);

 useEffect(() => {
 if (!sessionLoaded) return;

 let cancelled = false;
 setListLoading(true);
 setListError(null);
 const params = new URLSearchParams();
 params.set("page_size", "100");
 if (scopeBranchId) params.set("branch_id", scopeBranchId);

 void (async () => {
 try {
 const res = await apiFetch(`/api/credit-analysis/applications?${params.toString()}`);
 if (cancelled) return;
 if (!res.ok) {
 const j = await res.json().catch(() => ({}));
 const msg = apiErrorMessage(j, "Failed to load credit analysis queue");
 if (isSessionExpiredResponse(res.status, msg)) {
 throw new Error("Your session expired. Please sign in again.");
 }
 throw new Error(msg);
 }
 const json = await res.json();
 if (!cancelled) setApplications(extractApplicationsList(json));
 } catch (e) {
 if (!cancelled) setListError(e instanceof Error ? e.message : "Load failed");
 } finally {
 if (!cancelled) setListLoading(false);
 }
 })();

 return () => {
 cancelled = true;
 };
 }, [scopeBranchId, sessionLoaded]);

 const visibleApplications = useMemo(() => {
 if (!scopeBranchId) return applications;
 return applications.filter((app) => {
 if (app.branch_id !== scopeBranchId) return false;
 if (!isOfficerView || !user) return true;
 return app.created_by === user.id;
 });
 }, [applications, scopeBranchId, isOfficerView, user]);

 const selectedApplication = applicationId
 ? visibleApplications.find((app) => app.id === applicationId) ?? null
 : null;

 const selectedCustomer = useMemo(
 () => (customerApiRow ? adaptApiCustomerRowToCustomer(customerApiRow) : null),
 [customerApiRow]
 );

 const applyPrefillBundle = useCallback(
 (
 appRow: Record<string, unknown>,
 custRow: Record<string, unknown> | null,
 product: ReturnType<typeof adaptApiProductRow> | null,
 analyses: Record<string, unknown>[]
 ) => {
 const base = prefillFromApplicationCustomerProduct(appRow, custRow, product);
 const customer = custRow ? adaptApiCustomerRowToCustomer(custRow) : null;
 setRiskGradeRecommendation(customer?.risk_grade ?? "");
 const last = extractLatestAnalysisRecord(analyses);
 if (last) {
 const merged = overlayFromSavedAnalysis(last, base);
 setCreditScore(merged.creditScore);
 setCashFlow(merged.cashFlow);
 setLoanProposal(merged.loanProposal);
 if (last.risk_grade_recommendation != null && String(last.risk_grade_recommendation) !== "") {
 setRiskGradeRecommendation(String(last.risk_grade_recommendation));
 }
 if (merged.risks && merged.risks.length > 0) setRisks(merged.risks);
 const crbPatch = merged.crb;
 if (crbPatch) {
 setCrbDetails((prev) => ({
 ...prev,
 source: crbPatch.source ?? prev.source,
 scoreStatus: crbPatch.scoreStatus ?? prev.scoreStatus,
 checkDate: crbPatch.checkDate ?? prev.checkDate,
 remarks: crbPatch.remarks ?? prev.remarks,
 }));
 }
 if (merged.committee && merged.committee.length > 0) setCommitteeVotes(merged.committee);
 setSavedAnalysisRecord(last);
 } else {
 setCreditScore(base.creditScore);
 setCashFlow(base.cashFlow);
 setLoanProposal(base.loanProposal);
 setSavedAnalysisRecord(null);
 }
 },
 []
 );

 useEffect(() => {
 if (!sessionLoaded || !user) return;

 if (!applicationId) {
 setCustomerApiRow(null);
 setApplicationApiRow(null);
 setExistingAnalyses([]);
 setSelectedProduct(null);
 setSavedAnalysisRecord(null);
 setContextError(null);
 setSaveError(null);
 return;
 }
 let cancelled = false;
 setContextLoading(true);
 setContextError(null);
 setSaveError(null);
 setCreditScore("");
 setCashFlow({
 salesRevenue: "",
 purchasesCogs: "",
 businessExpenses: "",
 existingMonthlyDebtRepayments: "",
 householdExpenses: "",
 otherIncome: "",
 });
 setLoanProposal({
 amountRequested: "",
 amountApproved: "",
 bccApprovedAmount: "",
 loanCycle: "1",
 loanOfficerName: "",
 maturityMonths: "",
 proposedInstallment: "",
 interestRate: "6.00",
 loanPurpose: "",
 totalLoans: "",
 equity: "",
 inventory: "",
 currentAssets: "",
 currentLiabilities: "",
 });
 setRisks([
 { description: "", severity: "low", mitigationPlan: "" },
 { description: "", severity: "low", mitigationPlan: "" },
 { description: "", severity: "low", mitigationPlan: "" },
 ]);
 setCrbDetails({ source: "", scoreStatus: "", checkDate: "", remarks: "", attachment: null });
 setCommitteeVotes([{ memberName: "", vote: "pending", comments: "" }]);
 setExistingAnalyses([]);
 setSelectedProduct(null);
 setSavedAnalysisRecord(null);
 setRiskGradeRecommendation("");

 (async () => {
 try {
 const cr = await apiFetch(`/api/credit-analysis/applications/${encodeURIComponent(applicationId)}`);
 if (cancelled) return;
 if (cr.ok) {
 const data = await cr.json();
 if (cancelled) return;
 const env = parseCreditAnalysisEnvelope(data);
 const appRow = env.application;
 if (!appRow) throw new Error("Credit analysis response did not include an application");
 setApplicationApiRow(appRow);
 setCustomerApiRow(env.customer);
 const product = env.product ? adaptApiProductRow(env.product) : null;
 setSelectedProduct(product);
 setExistingAnalyses(env.existingAnalyses);
 applyPrefillBundle(appRow, env.customer, product, env.existingAnalyses);
 return;
 }

 const ar = await apiFetch(`/api/applications/${encodeURIComponent(applicationId)}`);
 if (cancelled) return;
 if (!ar.ok) {
 const j = await ar.json().catch(() => ({}));
 const msg = apiErrorMessage(j, "Could not load application");
 if (isSessionExpiredResponse(ar.status, msg)) {
 throw new Error("Your session expired. Please sign in again.");
 }
 throw new Error(msg);
 }
 const appJson = await ar.json();
 if (cancelled) return;
 const appRow = extractApplicationDetail(appJson);
 if (!appRow) throw new Error("Invalid application response");
 setApplicationApiRow(appRow);

 const customerId = String(appRow.customer_id ?? "");
 let custRow: Record<string, unknown> | null = null;
 if (customerId) {
 const cRes = await apiFetch(`/api/customers/${encodeURIComponent(customerId)}`);
 if (cancelled) return;
 if (cRes.ok) {
 const cj = await cRes.json();
 custRow = extractCustomerDetail(cj);
 }
 }
 setCustomerApiRow(custRow);

 const productId = String(appRow.product_id ?? "");
 let product: ReturnType<typeof adaptApiProductRow> | null = null;
 const pRes = await apiFetch("/api/falco/products?is_active=true");
 if (cancelled) return;
 if (pRes.ok) {
 const pj = await pRes.json();
 const products = extractProductsList(pj);
 product = products.find((p) => p.id === productId) ?? null;
 }

 if (cancelled) return;
 setSelectedProduct(product);
 setExistingAnalyses([]);
 applyPrefillBundle(appRow, custRow, product, []);
 } catch (e) {
 if (!cancelled) setContextError(e instanceof Error ? e.message : "Failed to load analysis context");
 } finally {
 if (!cancelled) setContextLoading(false);
 }
 })();

 return () => {
 cancelled = true;
 };
 }, [applicationId, applyPrefillBundle, sessionLoaded, user]);

 const cashFlowMetrics = computeCashFlowMetrics(cashFlow);
 const { grossCashFlow, operatingNet, disposableIncome, repaymentCapacity } = cashFlowMetrics;
 const ratioMetrics = computeRatioMetrics(cashFlowMetrics, loanProposal);
 const {
 debtServiceRatio: dsrPercent,
 leverageRatio: leveragePercent,
 rotationRatio: rotationPercent,
 liquidityRatio: liquidityPercent,
 } = ratioMetrics;

 const amountRequested = parseMoneyInput(loanProposal.amountRequested);
 const amountApproved = parseMoneyInput(loanProposal.amountApproved);
 const proposedInstallment = parseMoneyInput(loanProposal.proposedInstallment);

 const policyIndicators = buildPolicyIndicators({
 cashFlow: cashFlowMetrics,
 ratios: ratioMetrics,
 creditScore,
 proposedInstallment,
 });

 const voteStats = committeeVoteStats(committeeVotes);
 const committeeDecisionPreview = previewCommitteeDecision(committeeVotes);

 const serverMetrics = readServerMetricsFromAnalysis(savedAnalysisRecord);
 const displayRatios = serverMetrics.ratios ?? {
 debt_service_ratio: dsrPercent,
 leverage_ratio: leveragePercent,
 rotation_ratio: rotationPercent,
 liquidity_ratio: liquidityPercent,
 };
 const displayCashFlow = serverMetrics.cashFlow ?? {
 gross_cash_flow: grossCashFlow,
 operating_net: operatingNet,
 disposable_income: disposableIncome,
 repayment_capacity: repaymentCapacity,
 };
 const displayCommitteeDecision =
 serverMetrics.committeeDecision ?? committeeDecisionPreview;

 const pendingApplications = useMemo(
 () => visibleApplications.filter((app) => QUEUE_STATUSES.includes(app.status as (typeof QUEUE_STATUSES)[number])),
 [visibleApplications]
 );

 const getStatusLabel = (status: string) => {
 if (status === "submitted" || status === "under_review" || status === "draft") {
 return "Pending";
 }
 return status.replaceAll("_", " ");
 };

 const hasAnalysisContext =
 Boolean(applicationId) &&
 Boolean(selectedCustomer) &&
 Boolean(applicationApiRow) &&
 !contextLoading &&
 !contextError;

 const onSaveAnalysis = async () => {
 if (!applicationId) return;
 if (!sessionLoaded || !user) {
 setSaveError("Your session is still loading. Please wait and try again.");
 return;
 }
 setSaveLoading(true);
 setSaveError(null);
 try {
 const attachmentIds: string[] = [];
 if (crbDetails.attachment) {
 const fd = new FormData();
 fd.append("file", crbDetails.attachment);
 fd.append("type", "crb_report");
 fd.append("name", crbDetails.attachment.name);
 const up = await apiFetch(
 `/api/credit-analysis/applications/${encodeURIComponent(applicationId)}/attachments`,
 { method: "POST", body: fd }
 );
 const upJson = await up.json().catch(() => ({}));
 if (!up.ok) {
 const msg = apiErrorMessage(upJson, "CRB attachment upload failed");
 if (isSessionExpiredResponse(up.status, msg)) {
 throw new Error("Your session expired. Please sign in again.");
 }
 throw new Error(msg);
 }
 const attId = extractAttachmentIdFromUploadResponse(upJson);
 if (attId) attachmentIds.push(attId);
 }

 const dsrLabel =
 dsrPercent != null ? `${dsrPercent.toFixed(1)}%` : "n/a";
 const body = buildCreditAnalysisPostBody(
 {
 creditScore,
 cashFlow,
 loanProposal,
 risks,
 crbDetails,
 committeeVotes,
 },
 {
 summary: `Analysis saved. Committee preview: ${formatCommitteeDecision(committeeDecisionPreview)}. DSR ${dsrLabel}.`,
 risk_grade_recommendation: riskGradeRecommendation || selectedCustomer?.risk_grade,
 factors: [
 {
 key: "committee_preview",
 value: formatCommitteeDecision(committeeDecisionPreview),
 },
 {
 key: "repayment_capacity_tzs",
 value: String(Math.round(repaymentCapacity)),
 },
 ],
 attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
 }
 );
 const res = await apiFetch(
 `/api/credit-analysis/applications/${encodeURIComponent(applicationId)}/analysis`,
 {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(body),
 }
 );
 const j = await res.json().catch(() => ({}));
 if (!res.ok) {
 const msg = apiErrorMessage(j, "Save failed");
 if (isSessionExpiredResponse(res.status, msg)) {
 throw new Error("Your session expired. Please sign in again.");
 }
 throw new Error(msg);
 }
 const saved = extractAnalysisFromSaveResponse(j);
 if (saved) {
 setSavedAnalysisRecord(saved);
 setExistingAnalyses((prev) => [saved, ...prev]);
 }
 setCrbDetails((prev) => ({ ...prev, attachment: null }));
 setLastSavedAt(new Date().toISOString());
 } catch (e) {
 setSaveError(e instanceof Error ? e.message : "Save failed");
 } finally {
 setSaveLoading(false);
 }
 };

 return (
 <>
 <DashboardHeader
 title="Credit Analysis"
 description="Review loan proposal, risks, CRB report, and committee decision"
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-6xl space-y-6">
 <Card>
 <CardHeader>
 <CardTitle>Select Loan Application for Analysis</CardTitle>
 <CardDescription>
 Submitted and under-review applications from the credit-analysis API queue for your branch.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {listError && (
 <p className="mb-3 text-sm text-destructive" role="alert">
 {listError}
 </p>
 )}
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Application Code</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead>Business / purpose</TableHead>
 <TableHead>Product</TableHead>
 <TableHead className="text-right">Amount Requested (TZS)</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Application Date</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {listLoading ? (
 <TableRow>
 <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
 <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-label="Loading" />
 </TableCell>
 </TableRow>
 ) : pendingApplications.length === 0 ? (
 <TableRow>
 <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
 No applications in queue
 </TableCell>
 </TableRow>
 ) : (
 pendingApplications.map((app) => (
 <TableRow key={app.id}>
 <TableCell className="font-medium">{app.application_number}</TableCell>
 <TableCell>{app.customerDisplayName}</TableCell>
 <TableCell className="max-w-[200px] truncate" title={app.purpose}>
 {app.purpose || "—"}
 </TableCell>
 <TableCell>{app.productName || "—"}</TableCell>
 <TableCell className="text-right">{formatCurrency(app.requested_amount)}</TableCell>
 <TableCell>
 <Badge variant="secondary">{getStatusLabel(app.status)}</Badge>
 </TableCell>
 <TableCell>{formatDate(app.created_at)}</TableCell>
 <TableCell className="text-right">
 <Button
 size="sm"
 onClick={() =>
 router.push(`${creditAnalysisBase}?applicationId=${encodeURIComponent(app.id)}`)
 }
 >
 Open analysis
 </Button>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </CardContent>
 </Card>

 {applicationId && (
 <div className="flex flex-wrap items-center gap-2">
 <Button variant="outline" onClick={() => router.push(creditAnalysisBase)}>
 Start Over
 </Button>
 <Button onClick={() => void onSaveAnalysis()} disabled={saveLoading || !applicationId}>
 {saveLoading ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 "Save Analysis"
 )}
 </Button>
 {lastSavedAt && <Badge variant="outline">Saved: {formatDate(lastSavedAt)}</Badge>}
 {saveError && (
 <span className="text-sm text-destructive" role="alert">
 {saveError}
 </span>
 )}
 </div>
 )}

 {applicationId && (contextLoading || contextError) && (
 <Card>
 <CardContent className="flex items-center gap-3 py-6 text-sm">
 {contextLoading && <Loader2 className="h-5 w-5 shrink-0 animate-spin" />}
 {contextError ? (
 <span className="text-destructive">{contextError}</span>
 ) : (
 <span className="text-muted-foreground">Loading application context…</span>
 )}
 </CardContent>
 </Card>
 )}

 {applicationId && hasAnalysisContext && (
 <Card>
 <CardHeader>
 <CardTitle>Application context</CardTitle>
 <CardDescription>
 {String(
 selectedApplication?.application_number ??
 applicationApiRow?.application_number ??
 "N/A"
 )}{" "}
 ·{" "}
 {selectedCustomer
 ? `${selectedCustomer.first_name} ${selectedCustomer.middle_name ? `${selectedCustomer.middle_name} ` : ""}${selectedCustomer.last_name}`
 : "—"}
 {selectedProduct ? ` · ${selectedProduct.name}` : ""}
 </CardDescription>
 </CardHeader>
 <CardContent className="flex flex-wrap gap-2 text-sm text-muted-foreground">
 {selectedProduct && (
 <Badge variant="outline">
 Product limits: {formatCurrency(selectedProduct.min_amount)} –{" "}
 {formatCurrency(selectedProduct.max_amount)}
 </Badge>
 )}
 {existingAnalyses.length > 0 && (
 <Badge variant="secondary">{existingAnalyses.length} prior analysis record(s)</Badge>
 )}
 {serverMetrics.committeeDecision && (
 <Badge variant="outline">
 Last committee decision: {formatCommitteeDecision(serverMetrics.committeeDecision)}
 </Badge>
 )}
 </CardContent>
 </Card>
 )}

 {hasAnalysisContext && existingAnalyses.length > 0 && (
 <Card>
 <CardHeader>
 <CardTitle>Analysis history</CardTitle>
 <CardDescription>Append-only records returned by the credit-analysis API</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {existingAnalyses.slice(0, 5).map((row) => {
 const metrics = readServerMetricsFromAnalysis(row);
 const id = String(row.id ?? "");
 return (
 <div
 key={id || JSON.stringify(row)}
 className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
 >
 <span className="font-medium">
 {metrics.createdAt ? formatDate(metrics.createdAt) : "Record"}
 </span>
 <span className="text-muted-foreground">
 Committee: {formatCommitteeDecision(metrics.committeeDecision ?? "pending")}
 </span>
 {metrics.summary && (
 <span className="w-full truncate text-muted-foreground" title={metrics.summary}>
 {metrics.summary}
 </span>
 )}
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 )}

 {hasAnalysisContext && (
 <div className="grid gap-6 lg:grid-cols-2">
 <Card>
 <CardHeader>
 <CardTitle>Customer profile</CardTitle>
 <CardDescription>Fields from the customer API resource</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Customer number</span>
 <span>{selectedCustomer?.customer_number}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Type</span>
 <span className="capitalize">{selectedCustomer?.customer_type}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Business</span>
 <span className="max-w-[55%] text-right">{selectedCustomer?.business_name || "—"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Phone</span>
 <span>{selectedCustomer?.phone_number || "—"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Risk grade (profile)</span>
 <span>{selectedCustomer?.risk_grade}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Credit score (profile)</span>
 <span>{selectedCustomer?.credit_score ?? "—"}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Monthly income</span>
 <span>{formatCurrency(selectedCustomer?.monthly_income ?? 0)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Blacklisted</span>
 <span>{selectedCustomer?.is_blacklisted ? "Yes" : "No"}</span>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Policy indicators &amp; server metrics</CardTitle>
 <CardDescription>
 Live preview uses the same formulas as the API. Saved values below come from the latest stored analysis.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <ul className="space-y-2 text-sm">
 {policyIndicators.map((item) => (
 <li key={item.label} className="flex items-start justify-between gap-2">
 <span className="text-muted-foreground">{item.label}</span>
 <Badge variant={item.status === "ok" ? "secondary" : "destructive"}>
 {item.status === "ok" ? "OK" : "Review"}
 </Badge>
 </li>
 ))}
 </ul>
 <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
 <p className="font-medium">Committee decision (preview)</p>
 <p className="mt-1">{formatCommitteeDecision(committeeDecisionPreview)}</p>
 <p className="mt-2 text-xs text-muted-foreground">
 Persisted decision after save: {formatCommitteeDecision(displayCommitteeDecision)}
 </p>
 </div>
 {savedAnalysisRecord && (
 <div className="rounded-lg border border-border p-3 text-sm">
 <p className="mb-2 font-medium">Last saved server ratios</p>
 <div className="grid gap-1">
 <span>DSR: {formatRatioPercent(displayRatios.debt_service_ratio)}</span>
 <span>Leverage: {formatRatioPercent(displayRatios.leverage_ratio)}</span>
 <span>Rotation: {formatRatioPercent(displayRatios.rotation_ratio)}</span>
 <span>Liquidity: {formatRatioPercent(displayRatios.liquidity_ratio)}</span>
 </div>
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )}


<Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Scale className="h-5 w-5" />
 Cash Flow
 </CardTitle>
 <CardDescription>
 Gross cash flow = sales revenue + other income (matches API). Repayment capacity = max(disposable income, 0)
 × 40%.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 sm:grid-cols-2">
 <Field>
 <FieldLabel>Credit Score (analysis input)</FieldLabel>
 <Input
 type="number"
 placeholder="e.g., 650"
 value={creditScore}
 onChange={(e) => setCreditScore(e.target.value)}
 />
 </Field>
 <Field>
 <FieldLabel>Risk grade recommendation</FieldLabel>
 <Select value={riskGradeRecommendation} onValueChange={setRiskGradeRecommendation}>
 <SelectTrigger>
 <SelectValue placeholder="Select grade" />
 </SelectTrigger>
 <SelectContent>
 {["A", "B", "C", "D"].map((grade) => (
 <SelectItem key={grade} value={grade}>
 {grade}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Other Income</FieldLabel>
 <MoneyInput
 value={cashFlow.otherIncome}
 onValueChange={(value) => setCashFlow((prev) => ({ ...prev, otherIncome: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Sales / Revenue (period)</FieldLabel>
 <MoneyInput
 value={cashFlow.salesRevenue}
 onValueChange={(value) => setCashFlow((prev) => ({ ...prev, salesRevenue: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Purchases / COGS</FieldLabel>
 <MoneyInput
 value={cashFlow.purchasesCogs}
 onValueChange={(value) => setCashFlow((prev) => ({ ...prev, purchasesCogs: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Business Expenses (operating)</FieldLabel>
 <MoneyInput
 value={cashFlow.businessExpenses}
 onValueChange={(value) => setCashFlow((prev) => ({ ...prev, businessExpenses: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Existing Monthly Debt Repayments</FieldLabel>
 <MoneyInput
 value={cashFlow.existingMonthlyDebtRepayments}
 onValueChange={(value) =>
 setCashFlow((prev) => ({
 ...prev,
 existingMonthlyDebtRepayments: value,
 }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Home / Household Expenses</FieldLabel>
 <MoneyInput
 value={cashFlow.householdExpenses}
 onValueChange={(value) => setCashFlow((prev) => ({ ...prev, householdExpenses: value }))}
 />
 </Field>
 </div>

 <div className="rounded-lg border border-border bg-muted/40 p-4">
 <p className="mb-3 text-sm font-semibold">
 Cash Flow Results {savedAnalysisRecord ? "(preview; server values stored on save)" : "(preview)"}
 </p>
 <div className="grid gap-2 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">Gross Cash Flow (Sales + Other Income)</span>
 <span>{formatCurrency(Number(displayCashFlow.gross_cash_flow ?? grossCashFlow))}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Operating Net (Gross − COGS − Business Expenses)</span>
 <span>{formatCurrency(Number(displayCashFlow.operating_net ?? operatingNet))}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Disposable Income</span>
 <span>{formatCurrency(Number(displayCashFlow.disposable_income ?? disposableIncome))}</span>
 </div>
 <div className="flex justify-between font-semibold">
 <span>Repayment Capacity (40% of disposable)</span>
 <span>{formatCurrency(Number(displayCashFlow.repayment_capacity ?? repaymentCapacity))}</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Loan Proposal & Ratios</CardTitle>
 <CardDescription>
 Requested amount, term, installment, and interest are prefilled from the application and selected product
 where available.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 <Field>
 <FieldLabel>Amount Requested</FieldLabel>
 <MoneyInput
 value={loanProposal.amountRequested}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, amountRequested: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Amount Approved</FieldLabel>
 <MoneyInput
 value={loanProposal.amountApproved}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, amountApproved: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>BCC Approved Amount</FieldLabel>
 <MoneyInput
 value={loanProposal.bccApprovedAmount}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, bccApprovedAmount: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Loan Cycle</FieldLabel>
 <Input
 type="number"
 value={loanProposal.loanCycle}
 onChange={(e) => setLoanProposal((prev) => ({ ...prev, loanCycle: e.target.value }))}
 />
 </Field>
 <Field>
 <FieldLabel>LO Name</FieldLabel>
 <Input
 value={loanProposal.loanOfficerName}
 onChange={(e) => setLoanProposal((prev) => ({ ...prev, loanOfficerName: e.target.value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Maturity (months)</FieldLabel>
 <Input
 type="number"
 value={loanProposal.maturityMonths}
 onChange={(e) => setLoanProposal((prev) => ({ ...prev, maturityMonths: e.target.value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Installment (proposed monthly)</FieldLabel>
 <MoneyInput
 value={loanProposal.proposedInstallment}
 onValueChange={(value) =>
 setLoanProposal((prev) => ({
 ...prev,
 proposedInstallment: value,
 }))
 }
 />
 </Field>
 <Field>
 <FieldLabel>Interest Rate (% per month)</FieldLabel>
 <Input
 type="number"
 step="0.01"
 value={loanProposal.interestRate}
 onChange={(e) => setLoanProposal((prev) => ({ ...prev, interestRate: e.target.value }))}
 />
 </Field>
 <Field className="sm:col-span-2 lg:col-span-3">
 <FieldLabel>Loan Purpose</FieldLabel>
 <Textarea
 rows={2}
 value={loanProposal.loanPurpose}
 onChange={(e) => setLoanProposal((prev) => ({ ...prev, loanPurpose: e.target.value }))}
 />
 </Field>
 </div>

 <div className="rounded-lg border border-border bg-muted/40 p-4">
 <p className="mb-3 text-sm font-semibold">Financial Ratios</p>
 <div className="grid gap-2 text-sm">
 <div className="flex justify-between">
 <span className="text-muted-foreground">DSR (% of disposable income)</span>
 <span>{formatRatioPercent(displayRatios.debt_service_ratio ?? dsrPercent)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Leverage (% — total loans ÷ equity)</span>
 <span>{formatRatioPercent(displayRatios.leverage_ratio ?? leveragePercent)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Rotation (% — amount requested ÷ inventory)</span>
 <span>{formatRatioPercent(displayRatios.rotation_ratio ?? rotationPercent)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-muted-foreground">Liquidity (% — current assets ÷ liabilities)</span>
 <span>{formatRatioPercent(displayRatios.liquidity_ratio ?? liquidityPercent)}</span>
 </div>
 </div>
 <div className="mt-4 grid gap-4 sm:grid-cols-2">
 <Field>
 <FieldLabel>Loans (for Leverage)</FieldLabel>
 <MoneyInput
 value={loanProposal.totalLoans}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, totalLoans: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Equity</FieldLabel>
 <MoneyInput
 value={loanProposal.equity}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, equity: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Inventory</FieldLabel>
 <MoneyInput
 value={loanProposal.inventory}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, inventory: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Current Assets</FieldLabel>
 <MoneyInput
 value={loanProposal.currentAssets}
 onValueChange={(value) => setLoanProposal((prev) => ({ ...prev, currentAssets: value }))}
 />
 </Field>
 <Field>
 <FieldLabel>Current Liabilities</FieldLabel>
 <MoneyInput
 value={loanProposal.currentLiabilities}
 onValueChange={(value) =>
 setLoanProposal((prev) => ({
 ...prev,
 currentLiabilities: value,
 }))
 }
 />
 </Field>
 </div>
 </div>

 <div className="rounded-lg border border-border p-4 text-sm">
 <p className="font-semibold">Amount Requested vs Approved</p>
 <p className="mt-1 text-muted-foreground">
 {amountDecisionText(amountRequested, amountApproved)}
 </p>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Risk Analysis</CardTitle>
 <CardDescription>
 Capture key risks, severity, mitigation plan, and CRB / credit report details
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {risks.map((risk, index) => (
 <div key={index} className="rounded-lg border border-border p-4">
 <div className="mb-3 flex items-center justify-between">
 <p className="text-sm font-semibold">Risk {index + 1}</p>
 {risks.length > 1 && (
 <Button variant="ghost" size="icon" onClick={() => setRisks((prev) => prev.filter((_, i) => i !== index))}>
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>
 <div className="grid gap-4 sm:grid-cols-3">
 <Field>
 <FieldLabel>Risk Description</FieldLabel>
 <Textarea
 rows={2}
 value={risk.description}
 onChange={(e) =>
 setRisks((prev) =>
 prev.map((item, i) => (i === index ? { ...item, description: e.target.value } : item))
 )
 }
 />
 </Field>
 <Field>
 <FieldLabel>Severity</FieldLabel>
 <Select
 value={risk.severity}
 onValueChange={(value) =>
 setRisks((prev) => prev.map((item, i) => (i === index ? { ...item, severity: value } : item)))
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="low">Low</SelectItem>
 <SelectItem value="medium">Medium</SelectItem>
 <SelectItem value="high">High</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Mitigation Plan</FieldLabel>
 <Textarea
 rows={2}
 value={risk.mitigationPlan}
 onChange={(e) =>
 setRisks((prev) =>
 prev.map((item, i) => (i === index ? { ...item, mitigationPlan: e.target.value } : item))
 )
 }
 />
 </Field>
 </div>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 onClick={() => setRisks((prev) => [...prev, { description: "", severity: "low", mitigationPlan: "" }])}
 >
 <Plus className="mr-2 h-4 w-4" />
 Add Risk
 </Button>

 <div className="rounded-lg border border-border bg-muted/40 p-4">
 <p className="mb-3 text-sm font-semibold">CRB / Credit Report Details</p>
 <FieldGroup>
 <Field>
 <FieldLabel>CRB Source</FieldLabel>
 <Input
 value={crbDetails.source}
 onChange={(e) => setCrbDetails((prev) => ({ ...prev, source: e.target.value }))}
 />
 </Field>
 <Field>
 <FieldLabel>CRB Score / Status</FieldLabel>
 <Input
 value={crbDetails.scoreStatus}
 onChange={(e) => setCrbDetails((prev) => ({ ...prev, scoreStatus: e.target.value }))}
 />
 </Field>
 <Field>
 <FieldLabel>CRB Check Date</FieldLabel>
 <Input
 type="date"
 value={crbDetails.checkDate}
 onChange={(e) => setCrbDetails((prev) => ({ ...prev, checkDate: e.target.value }))}
 />
 </Field>
 <Field className="sm:col-span-2">
 <FieldLabel>CRB Remarks / Summary</FieldLabel>
 <Textarea
 rows={3}
 value={crbDetails.remarks}
 onChange={(e) => setCrbDetails((prev) => ({ ...prev, remarks: e.target.value }))}
 />
 </Field>
 <Field>
 <FieldLabel>CRB report file (uploaded on save)</FieldLabel>
 <Input
 type="file"
 accept=".pdf,image/*"
 onChange={(e) =>
 setCrbDetails((prev) => ({
 ...prev,
 attachment: e.target.files?.[0] ?? null,
 }))
 }
 />
 {crbDetails.attachment && (
 <p className="mt-1 text-xs text-muted-foreground">Attached: {crbDetails.attachment.name}</p>
 )}
 </Field>
 </FieldGroup>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Credit Committee</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {committeeVotes.map((vote, index) => (
 <div key={index} className="rounded-lg border border-border p-4">
 <div className="mb-3 flex items-center justify-between">
 <p className="text-sm font-semibold">Member Vote {index + 1}</p>
 {committeeVotes.length > 1 && (
 <Button
 variant="ghost"
 size="icon"
 onClick={() => setCommitteeVotes((prev) => prev.filter((_, i) => i !== index))}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>
 <div className="grid gap-4 sm:grid-cols-3">
 <Field>
 <FieldLabel>Committee Member</FieldLabel>
 <Input
 value={vote.memberName}
 onChange={(e) =>
 setCommitteeVotes((prev) =>
 prev.map((item, i) => (i === index ? { ...item, memberName: e.target.value } : item))
 )
 }
 />
 </Field>
 <Field>
 <FieldLabel>Vote</FieldLabel>
 <Select
 value={vote.vote}
 onValueChange={(value) =>
 setCommitteeVotes((prev) =>
 prev.map((item, i) => (i === index ? { ...item, vote: value } : item))
 )
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="approve">Approve</SelectItem>
 <SelectItem value="reject">Reject</SelectItem>
 <SelectItem value="abstain">Abstain</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field>
 <FieldLabel>Comments</FieldLabel>
 <Input
 value={vote.comments}
 onChange={(e) =>
 setCommitteeVotes((prev) =>
 prev.map((item, i) => (i === index ? { ...item, comments: e.target.value } : item))
 )
 }
 />
 </Field>
 </div>
 </div>
 ))}
 <Button
 type="button"
 variant="outline"
 onClick={() =>
 setCommitteeVotes((prev) => [...prev, { memberName: "", vote: "pending", comments: "" }])
 }
 >
 <Plus className="mr-2 h-4 w-4" />
 Add Committee Member Vote
 </Button>
 <div className="rounded-lg bg-muted/40 p-4 text-sm">
 <p className="font-semibold">Committee Tally</p>
 <p className="mt-2 flex items-center gap-2 text-muted-foreground">
 <CheckCircle2 className="h-4 w-4 text-green-600" />
 Approve: {voteStats.approve}
 </p>
 <p className="mt-1 flex items-center gap-2 text-muted-foreground">
 <XCircle className="h-4 w-4 text-red-600" />
 Reject: {voteStats.reject}
 </p>
 <p className="mt-1 flex items-center gap-2 text-muted-foreground">
 <MinusCircle className="h-4 w-4 text-amber-600" />
 Abstain: {voteStats.abstain}
 </p>
 <p className="mt-2 font-medium">{formatCommitteeDecision(committeeDecisionPreview)}</p>
 <p className="text-xs text-muted-foreground">
 Matches API rules: any reject → rejected; all approve → approved; otherwise pending.
 </p>
 </div>
 </CardContent>
 </Card>
 </div>
 </main>
 </>
 );
}

export default function CreditAnalysisPage() {
 return (
 <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading credit analysis...</div>}>
 <CreditAnalysisPageContent />
 </Suspense>
 );
}
