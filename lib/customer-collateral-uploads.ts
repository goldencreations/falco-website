import { validateLocationPhoto } from "@/lib/customer-attachments";
import { postCustomerMultipartUpload } from "@/lib/customer-upload-request";
import {
  resolveCustomerCollateralIdForFormRow,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";

async function uploadCustomerCollateralImagesBatch(
  customerId: string,
  collateralId: string,
  files: File[],
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (files.length === 0) return { ok: true };

  for (const file of files) {
    const validated = validateLocationPhoto(file);
    if (!validated.ok) return validated;
  }

  return postCustomerMultipartUpload(
    `/api/customers/${encodeURIComponent(customerId)}/documents`,
    files,
    { type: "collateral_image", collateral_id: collateralId, name: files[0].name },
    label
  );
}

/**
 * Upload collateral photos after create/update using returned collateral IDs.
 * Uploads append images; they do not replace earlier images.
 */
export async function uploadCustomerCollateralImages(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerCollateralFormRow[],
  onRowUploaded?: (row: CustomerCollateralFormRow) => void
): Promise<{ ok: true } | { ok: false; error: string }> {
  const collateralRows = rows.filter((row) => row.collateralType.trim());

  for (let i = 0; i < collateralRows.length; i++) {
    const collateralRow = collateralRows[i];
    const files: File[] =
      collateralRow.images.length > 0
        ? collateralRow.images
        : collateralRow.image != null
          ? [collateralRow.image]
          : [];
    if (files.length === 0) continue;

    const collateralId = resolveCustomerCollateralIdForFormRow(collateralRow, sourceRow, i);
    if (!collateralId) {
      return {
        ok: false,
        error: `Collateral image could not be uploaded — missing collateral ID for row ${i + 1}. Refresh the customer and try again.`,
      };
    }

    const label = `Collateral ${collateralRow.collateralType}`;
    const result = await uploadCustomerCollateralImagesBatch(
      customerId,
      collateralId,
      files,
      label
    );
    if (!result.ok) return result;
    onRowUploaded?.(collateralRow);
  }

  return { ok: true };
}
