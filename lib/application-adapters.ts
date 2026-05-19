import {
 normalizeApplicationStatus,
 normalizeWorkflowStage,
 rawApplicationStatus,
 type ApplicationWorkflowStage,
} from "@/lib/application-status";
import { resolveCustomerLoanOfficerId } from "@/lib/customer-adapters";
import type {
 LoanApplication,
 LoanApplicationStatus,
 LoanDocument,
 LoanMode,
 RiskGrade,
} from "@/lib/types";

function normalizeDocTypeSlug(t: string): string {
 return String(t ?? "")
 .trim()
 .toLowerCase()
 .replace(/\s+/g, "_")
 .replace(/-/g, "_");
}

function normalizeDocuments(raw: unknown[]): LoanDocument[] {
 return raw.map((item) => {
 const o = item as Record<string, unknown>;
 const type = normalizeDocTypeSlug(String(o.type ?? o.document_type ?? ""));
 return {
 id: String(o.id ?? ""),
 name: String(o.name ?? ""),
 type,
 url: String(o.url ?? ""),
 uploaded_at: String(o.uploaded_at ?? ""),
 verified: Boolean(o.verified),
 verified_by: o.verified_by != null ? String(o.verified_by) : undefined,
 };
 });
}

export type ApplicationViewRow = LoanApplication & {
 customerSearchText: string;
 customerDisplayName: string;
 customerNumber: string;
 productName: string;
 branchName: string;
 creatorName: string;
 officerName: string;
 assigned_officer_id?: string;
 /** RM from nested customer on list rows when customer_id map is incomplete. */
 customer_loan_officer_id?: string;
 required_documents?: string[];
 loan_id?: string;
 loan_number?: string;
 /** API status string before normalization (for workflow transitions). */
 raw_status?: string;
 workflow_stage?: ApplicationWorkflowStage;
 businessName?: string;
 monthlyIncome?: number;
 riskGrade?: RiskGrade | string;
 creditScore?: number;
};

function asStatus(v: string | undefined): LoanApplicationStatus {
 return normalizeApplicationStatus(v);
}

function unwrapApplication(row: Record<string, unknown>): Record<string, unknown> {
 const inner = row.application;
 if (inner && typeof inner === "object") return inner as Record<string, unknown>;
 return row;
}

function readAppMetadata(app: Record<string, unknown>): Record<string, unknown> {
 const md = app.metadata;
 if (md && typeof md === "object" && md !== null) return md as Record<string, unknown>;
 return {};
}

function customerProfileFromApp(app: Record<string, unknown>): {
 businessName: string;
 monthlyIncome?: number;
 riskGrade?: RiskGrade | string;
 creditScore?: number;
} {
 const md = readAppMetadata(app);
 let businessName = String(app.business_name ?? md.business_name ?? "").trim();
 let monthlyIncome: number | undefined;
 let riskGrade: RiskGrade | string | undefined;
 let creditScore: number | undefined;

 const c = app.customer;
 if (c && typeof c === "object") {
 const o = c as Record<string, unknown>;
 if (!businessName) businessName = String(o.business_name ?? "").trim();
 const mi = Number(o.monthly_income ?? 0);
 const oi = Number(o.other_income ?? 0);
 if (Number.isFinite(mi) && mi > 0) {
 monthlyIncome = mi + (Number.isFinite(oi) && oi > 0 ? oi : 0);
 }
 if (o.risk_grade) riskGrade = String(o.risk_grade) as RiskGrade;
 if (o.credit_score != null && Number.isFinite(Number(o.credit_score))) {
 creditScore = Number(o.credit_score);
 }
 }

 if (monthlyIncome == null && md.monthly_income != null) {
 const n = Number(md.monthly_income);
 if (Number.isFinite(n) && n > 0) monthlyIncome = n;
 }
 if (!riskGrade && md.risk_grade) riskGrade = String(md.risk_grade) as RiskGrade;
 if (creditScore == null && md.credit_score != null) {
 const n = Number(md.credit_score);
 if (Number.isFinite(n)) creditScore = n;
 }

 if (!businessName) {
 const collaterals = app.collaterals;
 if (Array.isArray(collaterals) && collaterals.length > 0) {
 const first = collaterals[0];
 if (first && typeof first === "object") {
 const row = first as Record<string, unknown>;
 businessName = String(row.description ?? row.type ?? "").trim();
 }
 }
 }

 return { businessName, monthlyIncome, riskGrade, creditScore };
}

function customerSearchTextFromRow(app: Record<string, unknown>): {
 searchText: string;
 displayName: string;
 customerNumber: string;
} {
 const c = app.customer;
 if (c && typeof c === "object") {
 const o = c as Record<string, unknown>;
 const fn = String(o.first_name ?? "");
 const ln = String(o.last_name ?? "");
 const full = String(o.full_name ?? "").trim();
 const display = full || `${fn} ${ln}`.trim();
 const num = String(o.customer_number ?? "");
 if (display) {
 const searchText = `${fn} ${ln} ${full} ${num}`.toLowerCase();
 return { searchText, displayName: display, customerNumber: num };
 }
 }

 const flatName = String(
 app.customer_name ?? app.customer_full_name ?? app.borrower_name ?? ""
 ).trim();
 const num = String(app.customer_number ?? "");
 if (flatName) {
 return {
 searchText: `${flatName} ${num}`.toLowerCase(),
 displayName: flatName,
 customerNumber: num,
 };
 }

 return { searchText: "", displayName: "", customerNumber: num };
}

export function adaptApiApplicationListRow(row: Record<string, unknown>): ApplicationViewRow {
 const app = unwrapApplication(row);
 const id = String(app.id ?? "");
 const customerId = String(app.customer_id ?? "");
 const productId = String(app.product_id ?? "");
 const branchId = String(app.branch_id ?? "");
 const assignedOfficerId =
 app.assigned_officer_id != null
 ? String(app.assigned_officer_id)
 : app.loan_officer_id != null
 ? String(app.loan_officer_id)
 : undefined;

 let customerLoanOfficerId = "";
 const custObj = app.customer;
 if (custObj && typeof custObj === "object") {
 customerLoanOfficerId = resolveCustomerLoanOfficerId(custObj as Record<string, unknown>);
 }

 const rawDocuments = Array.isArray(app.documents) ? app.documents : [];
 const documents = normalizeDocuments(rawDocuments);

 const cust = customerSearchTextFromRow(app);
 const profile = customerProfileFromApp(app);
 const product = app.product;
 let productName =
 product && typeof product === "object"
 ? String((product as Record<string, unknown>).name ?? "")
 : String(app.product_name ?? "");
 let required_documents: string[] | undefined;
 if (product && typeof product === "object") {
 const rd = (product as Record<string, unknown>).required_documents;
 if (Array.isArray(rd)) {
 required_documents = rd.map((x) => String(x));
 }
 }

 const branch = app.branch;
 const branchName =
 branch && typeof branch === "object"
 ? String((branch as Record<string, unknown>).name ?? "")
 : String(app.branch_name ?? branchId);
 const creator = app.creator ?? app.created_by_user;
 let creatorName = "";
 if (creator && typeof creator === "object") {
 creatorName = String((creator as Record<string, unknown>).full_name ?? "");
 } else if (typeof app.created_by_name === "string") {
 creatorName = app.created_by_name;
 }

 const officer = app.assigned_officer ?? app.loan_officer;
 let officerName = "";
 if (officer && typeof officer === "object") {
 officerName = String((officer as Record<string, unknown>).full_name ?? "");
 } else if (typeof app.assigned_officer_name === "string") {
 officerName = app.assigned_officer_name;
 } else if (typeof app.officer_name === "string") {
 officerName = app.officer_name;
 }

 const loanRaw = app.loan;
 const loan_id =
 app.loan_id != null
 ? String(app.loan_id)
 : loanRaw && typeof loanRaw === "object"
 ? String((loanRaw as Record<string, unknown>).id ?? "")
 : undefined;
 const loan_number =
 loanRaw && typeof loanRaw === "object"
 ? String((loanRaw as Record<string, unknown>).loan_number ?? "")
 : app.loan_number != null
 ? String(app.loan_number)
 : undefined;

 return {
 id,
 application_number: String(app.application_number ?? id),
 customer_id: customerId,
 loan_mode: (app.loan_mode as LoanMode) ?? "individual",
 group_id: app.group_id ? String(app.group_id) : undefined,
 product_id: productId,
 branch_id: branchId,
 requested_amount: Number(app.requested_amount ?? 0),
 approved_amount: app.approved_amount != null ? Number(app.approved_amount) : undefined,
 term_days: Number(app.term_days ?? 0),
 purpose: String(app.purpose ?? ""),
 interest_amount: app.interest_amount != null ? Number(app.interest_amount) : undefined,
 total_fees: app.total_fees != null ? Number(app.total_fees) : undefined,
 total_repayment: app.total_repayment != null ? Number(app.total_repayment) : undefined,
 installment_amount: app.installment_amount != null ? Number(app.installment_amount) : undefined,
 documents,
 status: asStatus(app.status ? String(app.status) : undefined),
 raw_status: rawApplicationStatus(app.status ? String(app.status) : undefined),
 workflow_stage: normalizeWorkflowStage(
 app.workflow_stage != null ? String(app.workflow_stage) : undefined
 ),
 submitted_at: app.submitted_at ? String(app.submitted_at) : undefined,
 created_by: String(app.created_by ?? assignedOfficerId ?? ""),
 created_at: String(app.created_at ?? new Date().toISOString()),
 updated_at: String(app.updated_at ?? app.created_at ?? new Date().toISOString()),
 customerSearchText: cust.searchText,
 customerDisplayName: cust.displayName,
 customerNumber: cust.customerNumber,
 productName,
 branchName,
 creatorName,
 officerName,
 assigned_officer_id: assignedOfficerId,
 customer_loan_officer_id: customerLoanOfficerId || undefined,
 required_documents,
 loan_id: loan_id || undefined,
 loan_number: loan_number || undefined,
 businessName: profile.businessName || undefined,
 monthlyIncome: profile.monthlyIncome,
 riskGrade: profile.riskGrade,
 creditScore: profile.creditScore,
 };
}

export function extractApplicationsList(json: unknown): ApplicationViewRow[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.applications) ? o.applications : [];
 if (!Array.isArray(rows)) return [];
 return (rows as Record<string, unknown>[]).map(adaptApiApplicationListRow);
}

/** `GET /applications/{id}` may return `{ application: {...} }` or a bare application object. */
export function extractApplicationDetail(json: unknown): Record<string, unknown> | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const inner = unwrapApplication(o);
 if (!inner || typeof inner !== "object") return null;
 return inner;
}
