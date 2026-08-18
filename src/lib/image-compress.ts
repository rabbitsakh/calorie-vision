import sharp from "sharp";

export const FOOD_IMAGE_MAX_EDGE = 640;
export const FOOD_IMAGE_WEBP_QUALITY = 68;
export const FOOD_IMAGE_MAX_BYTES = 56_000;
export const FOOD_IMAGE_KEEP_ORIGINAL_BYTES = 12_000;

const SHARP_OPTIONS = { failOn: "none" as const, limitInputPixels: 40_000_000 };

async function encodeWebp(buffer: Buffer, quality: number): Promise<Buffer> {
  return sharp(buffer, SHARP_OPTIONS)
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

async function encodeJpeg(buffer: Buffer, quality: number): Promise<Buffer> {
  return sharp(buffer, SHARP_OPTIONS)
    .rotate()
    .resize(FOOD_IMAGE_MAX_EDGE, FOOD_IMAGE_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
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
    const metadata = await sharp(buffer, { ...SHARP_OPTIONS, animated: true }).metadata();

    if (metadata.format === "gif" && (metadata.pages ?? 1) > 1) {
      return { buffer, mimeType: "image/gif" };
    }

    let compressed: Buffer | null = null;
    let mimeType = "image/webp";

    try {
      compressed = await encodeWebp(buffer, FOOD_IMAGE_WEBP_QUALITY);
      if (compressed.length > FOOD_IMAGE_MAX_BYTES) {
        const medium = await encodeWebp(buffer, 54);
        if (medium.length && medium.length < compressed.length) {
          compressed = medium;
        }
      }
      if (compressed.length > FOOD_IMAGE_MAX_BYTES) {
        const smaller = await encodeWebp(buffer, 46);
        if (smaller.length && smaller.length < compressed.length) {
          compressed = smaller;
        }
      }
    } catch {
      compressed = null;
    }

    if (!compressed?.length) {
      compressed = await encodeJpeg(buffer, Math.min(FOOD_IMAGE_WEBP_QUALITY + 6, 80));
      mimeType = "image/jpeg";
    }

    if (!compressed.length) {
      return { buffer, mimeType: "image/jpeg" };
    }

    const alreadyTiny = buffer.length <= FOOD_IMAGE_KEEP_ORIGINAL_BYTES;
    const didNotShrink = compressed.length >= buffer.length;
    if (alreadyTiny && didNotShrink) {
      const originalMime =
        metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : "image/jpeg";
      return { buffer, mimeType: originalMime };
    }

    return { buffer: compressed, mimeType };
  } catch {
    return { buffer, mimeType: "image/jpeg" };
  }
}
