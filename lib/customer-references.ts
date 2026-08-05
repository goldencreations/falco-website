import { parseCustomerMetadata } from "@/lib/customer-location";
import type { CustomerSex } from "@/lib/customer-guarantors";
import { asCustomerSex } from "@/lib/customer-guarantors";
import { digitsOnly, TZ_PHONE_MAX_DIGITS } from "@/lib/tz-form-inputs";

export type CustomerReferenceRecord = {
  /** Backend response id — required on PATCH to preserve this row (avoids orphaning). */
  id?: string;
  full_name: string;
  phone: string;
  relationship: string;
  address?: string;
  sex?: CustomerSex | null;
};

export type CustomerReferenceFormRow = {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
  address: string;
  sex: CustomerSex | "";
};

export function emptyCustomerReferenceRow(): CustomerReferenceFormRow {
  return {
    name: "",
    phone: "",
    relationship: "",
    address: "",
    sex: "",
  };
}

export function defaultCustomerReferenceForm(): CustomerReferenceFormRow[] {
  return [emptyCustomerReferenceRow()];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits || phone.trim();
}

export function customerReferenceFormToRecord(
  row: CustomerReferenceFormRow
): CustomerReferenceRecord | null {
  const full_name = row.name.trim();
  const phone = normalizePhone(row.phone);
  const relationship = row.relationship.trim();
  if (!full_name || !phone || !relationship) return null;
  const record: CustomerReferenceRecord = { full_name, phone, relationship };
  if (row.id?.trim()) record.id = row.id.trim();
  const address = row.address.trim();
  if (address) record.address = address;
  const sex = asCustomerSex(row.sex);
  if (sex) record.sex = sex;
  return record;
}

export function customerReferenceFormToRecords(
  rows: CustomerReferenceFormRow[]
): CustomerReferenceRecord[] {
  return rows
    .map(customerReferenceFormToRecord)
    .filter((row): row is CustomerReferenceRecord => Boolean(row));
}

export function parseCustomerReferencesFromRow(
  row: Record<string, unknown> | null | undefined
): CustomerReferenceRecord[] {
  if (!row) return [];
  const md = parseCustomerMetadata(row);
  const raw = md.references ?? row.references;
  if (!Array.isArray(raw)) return [];

  const out: CustomerReferenceRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const full_name = String(o.full_name ?? o.name ?? "").trim();
    const phone = normalizePhone(String(o.phone ?? o.phone_number ?? ""));
    const relationship = String(o.relationship ?? "").trim();
    if (!full_name || !phone || !relationship) continue;
    const record: CustomerReferenceRecord = { full_name, phone, relationship };
    const id = o.id != null ? String(o.id).trim() : "";
    if (id) record.id = id;
    const address = String(o.address ?? "").trim();
    if (address) record.address = address;
    const sex = asCustomerSex(o.sex ?? o.gender);
    if (sex) record.sex = sex;
    out.push(record);
  }
  return out;
}

/** Map stored/response reference records → editable form rows (preserves `id`). */
export function customerReferenceRecordsToForm(
  records: CustomerReferenceRecord[]
): CustomerReferenceFormRow[] {
  if (records.length === 0) return defaultCustomerReferenceForm();
  return records.map((record) => ({
    id: record.id,
    name: record.full_name,
    phone: record.phone,
    relationship: record.relationship,
    address: record.address ?? "",
    sex: record.sex ?? "",
  }));
}

export function validateCustomerReferences(
  rows: CustomerReferenceFormRow[]
): { ok: true } | { ok: false; error: string; field: string } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hasAny =
      row.name.trim() ||
      row.phone.trim() ||
      row.relationship.trim() ||
      row.address.trim() ||
      row.sex;
    if (!hasAny) continue;
    if (!row.name.trim()) {
      return {
        ok: false,
        error: `Reference ${i + 1}: full name is required.`,
        field: `references.${i}.name`,
      };
    }
    if (!row.phone.trim()) {
      return {
        ok: false,
        error: `Reference ${i + 1}: enter a phone number.`,
        field: `references.${i}.phone`,
      };
    }
    if (digitsOnly(row.phone).length !== TZ_PHONE_MAX_DIGITS) {
      return {
        ok: false,
        error: `Reference ${i + 1}: enter a 10 digit phone number.`,
        field: `references.${i}.phone`,
      };
    }
    if (!row.relationship.trim()) {
      return {
        ok: false,
        error: `Reference ${i + 1}: relationship is required.`,
        field: `references.${i}.relationship`,
      };
    }
    // Sex is optional per contract — collected when available but not required.
  }
  return { ok: true };
}

/** Map stored customer references → Falco `POST /applications` references array. */
export function customerReferencesToApplicationPayload(
  records: CustomerReferenceRecord[]
): Array<{ full_name: string; relationship: string; phone: string; sex?: CustomerSex }> {
  return records.map((record) => ({
    full_name: record.full_name,
    relationship: record.relationship,
    phone: record.phone,
    ...(record.sex ? { sex: record.sex } : {}),
  }));
}

export function formatReferenceRelationship(value: string): string {
  return value.replace(/_/g, " ");
}
