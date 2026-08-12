import { compressImageFiles } from "@/lib/compress-image";
import { batchFilesForPostLimit, formatUploadHttpError, validateCombinedUploadSize } from "@/lib/upload-limits";

export async function postCustomerMultipartUpload(
  url: string,
  files: File[],
  fields: Record<string, string>,
  label: string,
  options?: { fileField?: "file" | "files[]" }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (files.length === 0) return { ok: true };

  const prepared = await compressImageFiles(files);
  const batches = batchFilesForPostLimit(prepared);
  const fileField = options?.fileField ?? "files[]";

  for (const batch of batches) {
    const combined = validateCombinedUploadSize(batch);
    if (!combined.ok) return combined;

    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      if (value) form.append(key, value);
    }
    if (!fields.name) form.append("name", batch[0].name);
    for (const file of batch) {
      form.append(fileField, file, file.name);
    }

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: formatUploadHttpError(res.status, data, `${label} upload failed (${res.status})`),
      };
    }
  }

  return { ok: true };
}
