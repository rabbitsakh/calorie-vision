import { getImageUrl } from "@/lib/paths";

/**
 * Prefer saved upload URL — blob previews often fail on iOS PWA.
 * When an upload path exists it always wins (including on iOS).
 */
export function resolveConfirmHeroSrc(imagePath: string, previewUrl?: string): string {
  const persisted = imagePath.trim();
  if (persisted) {
    // Upload URL first — never let a blob preview override on iOS or elsewhere.
    return getImageUrl(persisted);
  }
  const preview = previewUrl?.trim() ?? "";
  if (!preview) return "";
  // Blob is only an interim fallback until the upload path arrives.
  return preview;
}
