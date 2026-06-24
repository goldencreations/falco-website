import { parseCustomerMetadata } from "@/lib/customer-location";

export type CustomerReferenceRecord = {
  full_name: string;
  phone: string;
  relationship: string;
  address?: string;
};

export type CustomerReferenceFormRow = {
  name: string;
  phone: string;
  relationship: string;
  address: string;
};

export function emptyCustomerReferenceRow(): CustomerReferenceFormRow {
  return {
    name: "",
    phone: "",
    relationship: "",
    address: "",
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
  const address = row.address.trim();
  if (address) record.address = address;
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
    const address = String(o.address ?? "").trim();
    if (address) record.address = address;
    out.push(record);
  }
  return out;
}

export function validateCustomerReferences(
  rows: CustomerReferenceFormRow[]
): { ok: true } | { ok: false; error: string } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hasAny =
      row.name.trim() || row.phone.trim() || row.relationship.trim() || row.address.trim();
    if (!hasAny) continue;
    if (!row.name.trim()) {
      return { ok: false, error: `Reference ${i + 1}: full name is required.` };
    }
    if (!row.phone.trim()) {
      return { ok: false, error: `Reference ${i + 1}: phone number is required.` };
    }
    if (!row.relationship.trim()) {
      return { ok: false, error: `Reference ${i + 1}: relationship is required.` };
    }
  }
  return { ok: true };
}

/** Map stored customer references → Falco `POST /applications` references array. */
export function customerReferencesToApplicationPayload(
  records: CustomerReferenceRecord[]
): Array<{ full_name: string; relationship: string; phone: string }> {
  return records.map((record) => ({
    full_name: record.full_name,
    relationship: record.relationship,
    phone: record.phone,
  }));
}

export function formatReferenceRelationship(value: string): string {
  return value.replace(/_/g, " ");
}
