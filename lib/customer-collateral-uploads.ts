import { validateLocationPhoto } from "@/lib/customer-attachments";
import { formatClientApiError } from "@/lib/application-workflow";
import {
  extractCustomerCollateralIds,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";

async function uploadCustomerCollateralImage(
  customerId: string,
  collateralId: string,
  file: File,
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateLocationPhoto(file);
  if (!validated.ok) return validated;

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", file.name);

  const res = await fetch(
    `/api/customers/${encodeURIComponent(customerId)}/collateral/${encodeURIComponent(collateralId)}/image`,
    {
      method: "POST",
      credentials: "include",
      body: form,
    }
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

/** Upload collateral photos after customer create using IDs from the customer detail row. */
export async function uploadCustomerCollateralImages(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerCollateralFormRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const collateralIds = extractCustomerCollateralIds(sourceRow);
  const collateralRows = rows.filter((row) => row.collateralType.trim());

  for (let i = 0; i < collateralRows.length; i++) {
    const row = collateralRows[i];
    const files: File[] =
      row.images.length > 0
        ? row.images
        : row.image != null
          ? [row.image]
          : [];
    if (files.length === 0) continue;

    const collateralId = collateralIds[i];
    if (!collateralId) {
      return {
        ok: false,
        error: `Collateral image could not be uploaded — missing collateral ID for row ${i + 1}. Refresh the customer and try again.`,
      };
    }

    const label = `Collateral ${row.collateralType}`;
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const result = await uploadCustomerCollateralImage(
        customerId,
        collateralId,
        files[fileIndex],
        `${label} photo ${fileIndex + 1}`
      );
      if (!result.ok) return result;
    }
  }

  return { ok: true };
}
