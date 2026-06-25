import { parseMoneyInput } from "@/lib/money-input";
import { validateLocationPhoto } from "@/lib/customer-attachments";
import { normalizeCollaterals } from "@/lib/application-adapters";
import { parseCustomerMetadata } from "@/lib/customer-location";

export type CustomerCollateralApiRecord = {
  id?: string;
  collateral_type: string;
  estimated_value: number;
  description: string;
  image_document_id?: string;
  image_document_ids?: string[];
  image_url?: string;
  image_preview_url?: string;
  attachments: string[];
  collateral_image_attachments: string[];
  collaterall_image_attachment: string[];
};

export type CustomerCollateralFormRow = {
  id?: string;
  collateralType: string;
  estimatedValue: string;
  description: string;
  image: File | null;
  images: File[];
  imageDocumentId?: string;
  imageDocumentIds?: string[];
  existingImageUrls: string[];
  existingImageUrl?: string;
  existingImagePreviewUrl?: string;
};

export function emptyCustomerCollateralRow(): CustomerCollateralFormRow {
  return {
    collateralType: "",
    estimatedValue: "",
    description: "",
    image: null,
    images: [],
    existingImageUrls: [],
  };
}

export function defaultCustomerCollateralForm(): CustomerCollateralFormRow[] {
  return [emptyCustomerCollateralRow()];
}

function rowHasAnyInput(row: CustomerCollateralFormRow): boolean {
  return Boolean(
    row.collateralType.trim() ||
      row.estimatedValue.trim() ||
      row.description.trim() ||
      row.image ||
      row.images.length ||
      row.existingImageUrls.length
  );
}

function readUrl(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function urlFromAttachmentEntry(entry: unknown): string | undefined {
  if (typeof entry === "string") return readUrl(entry);
  if (!entry || typeof entry !== "object") return undefined;
  const e = entry as Record<string, unknown>;
  const doc =
    e.document && typeof e.document === "object" ? (e.document as Record<string, unknown>) : null;
  return (
    readUrl(e.url) ??
    readUrl(e.download_url) ??
    readUrl(e.preview_url) ??
    (doc
      ? readUrl(doc.url) ?? readUrl(doc.download_url) ?? readUrl(doc.preview_url)
      : undefined)
  );
}

/** Stable key for deduping the same file served under different query strings or fields. */
function mediaUrlDedupKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const docMatch = parsed.pathname.match(/\/documents\/([^/]+)/i);
    if (docMatch) return `doc:${docMatch[1].toLowerCase()}`;
    return `${parsed.origin}${parsed.pathname}`.toLowerCase();
  } catch {
    return trimmed.split("?")[0].split("#")[0].toLowerCase();
  }
}

export function dedupeMediaUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const key = mediaUrlDedupKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(url.trim());
  }
  return out;
}

function primaryAttachmentList(item: Record<string, unknown>): unknown[] | null {
  for (const key of [
    "collateral_image_attachments",
    "collaterall_image_attachment",
    "attachments",
  ] as const) {
    const value = item[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return null;
}

/** Collect collateral image URLs from a raw API collateral object. */
export function extractCollateralImageUrlsFromItem(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];
  const o = item as Record<string, unknown>;
  const candidates: string[] = [];

  const list = primaryAttachmentList(o);
  if (list) {
    for (const entry of list) {
      const url = urlFromAttachmentEntry(entry);
      if (url) candidates.push(url);
    }
  }

  if (candidates.length === 0) {
    const image = readUrl(o.image_url);
    const preview = readUrl(o.image_preview_url);
    if (image) candidates.push(image);
    if (preview && preview !== image) candidates.push(preview);
  }

  return dedupeMediaUrls(candidates);
}

function readImageDocumentIds(item: Record<string, unknown>): string[] {
  if (Array.isArray(item.image_document_ids)) {
    return [...new Set(item.image_document_ids.map((id) => String(id).trim()).filter(Boolean))];
  }
  const single = item.image_document_id != null ? String(item.image_document_id).trim() : "";
  return single ? [single] : [];
}

export function readCustomerCollateralArray(
  row: Record<string, unknown> | null | undefined
): unknown[] {
  if (!row) return [];
  const md = parseCustomerMetadata(row);
  const raw = row.collateral ?? row.collaterals ?? md.collateral ?? md.collaterals;
  return Array.isArray(raw) ? raw : [];
}

export function extractCustomerCollateralIds(
  row: Record<string, unknown> | null | undefined
): string[] {
  return readCustomerCollateralArray(row)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = String((item as Record<string, unknown>).id ?? "").trim();
      return id || null;
    })
    .filter((id): id is string => Boolean(id));
}

function collateralFormMatchKey(row: CustomerCollateralFormRow): string {
  const type = row.collateralType.trim().toLowerCase();
  const value = parseMoneyInput(row.estimatedValue);
  const description = row.description.trim().toLowerCase();
  return `${type}|${Number.isFinite(value) ? value : ""}|${description}`;
}

function collateralApiMatchKey(item: Record<string, unknown>): string {
  const type = String(item.collateral_type ?? item.type ?? "").trim().toLowerCase();
  const value = Number(item.estimated_value ?? item.value ?? 0);
  const description = String(item.description ?? "").trim().toLowerCase();
  return `${type}|${Number.isFinite(value) ? value : ""}|${description}`;
}

/** Resolve the current backend collateral id for a form row (stable across PATCH side-effects). */
export function resolveCustomerCollateralIdForFormRow(
  row: CustomerCollateralFormRow,
  sourceRow: Record<string, unknown> | null | undefined,
  index: number
): string | null {
  const formKey = collateralFormMatchKey(row);
  for (const item of readCustomerCollateralArray(sourceRow)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    if (row.id && row.id === id) return id;
    if (collateralApiMatchKey(o) === formKey) return id;
  }
  const ids = extractCustomerCollateralIds(sourceRow);
  return ids[index] ?? null;
}

function collateralApiRecordFromRow(
  item: Record<string, unknown>,
  options?: {
    imageDocumentId?: string;
    imageDocumentIds?: string[];
    attachmentUrls?: string[];
  }
): Record<string, unknown> | null {
  const id = item.id != null ? String(item.id).trim() : "";
  const collateral_type = String(item.collateral_type ?? item.type ?? "").trim();
  const estimated_value = Number(item.estimated_value ?? item.value ?? 0);
  const description = String(item.description ?? "").trim();
  if (!collateral_type || !Number.isFinite(estimated_value) || estimated_value <= 0) {
    return null;
  }

  const existingUrls = extractCollateralImageUrlsFromItem(item);
  const attachmentUrls = options?.attachmentUrls ?? existingUrls;
  const imageDocumentIds =
    options?.imageDocumentIds ??
  (options?.imageDocumentId
    ? [...new Set([...readImageDocumentIds(item), options.imageDocumentId])]
    : readImageDocumentIds(item));

  const record: Record<string, unknown> = {
    ...(id ? { id } : {}),
    collateral_type,
    estimated_value,
    description,
    attachments: attachmentUrls,
    collateral_image_attachments: attachmentUrls,
    collaterall_image_attachment: attachmentUrls,
  };

  if (imageDocumentIds.length > 0) {
    record.image_document_ids = imageDocumentIds;
    record.image_document_id = imageDocumentIds[imageDocumentIds.length - 1];
  }

  return record;
}

/** Build a PATCH body that appends an uploaded document to one customer collateral row. */
export function buildCustomerCollateralImageLinkPatch(
  sourceRow: Record<string, unknown>,
  collateralId: string,
  imageDocumentId: string
): { collateral: Record<string, unknown>[] } | null {
  const collateral: Record<string, unknown>[] = [];
  let matched = false;

  for (const item of readCustomerCollateralArray(sourceRow)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;

    const isTarget = id === collateralId;
    const nextDocumentIds = isTarget
      ? [...new Set([...readImageDocumentIds(o), imageDocumentId])]
      : readImageDocumentIds(o);
    const record = collateralApiRecordFromRow(o, {
      imageDocumentIds: nextDocumentIds,
      attachmentUrls: extractCollateralImageUrlsFromItem(o),
    });
    if (!record) continue;

    if (isTarget) matched = true;
    collateral.push(record);
  }

  if (!matched) return null;
  return { collateral };
}

export type CustomerCollateralMetadataRecord = {
  id?: string;
  collateral_type: string;
  estimated_value: number;
  description: string;
};

/** Collateral fields for PATCH/POST JSON — metadata only; images upload via documents endpoint. */
export function customerCollateralFormToMetadataRecords(
  rows: CustomerCollateralFormRow[]
): CustomerCollateralMetadataRecord[] {
  return rows
    .map((row) => {
      if (!rowHasAnyInput(row)) return null;

      const collateral_type = row.collateralType.trim();
      const estimated_value = parseMoneyInput(row.estimatedValue);
      const description = row.description.trim();

      if (!collateral_type || !Number.isFinite(estimated_value) || estimated_value <= 0) {
        return null;
      }

      return {
        ...(row.id ? { id: row.id } : {}),
        collateral_type,
        estimated_value,
        description,
      };
    })
    .filter((row): row is CustomerCollateralMetadataRecord => Boolean(row));
}

export function collateralMetadataRecordsEqual(
  a: CustomerCollateralMetadataRecord[],
  b: CustomerCollateralMetadataRecord[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      (left.id ?? "") !== (right.id ?? "") ||
      left.collateral_type !== right.collateral_type ||
      left.estimated_value !== right.estimated_value ||
      left.description !== right.description
    ) {
      return false;
    }
  }
  return true;
}

/** @deprecated Use customerCollateralFormToMetadataRecords for API PATCH/POST bodies. */
export function customerCollateralFormToApiRecords(
  rows: CustomerCollateralFormRow[]
): CustomerCollateralMetadataRecord[] {
  return customerCollateralFormToMetadataRecords(rows);
}

export function validateCustomerCollateral(
  rows: CustomerCollateralFormRow[]
): { ok: true } | { ok: false; error: string } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!rowHasAnyInput(row)) continue;

    if (!row.collateralType.trim()) {
      return { ok: false, error: `Collateral ${i + 1}: type is required.` };
    }

    const value = parseMoneyInput(row.estimatedValue);
    if (!row.estimatedValue.trim() || !Number.isFinite(value) || value <= 0) {
      return { ok: false, error: `Collateral ${i + 1}: estimated value is required.` };
    }

    const files = row.images.length > 0 ? row.images : row.image ? [row.image] : [];
    for (const file of files) {
      const imageValidation = validateLocationPhoto(file);
      if (!imageValidation.ok) {
        return { ok: false, error: `Collateral ${i + 1}: ${imageValidation.error}` };
      }
    }
  }

  return { ok: true };
}

export function customerCollateralRowsWithImages(
  rows: CustomerCollateralFormRow[]
): CustomerCollateralFormRow[] {
  return rows.filter(
    (row) => row.collateralType.trim() && (row.image != null || row.images.length > 0)
  );
}

export function parseCustomerCollateralFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerCollateralApiRecord[] {
  if (!row) return [];

  const raw = readCustomerCollateralArray(row);

  const out: CustomerCollateralApiRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const collateral_type = String(o.collateral_type ?? o.type ?? "").trim();
    const estimated_value = Number(o.estimated_value ?? o.value ?? 0);
    const description = String(o.description ?? "").trim();
    if (!collateral_type || !Number.isFinite(estimated_value) || estimated_value <= 0) continue;

    const id = o.id != null ? String(o.id).trim() : "";
    const imageUrls = extractCollateralImageUrlsFromItem(o);
    const imageDocumentIds = readImageDocumentIds(o);
    const normalized = normalizeCollaterals([o])[0];
    out.push({
      ...(id ? { id } : {}),
      collateral_type,
      estimated_value,
      description,
      ...(imageDocumentIds.length > 0
        ? {
            image_document_id: imageDocumentIds[imageDocumentIds.length - 1],
            image_document_ids: imageDocumentIds,
          }
        : {}),
      image_url: normalized?.image_url ?? imageUrls[0],
      image_preview_url: normalized?.image_preview_url ?? imageUrls[0],
      attachments: imageUrls,
      collateral_image_attachments: imageUrls,
      collaterall_image_attachment: imageUrls,
    });
  }

  return out;
}

export function customerCollateralApiRecordsToForm(
  records: CustomerCollateralApiRecord[]
): CustomerCollateralFormRow[] {
  const rows = records.map((record) => {
    const existingImageUrls = extractCollateralImageUrlsFromItem(record);

    return {
      id: record.id,
      collateralType: record.collateral_type,
      estimatedValue: String(record.estimated_value),
      description: record.description,
      image: null,
      images: [],
      imageDocumentId: record.image_document_id,
      imageDocumentIds: record.image_document_ids ?? [],
      existingImageUrls,
      existingImageUrl: existingImageUrls[0],
      existingImagePreviewUrl: record.image_preview_url ?? existingImageUrls[0],
    };
  });
  return rows.length > 0 ? rows : [emptyCustomerCollateralRow()];
}
