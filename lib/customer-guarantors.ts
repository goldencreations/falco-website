import type { GuarantorFileRow } from "@/lib/application-linked-uploads";

export const MAX_CUSTOMER_GUARANTORS = 2;

export type CustomerGuarantorRecord = {
  full_name: string;
  phone: string;
  national_id?: string;
  relationship: string;
};

export type CustomerGuarantorFormRow = {
  name: string;
  phone: string;
  nationalId: string;
  relationship: string;
  otherRelationship: string;
  idFront: File | null;
  idBack: File | null;
};

export function emptyCustomerGuarantorRow(): CustomerGuarantorFormRow {
  return {
    name: "",
    phone: "",
    nationalId: "",
    relationship: "",
    otherRelationship: "",
    idFront: null,
    idBack: null,
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
  return record;
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
    const hasAny =
      row.name.trim() ||
      row.phone.trim() ||
      row.nationalId.trim() ||
      row.relationship.trim() ||
      row.idFront ||
      row.idBack;
    if (!hasAny) continue;

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
): Array<{ full_name: string; phone: string; relationship: string; national_id?: string }> {
  return records.map((record) => {
    const row: { full_name: string; phone: string; relationship: string; national_id?: string } = {
      full_name: record.full_name,
      phone: record.phone,
      relationship: record.relationship,
    };
    if (record.national_id?.trim()) row.national_id = record.national_id.trim();
    return row;
  });
}

export function customerGuarantorRecordsToFileRows(
  records: CustomerGuarantorRecord[],
  filesByIndex: Array<{ idFront: File | null; idBack: File | null }> = []
): GuarantorFileRow[] {
  return records.map((record, index) => ({
    name: record.full_name,
    phone: record.phone,
    idFront: filesByIndex[index]?.idFront ?? null,
    idBack: filesByIndex[index]?.idBack ?? null,
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
    }));
}

export function formatGuarantorRelationship(value: string): string {
  return value.replace(/_/g, " ");
}
