/** Backend PHP `upload_max_filesize` (50M). */
export const PHOTO_MAX_BYTES = 50 * 1024 * 1024;
/** Same ceiling as photos — documents share the PHP upload limit. */
export const DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
/** Backend PHP `post_max_size` is 55M; leave headroom for multipart fields. */
export const POST_MAX_BYTES = 52 * 1024 * 1024;
/** Phone camera JPEGs above this get a pre-upload warning (they will be compressed). */
export const PHOTO_WARN_BYTES = 8 * 1024 * 1024;
/** Target size after client-side JPEG compression. */
export const PHOTO_COMPRESS_TARGET_BYTES = 1.5 * 1024 * 1024;

export const FILE_TOO_LARGE_MESSAGE = "File too large. Please upload a smaller image.";
export const UPLOAD_SERVER_ERROR_MESSAGE =
  "The server could not save this file. The customer record was kept — you can retry the upload.";

export function formatFileSizeMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
  return `${rounded}MB`;
}

export const PHOTO_MAX_LABEL = formatFileSizeMb(PHOTO_MAX_BYTES);
export const DOCUMENT_MAX_LABEL = formatFileSizeMb(DOCUMENT_MAX_BYTES);

export const PHOTO_ACCEPT_HINT = `JPG, JPEG, PNG, or WEBP — max ${PHOTO_MAX_LABEL} each. Large phone photos are compressed before upload.`;
export const DOCUMENT_ACCEPT_HINT = `PDF, JPG, JPEG, or PNG — max ${DOCUMENT_MAX_LABEL} each.`;

export function totalFileBytes(files: File[]): number {
  return files.reduce((sum, file) => sum + (file.size || 0), 0);
}

export function validateCombinedUploadSize(
  files: File[]
): { ok: true } | { ok: false; error: string } {
  const total = totalFileBytes(files);
  if (total <= POST_MAX_BYTES) return { ok: true };
  return {
    ok: false,
    error: `These files together are ${formatFileSizeMb(total)} (limit ${formatFileSizeMb(POST_MAX_BYTES)} per upload). Remove some files or use smaller images.`,
  };
}

export function largePhotoWarning(file: File): string | null {
  if (!file.type.startsWith("image/")) return null;
  if (file.size < PHOTO_WARN_BYTES) return null;
  return `${file.name} is ${formatFileSizeMb(file.size)}. Large phone photos will be compressed before upload.`;
}

export function formatUploadHttpError(
  status: number,
  json: unknown,
  fallback: string
): string {
  if (status === 413) return FILE_TOO_LARGE_MESSAGE;
  if (status >= 500) return UPLOAD_SERVER_ERROR_MESSAGE;
  if (!json || typeof json !== "object") return fallback;
  const o = json as Record<string, unknown>;
  const err = o.error && typeof o.error === "object" ? (o.error as Record<string, unknown>) : o;
  const message =
    typeof err.message === "string"
      ? err.message
      : typeof o.message === "string"
        ? o.message
        : fallback;
  if (/payload too large|entity too large|file too large|post too large/i.test(message)) {
    return FILE_TOO_LARGE_MESSAGE;
  }
  return message || fallback;
}

/** Split files so each batch stays under the PHP POST ceiling. */
export function batchFilesForPostLimit(files: File[]): File[][] {
  const batches: File[][] = [];
  let current: File[] = [];
  let currentBytes = 0;
  for (const file of files) {
    if (file.size > POST_MAX_BYTES) {
      if (current.length) batches.push(current);
      batches.push([file]);
      current = [];
      currentBytes = 0;
      continue;
    }
    if (current.length > 0 && currentBytes + file.size > POST_MAX_BYTES) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += file.size;
  }
  if (current.length) batches.push(current);
  return batches;
}
