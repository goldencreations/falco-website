import type { ApplicationViewRow, GuarantorRow } from "@/lib/application-adapters";
import { normalizeCollaterals, normalizeGuarantors } from "@/lib/application-adapters";
import { shouldShowGuarantorLegacyDocument } from "@/lib/application-detail-display";
import type { CustomerGuarantorRecord } from "@/lib/customer-guarantors";
import {
  dedupeMediaUrls,
  extractCollateralImageUrlsFromItem,
  readCustomerCollateralArray,
} from "@/lib/customer-collateral";

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

function readPassportPhotoValue(value: unknown): string | null {
  if (typeof value === "string") return readUrl(value);
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return readUrl(d.url ?? d.download_url) ?? readUrl(d.preview_url);
}

function readPassportPhotoPreviewValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return readUrl(d.preview_url ?? d.signed_url) ?? readUrl(d.url ?? d.download_url);
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
    readPassportPhotoValue(row.passport_photo) ??
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
    readPassportPhotoPreviewValue(o.passport_photo) ??
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
  image_url?: string;
  image_preview_url?: string;
  image_urls?: string[];
};

export type CustomerGuarantorDocument = {
  name: string;
  url: string;
  previewUrl?: string | null;
};

export type CustomerGuarantorRow = {
  applicationNumber: string;
  name: string;
  nationalId: string;
  phone: string;
  relationship: string;
  documents: CustomerGuarantorDocument[];
};

function readDocumentField(
  o: Record<string, unknown>,
  key: string
): { url?: string; preview_url?: string } {
  const doc = o[key];
  if (!doc || typeof doc !== "object") return {};
  const d = doc as Record<string, unknown>;
  return {
    url: readUrl(d.url ?? d.download_url) ?? undefined,
    preview_url: readUrl(d.preview_url ?? d.signed_url) ?? undefined,
  };
}

function guarantorDocumentsFromRow(g: GuarantorRow): CustomerGuarantorDocument[] {
  const documents: CustomerGuarantorDocument[] = [];

  if (g.id_front_url || g.id_front_preview_url) {
    documents.push({
      name: "ID front",
      url: g.id_front_url ?? g.id_front_preview_url ?? "",
      previewUrl: g.id_front_preview_url ?? g.id_front_url,
    });
  }
  if (g.id_back_url || g.id_back_preview_url) {
    documents.push({
      name: "ID back",
      url: g.id_back_url ?? g.id_back_preview_url ?? "",
      previewUrl: g.id_back_preview_url ?? g.id_back_url,
    });
  }
  if (shouldShowGuarantorLegacyDocument(g) && g.document_url) {
    documents.push({ name: "ID document", url: g.document_url });
  }

  return documents;
}

function guarantorMatchKey(name: string, phone: string, nationalId?: string): string {
  const n = name.trim().toLowerCase();
  const p = phone.replace(/\D/g, "");
  const id = (nationalId ?? "").trim().toLowerCase();
  return `${n}|${p}|${id}`;
}

function mergeGuarantorDocuments(
  base: CustomerGuarantorRow,
  extra: CustomerGuarantorRow
): CustomerGuarantorRow {
  if (extra.documents.length === 0) return base;

  const seen = new Set(base.documents.map((d) => d.url));
  const documents = [...base.documents];
  for (const doc of extra.documents) {
    if (!doc.url || seen.has(doc.url)) continue;
    documents.push(doc);
    seen.add(doc.url);
  }

  const merged: CustomerGuarantorRow = { ...base, documents };
  if (
    base.applicationNumber === "Customer registration" &&
    extra.applicationNumber !== "Customer registration" &&
    documents.length > 0
  ) {
    merged.applicationNumber = extra.applicationNumber;
  }
  return merged;
}

function readCustomerCollateralArrayFromRow(
  sourceRow: Record<string, unknown> | null | undefined
): unknown[] {
  return readCustomerCollateralArray(sourceRow);
}

function readCustomerNestedArray(
  sourceRow: Record<string, unknown> | null | undefined,
  key: "collaterals" | "guarantors"
): unknown[] {
  if (!sourceRow) return [];
  const md =
    sourceRow.metadata && typeof sourceRow.metadata === "object" && sourceRow.metadata !== null
      ? (sourceRow.metadata as Record<string, unknown>)
      : {};
  const raw = sourceRow[key] ?? md[key];
  return Array.isArray(raw) ? raw : [];
}

function collateralKey(type: string, description: string, value: number): string {
  return `${type.trim().toLowerCase()}|${description.trim().toLowerCase()}|${value}`;
}

function mergeCollateralImages(
  base: CustomerCollateralRow,
  extra: CustomerCollateralRow
): CustomerCollateralRow {
  const imageUrls = [...(base.image_urls ?? []), ...(extra.image_urls ?? [])];
  const uniqueImageUrls = dedupeMediaUrls(imageUrls);
  return {
    ...base,
    image_url: base.image_url || extra.image_url,
    image_preview_url: base.image_preview_url || extra.image_preview_url,
    image_urls: uniqueImageUrls.length > 0 ? uniqueImageUrls : undefined,
  };
}

export function extractCollateralFromApplications(
  applications: ApplicationViewRow[]
): CustomerCollateralRow[] {
  const rows: CustomerCollateralRow[] = [];

  for (const app of applications) {
    const nested = app.collaterals?.filter((c) => c.type?.trim()) ?? [];
    if (nested.length > 0) {
      for (const c of nested) {
        rows.push({
          applicationNumber: app.application_number,
          type: c.type,
          description: c.description ?? "—",
          value: c.estimated_value ?? 0,
          status: app.status,
          image_url: c.image_url,
          image_preview_url: c.image_preview_url,
        });
      }
      continue;
    }

    if (!app.collateral_type && !app.collateral_description && (app.collateral_value ?? 0) <= 0) {
      continue;
    }

    rows.push({
      applicationNumber: app.application_number,
      type: app.collateral_type ?? "—",
      description: app.collateral_description ?? "—",
      value: app.collateral_value ?? 0,
      status: app.status,
    });
  }

  return rows;
}

/** Collateral declared on the customer record (`GET /customers/{id}`). */
export function extractCollateralFromCustomerRow(
  sourceRow: Record<string, unknown> | null | undefined
): CustomerCollateralRow[] {
  const normalized = normalizeCollaterals(readCustomerCollateralArrayFromRow(sourceRow));
  const raw = readCustomerCollateralArrayFromRow(sourceRow);
  return normalized.map((c, i) => {
    const allUrls = extractCollateralImageUrlsFromItem(raw[i]);
    return {
    applicationNumber: "Customer registration",
    type: c.type,
    description: c.description ?? "—",
    value: c.estimated_value ?? 0,
    status: "registered",
    image_url: c.image_url,
    image_preview_url: c.image_preview_url,
    image_urls: allUrls.length > 0 ? allUrls : c.image_url ? [c.image_url] : undefined,
  };
  });
}

/** Customer registration collateral merged with application collateral rows. */
export function buildCustomerCollateralRows(
  sourceRow: Record<string, unknown> | null | undefined,
  applications: ApplicationViewRow[]
): CustomerCollateralRow[] {
  const fromCustomer = extractCollateralFromCustomerRow(sourceRow);
  const fromApps = extractCollateralFromApplications(applications);

  if (fromCustomer.length === 0) return fromApps;
  if (fromApps.length === 0) return fromCustomer;

  const mergedByKey = new Map<string, CustomerCollateralRow>();
  for (const row of fromCustomer) {
    mergedByKey.set(collateralKey(row.type, row.description, row.value), row);
  }
  for (const row of fromApps) {
    const key = collateralKey(row.type, row.description, row.value);
    const existing = mergedByKey.get(key);
    if (existing) {
      mergedByKey.set(key, mergeCollateralImages(existing, row));
      continue;
    }
    mergedByKey.set(key, row);
  }
  return [...mergedByKey.values()];
}

export function extractGuarantorsFromApplications(
  applications: ApplicationViewRow[]
): CustomerGuarantorRow[] {
  const rows: CustomerGuarantorRow[] = [];

  for (const app of applications) {
    const nested = app.guarantors?.filter((g) => g.full_name?.trim()) ?? [];
    if (nested.length > 0) {
      for (const g of nested) {
        rows.push({
          applicationNumber: app.application_number,
          name: g.full_name,
          nationalId: g.national_id ?? "—",
          phone: g.phone ?? "—",
          relationship: g.relationship ?? "—",
          documents: guarantorDocumentsFromRow(g),
        });
      }
      continue;
    }

    if (!app.guarantor_name?.trim()) continue;

    rows.push({
      applicationNumber: app.application_number,
      name: app.guarantor_name ?? "—",
      nationalId: app.guarantor_national_id ?? "—",
      phone: app.guarantor_phone ?? "—",
      relationship: app.guarantor_relationship ?? "—",
      documents: (app.documents ?? [])
        .filter((d) => /guarantor|id|national/i.test(d.type) || /guarantor/i.test(d.name))
        .map((d) => ({
          name: d.name,
          url: d.url ?? d.preview_url ?? "",
          previewUrl: d.preview_url,
        }))
        .filter((d) => d.url),
    });
  }

  return rows;
}

function guarantorRowFromApiItem(
  item: Record<string, unknown>,
  applicationNumber: string
): CustomerGuarantorRow | null {
  const full_name = String(item.full_name ?? item.name ?? "").trim();
  if (!full_name) return null;

  const normalized = normalizeGuarantors([item])[0];
  if (!normalized) return null;

  return {
    applicationNumber,
    name: normalized.full_name,
    nationalId: normalized.national_id ?? "—",
    phone: normalized.phone ?? "—",
    relationship: normalized.relationship ?? "—",
    documents: guarantorDocumentsFromRow(normalized),
  };
}

function extractGuarantorsFromCustomerRow(
  sourceRow: Record<string, unknown> | null | undefined
): CustomerGuarantorRow[] {
  const rows: CustomerGuarantorRow[] = [];
  for (const item of readCustomerNestedArray(sourceRow, "guarantors")) {
    if (!item || typeof item !== "object") continue;
    const row = guarantorRowFromApiItem(item as Record<string, unknown>, "Customer registration");
    if (row) rows.push(row);
  }
  return rows;
}

function extractMetadataGuarantorDocuments(
  sourceRow: Record<string, unknown> | null | undefined,
  registered: CustomerGuarantorRecord
): CustomerGuarantorDocument[] {
  if (!sourceRow) return [];
  const md =
    sourceRow.metadata && typeof sourceRow.metadata === "object" && sourceRow.metadata !== null
      ? (sourceRow.metadata as Record<string, unknown>)
      : {};
  const raw = md.guarantors ?? sourceRow.guarantors;
  if (!Array.isArray(raw)) return [];

  const key = guarantorMatchKey(registered.full_name, registered.phone, registered.national_id);
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const itemKey = guarantorMatchKey(
      String(o.full_name ?? o.name ?? ""),
      String(o.phone ?? o.phone_number ?? ""),
      String(o.national_id ?? o.nationalId ?? "")
    );
    if (itemKey !== key) continue;

    const frontDoc = readDocumentField(o, "id_front_document");
    const backDoc = readDocumentField(o, "id_back_document");
    const normalized = normalizeGuarantors([o])[0];
    const guarantor: GuarantorRow = {
      full_name: registered.full_name,
      id_front_preview_url: normalized?.id_front_preview_url ?? frontDoc.preview_url,
      id_front_url:
        normalized?.id_front_url ??
        frontDoc.url ??
        readUrl(o.id_front_url) ??
        undefined,
      id_back_preview_url: normalized?.id_back_preview_url ?? backDoc.preview_url,
      id_back_url:
        normalized?.id_back_url ??
        backDoc.url ??
        readUrl(o.id_back_url) ??
        undefined,
      document_url:
        normalized?.document_url ??
        readUrl(o.document_url) ??
        readUrl(o.id_document_url) ??
        readUrl(o.national_id_url) ??
        undefined,
    };
    return guarantorDocumentsFromRow(guarantor);
  }

  return [];
}

/** Registration guarantors merged with ID photos from applications and customer metadata. */
export function buildCustomerGuarantorRows(
  registered: CustomerGuarantorRecord[] | undefined,
  applications: ApplicationViewRow[],
  sourceRow?: Record<string, unknown> | null
): CustomerGuarantorRow[] {
  const fromApps = extractGuarantorsFromApplications(applications);
  const fromCustomerApi = extractGuarantorsFromCustomerRow(sourceRow);
  const appsByKey = new Map<string, CustomerGuarantorRow[]>();
  const customerApiByKey = new Map<string, CustomerGuarantorRow>();

  for (const row of fromApps) {
    const key = guarantorMatchKey(
      row.name,
      row.phone,
      row.nationalId === "—" ? "" : row.nationalId
    );
    const list = appsByKey.get(key) ?? [];
    list.push(row);
    appsByKey.set(key, list);
  }

  for (const row of fromCustomerApi) {
    const key = guarantorMatchKey(
      row.name,
      row.phone,
      row.nationalId === "—" ? "" : row.nationalId
    );
    const existing = customerApiByKey.get(key);
    customerApiByKey.set(key, existing ? mergeGuarantorDocuments(existing, row) : row);
  }

  const result: CustomerGuarantorRow[] = [];
  const registeredKeys = new Set<string>();

  for (const g of registered ?? []) {
    const key = guarantorMatchKey(g.full_name, g.phone, g.national_id);
    registeredKeys.add(key);

    let row: CustomerGuarantorRow = {
      applicationNumber: "Customer registration",
      name: g.full_name,
      nationalId: g.national_id ?? "—",
      phone: g.phone,
      relationship: g.relationship,
      documents: extractMetadataGuarantorDocuments(sourceRow, g),
    };

    const fromApi = customerApiByKey.get(key);
    if (fromApi) row = mergeGuarantorDocuments(row, fromApi);

    for (const match of appsByKey.get(key) ?? []) {
      row = mergeGuarantorDocuments(row, match);
    }

    result.push(row);
  }

  for (const row of fromCustomerApi) {
    const key = guarantorMatchKey(
      row.name,
      row.phone,
      row.nationalId === "—" ? "" : row.nationalId
    );
    if (registeredKeys.has(key)) continue;
    let merged = row;
    for (const match of appsByKey.get(key) ?? []) {
      merged = mergeGuarantorDocuments(merged, match);
    }
    result.push(merged);
    registeredKeys.add(key);
  }

  for (const row of fromApps) {
    const key = guarantorMatchKey(
      row.name,
      row.phone,
      row.nationalId === "—" ? "" : row.nationalId
    );
    if (registeredKeys.has(key)) continue;
    result.push(row);
  }

  return result;
}
