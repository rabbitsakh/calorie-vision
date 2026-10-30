/**
 * Browser-side resize before recognize upload — cuts LTE payloads.
 * Server still compresses with sharp; this is a best-effort front filter.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
/** Skip work for already-small files. */
const SKIP_UNDER_BYTES = 450_000;

export async function compressImageFileForUpload(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.type.includes("gif") || file.type.includes("heic") || file.type.includes("heif")) {
    return file;
  }
  if (file.size > 0 && file.size < SKIP_UNDER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      if (scale >= 0.98 && file.size < SKIP_UNDER_BYTES * 2) {
        return file;
      }
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
      });
      if (!blob || blob.size <= 0) return file;
      // Prefer compressed only when meaningfully smaller.
      if (blob.size >= file.size * 0.92) return file;
      const name = file.name?.replace(/\.\w+$/i, ".jpg") || "photo.jpg";
      return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
