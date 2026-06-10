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

function readRawUrl(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

function extractDocumentField(
  o: Record<string, unknown>,
  key: string
): { url?: string; preview_url?: string } {
  const doc = o[key];
  if (doc && typeof doc === "object") {
    const d = doc as Record<string, unknown>;
    return {
      url: typeof d.url === "string" && d.url.trim() ? d.url.trim() : undefined,
      preview_url:
        typeof d.preview_url === "string" && d.preview_url.trim()
          ? d.preview_url.trim()
          : undefined,
    };
  }
  return {};
}

function normalizeCollaterals(raw: unknown[]): CollateralRow[] {
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      const imgDoc = extractDocumentField(o, "image_document");
      return {
        id: o.id != null ? String(o.id) : undefined,
        type: String(o.type ?? o.collateral_type ?? "").trim(),
        description: o.description != null ? String(o.description).trim() : undefined,
        estimated_value:
          o.estimated_value != null
            ? Number(o.estimated_value)
            : o.value != null
            ? Number(o.value)
            : undefined,
        // preview_url: usable directly in <img> without auth (expires ~15 min)
        image_preview_url: imgDoc.preview_url,
        // url: requires Bearer auth — use via document proxy for download
        image_url: imgDoc.url ?? readRawUrl(o, "image_url", "photo_url", "image", "photo"),
      };
    })
    .filter((c) => c.type.length > 0);
}

function normalizeGuarantors(raw: unknown[]): GuarantorRow[] {
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      const frontDoc = extractDocumentField(o, "id_front_document");
      const backDoc = extractDocumentField(o, "id_back_document");
      return {
        id: o.id != null ? String(o.id) : undefined,
        full_name: String(o.full_name ?? o.name ?? "").trim(),
        phone: o.phone != null ? String(o.phone).trim() : undefined,
        relationship: o.relationship != null ? String(o.relationship).trim() : undefined,
        national_id: o.national_id != null ? String(o.national_id).trim() : undefined,
        address: o.address != null ? String(o.address).trim() : undefined,
        // ID front — preview usable in <img> directly; url requires auth
        id_front_preview_url: frontDoc.preview_url,
        id_front_url: frontDoc.url,
        // ID back — same pattern
        id_back_preview_url: backDoc.preview_url,
        id_back_url: backDoc.url,
        // Legacy fallback for older API responses
        document_url: readRawUrl(o, "document_url", "id_document_url", "national_id_url"),
      };
    })
    .filter((g) => g.full_name.length > 0);
}

function normalizeReferences(raw: unknown[]): ReferenceRow[] {
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      return {
        id: o.id != null ? String(o.id) : undefined,
        full_name: String(o.full_name ?? o.name ?? "").trim(),
        phone: o.phone != null ? String(o.phone).trim() : undefined,
        relationship: o.relationship != null ? String(o.relationship).trim() : undefined,
      };
    })
    .filter((r) => r.full_name.length > 0);
}

function normalizeDocuments(raw: unknown[]): LoanDocument[] {
 const parsed = raw.map((item) => {
  const o = item as Record<string, unknown>;
  const type = normalizeDocTypeSlug(String(o.type ?? o.document_type ?? ""));
  const nested = extractDocumentField(o, "document");
  return {
   id: String(o.id ?? ""),
   name: String(o.name ?? o.file_name ?? ""),
   type,
   url: String(o.url ?? nested.url ?? ""),
   preview_url: readRawUrl(o, "preview_url", "signed_url", "thumbnail_url") ?? nested.preview_url,
   uploaded_at: String(o.uploaded_at ?? o.created_at ?? ""),
   verified: Boolean(o.verified),
   verified_by: o.verified_by != null ? String(o.verified_by) : undefined,
  };
 });

 // Deduplicate by type: if a type appears more than once, keep whichever
 // entry has a real URL (non-empty), otherwise keep the first occurrence.
 const seen = new Map<string, LoanDocument>();
 for (const doc of parsed) {
  const existing = seen.get(doc.type);
  if (!existing) {
   seen.set(doc.type, doc);
  } else if (!existing.url && doc.url) {
   // Upgrade to the version that has an actual URL
   seen.set(doc.type, doc);
  }
 }
 return Array.from(seen.values());
}

export type CollateralRow = {
  id?: string;
  type: string;
  description?: string;
  estimated_value?: number;
  /** Direct <img> src — no auth required, expires ~15 min. Prefer over image_url for display. */
  image_preview_url?: string;
  /** Authenticated download URL — must be fetched with Bearer token (use document proxy). */
  image_url?: string;
};

export type GuarantorRow = {
  id?: string;
  full_name: string;
  phone?: string;
  relationship?: string;
  national_id?: string;
  address?: string;
  /** Direct <img> src for ID front — no auth required, expires ~15 min. */
  id_front_preview_url?: string;
  /** Authenticated download URL for ID front. */
  id_front_url?: string;
  /** Direct <img> src for ID back — no auth required, expires ~15 min. */
  id_back_preview_url?: string;
  /** Authenticated download URL for ID back. */
  id_back_url?: string;
  /** Legacy fallback: single document URL (older API). */
  document_url?: string;
};

export type ReferenceRow = {
  id?: string;
  full_name: string;
  phone?: string;
  relationship?: string;
};

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
  /** Collaterals array from the API */
  collaterals?: CollateralRow[];
  /** Guarantors array from the API */
  guarantors?: GuarantorRow[];
  /** References array from the API */
  references?: ReferenceRow[];
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

  const collaterals = normalizeCollaterals(Array.isArray(app.collaterals) ? app.collaterals : []);
  const guarantors = normalizeGuarantors(Array.isArray(app.guarantors) ? app.guarantors : []);
  const references = normalizeReferences(Array.isArray(app.references) ? app.references : []);

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
    collaterals: collaterals.length > 0 ? collaterals : undefined,
    guarantors: guarantors.length > 0 ? guarantors : undefined,
    references: references.length > 0 ? references : undefined,
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
