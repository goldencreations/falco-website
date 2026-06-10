import type { CollateralRow, GuarantorRow } from "@/lib/application-adapters";
import { documentTypeFromRow } from "@/lib/application-documents";
import type { LoanDocument } from "@/lib/types";

/** Compare URLs ignoring query params (signed URLs differ only by token). */
export function normalizeUrlKey(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return trimmed.split("?")[0].split("#")[0];
  }
}

function collectLinkedMediaUrlKeys(collaterals: CollateralRow[], guarantors: GuarantorRow[]): Set<string> {
  const keys = new Set<string>();
  for (const col of collaterals) {
    for (const u of [col.image_url, col.image_preview_url]) {
      if (u?.trim()) keys.add(normalizeUrlKey(u));
    }
  }
  for (const g of guarantors) {
    for (const u of [
      g.id_front_url,
      g.id_front_preview_url,
      g.id_back_url,
      g.id_back_preview_url,
      g.document_url,
    ]) {
      if (u?.trim()) keys.add(normalizeUrlKey(u));
    }
  }
  return keys;
}

function isCollateralDocumentType(type: string): boolean {
  return /collateral/i.test(type);
}

function isGuarantorDocumentType(type: string): boolean {
  return (
    /guarantor/i.test(type) ||
    /guarantor_id/i.test(type) ||
    /id_front/i.test(type) ||
    /id_back/i.test(type)
  );
}

function documentMatchesLinkedMedia(doc: LoanDocument, linkedKeys: Set<string>): boolean {
  for (const u of [doc.url, doc.preview_url]) {
    if (u?.trim() && linkedKeys.has(normalizeUrlKey(u))) return true;
  }
  return false;
}

/** Remove documents already shown under Collateral / Guarantors (same file or linked type). */
export function filterDocumentsForDetailPanel(
  documents: LoanDocument[],
  collaterals: CollateralRow[],
  guarantors: GuarantorRow[]
): LoanDocument[] {
  const linkedKeys = collectLinkedMediaUrlKeys(collaterals, guarantors);
  const hasCollaterals = collaterals.length > 0;
  const hasGuarantors = guarantors.length > 0;

  const seen = new Set<string>();

  return documents.filter((doc) => {
    const type = documentTypeFromRow(doc);
    if (hasCollaterals && isCollateralDocumentType(type)) return false;
    if (hasGuarantors && isGuarantorDocumentType(type)) return false;
    if (documentMatchesLinkedMedia(doc, linkedKeys)) return false;

    const dedupeKey = doc.id || `${type}|${normalizeUrlKey(doc.url || doc.preview_url || doc.name)}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
}

export function dedupeCollateralRows(rows: CollateralRow[]): CollateralRow[] {
  const byKey = new Map<string, CollateralRow>();
  for (const row of rows) {
    const key = row.id ?? `${row.type.toLowerCase()}|${(row.description ?? "").toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingHasImage = Boolean(existing.image_url || existing.image_preview_url);
    const rowHasImage = Boolean(row.image_url || row.image_preview_url);
    if (!existingHasImage && rowHasImage) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

export function dedupeGuarantorRows(rows: GuarantorRow[]): GuarantorRow[] {
  const byKey = new Map<string, GuarantorRow>();
  for (const row of rows) {
    const key = row.id ?? `${row.full_name.toLowerCase()}|${row.phone ?? ""}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

/** Legacy single URL only when structured ID front/back are not already shown. */
export function shouldShowGuarantorLegacyDocument(g: GuarantorRow): boolean {
  if (!g.document_url?.trim()) return false;
  if (g.id_front_url || g.id_back_url || g.id_front_preview_url || g.id_back_preview_url) {
    return false;
  }
  return true;
}
