import { formatClientApiError } from "@/lib/application-workflow";
import {
  type CustomerAttachmentFormState,
  validateLocationPhoto,
} from "@/lib/customer-attachments";

export const CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE = "home_location_photo";
export const CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE = "business_location_photo";

async function uploadCustomerLocationPhoto(
  customerId: string,
  file: File,
  type: string,
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateLocationPhoto(file);
  if (!validated.ok) return validated;

  const form = new FormData();
  form.append("type", type);
  form.append("file", file, file.name);
  form.append("name", file.name);

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

/** Upload home and business location photos via POST /customers/{id}/documents. */
export async function uploadCustomerLocationPhotos(
  customerId: string,
  attachments: Pick<CustomerAttachmentFormState, "home_location_photos" | "business_location_photos">
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (let i = 0; i < attachments.home_location_photos.length; i++) {
    const file = attachments.home_location_photos[i];
    const result = await uploadCustomerLocationPhoto(
      customerId,
      file,
      CUSTOMER_HOME_LOCATION_PHOTO_DOCUMENT_TYPE,
      `Home location photo ${i + 1}`
    );
    if (!result.ok) return result;
  }

  for (let i = 0; i < attachments.business_location_photos.length; i++) {
    const file = attachments.business_location_photos[i];
    const result = await uploadCustomerLocationPhoto(
      customerId,
      file,
      CUSTOMER_BUSINESS_LOCATION_PHOTO_DOCUMENT_TYPE,
      `Business location photo ${i + 1}`
    );
    if (!result.ok) return result;
  }

  return { ok: true };
}
