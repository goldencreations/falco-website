import type { GuarantorFileRow } from "@/lib/application-linked-uploads";
import { validateLocationPhoto, validateSupportingDocument } from "@/lib/customer-attachments";
import type { CustomerIdType } from "@/lib/customer-id-types";
import { normalizeCustomerIdType } from "@/lib/customer-id-types";
import { parseCustomerMetadata } from "@/lib/customer-location";
import { parseMoneyInput } from "@/lib/money-input";
import { digitsOnly, TZ_NIDA_MAX_DIGITS, TZ_PHONE_MAX_DIGITS } from "@/lib/tz-form-inputs";

export type CustomerSex = "male" | "female" | "other";

export type CustomerGuarantorRecord = {
  full_name: string;
  phone: string;
  national_id?: string;
  id_type?: CustomerIdType | null;
  sex?: CustomerSex | null;
  relationship: string;
  address?: string;
  collateral_type?: string;
  collateral_description?: string;
  collateral_estimated_value?: number;
};

export type CustomerGuarantorMediaItem = {
  name?: string;
  url: string;
  preview_url?: string | null;
};

export type CustomerGuarantorApiRecord = CustomerGuarantorRecord & {
  id?: string;
  id_front_document_id?: string;
  id_back_document_id?: string;
  id_front_url?: string;
  id_front_preview_url?: string;
  id_back_url?: string;
  id_back_preview_url?: string;
  /** Guarantor passport / profile photo (`guarantor_passport_photo`). */
  passport_photo_url?: string;
  passport_photo_preview_url?: string;
  photos?: CustomerGuarantorMediaItem[];
  attachments?: CustomerGuarantorMediaItem[] | unknown[];
  collateral_image_attachments?: CustomerGuarantorMediaItem[] | unknown[];
};

export type CustomerGuarantorFormRow = {
  id?: string;
  name: string;
  phone: string;
  idType: CustomerIdType;
  nationalId: string;
  sex: CustomerSex | "";
  relationship: string;
  otherRelationship: string;
  address: string;
  collateralType: string;
  collateralDescription: string;
  collateralEstimatedValue: string;
  idFront: File | null;
  idBack: File | null;
  photo: File | null;
  /** Uploaded as `guarantor_passport_photo`. */
  photoWithCustomer: File | null;
  wardLetter: File | null;
  attachments: File[];
  /** Guarantor collateral photos → `guarantor_collateral_photo`. */
  collateralImages: File[];
  /** Existing (already-uploaded) ID document metadata carried over from the backend record. */
  idFrontDocumentId?: string;
  idBackDocumentId?: string;
  existingIdFrontUrl?: string;
  existingIdFrontPreviewUrl?: string;
  existingIdBackUrl?: string;
  existingIdBackPreviewUrl?: string;
  existingPassportPhotoUrl?: string;
  existingPassportPhotoPreviewUrl?: string;
};

export function asCustomerSex(v: unknown): CustomerSex | undefined {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "male" || s === "female" || s === "other") return s;
  return undefined;
}

export function emptyCustomerGuarantorRow(): CustomerGuarantorFormRow {
  return {
    name: "",
    phone: "",
    idType: "NIDA",
    nationalId: "",
    sex: "",
    relationship: "",
    otherRelationship: "",
    address: "",
    collateralType: "",
    collateralDescription: "",
    collateralEstimatedValue: "",
    idFront: null,
    idBack: null,
    photo: null,
    photoWithCustomer: null,
    wardLetter: null,
    attachments: [],
    collateralImages: [],
  };
}

export function defaultCustomerGuarantorForm(): CustomerGuarantorFormRow[] {
  return [emptyCustomerGuarantorRow()];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits || phone.trim();
}

function readGuarantorDocumentField(
  row: Record<string, unknown>,
  key: string
): { url?: string; preview_url?: string } {
  const doc = row[key];
  if (!doc || typeof doc !== "object") return {};
  const d = doc as Record<string, unknown>;
  return {
    url: typeof d.url === "string" && d.url.trim() ? d.url.trim() : undefined,
    preview_url:
      typeof d.preview_url === "string" && d.preview_url.trim()
        ? d.preview_url.trim()
        : undefined,
  };
}

function readMediaUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

/** Resolve guarantor passport photo URLs from API fields / `photos[]`. */
function readGuarantorPassportPhoto(o: Record<string, unknown>): {
  url?: string;
  preview_url?: string;
} {
  const passportDoc = readGuarantorDocumentField(o, "passport_photo_document");
  const altPassportDoc = readGuarantorDocumentField(o, "guarantor_passport_photo_document");
  const withCustomerDoc = readGuarantorDocumentField(o, "photo_with_customer_document");

  const flatUrl =
    readMediaUrl(o.passport_photo_url) ??
    readMediaUrl(o.guarantor_passport_photo_url) ??
    readMediaUrl(o.photo_with_customer_url);
  const flatPreview =
    readMediaUrl(o.passport_photo_preview_url) ??
    readMediaUrl(o.guarantor_passport_photo_preview_url) ??
    readMediaUrl(o.photo_with_customer_preview_url);

  const preferred = {
    url: passportDoc.url ?? altPassportDoc.url ?? flatUrl,
    preview_url:
      passportDoc.preview_url ??
      altPassportDoc.preview_url ??
      flatPreview ??
      passportDoc.url ??
      altPassportDoc.url ??
      flatUrl,
  };
  if (preferred.url || preferred.preview_url) return preferred;

  if (withCustomerDoc.url || withCustomerDoc.preview_url) {
    return {
      url: withCustomerDoc.url,
      preview_url: withCustomerDoc.preview_url ?? withCustomerDoc.url,
    };
  }

  if (Array.isArray(o.photos)) {
    for (const entry of o.photos) {
      if (typeof entry === "string" && entry.trim()) {
        return { url: entry.trim(), preview_url: entry.trim() };
      }
      if (!entry || typeof entry !== "object") continue;
      const p = entry as Record<string, unknown>;
      const type = String(p.type ?? p.document_type ?? "").toLowerCase();
      const name = String(p.name ?? "").toLowerCase();
      const isPassport =
        /passport|profile|guarantor_passport/.test(type) || /passport|profile/.test(name);
      const nested = readGuarantorDocumentField(p, "document");
      const url = readMediaUrl(p.url) ?? readMediaUrl(p.download_url) ?? nested.url;
      const preview = readMediaUrl(p.preview_url) ?? nested.preview_url ?? url;
      if (!url && !preview) continue;
      if (isPassport || o.photos.length === 1) {
        return { url: url ?? preview, preview_url: preview ?? url };
      }
    }
  }

  return {};
}

function resolveRelationship(row: CustomerGuarantorFormRow): string {
  const rel = row.relationship.trim();
  if (!rel) return "";
  if (rel === "other") return row.otherRelationship.trim() || "other";
  return rel;
}

function rowHasAnyInput(row: CustomerGuarantorFormRow): boolean {
  return Boolean(
    row.name.trim() ||
      row.phone.trim() ||
      row.nationalId.trim() ||
      row.sex ||
      row.relationship.trim() ||
      row.address.trim() ||
      row.collateralType.trim() ||
      row.collateralDescription.trim() ||
      row.collateralEstimatedValue.trim() ||
      row.idFront ||
      row.idBack ||
      row.photo ||
      row.photoWithCustomer ||
      row.wardLetter ||
      row.attachments.length > 0 ||
      row.collateralImages.length > 0
  );
}

function appendOptionalGuarantorFields(
  record: CustomerGuarantorRecord,
  source: CustomerGuarantorFormRow | Record<string, unknown>
): CustomerGuarantorRecord {
  const address =
    "address" in source
      ? String(source.address ?? "").trim()
      : String(source.address ?? "").trim();
  if (address) record.address = address;

  const collateralType =
    "collateralType" in source
      ? String(source.collateralType ?? "").trim()
      : String(source.collateral_type ?? "").trim();
  if (collateralType) record.collateral_type = collateralType;

  const collateralDescription =
    "collateralDescription" in source
      ? String(source.collateralDescription ?? "").trim()
      : String(source.collateral_description ?? "").trim();
  if (collateralDescription) record.collateral_description = collateralDescription;

  const rawValue =
    "collateralEstimatedValue" in source
      ? source.collateralEstimatedValue
      : source.collateral_estimated_value;
  if (rawValue != null && String(rawValue).trim() !== "") {
    const value =
      typeof rawValue === "number"
        ? rawValue
        : parseMoneyInput(String(rawValue));
    if (value > 0) record.collateral_estimated_value = value;
  }

  return record;
}

export function customerGuarantorFormToRecord(row: CustomerGuarantorFormRow): CustomerGuarantorRecord | null {
  const full_name = row.name.trim();
  const phone = normalizePhone(row.phone);
  const relationship = resolveRelationship(row);
  if (!full_name || !phone || !relationship) return null;
  const record: CustomerGuarantorRecord = {
    full_name,
    phone,
    relationship,
  };
  const national_id = row.nationalId.trim();
  if (national_id) record.national_id = national_id;
  record.id_type = normalizeCustomerIdType(row.idType);
  const sex = asCustomerSex(row.sex);
  if (sex) record.sex = sex;
  return appendOptionalGuarantorFields(record, row);
}

export function customerGuarantorFormToRecords(rows: CustomerGuarantorFormRow[]): CustomerGuarantorRecord[] {
  return rows
    .map(customerGuarantorFormToRecord)
    .filter((row): row is CustomerGuarantorRecord => Boolean(row));
}

export function customerGuarantorFormToApiRecords(
  rows: CustomerGuarantorFormRow[]
): CustomerGuarantorApiRecord[] {
  return rows
    .map((row) => {
      const base = customerGuarantorFormToRecord(row);
      if (!base) return null;
      return {
        ...(row.id ? { id: row.id } : {}),
        ...base,
        ...(row.idFrontDocumentId ? { id_front_document_id: row.idFrontDocumentId } : {}),
        ...(row.idBackDocumentId ? { id_back_document_id: row.idBackDocumentId } : {}),
      };
    })
    .filter((row): row is CustomerGuarantorApiRecord => Boolean(row));
}

export function readCustomerGuarantorsArray(
  row: Record<string, unknown> | null | undefined
): unknown[] {
  if (!row) return [];
  const md = parseCustomerMetadata(row);
  const raw = row.guarantors ?? md.guarantors;
  return Array.isArray(raw) ? raw : [];
}

export function extractCustomerGuarantorIds(
  row: Record<string, unknown> | null | undefined
): string[] {
  return readCustomerGuarantorsArray(row)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const id = String((item as Record<string, unknown>).id ?? "").trim();
      return id || null;
    })
    .filter((id): id is string => Boolean(id));
}

function guarantorApiRecordFromRow(
  item: Record<string, unknown>,
  field?: "id_front_document_id" | "id_back_document_id",
  documentId?: string
): Record<string, unknown> | null {
  const id = item.id != null ? String(item.id).trim() : "";
  const full_name = String(item.full_name ?? item.name ?? "").trim();
  const phone = normalizePhone(String(item.phone ?? item.phone_number ?? ""));
  const relationship = String(item.relationship ?? "").trim();
  if (!full_name || !phone || !relationship) return null;

  const record: Record<string, unknown> = {
    ...(id ? { id } : {}),
    full_name,
    phone,
    relationship,
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
  };

  const national_id = String(item.national_id ?? item.nationalId ?? "").trim();
  if (national_id) record.national_id = national_id;
  if (item.id_type != null && String(item.id_type).trim()) {
    record.id_type = normalizeCustomerIdType(item.id_type);
  }
  const sex = asCustomerSex(item.sex ?? item.gender);
  if (sex) record.sex = sex;

  const frontId =
    field === "id_front_document_id" && documentId
      ? documentId
      : item.id_front_document_id != null
        ? String(item.id_front_document_id).trim()
        : "";
  const backId =
    field === "id_back_document_id" && documentId
      ? documentId
      : item.id_back_document_id != null
        ? String(item.id_back_document_id).trim()
        : "";
  if (frontId) record.id_front_document_id = frontId;
  if (backId) record.id_back_document_id = backId;

  return record;
}

/** Build a PATCH body that links an uploaded document to one customer guarantor row. */
export function buildCustomerGuarantorDocumentLinkPatch(
  sourceRow: Record<string, unknown>,
  guarantorId: string,
  field: "id_front_document_id" | "id_back_document_id",
  documentId: string
): { guarantors: Record<string, unknown>[] } | null {
  const guarantors: Record<string, unknown>[] = [];
  let matched = false;

  for (const item of readCustomerGuarantorsArray(sourceRow)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;

    const record = guarantorApiRecordFromRow(
      o,
      id === guarantorId ? field : undefined,
      id === guarantorId ? documentId : undefined
    );
    if (!record) continue;

    if (id === guarantorId) matched = true;
    guarantors.push(record);
  }

  if (!matched) return null;
  return { guarantors };
}

/** Rows that have pending files to upload after create/update. */
export function customerGuarantorRowsWithIdFiles(
  rows: CustomerGuarantorFormRow[]
): CustomerGuarantorFormRow[] {
  return rows.filter(
    (row) =>
      row.name.trim() &&
      row.phone.trim() &&
      Boolean(
        row.idFront ||
          row.idBack ||
          row.photo ||
          row.photoWithCustomer ||
          row.wardLetter ||
          row.attachments.length > 0 ||
          row.collateralImages.length > 0
      )
  );
}

function guarantorFormMatchKey(row: CustomerGuarantorFormRow): string {
  const name = row.name.trim().toLowerCase();
  const phone = row.phone.replace(/\D/g, "");
  const nationalId = row.nationalId.trim().toLowerCase();
  return `${name}|${phone}|${nationalId}`;
}

function guarantorApiMatchKey(item: Record<string, unknown>): string {
  const name = String(item.full_name ?? item.name ?? "").trim().toLowerCase();
  const phone = String(item.phone ?? item.phone_number ?? "").replace(/\D/g, "");
  const nationalId = String(item.national_id ?? item.nationalId ?? "").trim().toLowerCase();
  return `${name}|${phone}|${nationalId}`;
}

/** Resolve the current backend guarantor id for a form row (stable across PATCH side-effects). */
export function resolveCustomerGuarantorIdForFormRow(
  row: CustomerGuarantorFormRow,
  sourceRow: Record<string, unknown> | null | undefined,
  index: number
): string | null {
  const formKey = guarantorFormMatchKey(row);
  for (const item of readCustomerGuarantorsArray(sourceRow)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    if (row.id && row.id === id) return id;
    if (guarantorApiMatchKey(o) === formKey) return id;
  }
  const ids = extractCustomerGuarantorIds(sourceRow);
  return ids[index] ?? null;
}

const STANDARD_GUARANTOR_RELATIONSHIPS = new Set([
  "spouse",
  "parent",
  "sibling",
  "relative",
  "friend",
  "colleague",
  "business_partner",
]);

export function customerGuarantorRecordsToForm(
  records: CustomerGuarantorRecord[]
): CustomerGuarantorFormRow[] {
  return customerGuarantorApiRecordsToForm(records);
}

export function customerGuarantorApiRecordsToForm(
  records: CustomerGuarantorApiRecord[]
): CustomerGuarantorFormRow[] {
  const rows: CustomerGuarantorFormRow[] = records.map((record) => {
    const normalized = record.relationship.trim().toLowerCase().replace(/\s+/g, "_");
    const isStandard = STANDARD_GUARANTOR_RELATIONSHIPS.has(normalized);
    return {
      // Base defaults (null files, empty attachments array, etc.) so every row always has the
      // full shape the fields UI expects — without this, rows built from a saved guarantor that
      // omits e.g. `address`/`attachments` would crash the edit form (`row.attachments.length`
      // on `undefined`) as soon as it rendered.
      ...emptyCustomerGuarantorRow(),
      ...(record.id ? { id: record.id } : {}),
      name: record.full_name,
      phone: record.phone,
      idType: normalizeCustomerIdType(record.id_type),
      nationalId: record.national_id ?? "",
      sex: asCustomerSex(record.sex) ?? "",
      relationship: isStandard ? normalized : normalized ? "other" : "",
      otherRelationship: isStandard ? "" : record.relationship,
      address: record.address ?? "",
      collateralType: record.collateral_type ?? "",
      collateralDescription: record.collateral_description ?? "",
      collateralEstimatedValue:
        record.collateral_estimated_value != null ? String(record.collateral_estimated_value) : "",
      ...(record.id_front_document_id ? { idFrontDocumentId: record.id_front_document_id } : {}),
      ...(record.id_back_document_id ? { idBackDocumentId: record.id_back_document_id } : {}),
      ...(record.id_front_url ? { existingIdFrontUrl: record.id_front_url } : {}),
      ...(record.id_front_preview_url
        ? { existingIdFrontPreviewUrl: record.id_front_preview_url }
        : {}),
      ...(record.id_back_url ? { existingIdBackUrl: record.id_back_url } : {}),
      ...(record.id_back_preview_url
        ? { existingIdBackPreviewUrl: record.id_back_preview_url }
        : {}),
      ...(record.passport_photo_url
        ? { existingPassportPhotoUrl: record.passport_photo_url }
        : {}),
      ...(record.passport_photo_preview_url
        ? { existingPassportPhotoPreviewUrl: record.passport_photo_preview_url }
        : {}),
    };
  });

  return rows.length > 0 ? rows : [emptyCustomerGuarantorRow()];
}

export function parseCustomerGuarantorApiRecordsFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerGuarantorApiRecord[] {
  const out: CustomerGuarantorApiRecord[] = [];

  for (const item of readCustomerGuarantorsArray(row)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const full_name = String(o.full_name ?? o.name ?? "").trim();
    const phone = normalizePhone(String(o.phone ?? o.phone_number ?? ""));
    const relationship = String(o.relationship ?? "").trim();
    if (!full_name || !phone || !relationship) continue;

    const record: CustomerGuarantorApiRecord = { full_name, phone, relationship };
    const id = String(o.id ?? "").trim();
    if (id) record.id = id;
    const national_id = String(o.national_id ?? o.nationalId ?? "").trim();
    if (national_id) record.national_id = national_id;
    if (o.id_type != null && String(o.id_type).trim()) {
      record.id_type = normalizeCustomerIdType(o.id_type);
    }
    const sex = asCustomerSex(o.sex ?? o.gender);
    if (sex) record.sex = sex;

    const frontId = String(o.id_front_document_id ?? "").trim();
    const backId = String(o.id_back_document_id ?? "").trim();
    if (frontId) record.id_front_document_id = frontId;
    if (backId) record.id_back_document_id = backId;

    const frontDoc = readGuarantorDocumentField(o, "id_front_document");
    const backDoc = readGuarantorDocumentField(o, "id_back_document");
    if (frontDoc.url) record.id_front_url = frontDoc.url;
    if (frontDoc.preview_url) record.id_front_preview_url = frontDoc.preview_url;
    if (backDoc.url) record.id_back_url = backDoc.url;
    if (backDoc.preview_url) record.id_back_preview_url = backDoc.preview_url;

    const passport = readGuarantorPassportPhoto(o);
    if (passport.url) record.passport_photo_url = passport.url;
    if (passport.preview_url) record.passport_photo_preview_url = passport.preview_url;

    appendOptionalGuarantorFields(record, o);
    out.push(record);
  }

  return out;
}

export function parseCustomerGuarantorsFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerGuarantorRecord[] {
  return parseCustomerGuarantorApiRecordsFromRow(row).map(
    ({ full_name, phone, national_id, id_type, sex, relationship, address, collateral_type, collateral_description, collateral_estimated_value }) => ({
      full_name,
      phone,
      relationship,
      ...(national_id ? { national_id } : {}),
      ...(id_type ? { id_type } : {}),
      ...(sex ? { sex } : {}),
      ...(address ? { address } : {}),
      ...(collateral_type ? { collateral_type } : {}),
      ...(collateral_description ? { collateral_description } : {}),
      ...(collateral_estimated_value != null ? { collateral_estimated_value } : {}),
    })
  );
}

export function validateCustomerGuarantors(
  rows: CustomerGuarantorFormRow[]
): { ok: true } | { ok: false; error: string; field: string } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!rowHasAnyInput(row)) continue;

    if (!row.name.trim()) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: full name is required.`,
        field: `guarantors.${i}.name`,
      };
    }
    if (!row.phone.trim()) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: enter a phone number.`,
        field: `guarantors.${i}.phone`,
      };
    }
    if (digitsOnly(row.phone).length !== TZ_PHONE_MAX_DIGITS) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: enter a 10 digit phone number.`,
        field: `guarantors.${i}.phone`,
      };
    }
    if (!row.nationalId.trim()) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: enter the ID number.`,
        field: `guarantors.${i}.nationalId`,
      };
    }
    if (
      normalizeCustomerIdType(row.idType) === "NIDA" &&
      digitsOnly(row.nationalId).length !== TZ_NIDA_MAX_DIGITS
    ) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: enter a complete 20 digit NIDA number.`,
        field: `guarantors.${i}.nationalId`,
      };
    }
    if (!resolveRelationship(row)) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: relationship is required.`,
        field: `guarantors.${i}.relationship`,
      };
    }
    if (!asCustomerSex(row.sex)) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: select sex.`,
        field: `guarantors.${i}.sex`,
      };
    }
    if (row.relationship === "other" && !row.otherRelationship.trim()) {
      return {
        ok: false,
        error: `Guarantor ${i + 1}: enter the relationship.`,
        field: `guarantors.${i}.otherRelationship`,
      };
    }

    const hasCollateral =
      row.collateralType.trim() ||
      row.collateralEstimatedValue.trim() ||
      row.collateralDescription.trim();
    if (hasCollateral) {
      if (!row.collateralType.trim()) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: enter the collateral type.`,
          field: `guarantors.${i}.collateralType`,
        };
      }
      const collateralValue = parseMoneyInput(row.collateralEstimatedValue);
      if (
        !row.collateralEstimatedValue.trim() ||
        !Number.isFinite(collateralValue) ||
        collateralValue <= 0
      ) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: enter a collateral value greater than zero.`,
          field: `guarantors.${i}.collateralEstimatedValue`,
        };
      }
      if (!row.collateralDescription.trim()) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: describe the collateral.`,
          field: `guarantors.${i}.collateralDescription`,
        };
      }
    }

    const documentChecks: Array<[File | null, string, string]> = [
      [row.idFront, "idFront", "Guarantor ID front"],
      [row.idBack, "idBack", "Guarantor ID back"],
      [row.wardLetter, "wardLetter", "Ward letter"],
    ];
    for (const [file, field, label] of documentChecks) {
      if (!file) continue;
      const check = validateSupportingDocument(file);
      if (!check.ok) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: ${label} must be PDF, JPG, JPEG, or PNG and 10MB or smaller.`,
          field: `guarantors.${i}.${field}`,
        };
      }
    }

    const photoChecks: Array<[File | null, string, string]> = [
      [row.photo, "photo", "Guarantor photo"],
      [row.photoWithCustomer, "photoWithCustomer", "Passport photo"],
    ];
    for (const [file, field, label] of photoChecks) {
      if (!file) continue;
      const check = validateLocationPhoto(file);
      if (!check.ok) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: ${label} must be JPG, JPEG, PNG, or WEBP and 5MB or smaller.`,
          field: `guarantors.${i}.${field}`,
        };
      }
    }

    for (const file of row.attachments) {
      const check = validateSupportingDocument(file);
      if (!check.ok) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: attachment must be PDF, JPG, JPEG, or PNG and 10MB or smaller.`,
          field: `guarantors.${i}.attachments`,
        };
      }
    }

    for (const file of row.collateralImages) {
      const check = validateLocationPhoto(file);
      if (!check.ok) {
        return {
          ok: false,
          error: `Guarantor ${i + 1}: collateral photo must be JPG, JPEG, PNG, or WEBP and 5MB or smaller.`,
          field: `guarantors.${i}.collateralImages`,
        };
      }
    }
  }
  return { ok: true };
}

export function customerGuarantorsToApplicationPayload(
  records: CustomerGuarantorRecord[]
): Array<{
  full_name: string;
  phone: string;
  relationship: string;
  national_id?: string;
  id_type?: CustomerIdType;
  sex?: CustomerSex;
  address?: string;
  collateral_type?: string;
  collateral_description?: string;
  collateral_estimated_value?: number;
}> {
  return records.map((record) => {
    const row: {
      full_name: string;
      phone: string;
      relationship: string;
      national_id?: string;
      id_type?: CustomerIdType;
      sex?: CustomerSex;
      address?: string;
      collateral_type?: string;
      collateral_description?: string;
      collateral_estimated_value?: number;
    } = {
      full_name: record.full_name,
      phone: record.phone,
      relationship: record.relationship,
    };
    if (record.national_id?.trim()) row.national_id = record.national_id.trim();
    if (record.id_type) row.id_type = normalizeCustomerIdType(record.id_type);
    if (record.sex) row.sex = record.sex;
    if (record.address?.trim()) row.address = record.address.trim();
    if (record.collateral_type?.trim()) row.collateral_type = record.collateral_type.trim();
    if (record.collateral_description?.trim()) {
      row.collateral_description = record.collateral_description.trim();
    }
    if (record.collateral_estimated_value != null && record.collateral_estimated_value > 0) {
      row.collateral_estimated_value = record.collateral_estimated_value;
    }
    return row;
  });
}

export function customerGuarantorRecordsToFileRows(
  records: CustomerGuarantorRecord[],
  filesByIndex: Array<Partial<GuarantorFileRow>> = []
): GuarantorFileRow[] {
  return records.map((record, index) => ({
    name: record.full_name,
    phone: record.phone,
    idFront: filesByIndex[index]?.idFront ?? null,
    idBack: filesByIndex[index]?.idBack ?? null,
    photo: filesByIndex[index]?.photo ?? null,
    photoWithCustomer: filesByIndex[index]?.photoWithCustomer ?? null,
    wardLetter: filesByIndex[index]?.wardLetter ?? null,
    attachments: filesByIndex[index]?.attachments ?? [],
  }));
}

export function customerGuarantorFormToFileRows(rows: CustomerGuarantorFormRow[]): GuarantorFileRow[] {
  return rows
    .filter((row) => row.name.trim() && row.phone.trim())
    .map((row) => ({
      name: row.name.trim(),
      phone: row.phone.trim(),
      idFront: row.idFront,
      idBack: row.idBack,
      photo: row.photo,
      photoWithCustomer: row.photoWithCustomer,
      wardLetter: row.wardLetter,
      attachments: row.attachments,
    }));
}

export function formatGuarantorRelationship(value: string): string {
  return value.replace(/_/g, " ");
}
