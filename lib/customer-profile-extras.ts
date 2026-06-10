import type { LoanApplication } from "@/lib/types";

function readUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
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

  return (
    readUrl(md.passport_photo_url) ??
    readUrl(md.passport_photo) ??
    readUrl(md.profile_photo_url) ??
    readUrl(md.customer_photo_url) ??
    readUrl(attachments.passport_photo_url) ??
    readUrl(attachments.passport_photo)
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

  return (
    readUrl(md.passport_photo_preview_url) ??
    readUrl(md.profile_photo_preview_url) ??
    readUrl(attachments.passport_photo_preview_url)
  );
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
