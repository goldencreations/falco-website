import type { GuarantorFileRow } from "@/lib/application-linked-uploads";
import { parseMoneyInput } from "@/lib/money-input";

export const MAX_CUSTOMER_GUARANTORS = 2;

export type CustomerGuarantorRecord = {
  full_name: string;
  phone: string;
  national_id?: string;
  relationship: string;
  address?: string;
  collateral_type?: string;
  collateral_description?: string;
  collateral_estimated_value?: number;
};

export type CustomerGuarantorFormRow = {
  name: string;
  phone: string;
  nationalId: string;
  relationship: string;
  otherRelationship: string;
  address: string;
  collateralType: string;
  collateralDescription: string;
  collateralEstimatedValue: string;
  idFront: File | null;
  idBack: File | null;
  photo: File | null;
  photoWithCustomer: File | null;
  wardLetter: File | null;
  attachments: File[];
};

export function emptyCustomerGuarantorRow(): CustomerGuarantorFormRow {
  return {
    name: "",
    phone: "",
    nationalId: "",
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
  };
}

export function defaultCustomerGuarantorForm(): CustomerGuarantorFormRow[] {
  return [emptyCustomerGuarantorRow(), emptyCustomerGuarantorRow()];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits || phone.trim();
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
      row.attachments.length > 0
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
  return appendOptionalGuarantorFields(record, row);
}

export function customerGuarantorFormToRecords(rows: CustomerGuarantorFormRow[]): CustomerGuarantorRecord[] {
  return rows
    .map(customerGuarantorFormToRecord)
    .filter((row): row is CustomerGuarantorRecord => Boolean(row))
    .slice(0, MAX_CUSTOMER_GUARANTORS);
}

export function parseCustomerGuarantorsFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerGuarantorRecord[] {
  if (!row) return [];
  const md =
    row.metadata && typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};
  const raw = md.guarantors ?? row.guarantors;
  if (!Array.isArray(raw)) return [];

  const out: CustomerGuarantorRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const full_name = String(o.full_name ?? o.name ?? "").trim();
    const phone = normalizePhone(String(o.phone ?? o.phone_number ?? ""));
    const relationship = String(o.relationship ?? "").trim();
    if (!full_name || !phone || !relationship) continue;
    const record: CustomerGuarantorRecord = { full_name, phone, relationship };
    const national_id = String(o.national_id ?? o.nationalId ?? "").trim();
    if (national_id) record.national_id = national_id;
    appendOptionalGuarantorFields(record, o);
    out.push(record);
    if (out.length >= MAX_CUSTOMER_GUARANTORS) break;
  }
  return out;
}

export function validateCustomerGuarantors(
  rows: CustomerGuarantorFormRow[]
): { ok: true } | { ok: false; error: string } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!rowHasAnyInput(row)) continue;

    if (!row.name.trim()) {
      return { ok: false, error: `Guarantor ${i + 1}: full name is required.` };
    }
    if (!row.phone.trim()) {
      return { ok: false, error: `Guarantor ${i + 1}: phone number is required.` };
    }
    if (!resolveRelationship(row)) {
      return { ok: false, error: `Guarantor ${i + 1}: relationship is required.` };
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
