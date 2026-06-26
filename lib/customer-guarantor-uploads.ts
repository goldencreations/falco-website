import { formatClientApiError } from "@/lib/application-workflow";
import { validateDocumentFile } from "@/lib/application-documents";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import {
  resolveCustomerGuarantorIdForFormRow,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";

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

async function uploadCustomerGuarantorIdFile(
  customerId: string,
  guarantorId: string,
  side: "id-front" | "id-back",
  file: File,
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateDocumentFile(file);
  if (!validated.ok) return validated;

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", file.name);

  const res = await fetch(
    `/api/customers/${encodeURIComponent(customerId)}/guarantors/${encodeURIComponent(guarantorId)}/${side}`,
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

/** Upload guarantor ID front/back scans after customer create or update. */
export async function uploadCustomerGuarantorIdDocuments(
  customerId: string,
  sourceRow: Record<string, unknown> | null | undefined,
  rows: CustomerGuarantorFormRow[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  let detailRow = sourceRow ?? null;
  const guarantorRows = rows.filter((row) => row.name.trim() && row.phone.trim());

  for (let i = 0; i < guarantorRows.length; i++) {
    const row = guarantorRows[i];
    const labelBase = row.name.trim() || `Guarantor ${i + 1}`;

    const uploadSide = async (side: "id-front" | "id-back", file: File, label: string) => {
      const guarantorId = resolveCustomerGuarantorIdForFormRow(row, detailRow, i);
      if (!guarantorId) {
        return {
          ok: false as const,
          error: `Guarantor ID upload failed — missing guarantor ID for ${labelBase}. Refresh the customer and try again.`,
        };
      }
      const result = await uploadCustomerGuarantorIdFile(customerId, guarantorId, side, file, label);
      if (!result.ok) return result;
      const refreshed = await fetchCustomerDetailRow(customerId);
      if (refreshed) detailRow = refreshed;
      return { ok: true as const };
    };

    if (row.idFront) {
      const result = await uploadSide("id-front", row.idFront, `${labelBase} ID front`);
      if (!result.ok) return result;
    }
    if (row.idBack) {
      const result = await uploadSide("id-back", row.idBack, `${labelBase} ID back`);
      if (!result.ok) return result;
    }
  }

  return { ok: true };
}
