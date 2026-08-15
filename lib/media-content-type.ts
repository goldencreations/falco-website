/** Detect common image formats from magic bytes when upstream Content-Type is wrong. */
export function sniffImageMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }
  return null;
}

export function isGenericBinaryContentType(contentType: string | null | undefined): boolean {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return (
    !type ||
    type === "application/octet-stream" ||
    type === "binary/octet-stream" ||
    type === "application/download" ||
    type === "application/force-download"
  );
}

/** Prefer a sniffed image MIME type when the declared type is missing or generic. */
export function resolveImageContentType(
  declaredType: string | null | undefined,
  bytes: Uint8Array,
  filenameHint?: string | null
): string {
  const declared = (declaredType ?? "").split(";")[0].trim().toLowerCase();
  const sniffed = sniffImageMimeType(bytes);

  // Always trust magic bytes over a wrong/generic declared type.
  if (sniffed) return sniffed;

  if (declared.startsWith("image/") && declared !== "image/heic" && declared !== "image/heif") {
    // Normalize non-standard image/jpg
    if (declared === "image/jpg") return "image/jpeg";
    return declared;
  }

  const name = (filenameHint ?? "").toLowerCase();
  if (/\.jpe?g(?:$|[?#])/i.test(name)) return "image/jpeg";
  if (/\.png(?:$|[?#])/i.test(name)) return "image/png";
  if (/\.webp(?:$|[?#])/i.test(name)) return "image/webp";
  if (/\.gif(?:$|[?#])/i.test(name)) return "image/gif";

  if (declared) return declared;
  return "application/octet-stream";
}
