import { validateLocationPhoto } from "@/lib/customer-attachments";
import { formatClientApiError } from "@/lib/application-workflow";

export async function uploadCustomerPassportPhoto(
  customerId: string,
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateLocationPhoto(file);
  if (!validated.ok) return validated;

  const form = new FormData();
  form.append("file", file, file.name);
  form.append("name", file.name);

  const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/passport-photo`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: formatClientApiError(data, `Passport photo upload failed (${res.status})`),
    };
  }
  return { ok: true };
}
