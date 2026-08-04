import { formatClientApiError } from "@/lib/application-workflow";
import { validateDocumentFile } from "@/lib/application-documents";
import { validateLocationPhoto, validateSupportingDocument } from "@/lib/customer-attachments";
import {
  resolveCustomerGuarantorIdForFormRow,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";
import {
  CUSTOMER_GUARANTOR_COLLATERAL_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_PASSPORT_PHOTO_DOCUMENT_TYPE,
  CUSTOMER_GUARANTOR_PHOTO_DOCUMENT_TYPE,
} from "@/lib/customer-document-types";

async function uploadGuarantorFiles(
  customerId: string,
  guarantorId: string,
  type: string,
  files: File[],
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (files.length === 0) return { ok: true };

  const form = new FormData();
  form.append("type", type);
  form.append("guarantor_id", guarantorId);
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

/**
 * Uploads a single guarantor ID scan via the dedicated per-guarantor endpoint, which — unlike
 * the generic `guarantor_document` batch upload — links the resulting document id back onto the
 * guarantor record as `id_front_document_id`/`id_back_document_id`. Without this link the ID
 * scan has no way to be re-displayed as a preview later (it's just an untagged file in the
 * customer's generic document list).
 */
async function uploadGuarantorIdScan(
  customerId: string,
  guarantorId: string,
  field: "id-front" | "id-back",
  file: File,
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", file.name);

  const res = await fetch(
    `/api/customers/${encodeURIComponent(customerId)}/guarantors/${encodeURIComponent(guarantorId)}/${field}`,
    { method: "POST", credentials: "include", body: form }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: formatClientApiError(data, `${label} upload failed (${res.status})`),
    };
  }
  return { ok: true };
}

function validatePhotoFiles(files: File[]): { ok: true } | { ok: false; error: string } {
  for (const file of files) {
    const check = validateLocationPhoto(file);
    if (!check.ok) return check;
  }
  return { ok: true };
}

function validateDocFiles(files: File[]): { ok: true } | { ok: false; error: string } {
  for (const file of files) {
    const asPhoto = validateLocationPhoto(file);
    if (asPhoto.ok) continue;
    const asDoc = validateDocumentFile(file);
    if (!asDoc.ok) {
      const support = validateSupportingDocument(file);
      if (!support.ok) return { ok: false, error: support.error };
    }
  }
  return { ok: true };
}

/** True when the guarantor row has any pending files to upload. */
export function customerGuarantorRowsWithUploadFiles(
  rows: CustomerGuarantorFormRow[]
): CustomerGuarantorFormRow[] {
  return rows.filter(
    (row) =>
      row.name.trim() &&
      row.phone.trim() &&
      Boolean(
        row.photo ||
          row.photoWithCustomer ||
          row.idFront ||
          row.idBack ||
          row.wardLetter ||
          row.attachments.length > 0 ||
          (row.collateralImages?.length ?? 0) > 0
      )
  );
}

/** @deprecated Use customerGuarantorRowsWithUploadFiles */
export function customerGuarantorRowsWithIdFiles(
  rows: CustomerGuarantorFormRow[]
): CustomerGuarantorFormRow[] {
  return customerGuarantorRowsWithUploadFiles(rows);
}

/**
 * After create/update, upload guarantor media via `POST /customers/{id}/documents`
 * using returned guarantor IDs. Uploads append; they do not replace earlier images.
 */
export async function uploadCustomerGuarantorDocuments(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerGuarantorFormRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guarantorRows = customerGuarantorRowsWithUploadFiles(rows);

  for (let i = 0; i < guarantorRows.length; i++) {
    const row = guarantorRows[i];
    const labelBase = row.name.trim() || `Guarantor ${i + 1}`;
    const guarantorId = resolveCustomerGuarantorIdForFormRow(row, sourceRow, i);
    if (!guarantorId) {
      return {
        ok: false,
        error: `Guarantor upload failed — missing guarantor ID for ${labelBase}. Refresh the customer and try again.`,
      };
    }

    if (row.photo) {
      const check = validatePhotoFiles([row.photo]);
      if (!check.ok) return { ok: false, error: `${labelBase} photo: ${check.error}` };
      const result = await uploadGuarantorFiles(
        customerId,
        guarantorId,
        CUSTOMER_GUARANTOR_PHOTO_DOCUMENT_TYPE,
        [row.photo],
        `${labelBase} photo`
      );
      if (!result.ok) return result;
    }

    if (row.photoWithCustomer) {
      const check = validatePhotoFiles([row.photoWithCustomer]);
      if (!check.ok) return { ok: false, error: `${labelBase} passport photo: ${check.error}` };
      const result = await uploadGuarantorFiles(
        customerId,
        guarantorId,
        CUSTOMER_GUARANTOR_PASSPORT_PHOTO_DOCUMENT_TYPE,
        [row.photoWithCustomer],
        `${labelBase} passport photo`
      );
      if (!result.ok) return result;
    }

    const collateralImages = row.collateralImages ?? [];
    if (collateralImages.length > 0) {
      const check = validatePhotoFiles(collateralImages);
      if (!check.ok) return { ok: false, error: `${labelBase} collateral photo: ${check.error}` };
      const result = await uploadGuarantorFiles(
        customerId,
        guarantorId,
        CUSTOMER_GUARANTOR_COLLATERAL_PHOTO_DOCUMENT_TYPE,
        collateralImages,
        `${labelBase} collateral photos`
      );
      if (!result.ok) return result;
    }

    if (row.idFront) {
      const check = validateDocFiles([row.idFront]);
      if (!check.ok) return { ok: false, error: `${labelBase} ID front: ${check.error}` };
      const result = await uploadGuarantorIdScan(
        customerId,
        guarantorId,
        "id-front",
        row.idFront,
        `${labelBase} ID front`
      );
      if (!result.ok) return result;
    }

    if (row.idBack) {
      const check = validateDocFiles([row.idBack]);
      if (!check.ok) return { ok: false, error: `${labelBase} ID back: ${check.error}` };
      const result = await uploadGuarantorIdScan(
        customerId,
        guarantorId,
        "id-back",
        row.idBack,
        `${labelBase} ID back`
      );
      if (!result.ok) return result;
    }

    const documents: File[] = [];
    if (row.wardLetter) documents.push(row.wardLetter);
    documents.push(...row.attachments);
    if (documents.length > 0) {
      const check = validateDocFiles(documents);
      if (!check.ok) return { ok: false, error: `${labelBase} document: ${check.error}` };
      const result = await uploadGuarantorFiles(
        customerId,
        guarantorId,
        CUSTOMER_GUARANTOR_DOCUMENT_TYPE,
        documents,
        `${labelBase} documents`
      );
      if (!result.ok) return result;
    }
  }

  return { ok: true };
}

/** @deprecated Use uploadCustomerGuarantorDocuments */
export async function uploadCustomerGuarantorIdDocuments(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerGuarantorFormRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  return uploadCustomerGuarantorDocuments(customerId, sourceRow, rows);
}
