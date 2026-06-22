import { parseMoneyInput } from "@/lib/money-input";
import { validateLocationPhoto } from "@/lib/customer-attachments";
import { normalizeCollaterals } from "@/lib/application-adapters";
import { parseCustomerMetadata } from "@/lib/customer-location";

export const MAX_CUSTOMER_COLLATERAL = 2;

export type CustomerCollateralApiRecord = {
  id?: string;
  collateral_type: string;
  estimated_value: number;
  description: string;
  image_document_id?: string;
  image_url?: string;
  image_preview_url?: string;
  attachments: [];
  collateral_image_attachments: [];
  collaterall_image_attachment: [];
};

export type CustomerCollateralFormRow = {
  id?: string;
  collateralType: string;
  estimatedValue: string;
  description: string;
  image: File | null;
  imageDocumentId?: string;
  existingImageUrl?: string;
  existingImagePreviewUrl?: string;
};

export function emptyCustomerCollateralRow(): CustomerCollateralFormRow {
  return {
    collateralType: "",
    estimatedValue: "",
    description: "",
    image: null,
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
      row.image
  );
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

function collateralApiRecordFromRow(
  item: Record<string, unknown>,
  imageDocumentId?: string
): Record<string, unknown> | null {
  const id = item.id != null ? String(item.id).trim() : "";
  const collateral_type = String(item.collateral_type ?? item.type ?? "").trim();
  const estimated_value = Number(item.estimated_value ?? item.value ?? 0);
  const description = String(item.description ?? "").trim();
  if (!collateral_type || !Number.isFinite(estimated_value) || estimated_value <= 0) {
    return null;
  }

  const record: Record<string, unknown> = {
    ...(id ? { id } : {}),
    collateral_type,
    estimated_value,
    description,
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    collateral_image_attachments: Array.isArray(item.collateral_image_attachments)
      ? item.collateral_image_attachments
      : [],
    collaterall_image_attachment: Array.isArray(item.collaterall_image_attachment)
      ? item.collaterall_image_attachment
      : [],
  };

  if (imageDocumentId) {
    record.image_document_id = imageDocumentId;
  } else if (item.image_document_id != null && String(item.image_document_id).trim()) {
    record.image_document_id = String(item.image_document_id).trim();
  }

  return record;
}

/** Build a PATCH body that links an uploaded document to one customer collateral row. */
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

    const imageId = id === collateralId ? imageDocumentId : undefined;
    const record = collateralApiRecordFromRow(o, imageId);
    if (!record) continue;

    if (id === collateralId) matched = true;
    collateral.push(record);
  }

  if (!matched) return null;
  return { collateral };
}

export function customerCollateralFormToApiRecords(
  rows: CustomerCollateralFormRow[]
): CustomerCollateralApiRecord[] {
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
        ...(row.imageDocumentId ? { image_document_id: row.imageDocumentId } : {}),
        attachments: [],
        collateral_image_attachments: [],
        collaterall_image_attachment: [],
      };
    })
    .filter((row): row is CustomerCollateralApiRecord => Boolean(row))
    .slice(0, MAX_CUSTOMER_COLLATERAL);
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

    if (row.image) {
      const imageValidation = validateLocationPhoto(row.image);
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
  return rows.filter((row) => row.collateralType.trim() && row.image);
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
    const image_document_id =
      o.image_document_id != null ? String(o.image_document_id).trim() : "";
    const normalized = normalizeCollaterals([o])[0];
    out.push({
      ...(id ? { id } : {}),
      collateral_type,
      estimated_value,
      description,
      ...(image_document_id ? { image_document_id } : {}),
      image_url: normalized?.image_url,
      image_preview_url: normalized?.image_preview_url,
      attachments: [],
      collateral_image_attachments: [],
      collaterall_image_attachment: [],
    });
    if (out.length >= MAX_CUSTOMER_COLLATERAL) break;
  }

  return out;
}

export function customerCollateralApiRecordsToForm(
  records: CustomerCollateralApiRecord[]
): CustomerCollateralFormRow[] {
  const rows = records.map((record) => ({
    id: record.id,
    collateralType: record.collateral_type,
    estimatedValue: String(record.estimated_value),
    description: record.description,
    image: null,
    imageDocumentId: record.image_document_id,
    existingImageUrl: record.image_url,
    existingImagePreviewUrl: record.image_preview_url,
  }));

  while (rows.length < MAX_CUSTOMER_COLLATERAL) {
    rows.push(emptyCustomerCollateralRow());
  }

  return rows.slice(0, MAX_CUSTOMER_COLLATERAL);
}
