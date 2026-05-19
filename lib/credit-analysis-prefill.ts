import { adaptApiCustomerRowToCustomer } from "@/lib/customer-adapters";
import type { LoanProduct } from "@/lib/types";

export type CashFlowFormState = {
 salesRevenue: string;
 purchasesCogs: string;
 businessExpenses: string;
 existingMonthlyDebtRepayments: string;
 householdExpenses: string;
 otherIncome: string;
};

export type LoanProposalFormState = {
 amountRequested: string;
 amountApproved: string;
 bccApprovedAmount: string;
 loanCycle: string;
 loanOfficerName: string;
 maturityMonths: string;
 proposedInstallment: string;
 interestRate: string;
 loanPurpose: string;
 totalLoans: string;
 equity: string;
 inventory: string;
 currentAssets: string;
 currentLiabilities: string;
};

export type RiskRow = { description: string; severity: string; mitigationPlan: string };
export type CommitteeRow = { memberName: string; vote: string; comments: string };
export type CrbFormState = {
 source: string;
 scoreStatus: string;
 checkDate: string;
 remarks: string;
 attachment: File | null;
};

function numStr(v: unknown): string {
 if (v == null || v === "") return "";
 const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
 return Number.isFinite(n) && n !== 0 ? String(n) : "";
}

function numStrAllowZero(v: unknown): string {
 if (v == null || v === "") return "";
 const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
 return Number.isFinite(n) ? String(n) : "";
}

export function readRowMetadata(obj: Record<string, unknown> | null | undefined): Record<string, unknown> {
 if (!obj?.metadata || typeof obj.metadata !== "object" || obj.metadata === null) return {};
 return obj.metadata as Record<string, unknown>;
}

function pick(...vals: unknown[]): string {
 for (const v of vals) {
 const s = numStr(v);
 if (s !== "") return s;
 }
 return "";
}

function officerNameFromApplication(app: Record<string, unknown>): string {
 const o = app.assigned_officer ?? app.loan_officer ?? app.creator;
 if (o && typeof o === "object") return String((o as Record<string, unknown>).full_name ?? "");
 return String(app.created_by_name ?? app.officer_name ?? "");
}

function collateralSum(app: Record<string, unknown>, predicate: (type: string) => boolean): string {
 const c = app.collaterals;
 if (!Array.isArray(c) || c.length === 0) return "";
 let sum = 0;
 for (const raw of c) {
 if (!raw || typeof raw !== "object") continue;
 const row = raw as Record<string, unknown>;
 const type = String(row.type ?? "").toLowerCase();
 if (!predicate(type)) continue;
 const v = Number(row.estimated_value ?? row.value ?? 0);
 if (Number.isFinite(v)) sum += v;
 }
 return sum > 0 ? String(sum) : "";
}

function sumAllCollaterals(app: Record<string, unknown>): string {
 const c = app.collaterals;
 if (!Array.isArray(c) || c.length === 0) return "";
 let sum = 0;
 for (const raw of c) {
 if (!raw || typeof raw !== "object") continue;
 const v = Number((raw as Record<string, unknown>).estimated_value ?? 0);
 if (Number.isFinite(v)) sum += v;
 }
 return sum > 0 ? String(sum) : "";
}

function maturityMonthsFromTermDays(termDays: number): string {
 if (!termDays || termDays <= 0) return "";
 const months = termDays / 30;
 if (Math.abs(months - Math.round(months)) < 0.08) return String(Math.max(1, Math.round(months)));
 return String(Math.round(months * 10) / 10);
}

export function parseCreditAnalysisEnvelope(data: unknown): {
 application: Record<string, unknown> | null;
 customer: Record<string, unknown> | null;
 product: Record<string, unknown> | null;
 existingAnalyses: Record<string, unknown>[];
} {
 if (!data || typeof data !== "object") {
 return { application: null, customer: null, product: null, existingAnalyses: [] };
 }
 const o = data as Record<string, unknown>;
 const app = o.application;
 const cust = o.customer;
 const prod = o.product;
 const rawList = o.existing_analyses ?? o.existingAnalyses;
 const list = Array.isArray(rawList) ? rawList : [];
 return {
 application: app && typeof app === "object" ? (app as Record<string, unknown>) : null,
 customer: cust && typeof cust === "object" ? (cust as Record<string, unknown>) : null,
 product: prod && typeof prod === "object" ? (prod as Record<string, unknown>) : null,
 existingAnalyses: list.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object")) as Record<
 string,
 unknown
 >[],
 };
}

export function prefillFromApplicationCustomerProduct(
 application: Record<string, unknown>,
 customerRow: Record<string, unknown> | null,
 product: LoanProduct | null
): {
 creditScore: string;
 cashFlow: CashFlowFormState;
 loanProposal: LoanProposalFormState;
} {
 const customer = customerRow ? adaptApiCustomerRowToCustomer(customerRow) : null;
 const appMd = readRowMetadata(application);
 const custMd = customerRow ? readRowMetadata(customerRow) : {};

 const monthlyIncome = customer?.monthly_income ?? 0;
 const otherIncome = numStrAllowZero(
 customerRow?.other_income ?? customerRow?.other_monthly_income ?? custMd.other_monthly_income
 );

 const termDays = Number(application.term_days ?? 0);

 return {
 creditScore: customer?.credit_score != null ? String(customer.credit_score) : "",
 cashFlow: {
 salesRevenue: pick(
 appMd.estimated_monthly_sales,
 appMd.monthly_sales,
 appMd.monthly_revenue,
 custMd.estimated_monthly_sales,
 monthlyIncome > 0 ? monthlyIncome : undefined
 ),
 purchasesCogs: pick(appMd.estimated_monthly_cogs, appMd.monthly_cogs, custMd.estimated_monthly_cogs),
 businessExpenses: pick(
 appMd.estimated_monthly_operating_expenses,
 appMd.monthly_business_expenses,
 custMd.estimated_monthly_operating_expenses
 ),
 existingMonthlyDebtRepayments: pick(
 appMd.estimated_monthly_debt_service,
 appMd.monthly_debt_repayments,
 custMd.estimated_monthly_debt_repayments
 ),
 householdExpenses: pick(
 appMd.estimated_monthly_household_expenses,
 custMd.estimated_monthly_household_expenses
 ),
 otherIncome,
 },
 loanProposal: {
 amountRequested: numStrAllowZero(application.requested_amount),
 amountApproved: pick(application.approved_amount),
 bccApprovedAmount: pick(application.board_approved_amount, appMd.bcc_approved_amount),
 loanCycle: String(appMd.loan_cycle ?? custMd.loan_cycle ?? "1"),
 loanOfficerName: officerNameFromApplication(application),
 maturityMonths: maturityMonthsFromTermDays(termDays),
 proposedInstallment: pick(application.installment_amount, appMd.proposed_installment),
 interestRate:
 product?.interest_rate_per_month != null && product.interest_rate_per_month > 0
 ? String(product.interest_rate_per_month)
 : product && product.interest_rate > 0
 ? String(Math.round((product.interest_rate / 12) * 10000) / 10000)
 : "6.00",
 loanPurpose: String(application.purpose ?? ""),
 totalLoans: pick(appMd.total_existing_loan_balance, custMd.total_existing_loan_balance),
 equity: pick(appMd.estimated_equity, custMd.estimated_equity),
 inventory:
 collateralSum(application, (t) => t.includes("inventory")) ||
 pick(appMd.inventory_value, custMd.inventory_value),
 currentAssets:
 sumAllCollaterals(application) || pick(appMd.current_assets, custMd.current_assets),
 currentLiabilities: pick(appMd.current_liabilities, custMd.current_liabilities),
 },
 };
}

function readNestedRecord(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
 const v = obj[key];
 if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
 return null;
}

export function extractLatestAnalysisRecord(existingAnalyses: Record<string, unknown>[]): Record<string, unknown> | null {
 if (!existingAnalyses.length) return null;
 const normalized = existingAnalyses.map((x) => {
 const inner = x.analysis && typeof x.analysis === "object" ? (x.analysis as Record<string, unknown>) : x;
 return inner;
 });
 const sorted = [...normalized].sort((a, b) => {
 const da = String(a.created_at ?? a.updated_at ?? "");
 const db = String(b.created_at ?? b.updated_at ?? "");
 return da.localeCompare(db);
 });
 return sorted[sorted.length - 1] ?? null;
}

export function overlayFromSavedAnalysis(
 last: Record<string, unknown>,
 base: ReturnType<typeof prefillFromApplicationCustomerProduct>
): ReturnType<typeof prefillFromApplicationCustomerProduct> & {
 risks: RiskRow[] | null;
 crb: Partial<CrbFormState> | null;
 committee: CommitteeRow[] | null;
} {
 const cf =
 readNestedRecord(last, "cash_flow") ??
 (last.cashFlow && typeof last.cashFlow === "object" ? (last.cashFlow as Record<string, unknown>) : null);
 const lp =
 readNestedRecord(last, "loan_proposal") ??
 (last.loanProposal && typeof last.loanProposal === "object" ? (last.loanProposal as Record<string, unknown>) : null);

 const cashFlow: CashFlowFormState = { ...base.cashFlow };
 if (cf) {
 if (numStr(cf.sales_revenue ?? cf.salesRevenue)) cashFlow.salesRevenue = numStr(cf.sales_revenue ?? cf.salesRevenue);
 if (numStr(cf.purchases_cogs ?? cf.purchasesCogs))
 cashFlow.purchasesCogs = numStr(cf.purchases_cogs ?? cf.purchasesCogs);
 if (numStr(cf.business_expenses ?? cf.businessExpenses))
 cashFlow.businessExpenses = numStr(cf.business_expenses ?? cf.businessExpenses);
 if (numStr(cf.existing_monthly_debt_repayments ?? cf.existingMonthlyDebtRepayments))
 cashFlow.existingMonthlyDebtRepayments = numStr(
 cf.existing_monthly_debt_repayments ?? cf.existingMonthlyDebtRepayments
 );
 if (numStr(cf.household_expenses ?? cf.householdExpenses))
 cashFlow.householdExpenses = numStr(cf.household_expenses ?? cf.householdExpenses);
 if (numStrAllowZero(cf.other_income ?? cf.otherIncome) !== "")
 cashFlow.otherIncome = numStrAllowZero(cf.other_income ?? cf.otherIncome);
 }

 const loanProposal: LoanProposalFormState = { ...base.loanProposal };
 if (lp) {
 const snake: Record<string, keyof LoanProposalFormState> = {
 amount_requested: "amountRequested",
 amount_approved: "amountApproved",
 bcc_approved_amount: "bccApprovedAmount",
 loan_cycle: "loanCycle",
 loan_officer_name: "loanOfficerName",
 maturity_months: "maturityMonths",
 proposed_installment: "proposedInstallment",
 interest_rate_per_month: "interestRate",
 loan_purpose: "loanPurpose",
 total_loans: "totalLoans",
 equity: "equity",
 inventory: "inventory",
 current_assets: "currentAssets",
 current_liabilities: "currentLiabilities",
 };
 for (const [sk, fk] of Object.entries(snake)) {
 const v = lp[sk] ?? lp[fk];
 if (v != null && String(v) !== "") (loanProposal as Record<string, string>)[fk] = String(v);
 }
 }

 let risks: RiskRow[] | null = null;
 const rawRisks = last.risks;
 if (Array.isArray(rawRisks) && rawRisks.length > 0) {
 risks = rawRisks.map((r) => {
 if (!r || typeof r !== "object") return { description: "", severity: "low", mitigationPlan: "" };
 const o = r as Record<string, unknown>;
 return {
 description: String(o.description ?? ""),
 severity: String(o.severity ?? "low"),
 mitigationPlan: String(o.mitigation_plan ?? o.mitigationPlan ?? ""),
 };
 });
 }

 let crb: Partial<CrbFormState> | null = null;
 const crbRaw =
 readNestedRecord(last, "crb_details") ??
 (last.crbDetails && typeof last.crbDetails === "object" ? (last.crbDetails as Record<string, unknown>) : null);
 if (crbRaw) {
 crb = {
 source: String(crbRaw.source ?? ""),
 scoreStatus: String(crbRaw.score_status ?? crbRaw.scoreStatus ?? ""),
 checkDate: String(crbRaw.check_date ?? crbRaw.checkDate ?? "").slice(0, 10),
 remarks: String(crbRaw.remarks ?? ""),
 };
 }

 let committee: CommitteeRow[] | null = null;
 const rawVotes = last.committee_votes ?? last.committeeVotes;
 if (Array.isArray(rawVotes) && rawVotes.length > 0) {
 committee = rawVotes.map((v) => {
 if (!v || typeof v !== "object") return { memberName: "", vote: "pending", comments: "" };
 const o = v as Record<string, unknown>;
 return {
 memberName: String(o.member_name ?? o.memberName ?? ""),
 vote: String(o.vote ?? "pending"),
 comments: String(o.comments ?? ""),
 };
 });
 }

 const creditScore =
 last.credit_score != null && String(last.credit_score) !== ""
 ? String(last.credit_score)
 : base.creditScore;

 return {
 creditScore,
 cashFlow,
 loanProposal,
 risks,
 crb,
 committee,
 };
}

function toNum(s: string): number | undefined {
 const n = parseFloat(String(s).replace(/,/g, ""));
 return Number.isFinite(n) ? n : undefined;
}

export type CreditAnalysisPostMeta = {
 summary?: string;
 risk_grade_recommendation?: string;
 recommended_amount?: number;
 recommended_term_days?: number;
 factors?: { key: string; value: string }[];
 attachment_ids?: string[];
};

export function buildCreditAnalysisPostBody(
 input: {
 creditScore: string;
 cashFlow: CashFlowFormState;
 loanProposal: LoanProposalFormState;
 risks: RiskRow[];
 crbDetails: CrbFormState;
 committeeVotes: CommitteeRow[];
 },
 meta?: CreditAnalysisPostMeta
): Record<string, unknown> {
 const { creditScore, cashFlow, loanProposal, risks, crbDetails, committeeVotes } = input;

 const recAmt =
 meta?.recommended_amount ??
 toNum(loanProposal.amountApproved) ??
 toNum(loanProposal.amountRequested);
 const maturityMonths = toNum(loanProposal.maturityMonths);
 const recTerm =
 meta?.recommended_term_days ??
 (maturityMonths != null ? Math.max(1, Math.round(maturityMonths * 30)) : undefined);

 const out: Record<string, unknown> = {
 credit_score: toNum(creditScore),
 cash_flow: {
 sales_revenue: toNum(cashFlow.salesRevenue),
 purchases_cogs: toNum(cashFlow.purchasesCogs),
 business_expenses: toNum(cashFlow.businessExpenses),
 existing_monthly_debt_repayments: toNum(cashFlow.existingMonthlyDebtRepayments),
 household_expenses: toNum(cashFlow.householdExpenses),
 other_income: toNum(cashFlow.otherIncome),
 },
 loan_proposal: {
 amount_requested: toNum(loanProposal.amountRequested),
 amount_approved: toNum(loanProposal.amountApproved),
 bcc_approved_amount: toNum(loanProposal.bccApprovedAmount),
 loan_cycle: toNum(loanProposal.loanCycle),
 loan_officer_name: loanProposal.loanOfficerName.trim() || undefined,
 maturity_months: toNum(loanProposal.maturityMonths),
 proposed_installment: toNum(loanProposal.proposedInstallment),
 interest_rate_per_month: toNum(loanProposal.interestRate),
 loan_purpose: loanProposal.loanPurpose || undefined,
 total_loans: toNum(loanProposal.totalLoans),
 equity: toNum(loanProposal.equity),
 inventory: toNum(loanProposal.inventory),
 current_assets: toNum(loanProposal.currentAssets),
 current_liabilities: toNum(loanProposal.currentLiabilities),
 },
 risks: risks
 .filter((r) => r.description.trim())
 .map((r) => ({
 description: r.description,
 severity: r.severity,
 mitigation_plan: r.mitigationPlan,
 })),
 crb_details: {
 source: crbDetails.source || undefined,
 score_status: crbDetails.scoreStatus || undefined,
 check_date: crbDetails.checkDate || undefined,
 remarks: crbDetails.remarks || undefined,
 },
 committee_votes: committeeVotes
 .filter((v) => v.memberName.trim())
 .map((v) => ({
 member_name: v.memberName,
 vote: v.vote === "approve" ? "approve" : v.vote === "reject" ? "reject" : v.vote === "abstain" ? "abstain" : "pending",
 comments: v.comments || undefined,
 })),
 };

 if (meta?.risk_grade_recommendation) {
 out.risk_grade_recommendation = meta.risk_grade_recommendation;
 }
 if (recAmt != null) {
 out.recommended_amount = recAmt;
 }
 if (recTerm != null) {
 out.recommended_term_days = recTerm;
 }
 if (meta?.summary) {
 out.summary = meta.summary;
 }
 if (meta?.factors && meta.factors.length > 0) {
 out.factors = meta.factors;
 }
 if (meta?.attachment_ids && meta.attachment_ids.length > 0) {
 out.attachments = meta.attachment_ids;
 }

 return out;
}

export function extractAnalysisFromSaveResponse(data: unknown): Record<string, unknown> | null {
 if (!data || typeof data !== "object") return null;
 const o = data as Record<string, unknown>;
 const inner = o.analysis;
 if (inner && typeof inner === "object") return inner as Record<string, unknown>;
 return null;
}

export function extractAttachmentIdFromUploadResponse(data: unknown): string | null {
 if (!data || typeof data !== "object") return null;
 const o = data as Record<string, unknown>;
 const att = o.attachment;
 if (att && typeof att === "object") {
 const id = (att as Record<string, unknown>).id;
 return id != null ? String(id) : null;
 }
 return null;
}

export function readServerMetricsFromAnalysis(record: Record<string, unknown> | null): {
 cashFlow: Record<string, unknown> | null;
 ratios: Record<string, unknown> | null;
 committeeDecision: string | null;
 summary: string | null;
 createdAt: string | null;
} {
 if (!record) {
 return { cashFlow: null, ratios: null, committeeDecision: null, summary: null, createdAt: null };
 }
 return {
 cashFlow: readNestedRecord(record, "cash_flow"),
 ratios: readNestedRecord(record, "ratios"),
 committeeDecision:
 record.committee_decision != null ? String(record.committee_decision) : null,
 summary: record.summary != null ? String(record.summary) : null,
 createdAt: record.created_at != null ? String(record.created_at) : null,
 };
}
