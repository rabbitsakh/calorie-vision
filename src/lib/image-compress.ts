import sharp from "sharp";

export const FOOD_IMAGE_MAX_EDGE = 480;
export const FOOD_IMAGE_WEBP_QUALITY = 52;
export const FOOD_IMAGE_MAX_BYTES = 24_000;
export const FOOD_IMAGE_KEEP_ORIGINAL_BYTES = 12_000;

async function encodeWebp(buffer: Buffer, quality: number): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(FOOD_IMAGE_MAX_EDGE, FOOD_IMAGE_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality,
      effort: 6,
      smartSubsample: true,
    })
    .toBuffer();
}

export async function compressFoodImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  if (!buffer.length) {
    return { buffer, mimeType: "image/jpeg" };
  }

  try {
    const metadata = await sharp(buffer, { failOn: "none", animated: true }).metadata();

    if (metadata.format === "gif" && (metadata.pages ?? 1) > 1) {
      return { buffer, mimeType: "image/gif" };
    }

    let compressed = await encodeWebp(buffer, FOOD_IMAGE_WEBP_QUALITY);
    if (!compressed.length) {
      return { buffer, mimeType: "image/jpeg" };
    }

    if (compressed.length > FOOD_IMAGE_MAX_BYTES) {
      const smaller = await encodeWebp(buffer, 38);
      if (smaller.length && smaller.length < compressed.length) {
        compressed = smaller;
      }
    }

    const alreadyTiny = buffer.length <= FOOD_IMAGE_KEEP_ORIGINAL_BYTES;
    const didNotShrink = compressed.length >= buffer.length;
    if (alreadyTiny && didNotShrink) {
      const mimeType =
        metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : "image/jpeg";
      return { buffer, mimeType };
    }

    return { buffer: compressed, mimeType: "image/webp" };
  } catch {
    return { buffer, mimeType: "image/jpeg" };
  }
}
