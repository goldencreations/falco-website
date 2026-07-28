export type CustomerAttachmentFormState = {
  passport_photo: File | null;
  home_location_photos: File[];
  business_location_photos: File[];
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
  homeLocationPhotos: CustomerAttachmentDocument[];
  businessLocationPhotos: CustomerAttachmentDocument[];
  supportingDocuments: CustomerAttachmentDocument[];
};

export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function emptyCustomerAttachments(): CustomerAttachmentFormState {
  return {
    passport_photo: null,
    home_location_photos: [],
    business_location_photos: [],
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
): { ok: true } | { ok: false; error: string; field: string } {
  if (attachments.passport_photo) {
    const v = validateLocationPhoto(attachments.passport_photo);
    if (!v.ok) {
      return { ok: false, error: `Passport photo: ${v.error}`, field: "attachments.passport_photo" };
    }
  }
  for (const file of attachments.home_location_photos) {
    const v = validateLocationPhoto(file);
    if (!v.ok) {
      return {
        ok: false,
        error: `Home location photo (${file.name}): ${v.error}`,
        field: "attachments.home_location_photos",
      };
    }
  }
  for (const file of attachments.business_location_photos) {
    const v = validateLocationPhoto(file);
    if (!v.ok) {
      return {
        ok: false,
        error: `Business location photo (${file.name}): ${v.error}`,
        field: "attachments.business_location_photos",
      };
    }
  }
  for (const doc of attachments.supporting_documents) {
    const v = validateSupportingDocument(doc);
    if (!v.ok) {
      return {
        ok: false,
        error: `Supporting document (${doc.name}): ${v.error}`,
        field: "attachments.supporting_documents",
      };
    }
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

function readPhotoValue(value: unknown): { url: string | null; previewUrl: string | null } {
  if (typeof value === "string") {
    const url = readUrl(value);
    return { url, previewUrl: null };
  }
  if (!value || typeof value !== "object") return { url: null, previewUrl: null };
  const d = value as Record<string, unknown>;
  const url = readUrl(d.url ?? d.download_url ?? d.href);
  const previewUrl = readUrl(d.preview_url ?? d.signed_url ?? d.thumbnail_url);
  return { url, previewUrl };
}

function readPhotoFromSources(
  sources: Record<string, unknown>[],
  urlKeys: string[],
  docKeys: string[]
): { url: string | null; previewUrl: string | null } {
  for (const source of sources) {
    for (const key of urlKeys) {
      const photo = readPhotoValue(source[key]);
      if (photo.url) {
        const preview =
          photo.previewUrl ??
          readUrl(source[`${key}_preview_url`]) ??
          readUrl(source[`${key.replace(/_url$/, "")}_preview_url`]);
        return { url: photo.url, previewUrl: preview };
      }
    }
    for (const key of docKeys) {
      const nested = readNestedDocument(source, key);
      if (nested.url) return nested;
    }
  }
  return { url: null, previewUrl: null };
}

function readAttachmentArray(
  value: unknown,
  defaultName: string
): CustomerAttachmentDocument[] {
  if (!Array.isArray(value)) return [];
  const out: CustomerAttachmentDocument[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const url = readUrl(item);
      if (!url) continue;
      out.push({
        name: url.split("/").pop() ?? defaultName,
        url,
        previewUrl: null,
      });
      continue;
    }

    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nested = readNestedDocument(o, "document");
    const url = readUrl(o.url ?? o.download_url ?? o.href) ?? nested.url;
    if (!url) continue;
    const previewUrl =
      readUrl(o.preview_url ?? o.signed_url ?? o.thumbnail_url) ?? nested.previewUrl;
    const type = normalizeDocType(o.type ?? o.document_type);
    const name =
      (typeof o.name === "string" && o.name.trim()) ||
      (typeof o.filename === "string" && o.filename.trim()) ||
      (type ? type.replace(/_/g, " ") : null) ||
      url.split("/").pop() ||
      defaultName;
    out.push({ name, url, previewUrl });
  }

  return out;
}

function dedupeAttachmentDocuments(
  docs: CustomerAttachmentDocument[]
): CustomerAttachmentDocument[] {
  const byKey = new Map<string, CustomerAttachmentDocument>();

  const normalizeUrlKey = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return "";
    try {
      const parsed = new URL(trimmed);
      return `${parsed.origin}${parsed.pathname}`.toLowerCase();
    } catch {
      return trimmed.split("?")[0].split("#")[0].toLowerCase();
    }
  };

  for (const doc of docs) {
    const normalized = normalizeUrlKey(doc.url);
    const fallbackName = doc.name.trim().toLowerCase();
    const key = normalized || `${fallbackName}|${doc.url.trim().toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, doc);
  }
  return Array.from(byKey.values());
}

function readDocuments(value: unknown): CustomerAttachmentDocument[] {
  return readAttachmentArray(value, "Document");
}

function isHomeLocationDocType(type: string): boolean {
  return /home(_|-)?location|home_photo|residence(_|-)?location|residence_photo/.test(type);
}

function isBusinessLocationDocType(type: string): boolean {
  return /business(_|-)?location|business_photo|premises(_|-)?location|shop_photo/.test(type);
}

function isProfilePhotoDocType(type: string): boolean {
  return (
    !type ||
    /passport|profile_photo|customer_photo/.test(type) ||
    isHomeLocationDocType(type) ||
    isBusinessLocationDocType(type)
  );
}

function readLocationPhotosFromDocuments(
  sources: Record<string, unknown>[],
  matchType: (type: string) => boolean,
  defaultName: string
): CustomerAttachmentDocument[] {
  const out: CustomerAttachmentDocument[] = [];

  for (const source of sources) {
    const docs = Array.isArray(source.documents) ? source.documents : [];
    for (const item of docs) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const type = normalizeDocType(o.type ?? o.document_type);
      if (!matchType(type)) continue;
      out.push(...readAttachmentArray([item], defaultName));
    }
  }

  return out;
}

function readLocationPhotoArrays(
  sources: Record<string, unknown>[],
  arrayKey: "home_location_photos" | "business_location_photos",
  defaultName: string
): CustomerAttachmentDocument[] {
  const out: CustomerAttachmentDocument[] = [];
  for (const source of sources) {
    out.push(...readAttachmentArray(source[arrayKey], defaultName));
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
      if (isProfilePhotoDocType(type)) {
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
      homeLocationPhotos: [],
      businessLocationPhotos: [],
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

  const homeLocationPhotos = dedupeAttachmentDocuments([
    ...readLocationPhotoArrays(sources, "home_location_photos", "Home location photo"),
    ...readLocationPhotosFromDocuments(sources, isHomeLocationDocType, "Home location photo"),
    ...(homePhoto.url
      ? [{ name: "Home location photo", url: homePhoto.url, previewUrl: homePhoto.previewUrl }]
      : []),
  ]);
  const businessLocationPhotos = dedupeAttachmentDocuments([
    ...readLocationPhotoArrays(sources, "business_location_photos", "Business location photo"),
    ...readLocationPhotosFromDocuments(
      sources,
      isBusinessLocationDocType,
      "Business location photo"
    ),
    ...(businessPhoto.url
      ? [
          {
            name: "Business location photo",
            url: businessPhoto.url,
            previewUrl: businessPhoto.previewUrl,
          },
        ]
      : []),
  ]);

  const homeLocationPhotoUrl = homeLocationPhotos[0]?.url ?? null;
  const homeLocationPhotoPreviewUrl = homeLocationPhotos[0]?.previewUrl ?? null;
  const businessLocationPhotoUrl = businessLocationPhotos[0]?.url ?? null;
  const businessLocationPhotoPreviewUrl = businessLocationPhotos[0]?.previewUrl ?? null;

  const profilePhotoUrls = new Set([
    ...homeLocationPhotos.map((p) => p.url),
    ...businessLocationPhotos.map((p) => p.url),
  ]);

  let supportingDocuments = dedupeAttachmentDocuments([
    ...readAttachmentArray(row.supporting_documents, "Supporting document"),
    ...readAttachmentArray(md.supporting_documents, "Supporting document"),
    ...readAttachmentArray(attachmentsBlock.supporting_documents, "Supporting document"),
    ...readDocuments(row.documents),
    ...readDocuments(md.documents),
    ...readDocuments(attachmentsBlock.documents),
  ]);

  supportingDocuments = documentsByType(
    supportingDocuments.filter((doc) => !profilePhotoUrls.has(doc.url)),
    sources
  ).filter((doc) => !profilePhotoUrls.has(doc.url));

  return {
    homeLocationPhotoUrl,
    homeLocationPhotoPreviewUrl,
    businessLocationPhotoUrl,
    businessLocationPhotoPreviewUrl,
    homeLocationPhotos,
    businessLocationPhotos,
    supportingDocuments,
  };
}

export function hasCustomerAttachmentData(display: CustomerAttachmentDisplay): boolean {
  return Boolean(
    display.homeLocationPhotoUrl ||
      display.businessLocationPhotoUrl ||
      display.homeLocationPhotos.length > 0 ||
      display.businessLocationPhotos.length > 0 ||
      display.supportingDocuments.length > 0
  );
}
