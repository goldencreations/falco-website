import {
 normalizeApplicationStatus,
 normalizeWorkflowStage,
 rawApplicationStatus,
 type ApplicationWorkflowStage,
} from "@/lib/application-status";
import { resolveCustomerLoanOfficerId } from "@/lib/customer-adapters";
import { DEFAULT_FALCO_API_BASE_URL } from "@/lib/falco-api";
import { calculateLoanFormula, monthsFromTermDays } from "@/lib/loan-formula";
import type {
 InterestType,
 LoanApplication,
 LoanApplicationStatus,
 LoanDocument,
 LoanMode,
 RepaymentFrequency,
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

function readNestedUrl(o: Record<string, unknown>, key: string): string | undefined {
  const value = o[key];
  if (!value || typeof value !== "object") return undefined;
  return readRawUrl(value as Record<string, unknown>, "url", "download_url", "preview_url", "signed_url");
}

function readPhotoValue(value: unknown, previewOnly = false): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return undefined;
  const o = value as Record<string, unknown>;
  return previewOnly
    ? readRawUrl(o, "preview_url", "signed_url", "url", "download_url")
    : readRawUrl(o, "url", "download_url", "preview_url", "signed_url");
}

function readCustomerPhotoFromDocuments(source: Record<string, unknown>, previewOnly = false): string | undefined {
  const docs = Array.isArray(source.documents) ? source.documents : [];
  for (const item of docs) {
    if (!item || typeof item !== "object") continue;
    const doc = item as Record<string, unknown>;
    const type = String(doc.type ?? doc.document_type ?? "").trim().toLowerCase();
    if (!/passport|profile_photo|customer_photo/.test(type)) continue;
    const direct = previewOnly
      ? readRawUrl(doc, "preview_url", "signed_url", "url", "download_url")
      : readRawUrl(doc, "url", "download_url", "preview_url", "signed_url");
    if (direct) return direct;
    const nested = readNestedUrl(doc, "document");
    if (nested) return nested;
  }
  return undefined;
}

function customerPhotoFromApp(app: Record<string, unknown>): {
  customerPassportPhotoUrl?: string;
  customerPassportPhotoPreviewUrl?: string;
} {
  const md = readAppMetadata(app);
  const customer =
    app.customer && typeof app.customer === "object"
      ? (app.customer as Record<string, unknown>)
      : {};
  const customerMd =
    customer.metadata && typeof customer.metadata === "object" && customer.metadata !== null
      ? (customer.metadata as Record<string, unknown>)
      : {};
  const sources = [customer, customerMd, md, app];

  const readUrlFromSource = (source: Record<string, unknown>) =>
    readRawUrl(source, "passport_photo_url", "profile_photo_url", "customer_photo_url") ??
    readPhotoValue(source.passport_photo) ??
    readNestedUrl(source, "passport_photo_document") ??
    readNestedUrl(source, "passport_document") ??
    readCustomerPhotoFromDocuments(source);

  const readPreviewFromSource = (source: Record<string, unknown>) =>
    readRawUrl(
      source,
      "passport_photo_preview_url",
      "profile_photo_preview_url",
      "customer_photo_preview_url"
    ) ??
    readPhotoValue(source.passport_photo, true) ??
    readCustomerPhotoFromDocuments(source, true);

  return {
    customerPassportPhotoUrl: sources.map(readUrlFromSource).find(Boolean),
    customerPassportPhotoPreviewUrl: sources.map(readPreviewFromSource).find(Boolean),
  };
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

function documentUrlFromDocumentId(id: unknown): string | undefined {
  const s = id != null ? String(id).trim() : "";
  if (!s) return undefined;
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FALCO_API_URL?.trim()) ||
    (typeof process !== "undefined" && process.env.FALCO_API_BASE_URL?.trim()) ||
    DEFAULT_FALCO_API_BASE_URL;
  return `${base.replace(/\/+$/, "")}/documents/${encodeURIComponent(s)}`;
}

function urlsFromAttachmentList(attachments: unknown): string[] {
  if (!Array.isArray(attachments)) return [];
  const out: string[] = [];
  for (const item of attachments) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = readRawUrl(o, "url", "download_url");
    if (url) {
      out.push(url);
      continue;
    }
    const fromId = documentUrlFromDocumentId(o.document_id ?? o.id);
    if (fromId) out.push(fromId);
    const nested = extractDocumentField(o, "document");
    if (nested.url) out.push(nested.url);
  }
  return out;
}

function firstAttachmentDocumentUrl(attachments: unknown): string | undefined {
  return urlsFromAttachmentList(attachments)[0];
}

export function normalizeCollaterals(raw: unknown[]): CollateralRow[] {
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      const imgDoc = extractDocumentField(o, "image_document");
      const imageDocumentId = o.image_document_id != null ? String(o.image_document_id).trim() : "";
      const fromAttachments =
        firstAttachmentDocumentUrl(o.collateral_image_attachments) ??
        firstAttachmentDocumentUrl(o.collaterall_image_attachment) ??
        firstAttachmentDocumentUrl(o.attachments);
      const image_url =
        fromAttachments ??
        imgDoc.url ??
        readRawUrl(o, "image_url", "photo_url", "image", "photo") ??
        documentUrlFromDocumentId(imageDocumentId);
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
        // Direct storage URLs from attachment arrays can load without a separate preview field.
        image_preview_url:
          imgDoc.preview_url ??
          (fromAttachments && !fromAttachments.includes("/documents/") ? fromAttachments : undefined),
        image_url,
      };
    })
    .filter((c) => c.type.length > 0);
}

export function normalizeGuarantors(raw: unknown[]): GuarantorRow[] {
  return raw
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      const frontDoc = extractDocumentField(o, "id_front_document");
      const backDoc = extractDocumentField(o, "id_back_document");
      const photoDoc = extractDocumentField(o, "photo_document");
      const photoWithCustomerDoc = extractDocumentField(o, "photo_with_customer_document");
      const wardLetterDoc = extractDocumentField(o, "ward_letter_document");
      const attachmentDocs = Array.isArray(o.attachments)
        ? o.attachments
            .filter((item) => item && typeof item === "object")
            .map((item) => extractDocumentField(item as Record<string, unknown>, "document"))
            .filter((doc) => doc.url || doc.preview_url)
        : [];
      const id_front_url =
        frontDoc.url ??
        readRawUrl(o, "id_front_url") ??
        documentUrlFromDocumentId(o.id_front_document_id);
      const id_back_url =
        backDoc.url ??
        readRawUrl(o, "id_back_url") ??
        documentUrlFromDocumentId(o.id_back_document_id);
      const flatFrontPreview = readRawUrl(o, "id_front_preview_url");
      const flatBackPreview = readRawUrl(o, "id_back_preview_url");

      return {
        id: o.id != null ? String(o.id) : undefined,
        full_name: String(o.full_name ?? o.name ?? "").trim(),
        phone: o.phone != null ? String(o.phone).trim() : undefined,
        relationship: o.relationship != null ? String(o.relationship).trim() : undefined,
        national_id: o.national_id != null ? String(o.national_id).trim() : undefined,
        address: o.address != null ? String(o.address).trim() : undefined,
        collateral_type:
          o.collateral_type != null ? String(o.collateral_type).trim() : undefined,
        collateral_description:
          o.collateral_description != null ? String(o.collateral_description).trim() : undefined,
        collateral_estimated_value:
          o.collateral_estimated_value != null ? Number(o.collateral_estimated_value) : undefined,
        id_front_preview_url:
          frontDoc.preview_url ??
          flatFrontPreview ??
          (id_front_url && !id_front_url.includes("/documents/") ? id_front_url : undefined),
        id_front_url,
        id_back_preview_url:
          backDoc.preview_url ??
          flatBackPreview ??
          (id_back_url && !id_back_url.includes("/documents/") ? id_back_url : undefined),
        id_back_url,
        photo_preview_url: photoDoc.preview_url,
        photo_url: photoDoc.url,
        photo_with_customer_preview_url: photoWithCustomerDoc.preview_url,
        photo_with_customer_url: photoWithCustomerDoc.url,
        ward_letter_preview_url: wardLetterDoc.preview_url,
        ward_letter_url: wardLetterDoc.url,
        attachment_urls: attachmentDocs
          .map((doc) => doc.url ?? doc.preview_url)
          .filter((url): url is string => Boolean(url)),
        document_url:
          readRawUrl(o, "document_url", "id_document_url", "national_id_url") ??
          documentUrlFromDocumentId(o.photo_document_id) ??
          documentUrlFromDocumentId(o.photo_with_customer_document_id),
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

 // Deduplicate by type; prefer entries with URLs and preview URLs.
 const seen = new Map<string, LoanDocument>();
 for (const doc of parsed) {
  const existing = seen.get(doc.type);
  if (!existing) {
   seen.set(doc.type, doc);
  } else {
   const existingScore = (existing.url ? 2 : 0) + (existing.preview_url ? 1 : 0);
   const docScore = (doc.url ? 2 : 0) + (doc.preview_url ? 1 : 0);
   if (docScore > existingScore) seen.set(doc.type, doc);
  }
 }

 // Drop exact duplicate files (same URL path) under different types.
 const byUrl = new Map<string, LoanDocument>();
 for (const doc of seen.values()) {
  const urlKey = (doc.url || doc.preview_url || "").split("?")[0];
  if (!urlKey) {
   byUrl.set(`${doc.type}|${doc.id || doc.name}`, doc);
   continue;
  }
  const existing = byUrl.get(urlKey);
  if (!existing) byUrl.set(urlKey, doc);
 }
 return Array.from(byUrl.values());
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
  collateral_type?: string;
  collateral_description?: string;
  collateral_estimated_value?: number;
  /** Direct <img> src for ID front — no auth required, expires ~15 min. */
  id_front_preview_url?: string;
  /** Authenticated download URL for ID front. */
  id_front_url?: string;
  /** Direct <img> src for ID back — no auth required, expires ~15 min. */
  id_back_preview_url?: string;
  /** Authenticated download URL for ID back. */
  id_back_url?: string;
  photo_preview_url?: string;
  photo_url?: string;
  photo_with_customer_preview_url?: string;
  photo_with_customer_url?: string;
  ward_letter_preview_url?: string;
  ward_letter_url?: string;
  attachment_urls?: string[];
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
  customerPassportPhotoUrl?: string;
  customerPassportPhotoPreviewUrl?: string;
  /** RM from nested customer on list rows when customer_id map is incomplete. */
  customer_loan_officer_id?: string;
  required_documents?: string[];
  loan_id?: string;
  loan_number?: string;
  /** API status string before normalization (for workflow transitions). */
  raw_status?: string;
  workflow_stage?: ApplicationWorkflowStage;
  productInterestRatePerMonth?: number;
  productInterestType?: InterestType;
  productProcessingFeePercent?: number;
  productInsuranceFeePercent?: number;
  productRepaymentFrequency?: RepaymentFrequency;
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

function asProductInterestType(v: unknown): InterestType {
 return String(v ?? "") === "reducing_balance" ? "reducing_balance" : "flat";
}

function asProductRepaymentFrequency(v: unknown): RepaymentFrequency {
 const value = String(v ?? "");
 if (value === "daily" || value === "weekly" || value === "bi_weekly" || value === "monthly") {
  return value;
 }
 return "monthly";
}

function finiteNumber(value: unknown): number | undefined {
 const n = Number(value);
 return Number.isFinite(n) ? n : undefined;
}

export function applyCalculatedApplicationTerms(row: ApplicationViewRow): ApplicationViewRow {
 const interestRatePerMonth = row.productInterestRatePerMonth;
 const processingFeePercent = row.productProcessingFeePercent;
 const insuranceFeePercent = row.productInsuranceFeePercent;
 if (
  interestRatePerMonth == null ||
  processingFeePercent == null ||
  insuranceFeePercent == null ||
  row.requested_amount <= 0 ||
  row.term_days <= 0
 ) {
  return row;
 }

 const formula = calculateLoanFormula({
  principal: row.approved_amount && row.approved_amount > 0 ? row.approved_amount : row.requested_amount,
  months: monthsFromTermDays(row.term_days),
  interestRatePerMonth,
  processingFeePercent,
  insuranceFeePercent,
  repaymentFrequency: row.productRepaymentFrequency ?? "monthly",
  interestType: row.productInterestType ?? "flat",
 });

 return {
  ...row,
  interest_amount: formula.interestAmount,
  total_fees: formula.totalFees,
  total_repayment: formula.totalRepayment,
  installment_amount: formula.installmentAmount,
 };
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
 const customerPhoto = customerPhotoFromApp(app);
 const product = app.product;
 const productRow =
 product && typeof product === "object" ? (product as Record<string, unknown>) : null;
 let productName =
 productRow
 ? String(productRow.name ?? "")
 : String(app.product_name ?? "");
 let required_documents: string[] | undefined;
 let productInterestRatePerMonth: number | undefined;
 let productInterestType: InterestType | undefined;
 let productProcessingFeePercent: number | undefined;
 let productInsuranceFeePercent: number | undefined;
 let productRepaymentFrequency: RepaymentFrequency | undefined;
 if (productRow) {
 const rd = productRow.required_documents;
 if (Array.isArray(rd)) {
 required_documents = rd.map((x) => String(x));
 }
 const monthlyRate = finiteNumber(productRow.interest_rate_per_month);
 const annualRate = finiteNumber(productRow.interest_rate);
 productInterestRatePerMonth =
  monthlyRate != null && monthlyRate > 0
   ? monthlyRate
   : annualRate != null && annualRate > 0
   ? annualRate / 12
   : undefined;
 productInterestType = asProductInterestType(productRow.interest_type);
 productProcessingFeePercent = finiteNumber(productRow.processing_fee_percent);
 productInsuranceFeePercent = finiteNumber(productRow.insurance_fee_percent);
 productRepaymentFrequency = asProductRepaymentFrequency(productRow.repayment_frequency);
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

 const adapted: ApplicationViewRow = {
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
 productInterestRatePerMonth,
 productInterestType,
 productProcessingFeePercent,
 productInsuranceFeePercent,
 productRepaymentFrequency,
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
 customerPassportPhotoUrl: customerPhoto.customerPassportPhotoUrl,
 customerPassportPhotoPreviewUrl: customerPhoto.customerPassportPhotoPreviewUrl,
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
 return applyCalculatedApplicationTerms(adapted);
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
