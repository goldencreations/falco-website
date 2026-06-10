import type { LoanApplication } from "@/lib/types";

function readUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function readNestedDocUrl(o: Record<string, unknown>, key: string): string | null {
  const doc = o[key];
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Record<string, unknown>;
  return readUrl(d.url ?? d.download_url) ?? readUrl(d.preview_url);
}

function readPassportFromDocuments(sources: Record<string, unknown>[]): string | null {
  for (const source of sources) {
    const docs = Array.isArray(source.documents) ? source.documents : [];
    for (const item of docs) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const type = String(o.type ?? o.document_type ?? "")
        .trim()
        .toLowerCase();
      if (!/passport|profile_photo|customer_photo/.test(type)) continue;
      const url = readUrl(o.url) ?? readNestedDocUrl(o, "document");
      if (url) return url;
    }
  }
  return null;
}

/** Passport / profile photo URL from customer API metadata when available. */
export function extractPassportPhotoUrl(row: Record<string, unknown> | null | undefined): string | null {
  if (!row) return null;
  const md =
    row.metadata && typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};
  const attachments =
    md.attachments && typeof md.attachments === "object" && md.attachments !== null
      ? (md.attachments as Record<string, unknown>)
      : {};

  const sources = [row, md, attachments];

  return (
    readUrl(row.passport_photo_url) ??
    readUrl(row.passport_photo) ??
    readUrl(row.profile_photo_url) ??
    readUrl(row.customer_photo_url) ??
    readNestedDocUrl(row, "passport_photo_document") ??
    readNestedDocUrl(row, "passport_document") ??
    readUrl(md.passport_photo_url) ??
    readUrl(md.passport_photo) ??
    readUrl(md.profile_photo_url) ??
    readUrl(md.customer_photo_url) ??
    readNestedDocUrl(md, "passport_photo_document") ??
    readUrl(attachments.passport_photo_url) ??
    readUrl(attachments.passport_photo) ??
    readNestedDocUrl(attachments, "passport_photo_document") ??
    readPassportFromDocuments(sources)
  );
}

export function extractPassportPhotoPreviewUrl(
  row: Record<string, unknown> | null | undefined
): string | null {
  if (!row) return null;
  const md =
    row.metadata && typeof row.metadata === "object" && row.metadata !== null
      ? (row.metadata as Record<string, unknown>)
      : {};
  const attachments =
    md.attachments && typeof md.attachments === "object" && md.attachments !== null
      ? (md.attachments as Record<string, unknown>)
      : {};

  const readPreview = (o: Record<string, unknown>) =>
    readUrl(o.passport_photo_preview_url) ??
    readUrl(o.profile_photo_preview_url) ??
    readUrl(o.customer_photo_preview_url);

  const fromDocs = (): string | null => {
    for (const source of [row, md, attachments]) {
      const docs = Array.isArray(source.documents) ? source.documents : [];
      for (const item of docs) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const type = String(o.type ?? o.document_type ?? "")
          .trim()
          .toLowerCase();
        if (!/passport|profile_photo|customer_photo/.test(type)) continue;
        const preview = readUrl(o.preview_url) ?? readUrl(o.signed_url);
        if (preview) return preview;
      }
    }
    return null;
  };

  return readPreview(md) ?? readPreview(attachments) ?? readPreview(row) ?? fromDocs();
}

export type CustomerCollateralRow = {
  applicationNumber: string;
  type: string;
  description: string;
  value: number;
  status: string;
};

export type CustomerGuarantorRow = {
  applicationNumber: string;
  name: string;
  nationalId: string;
  phone: string;
  address: string;
  relationship: string;
  documents: Array<{ name: string; url: string }>;
};

export function extractCollateralFromApplications(applications: LoanApplication[]): CustomerCollateralRow[] {
  return applications
    .filter((a) => a.collateral_type || a.collateral_description || (a.collateral_value ?? 0) > 0)
    .map((a) => ({
      applicationNumber: a.application_number,
      type: a.collateral_type ?? "—",
      description: a.collateral_description ?? "—",
      value: a.collateral_value ?? 0,
      status: a.status,
    }));
}

export function extractGuarantorsFromApplications(applications: LoanApplication[]): CustomerGuarantorRow[] {
  return applications
    .filter((a) => a.guarantor_name?.trim())
    .map((a) => ({
      applicationNumber: a.application_number,
      name: a.guarantor_name ?? "—",
      nationalId: a.guarantor_national_id ?? "—",
      phone: a.guarantor_phone ?? "—",
      address: a.guarantor_address ?? "—",
      relationship: a.guarantor_relationship ?? "—",
      documents: (a.documents ?? [])
        .filter((d) => /guarantor|id|national/i.test(d.type) || /guarantor/i.test(d.name))
        .map((d) => ({ name: d.name, url: d.url })),
    }));
}
