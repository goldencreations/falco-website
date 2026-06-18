import type { LoanDocument } from "@/lib/types";
import { extractApplicationDetail } from "@/lib/application-adapters";
import { invalidateApplicationDetailCache } from "@/lib/application-detail-cache";
import { extractProductsList } from "@/lib/product-adapters";
import { formatValidationDetails, type FalcoApiErrorDetail } from "@/lib/falco-api";
import { APPLICATION_DOCUMENTS_OPTIONAL } from "@/lib/application-workflow-config";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export type DocumentFilesByType = Record<string, File[]>;

/** Normalize legacy single-file values and arrays into a file list. */
export function filesForDocumentType(
  filesByType: Record<string, File[] | File | null | undefined> | undefined,
  type: string
): File[] {
  if (!filesByType) return [];
  const normalized = normalizeDocumentType(type);
  const raw = filesByType[normalized] ?? filesByType[type];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function hasDocumentFilesForType(
  filesByType: Record<string, File[] | File | null | undefined> | undefined,
  type: string
): boolean {
  return filesForDocumentType(filesByType, type).length > 0;
}

function formatUploadError(json: unknown, fallback: string): string {
 if (!json || typeof json !== "object") return fallback;
 const o = json as Record<string, unknown>;
 const err =
 o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
 const message =
 typeof err.message === "string"
 ? err.message
 : typeof o.message === "string"
 ? o.message
 : fallback;
 const detailsRaw = err.details ?? o.details;
 if (Array.isArray(detailsRaw)) {
 const formatted = formatValidationDetails(detailsRaw as FalcoApiErrorDetail[]);
 if (formatted) return `${message} — ${formatted}`;
 }
 if (detailsRaw && typeof detailsRaw === "object" && !Array.isArray(detailsRaw)) {
 const parts: string[] = [];
 for (const [field, messages] of Object.entries(detailsRaw as Record<string, unknown>)) {
 const text = Array.isArray(messages) ? messages.map(String).join(", ") : String(messages);
 parts.push(`${field}: ${text}`);
 }
 if (parts.length) return `${message} — ${parts.join("; ")}`;
 }
 return message;
}

/** Backend document type slug (e.g. `national_id`). */
export function normalizeDocumentType(type: string): string {
 return String(type ?? "")
 .trim()
 .toLowerCase()
 .replace(/\s+/g, "_")
 .replace(/-/g, "_");
}

export function documentTypeFromRow(doc: { type?: string; document_type?: string }): string {
 return normalizeDocumentType(doc.type ?? doc.document_type ?? "");
}

export function normalizeDocuments(raw: unknown[]): LoanDocument[] {
 return raw.map((item) => {
 const o = item as Record<string, unknown>;
 const type = normalizeDocumentType(String(o.type ?? o.document_type ?? ""));
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

export function formatRequiredDocumentLabel(slug: string): string {
 return slug
 .split(/[_-]+/)
 .filter(Boolean)
 .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
 .join(" ");
}

export function validateDocumentFile(file: File): { ok: true } | { ok: false; error: string } {
 const name = file.name.toLowerCase();
 const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
 if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
 return {
 ok: false,
 error: `Invalid file type. Use PDF, JPG, PNG, or WEBP (${file.name}).`,
 };
 }
 if (file.size > MAX_DOCUMENT_BYTES) {
 return {
 ok: false,
 error: `File too large (max ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))}MB): ${file.name}`,
 };
 }
 if (file.size <= 0) {
 return { ok: false, error: "File is empty." };
 }
 return { ok: true };
}

export function getUploadedDocumentTypes(
 documents: Array<{ type?: string; document_type?: string }>
): Set<string> {
 const types = new Set<string>();
 for (const doc of documents) {
 const t = documentTypeFromRow(doc);
 if (t) types.add(t);
 }
 return types;
}

export function getMissingRequiredDocumentTypes(
 documents: Array<{ type?: string; document_type?: string }>,
 requiredTypes: string[]
): string[] {
 const uploaded = getUploadedDocumentTypes(documents);
 const missing: string[] = [];
 for (const raw of requiredTypes) {
 const t = normalizeDocumentType(raw);
 if (!t) continue;
 if (!uploaded.has(t)) missing.push(t);
 }
 return missing;
}

function documentsFromUploadResponse(json: unknown): LoanDocument[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const app =
 o.application && typeof o.application === "object"
 ? (o.application as Record<string, unknown>)
 : o;
 if (Array.isArray(app.documents)) {
 return normalizeDocuments(app.documents);
 }
 if (o.document && typeof o.document === "object") {
 return normalizeDocuments([o.document]);
 }
 return [];
}

export function extractRequiredDocumentsFromApplicationDetail(
 detail: Record<string, unknown>
): string[] {
 const product = detail.product;
 if (product && typeof product === "object") {
 const rd = (product as Record<string, unknown>).required_documents;
 if (Array.isArray(rd)) {
 return rd.map((x) => normalizeDocumentType(String(x))).filter(Boolean);
 }
 }
 return [];
}

export type ApplicationDocumentStatus = {
 required: string[];
 uploadedTypes: string[];
 missing: string[];
 documents: LoanDocument[];
};

export async function fetchApplicationDocumentStatus(
 applicationId: string,
 productId?: string,
 requiredFromProduct?: string[]
): Promise<ApplicationDocumentStatus | null> {
 const appRes = await fetch(`/api/applications/${encodeURIComponent(applicationId)}`, {
 credentials: "include",
 });
 if (!appRes.ok) return null;
 const appJson = await appRes.json();
 const detail = extractApplicationDetail(appJson);
 if (!detail) return null;

 const documents = Array.isArray(detail.documents)
 ? normalizeDocuments(detail.documents)
 : [];
 let required =
 requiredFromProduct?.map(normalizeDocumentType).filter(Boolean) ??
 extractRequiredDocumentsFromApplicationDetail(detail);

 if (required.length === 0 && productId) {
 const prodRes = await fetch("/api/falco/products", { credentials: "include" });
 if (prodRes.ok) {
 const prodJson = await prodRes.json();
 const products = extractProductsList(prodJson);
 const product = products.find((p) => p.id === productId);
 if (product?.required_documents?.length) {
 required = product.required_documents.map(normalizeDocumentType).filter(Boolean);
 }
 }
 }

 const uploadedTypes = [...getUploadedDocumentTypes(documents)];
 const missing = getMissingRequiredDocumentTypes(documents, required);

 return { required, uploadedTypes, missing, documents };
}

export async function uploadApplicationDocumentApi(
 applicationId: string,
 file: File,
 type: string,
 name?: string
): Promise<{ ok: true; documents: LoanDocument[] } | { ok: false; error: string }> {
 const validated = validateDocumentFile(file);
 if (!validated.ok) return validated;

 const docType = normalizeDocumentType(type);
 const form = new FormData();
 form.append("file", file, file.name);
 form.append("type", docType);
 form.append("name", name ?? formatRequiredDocumentLabel(docType));

 const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/documents`, {
 method: "POST",
 credentials: "include",
 body: form,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 return { ok: false, error: formatUploadError(data, `Upload failed (${res.status})`) };
 }

 const docs = documentsFromUploadResponse(data);
 const hasType = docs.some((d) => documentTypeFromRow(d) === docType);
 if (hasType) {
 invalidateApplicationDetailCache(applicationId);
 return { ok: true, documents: docs };
 }

 // Upload succeeded but response shape is sparse — verify once before failing.
 const status = await fetchApplicationDocumentStatus(applicationId);
 const verified =
 status?.uploadedTypes.includes(docType) ||
 status?.documents.some((d) => documentTypeFromRow(d) === docType);
 if (!verified) {
 return {
 ok: false,
 error: `${formatRequiredDocumentLabel(docType)} upload did not register. Try again or use PDF/JPG/PNG.`,
 };
 }

 invalidateApplicationDetailCache(applicationId);
 return { ok: true, documents: docs };
}

/** Upload all selected files per required type slug; keys must match backend `type` values. */
export async function uploadRequiredDocumentsByType(
 applicationId: string,
 filesByType: Record<string, File[] | File | null | undefined>,
 typesToUpload: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
 const jobs: Promise<{ ok: true; documents: LoanDocument[] } | { ok: false; error: string }>[] = [];

 for (const rawType of typesToUpload) {
  const type = normalizeDocumentType(rawType);
  const files = filesForDocumentType(filesByType, type);
  if (files.length === 0) {
   return {
    ok: false,
    error: `Upload ${formatRequiredDocumentLabel(type)} before continuing.`,
   };
  }
  for (const file of files) {
   jobs.push(uploadApplicationDocumentApi(applicationId, file, type));
  }
 }

 const results = await Promise.all(jobs);
 const failed = results.find((r) => !r.ok);
 return failed && !failed.ok ? failed : { ok: true };
}

/** Register document metadata without a file (LMS accepts JSON `url`, `type`, `name`). */
export async function registerApplicationDocumentPlaceholder(
 applicationId: string,
 type: string
): Promise<{ ok: true } | { ok: false; error: string }> {
 const docType = normalizeDocumentType(type);
 const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/documents`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 type: docType,
 name: formatRequiredDocumentLabel(docType),
 url: `https://documents.falco.local/placeholder/${docType}`,
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 return { ok: false, error: formatUploadError(data, `Could not register ${docType} (${res.status})`) };
 }
 return { ok: true };
}

/** Upload selected files; register placeholders for remaining required types when optional. */
export async function satisfyRequiredDocumentsForSubmit(
 applicationId: string,
 filesByType: Record<string, File[] | File | null | undefined>,
 requiredTypes: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
 const normalizedRequired = requiredTypes.map(normalizeDocumentType).filter(Boolean);
 if (!normalizedRequired.length) return { ok: true };

 for (const type of normalizedRequired) {
 const files = filesForDocumentType(filesByType, type);
 if (files.length > 0) {
  let uploadedAny = false;
  for (const file of files) {
   const up = await uploadApplicationDocumentApi(applicationId, file, type);
   if (up.ok) {
    uploadedAny = true;
    continue;
   }
   if (!APPLICATION_DOCUMENTS_OPTIONAL) return up;
  }
  if (uploadedAny) continue;
 }
 const placeholder = await registerApplicationDocumentPlaceholder(applicationId, type);
 if (!placeholder.ok && !APPLICATION_DOCUMENTS_OPTIONAL) return placeholder;
 }

 const after = await fetchApplicationDocumentStatus(applicationId, undefined, normalizedRequired);
 if (!after) {
 return APPLICATION_DOCUMENTS_OPTIONAL
 ? { ok: true }
 : { ok: false, error: "Could not verify uploaded documents." };
 }
 if (after.missing.length > 0 && !APPLICATION_DOCUMENTS_OPTIONAL) {
 return {
 ok: false,
 error: `Still missing: ${after.missing.map(formatRequiredDocumentLabel).join(", ")}`,
 };
 }
 return { ok: true };
}

export async function ensureApplicationHasRequiredDocuments(
 applicationId: string,
 filesByType?: Record<string, File[] | File | null | undefined>,
 requiredFromProduct?: string[]
): Promise<{ ok: true } | { ok: false; error: string; missing: string[] }> {
 const status = await fetchApplicationDocumentStatus(
 applicationId,
 undefined,
 requiredFromProduct
 );
 if (!status) {
 return { ok: false, error: "Could not load application documents.", missing: [] };
 }

 if (status.missing.length === 0) return { ok: true };

 if (APPLICATION_DOCUMENTS_OPTIONAL) {
 const satisfied = await satisfyRequiredDocumentsForSubmit(
 applicationId,
 filesByType ?? {},
 requiredFromProduct ?? status.required
 );
 if (!satisfied.ok) return { ok: false, error: satisfied.error, missing: status.missing };
 return { ok: true };
 }

 if (!filesByType) {
 return {
 ok: false,
 error: `Missing required documents: ${status.missing.map(formatRequiredDocumentLabel).join(", ")}`,
 missing: status.missing,
 };
 }

 const upload = await uploadRequiredDocumentsByType(applicationId, filesByType, status.missing);
 if (!upload.ok) return { ok: false, error: upload.error, missing: status.missing };

 const after = await fetchApplicationDocumentStatus(
 applicationId,
 undefined,
 requiredFromProduct ?? status.required
 );
 if (!after) {
 return { ok: false, error: "Could not verify uploaded documents.", missing: status.missing };
 }
 if (after.missing.length > 0) {
 return {
 ok: false,
 error: `Still missing: ${after.missing.map(formatRequiredDocumentLabel).join(", ")}`,
 missing: after.missing,
 };
 }

 return { ok: true };
}
