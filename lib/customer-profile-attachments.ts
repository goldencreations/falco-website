import type { ApplicationViewRow } from "@/lib/application-adapters";
import {
  dedupeCollateralRows,
  dedupeGuarantorRows,
  filterDocumentsForDetailPanel,
  shouldShowGuarantorLegacyDocument,
} from "@/lib/application-detail-display";
import {
  extractCustomerAttachmentsFromRow,
  hasCustomerAttachmentData,
  type CustomerAttachmentDisplay,
} from "@/lib/customer-attachments";
import {
  extractPassportPhotoPreviewUrl,
  extractPassportPhotoUrl,
} from "@/lib/customer-profile-extras";
import type { CollateralRow, GuarantorRow } from "@/lib/application-adapters";
import type { LoanDocument } from "@/lib/types";

export type CustomerApplicationAttachments = {
  applicationId: string;
  applicationNumber: string;
  productName?: string;
  collaterals: CollateralRow[];
  guarantors: GuarantorRow[];
  documents: LoanDocument[];
};

export type CustomerProfileAttachments = CustomerAttachmentDisplay & {
  passportPhotoUrl: string | null;
  passportPhotoPreviewUrl: string | null;
  applicationAttachments: CustomerApplicationAttachments[];
};

function applicationHasAttachmentFiles(section: CustomerApplicationAttachments): boolean {
  if (section.documents.some((d) => d.url || d.preview_url)) return true;
  if (section.collaterals.some((c) => c.image_url || c.image_preview_url)) return true;
  return section.guarantors.some(
    (g) =>
      g.id_front_url ||
      g.id_back_url ||
      g.id_front_preview_url ||
      g.id_back_preview_url ||
      (shouldShowGuarantorLegacyDocument(g) && g.document_url)
  );
}

export function buildCustomerProfileAttachments(
  sourceRow: Record<string, unknown> | null | undefined,
  applications: ApplicationViewRow[]
): CustomerProfileAttachments {
  const profile = extractCustomerAttachmentsFromRow(sourceRow);
  const applicationAttachments: CustomerApplicationAttachments[] = [];

  for (const app of applications) {
    const collaterals = dedupeCollateralRows(app.collaterals ?? []);
    const guarantors = dedupeGuarantorRows(app.guarantors ?? []);
    let documents = filterDocumentsForDetailPanel(app.documents ?? [], collaterals, guarantors);
    if (!documents.some((d) => d.url?.trim() || d.preview_url?.trim())) {
      documents = (app.documents ?? []).filter((d) => d.url?.trim() || d.preview_url?.trim());
    }

    const section: CustomerApplicationAttachments = {
      applicationId: app.id,
      applicationNumber: app.application_number,
      productName: app.productName,
      collaterals,
      guarantors,
      documents,
    };

    if (applicationHasAttachmentFiles(section)) {
      applicationAttachments.push(section);
    }
  }

  return {
    ...profile,
    passportPhotoUrl: extractPassportPhotoUrl(sourceRow),
    passportPhotoPreviewUrl: extractPassportPhotoPreviewUrl(sourceRow),
    applicationAttachments,
  };
}

export function hasCustomerProfileAttachmentData(display: CustomerProfileAttachments): boolean {
  if (display.passportPhotoUrl) return true;
  if (hasCustomerAttachmentData(display)) return true;
  return display.applicationAttachments.length > 0;
}
