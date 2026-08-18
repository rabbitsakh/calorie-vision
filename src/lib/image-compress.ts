import sharp from "sharp";

export const FOOD_IMAGE_MAX_EDGE = 960;
export const FOOD_IMAGE_WEBP_QUALITY = 72;

export async function compressFoodImage(buffer: Buffer): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  if (!buffer.length) {
    return { buffer, mimeType: "image/jpeg" };
  }

  try {
    const image = sharp(buffer, { failOn: "none", animated: true }).rotate();
    const metadata = await image.metadata();

    if (metadata.format === "gif" && (metadata.pages ?? 1) > 1) {
      return { buffer, mimeType: "image/gif" };
    }

    const compressed = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(FOOD_IMAGE_MAX_EDGE, FOOD_IMAGE_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: FOOD_IMAGE_WEBP_QUALITY, effort: 4 })
      .toBuffer();

    if (!compressed.length) {
      return { buffer, mimeType: "image/jpeg" };
    }

    if (compressed.length >= buffer.length && buffer.length <= 40_000) {
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
