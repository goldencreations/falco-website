import { extractApplicationDetail } from "@/lib/application-adapters";
import { normalizeApplicationStatus, rawApplicationStatus } from "@/lib/application-status";
import type { SessionUser } from "@/lib/auth";
import { resolvedBranchIdForListQuery } from "@/lib/authorization";
import { previewCommitteeDecision } from "@/lib/credit-analysis-metrics";
import type { CommitteeRow } from "@/lib/credit-analysis-prefill";
import { FalcoApiError, getFalcoApiBaseUrl } from "@/lib/falco-api";
import { falcoServerFetch, resolveFalcoAccessToken } from "@/lib/server-falco";

const CREDIT_QUEUE_STATUSES = new Set(["submitted", "under_review"]);

export function isCreditAnalysisQueueStatus(raw: string | undefined | null): boolean {
 const normalized = normalizeApplicationStatus(rawApplicationStatus(raw));
 return CREDIT_QUEUE_STATUSES.has(normalized);
}

function extractApplicationRows(data: unknown): Record<string, unknown>[] {
 if (!data || typeof data !== "object") return [];
 const o = data as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.applications) ? o.applications : [];
 if (!Array.isArray(rows)) return [];
 return rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"));
}

function filterRowsForCreditQueue(
 rows: Record<string, unknown>[],
 user: SessionUser
): Record<string, unknown>[] {
 const officerId = user.role === "loan_officer" ? user.id.trim() : "";
 return rows.filter((row) => {
 if (!isCreditAnalysisQueueStatus(String(row.status ?? ""))) return false;
 if (officerId) {
 const createdBy = String(row.created_by ?? "").trim();
 if (createdBy && createdBy !== officerId) return false;
 }
 return true;
 });
}

/** When Falco denies `credit_analysis.*`, proxy the queue from `/applications` for branch staff. */
export async function fetchCreditAnalysisApplicationsList(
 request: Request,
 user: SessionUser,
 query: {
 page?: string | null;
 page_size?: string | null;
 status?: string | null;
 branch_id?: string | null;
 assigned_analyst_id?: string | null;
 }
): Promise<Awaited<ReturnType<typeof falcoServerFetch<unknown>>>> {
 const branchId = resolvedBranchIdForListQuery(user, query.branch_id);

 const primary = await falcoServerFetch<unknown>("/credit-analysis/applications", {
 request,
 query: {
 page: query.page ?? "1",
 page_size: query.page_size ?? "50",
 status: query.status ?? undefined,
 branch_id: branchId,
 assigned_analyst_id: query.assigned_analyst_id ?? undefined,
 },
 });

 if (primary.ok) return primary;

 if (primary.error.status !== 403) return primary;

 const apps = await falcoServerFetch<unknown>("/applications", {
 request,
 query: {
 page: query.page ?? "1",
 page_size: query.page_size ?? "100",
 branch_id: branchId,
 status: query.status ?? undefined,
 },
 });

 if (!apps.ok) return primary;

 const rows = filterRowsForCreditQueue(extractApplicationRows(apps.data), user);
 const envelope =
 apps.data && typeof apps.data === "object"
 ? { ...(apps.data as Record<string, unknown>), data: rows, _credit_analysis_fallback: true }
 : { data: rows, _credit_analysis_fallback: true };

 return { ok: true, data: envelope };
}

/** Build credit-analysis context from application detail when the dedicated endpoint returns 403. */
export async function fetchCreditAnalysisApplicationContext(
 request: Request,
 applicationId: string
): Promise<Awaited<ReturnType<typeof falcoServerFetch<unknown>>>> {
 const primary = await falcoServerFetch<unknown>(
 `/credit-analysis/applications/${encodeURIComponent(applicationId)}`,
 { request }
 );
 if (primary.ok) return primary;
 if (primary.error.status !== 403) return primary;

 const appRes = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}`, {
 request,
 });
 if (!appRes.ok) return primary;

 const appRow = extractApplicationDetail(appRes.data);
 if (!appRow) {
 return {
 ok: false,
 error: new FalcoApiError("Application not found", { status: 404 }),
 };
 }

 const customerId = String(appRow.customer_id ?? "").trim();
 let customer: Record<string, unknown> | null = null;
 if (customerId) {
 const custRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
 request,
 });
 if (custRes.ok && custRes.data && typeof custRes.data === "object") {
 const o = custRes.data as Record<string, unknown>;
 customer =
 o.customer && typeof o.customer === "object"
 ? (o.customer as Record<string, unknown>)
 : (o as Record<string, unknown>);
 }
 }

 const productId = String(appRow.product_id ?? "").trim();
 let product: Record<string, unknown> | null = null;
 if (productId) {
 const prodRes = await falcoServerFetch<unknown>("/products", {
 request,
 query: { is_active: "true", page_size: "200" },
 });
 if (prodRes.ok) {
 const rows = extractApplicationRows(prodRes.data);
 product = rows.find((p) => String(p.id ?? "") === productId) ?? null;
 }
 }

 const existingAnalyses = readCreditAnalysesFromMetadata(appRow);

 return {
 ok: true,
 data: {
 application: appRow,
 customer,
 product,
 existing_analyses: existingAnalyses,
 _credit_analysis_fallback: true,
 },
 };
}

function readAppMetadata(app: Record<string, unknown>): Record<string, unknown> {
 const md = app.metadata;
 if (md && typeof md === "object" && md !== null) return { ...(md as Record<string, unknown>) };
 return {};
}

export function readCreditAnalysesFromMetadata(
 appOrMetadata: Record<string, unknown>
): Record<string, unknown>[] {
 const md =
 appOrMetadata.metadata && typeof appOrMetadata.metadata === "object"
 ? (appOrMetadata.metadata as Record<string, unknown>)
 : appOrMetadata;
 const raw = md.credit_analyses ?? md.creditAnalyses;
 if (!Array.isArray(raw)) return [];
 return raw.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"));
}

function numFromBody(v: unknown): number {
 const n = typeof v === "number" ? v : Number(v);
 return Number.isFinite(n) ? n : 0;
}

function readNestedBody(obj: unknown): Record<string, unknown> | null {
 if (!obj || typeof obj !== "object") return null;
 return obj as Record<string, unknown>;
}

function committeeDecisionFromApiVotes(votes: unknown): string {
 if (!Array.isArray(votes)) return "pending";
 const rows: CommitteeRow[] = votes.map((v) => {
 const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
 return {
 memberName: String(o.member_name ?? o.memberName ?? ""),
 vote: String(o.vote ?? "pending"),
 comments: String(o.comments ?? ""),
 };
 });
 return previewCommitteeDecision(rows);
}

function buildMetricsFromAnalysisBody(body: Record<string, unknown>) {
 const cf = readNestedBody(body.cash_flow) ?? {};
 const lp = readNestedBody(body.loan_proposal) ?? {};

 const grossCashFlow = numFromBody(cf.sales_revenue) + numFromBody(cf.other_income);
 const operatingNet =
 grossCashFlow - numFromBody(cf.purchases_cogs) - numFromBody(cf.business_expenses);
 const disposableIncome =
 operatingNet -
 numFromBody(cf.existing_monthly_debt_repayments) -
 numFromBody(cf.household_expenses);
 const repaymentCapacity = Math.max(disposableIncome, 0) * 0.4;

 const ratio = (numerator: number, denominator: number): number | null => {
 if (denominator <= 0) return null;
 return Math.round((numerator / denominator) * 10000) / 100;
 };

 return {
 cash_flow: {
 gross_cash_flow: grossCashFlow,
 operating_net: operatingNet,
 disposable_income: disposableIncome,
 repayment_capacity: repaymentCapacity,
 },
 ratios: {
 debt_service_ratio: ratio(numFromBody(lp.proposed_installment), disposableIncome),
 leverage_ratio: ratio(numFromBody(lp.total_loans), numFromBody(lp.equity)),
 rotation_ratio: ratio(numFromBody(lp.amount_requested), numFromBody(lp.inventory)),
 liquidity_ratio: ratio(numFromBody(lp.current_assets), numFromBody(lp.current_liabilities)),
 },
 };
}

function buildSyntheticAnalysisRecord(
 applicationId: string,
 analystId: string,
 body: Record<string, unknown>
): Record<string, unknown> {
 const metrics = buildMetricsFromAnalysisBody(body);
 const now = new Date().toISOString();
 return {
 id: `local-${Date.now()}`,
 application_id: applicationId,
 analyst_id: analystId,
 credit_score: body.credit_score ?? null,
 risk_grade_recommendation: body.risk_grade_recommendation ?? null,
 recommended_amount: body.recommended_amount ?? null,
 recommended_term_days: body.recommended_term_days ?? null,
 summary: body.summary ?? null,
 factors: body.factors ?? [],
 cash_flow: { ...readNestedBody(body.cash_flow), ...metrics.cash_flow },
 loan_proposal: body.loan_proposal ?? null,
 risks: body.risks ?? [],
 crb_details: body.crb_details ?? null,
 committee_votes: body.committee_votes ?? [],
 committee_decision: committeeDecisionFromApiVotes(body.committee_votes),
 ratios: metrics.ratios,
 attachments: body.attachments ?? [],
 created_at: now,
 updated_at: now,
 _stored_via: "application_metadata",
 };
}

async function saveCreditAnalysisViaApplicationMetadata(
 request: Request,
 applicationId: string,
 user: SessionUser,
 body: Record<string, unknown>
): Promise<Awaited<ReturnType<typeof falcoServerFetch<unknown>>>> {
 const appRes = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}`, {
 request,
 });
 if (!appRes.ok) return appRes;

 const appRow = extractApplicationDetail(appRes.data);
 if (!appRow) {
 return {
 ok: false,
 error: new FalcoApiError("Application not found", { status: 404 }),
 };
 }

 if (user.role === "loan_officer") {
 const createdBy = String(appRow.created_by ?? "").trim();
 if (createdBy && createdBy !== user.id.trim()) {
 return {
 ok: false,
 error: new FalcoApiError("You can only save credit analysis for applications you created.", {
 status: 403,
 }),
 };
 }
 }

 const metadata = readAppMetadata(appRow);
 const history = readCreditAnalysesFromMetadata(metadata);
 const record = buildSyntheticAnalysisRecord(applicationId, user.id, body);
 history.push(record);

 const patchRes = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}`, {
 request,
 method: "PATCH",
 body: {
 metadata: {
 ...metadata,
 credit_analyses: history,
 },
 },
 });

 if (!patchRes.ok) return patchRes;

 return {
 ok: true,
 data: { analysis: record, _credit_analysis_fallback: true },
 };
}

/** Save analysis; falls back to application metadata when `credit_analysis.create` is denied. */
export async function saveCreditAnalysisRecord(
 request: Request,
 applicationId: string,
 user: SessionUser,
 body: Record<string, unknown>
): Promise<Awaited<ReturnType<typeof falcoServerFetch<unknown>>>> {
 const primary = await falcoServerFetch<unknown>(
 `/credit-analysis/applications/${encodeURIComponent(applicationId)}/analysis`,
 { method: "POST", body, request }
 );

 if (primary.ok) return primary;
 if (primary.error.status !== 403) return primary;

 return saveCreditAnalysisViaApplicationMetadata(request, applicationId, user, body);
}

function normalizeDocumentUploadResponse(data: unknown): Record<string, unknown> {
 if (!data || typeof data !== "object") return { ok: true };
 const o = data as Record<string, unknown>;
 const doc = o.document ?? o.attachment;
 if (doc && typeof doc === "object") {
 const id = (doc as Record<string, unknown>).id;
 if (id != null) return { attachment: { id: String(id) } };
 }
 return o;
}

/** Upload CRB/analysis file; falls back to application documents when credit-analysis attach is denied. */
export async function uploadCreditAnalysisAttachment(
 request: Request,
 applicationId: string,
 incoming: FormData
): Promise<Awaited<ReturnType<typeof falcoServerFetch<unknown>>> | { ok: true; data: unknown }> {
 const token = await resolveFalcoAccessToken(request);
 if (!token) {
 return {
 ok: false,
 error: new FalcoApiError("Unauthorized", { status: 401 }),
 };
 }

 const outbound = new FormData();
 for (const [key, value] of incoming.entries()) {
 if (value instanceof File) outbound.append(key, value, value.name);
 else outbound.append(key, value);
 }

 const creditPath = `${getFalcoApiBaseUrl()}/credit-analysis/applications/${encodeURIComponent(applicationId)}/attachments`;
 const creditRes = await fetch(creditPath, {
 method: "POST",
 headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
 body: outbound,
 cache: "no-store",
 });

 if (creditRes.ok) {
 const text = await creditRes.text();
 let data: unknown = null;
 if (text) {
 try {
 data = JSON.parse(text);
 } catch {
 data = { message: text };
 }
 }
 return { ok: true, data: normalizeDocumentUploadResponse(data) };
 }

 if (creditRes.status !== 403) {
 const text = await creditRes.text();
 let data: unknown = { message: "Attachment upload failed" };
 if (text) {
 try {
 data = JSON.parse(text);
 } catch {
 data = { message: text };
 }
 }
 const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
 const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
 return {
 ok: false,
 error: new FalcoApiError(
 typeof err.message === "string" ? err.message : "Attachment upload failed",
 { status: creditRes.status }
 ),
 };
 }

 const appPath = `${getFalcoApiBaseUrl()}/applications/${encodeURIComponent(applicationId)}/documents`;
 const appRes = await fetch(appPath, {
 method: "POST",
 headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
 body: outbound,
 cache: "no-store",
 });

 const text = await appRes.text();
 let data: unknown = null;
 if (text) {
 try {
 data = JSON.parse(text);
 } catch {
 data = { message: text };
 }
 }

 if (!appRes.ok) {
 const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
 const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
 return {
 ok: false,
 error: new FalcoApiError(
 typeof err.message === "string" ? err.message : "Attachment upload failed",
 { status: appRes.status }
 ),
 };
 }

 return { ok: true, data: normalizeDocumentUploadResponse(data) };
}
