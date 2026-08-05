import { formatClientApiError } from "@/lib/application-workflow";
import {
  type CustomerAttachmentFormState,
  validateLocationPhoto,
  validateSupportingDocument,
} from "@/lib/customer-attachments";
import {
  CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_SUPPORTING_DOCUMENT_TYPE,
} from "@/lib/customer-document-types";

export const CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE_CLIENT =
  CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE;
export const CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE_CLIENT =
  CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE;

/** Re-export for callers that imported these from this module. */
export {
  CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE,
};

async function uploadCustomerFiles(
  customerId: string,
  type: string,
  files: File[],
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (files.length === 0) return { ok: true };

  const form = new FormData();
  form.append("type", type);
  form.append("name", files[0].name);
  for (const file of files) {
    form.append("files[]", file, file.name);
  }

  const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/documents`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: formatClientApiError(data, `${label} upload failed (${res.status})`),
    };
  }
  return { ok: true };
}

export function customerAttachmentFormHasLocationPhotos(
  attachments: Pick<CustomerAttachmentFormState, "home_location_photos" | "business_location_photos">
): boolean {
  return (
    attachments.home_location_photos.length > 0 ||
    attachments.business_location_photos.length > 0
  );
}

export function customerAttachmentFormHasSupportingDocuments(
  attachments: Pick<CustomerAttachmentFormState, "supporting_documents">
): boolean {
  return attachments.supporting_documents.length > 0;
}

/** Upload home and business location photos via POST /customers/{id}/documents (`files[]`). */
export async function uploadCustomerLocationPhotos(
  customerId: string,
  attachments: Pick<CustomerAttachmentFormState, "home_location_photos" | "business_location_photos">
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (attachments.home_location_photos.length > 0) {
    for (const file of attachments.home_location_photos) {
      const validated = validateLocationPhoto(file);
      if (!validated.ok) return validated;
    }
    const result = await uploadCustomerFiles(
      customerId,
      CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE,
      attachments.home_location_photos,
      "Home location photos"
    );
    if (!result.ok) return result;
  }

  if (attachments.business_location_photos.length > 0) {
    for (const file of attachments.business_location_photos) {
      const validated = validateLocationPhoto(file);
      if (!validated.ok) return validated;
    }
    const result = await uploadCustomerFiles(
      customerId,
      CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE,
      attachments.business_location_photos,
      "Business location photos"
    );
    if (!result.ok) return result;
  }

  return { ok: true };
}

/** Upload supporting documents via POST /customers/{id}/documents. */
export async function uploadCustomerSupportingDocuments(
  customerId: string,
  attachments: Pick<CustomerAttachmentFormState, "supporting_documents">
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (attachments.supporting_documents.length === 0) return { ok: true };

  for (const file of attachments.supporting_documents) {
    const validated = validateSupportingDocument(file);
    if (!validated.ok) return validated;
  }

  return uploadCustomerFiles(
    customerId,
    CUSTOMER_SUPPORTING_DOCUMENT_TYPE,
    attachments.supporting_documents,
    "Supporting documents"
  );
}
