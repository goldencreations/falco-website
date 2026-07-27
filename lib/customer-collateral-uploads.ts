import { validateLocationPhoto } from "@/lib/customer-attachments";
import { formatClientApiError } from "@/lib/application-workflow";
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

  const form = new FormData();
  form.append("type", "collateral_image");
  form.append("collateral_id", collateralId);
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
 * Upload collateral photos after create/update using returned collateral IDs.
 * Uploads append images; they do not replace earlier images.
 */
export async function uploadCustomerCollateralImages(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerCollateralFormRow[]
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
  }

  return { ok: true };
}
