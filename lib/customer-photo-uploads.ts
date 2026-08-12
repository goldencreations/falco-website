import { validateLocationPhoto } from "@/lib/customer-attachments";
import { postCustomerMultipartUpload } from "@/lib/customer-upload-request";

export async function uploadCustomerPassportPhoto(
  customerId: string,
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  const validated = validateLocationPhoto(file);
  if (!validated.ok) return validated;

  return postCustomerMultipartUpload(
    `/api/customers/${encodeURIComponent(customerId)}/passport-photo`,
    [file],
    { name: file.name },
    "Passport photo",
    { fileField: "file" }
  );
}
