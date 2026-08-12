import { PHOTO_COMPRESS_TARGET_BYTES, PHOTO_MAX_BYTES } from "@/lib/upload-limits";

const MAX_EDGE = 1920;

function isCompressibleImage(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/png" || type === "image/webp") {
    return true;
  }
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(name);
}

async function loadImageBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not compress image"));
      },
      "image/jpeg",
      quality
    );
  });
}

function jpegFileName(name: string): string {
  return name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg";
}

/**
 * Shrink large phone photos to JPEG before upload so they stay under the PHP POST ceiling.
 * Non-images and tiny files are returned unchanged.
 */
export async function compressImageFile(
  file: File,
  targetBytes = PHOTO_COMPRESS_TARGET_BYTES
): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!isCompressibleImage(file)) return file;
  if (file.size <= targetBytes && file.size <= PHOTO_MAX_BYTES / 4) return file;

  try {
    const source = await loadImageBitmap(file);
    const width = "width" in source ? source.width : 0;
    const height = "height" in source ? source.height : 0;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if ("close" in source && typeof source.close === "function") source.close();

    let quality = 0.82;
    let blob = await canvasToJpegBlob(canvas, quality);
    while (blob.size > targetBytes && quality > 0.5) {
      quality -= 0.12;
      blob = await canvasToJpegBlob(canvas, quality);
    }

    if (blob.size >= file.size) return file;
    return new File([blob], jpegFileName(file.name), { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function compressImageFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    out.push(await compressImageFile(file));
  }
  return out;
}
