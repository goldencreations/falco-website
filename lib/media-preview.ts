/** True when the filename or URL looks like a PDF. */
export function isPdfFilename(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return /\.pdf(?:$|[?#])/i.test(trimmed) || /application\/pdf/i.test(trimmed);
}

/** True when the filename or URL looks like a raster image. */
export function isImageFilename(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return /\.(jpe?g|png|webp|gif|bmp)(?:$|[?#])/i.test(trimmed);
}

export function isPreviewableDocumentFilename(
  name?: string | null,
  url?: string | null
): boolean {
  if (isImageFilename(name) || isImageFilename(url)) return true;
  if (isPdfFilename(name) || isPdfFilename(url)) return true;
  return false;
}

export function isPreviewableUploadFile(file: Pick<File, "name" | "type">): boolean {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/")) return true;
  if (type === "application/pdf") return true;
  return isPreviewableDocumentFilename(file.name);
}
