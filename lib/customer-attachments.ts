export type CustomerAttachmentFormState = {
  home_location_photo: File | null;
  business_location_photo: File | null;
  supporting_documents: File[];
};

export type CustomerAttachmentDocument = {
  name: string;
  url: string;
  previewUrl?: string | null;
};

export type CustomerAttachmentDisplay = {
  homeLocationPhotoUrl: string | null;
  homeLocationPhotoPreviewUrl: string | null;
  businessLocationPhotoUrl: string | null;
  businessLocationPhotoPreviewUrl: string | null;
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

function normalizeDocType(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function readNestedDocument(
  o: Record<string, unknown>,
  key: string
): { url: string | null; previewUrl: string | null } {
  const doc = o[key];
  if (!doc || typeof doc !== "object") return { url: null, previewUrl: null };
  const d = doc as Record<string, unknown>;
  return {
    url: readUrl(d.url ?? d.download_url ?? d.href),
    previewUrl: readUrl(d.preview_url ?? d.signed_url ?? d.thumbnail_url),
  };
}

function readPhotoFromSources(
  sources: Record<string, unknown>[],
  urlKeys: string[],
  docKeys: string[]
): { url: string | null; previewUrl: string | null } {
  for (const source of sources) {
    for (const key of urlKeys) {
      const url = readUrl(source[key]);
      if (url) {
        const preview =
          readUrl(source[`${key}_preview_url`]) ??
          readUrl(source[`${key.replace(/_url$/, "")}_preview_url`]);
        return { url, previewUrl: preview };
      }
    }
    for (const key of docKeys) {
      const nested = readNestedDocument(source, key);
      if (nested.url) return nested;
    }
  }
  return { url: null, previewUrl: null };
}

function readDocuments(value: unknown): CustomerAttachmentDocument[] {
  if (!Array.isArray(value)) return [];
  const out: CustomerAttachmentDocument[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nested = readNestedDocument(o, "document");
    const url =
      readUrl(o.url ?? o.download_url ?? o.href) ?? nested.url;
    const previewUrl =
      readUrl(o.preview_url ?? o.signed_url ?? o.thumbnail_url) ?? nested.previewUrl;
    const type = normalizeDocType(o.type ?? o.document_type);
    const name =
      (typeof o.name === "string" && o.name.trim()) ||
      (typeof o.filename === "string" && o.filename.trim()) ||
      (type ? type.replace(/_/g, " ") : null);
    if (url && name) out.push({ name, url, previewUrl });
    else if (url) out.push({ name: url.split("/").pop() ?? "Document", url, previewUrl });
  }
  return out;
}

function documentsByType(
  docs: CustomerAttachmentDocument[],
  sourceRows: Record<string, unknown>[]
): CustomerAttachmentDocument[] {
  const typed: CustomerAttachmentDocument[] = [];
  for (const source of sourceRows) {
    const list = Array.isArray(source.documents) ? source.documents : [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const type = normalizeDocType(o.type ?? o.document_type);
      if (!type || /passport|home_location|business_location|profile_photo|customer_photo/.test(type)) {
        continue;
      }
      const nested = readNestedDocument(o, "document");
      const url = readUrl(o.url) ?? nested.url;
      if (!url) continue;
      const previewUrl = readUrl(o.preview_url) ?? nested.previewUrl;
      const name =
        (typeof o.name === "string" && o.name.trim()) ||
        type.replace(/_/g, " ");
      typed.push({ name, url, previewUrl });
    }
  }
  const seen = new Set(docs.map((d) => d.url));
  return [...docs, ...typed.filter((d) => !seen.has(d.url))];
}

/** Read attachment URLs from API customer row metadata (when backend provides them). */
export function extractCustomerAttachmentsFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerAttachmentDisplay {
  if (!row) {
    return {
      homeLocationPhotoUrl: null,
      homeLocationPhotoPreviewUrl: null,
      businessLocationPhotoUrl: null,
      businessLocationPhotoPreviewUrl: null,
      supportingDocuments: [],
    };
  }

  const md =
    row.metadata && typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};

  const attachmentsBlock =
    md.attachments && typeof md.attachments === "object" && md.attachments !== null
      ? (md.attachments as Record<string, unknown>)
      : {};

  const sources = [row, md, attachmentsBlock];

  const homePhoto = readPhotoFromSources(
    sources,
    ["home_location_photo_url", "home_location_photo"],
    ["home_location_photo_document", "home_location_document", "home_photo_document"]
  );

  const businessPhoto = readPhotoFromSources(
    sources,
    ["business_location_photo_url", "business_location_photo"],
    ["business_location_photo_document", "business_location_document", "business_photo_document"]
  );

  const homeLocationPhotoUrl = homePhoto.url;
  const homeLocationPhotoPreviewUrl = homePhoto.previewUrl;
  const businessLocationPhotoUrl = businessPhoto.url;
  const businessLocationPhotoPreviewUrl = businessPhoto.previewUrl;

  let supportingDocuments = [
    ...readDocuments(row.documents),
    ...readDocuments(md.documents),
    ...readDocuments(md.supporting_documents),
    ...readDocuments(attachmentsBlock.supporting_documents),
    ...readDocuments(attachmentsBlock.documents),
  ];

  const byUrl = new Map<string, CustomerAttachmentDocument>();
  for (const doc of supportingDocuments) {
    if (!byUrl.has(doc.url)) byUrl.set(doc.url, doc);
  }
  supportingDocuments = documentsByType(Array.from(byUrl.values()), sources);

  return {
    homeLocationPhotoUrl,
    homeLocationPhotoPreviewUrl,
    businessLocationPhotoUrl,
    businessLocationPhotoPreviewUrl,
    supportingDocuments,
  };
}

export function hasCustomerAttachmentData(display: CustomerAttachmentDisplay): boolean {
  return Boolean(
    display.homeLocationPhotoUrl ||
      display.businessLocationPhotoUrl ||
      display.supportingDocuments.length > 0
  );
}
