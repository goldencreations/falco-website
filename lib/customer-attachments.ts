export type CustomerAttachmentFormState = {
  home_location_photo: File | null;
  business_location_photo: File | null;
  supporting_documents: File[];
};

export type CustomerAttachmentDocument = {
  name: string;
  url: string;
};

export type CustomerAttachmentDisplay = {
  homeLocationPhotoUrl: string | null;
  businessLocationPhotoUrl: string | null;
  supportingDocuments: CustomerAttachmentDocument[];
};

export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function emptyCustomerAttachments(): CustomerAttachmentFormState {
  return {
    home_location_photo: null,
    business_location_photo: null,
    supporting_documents: [],
  };
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function validateLocationPhoto(file: File): { ok: true } | { ok: false; error: string } {
  const ext = extensionOf(file.name);
  if (!["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return { ok: false, error: "Home/Business photos must be JPG, JPEG, PNG, or WEBP." };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { ok: false, error: "Photo must be 5MB or smaller." };
  }
  return { ok: true };
}

export function validateSupportingDocument(file: File): { ok: true } | { ok: false; error: string } {
  const ext = extensionOf(file.name);
  if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
    return { ok: false, error: "Supporting documents must be PDF, JPG, JPEG, or PNG." };
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return { ok: false, error: "Each document must be 10MB or smaller." };
  }
  return { ok: true };
}

export function validateCustomerAttachments(
  attachments: CustomerAttachmentFormState
): { ok: true } | { ok: false; error: string } {
  if (attachments.home_location_photo) {
    const v = validateLocationPhoto(attachments.home_location_photo);
    if (!v.ok) return { ok: false, error: `Home location photo: ${v.error}` };
  }
  if (attachments.business_location_photo) {
    const v = validateLocationPhoto(attachments.business_location_photo);
    if (!v.ok) return { ok: false, error: `Business location photo: ${v.error}` };
  }
  for (const doc of attachments.supporting_documents) {
    const v = validateSupportingDocument(doc);
    if (!v.ok) return { ok: false, error: `Supporting document (${doc.name}): ${v.error}` };
  }
  return { ok: true };
}

function readUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function readDocuments(value: unknown): CustomerAttachmentDocument[] {
  if (!Array.isArray(value)) return [];
  const out: CustomerAttachmentDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const url = readUrl(o.url ?? o.download_url ?? o.href);
    const name = typeof o.name === "string" ? o.name : typeof o.filename === "string" ? o.filename : null;
    if (url && name) out.push({ name, url });
    else if (url) out.push({ name: url.split("/").pop() ?? "Document", url });
  }
  return out;
}

/** Read attachment URLs from API customer row metadata (when backend provides them). */
export function extractCustomerAttachmentsFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerAttachmentDisplay {
  if (!row) {
    return { homeLocationPhotoUrl: null, businessLocationPhotoUrl: null, supportingDocuments: [] };
  }

  const md =
    row.metadata && typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};

  const attachmentsBlock =
    md.attachments && typeof md.attachments === "object" && md.attachments !== null
      ? (md.attachments as Record<string, unknown>)
      : {};

  const homeLocationPhotoUrl =
    readUrl(md.home_location_photo_url) ??
    readUrl(md.home_location_photo) ??
    readUrl(attachmentsBlock.home_location_photo_url) ??
    readUrl(attachmentsBlock.home_location_photo);

  const businessLocationPhotoUrl =
    readUrl(md.business_location_photo_url) ??
    readUrl(md.business_location_photo) ??
    readUrl(attachmentsBlock.business_location_photo_url) ??
    readUrl(attachmentsBlock.business_location_photo);

  const supportingDocuments =
    readDocuments(md.supporting_documents).length > 0
      ? readDocuments(md.supporting_documents)
      : readDocuments(attachmentsBlock.supporting_documents);

  return { homeLocationPhotoUrl, businessLocationPhotoUrl, supportingDocuments };
}

export function hasCustomerAttachmentData(display: CustomerAttachmentDisplay): boolean {
  return Boolean(
    display.homeLocationPhotoUrl ||
      display.businessLocationPhotoUrl ||
      display.supportingDocuments.length > 0
  );
}
