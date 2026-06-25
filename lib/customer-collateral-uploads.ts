import { validateLocationPhoto } from "@/lib/customer-attachments";
import { formatClientApiError } from "@/lib/application-workflow";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import {
  resolveCustomerCollateralIdForFormRow,
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
  form.append("type", "collateral_image");
  form.append("collateral_id", collateralId);
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

/** Upload collateral photos after customer create using IDs from the customer detail row. */
async function fetchCustomerDetailRow(
  customerId: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
    credentials: "include",
  });
  const body = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) return null;
  return extractCustomerDetail(body);
}

/** Upload collateral photos after customer create using IDs from the customer detail row. */
export async function uploadCustomerCollateralImages(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerCollateralFormRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  let detailRow = sourceRow ?? null;
  const collateralRows = rows.filter((row) => row.collateralType.trim());

  for (let i = 0; i < collateralRows.length; i++) {
    const collateralRow = collateralRows[i];
    const files =
      collateralRow.images.length > 0
        ? collateralRow.images
        : collateralRow.image
          ? [collateralRow.image]
          : [];
    if (files.length === 0) continue;

    const label = `Collateral ${collateralRow.collateralType}`;
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const collateralId = resolveCustomerCollateralIdForFormRow(collateralRow, detailRow, i);
      if (!collateralId) {
        return {
          ok: false,
          error: `Collateral image could not be uploaded — missing collateral ID for row ${i + 1}. Refresh the customer and try again.`,
        };
      }
      const result = await uploadCustomerCollateralImage(
        customerId,
        collateralId,
        files[fileIndex],
        `${label} photo ${fileIndex + 1}`
      );
      if (!result.ok) return result;
      // Re-fetch only when collateral id is not yet known (e.g. after create/PATCH replaced rows).
      if (!collateralRow.id) {
        const refreshed = await fetchCustomerDetailRow(customerId);
        if (refreshed) detailRow = refreshed;
      }
    }
  }

  return { ok: true };
}
