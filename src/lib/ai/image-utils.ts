import sharp from "sharp";

const SHARP_OPTIONS = { failOn: "none" as const, limitInputPixels: 40_000_000 };

/** HEIC/HEIF ftyp brand at bytes 8–12 (ISO BMFF). */
export function isHeicBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const brand = buffer.toString("ascii", 8, 12).toLowerCase();
  return brand === "heic" || brand === "heif" || brand === "mif1" || brand === "msf1";
}

export function looksLikeImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 3) {
    return false;
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return true;
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) {
    return true;
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return true;
  }
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") {
    return true;
  }
  return isHeicBuffer(buffer);
}

export function getImageMimeType(filename: string, buffer: Buffer): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";

  if (isHeicBuffer(buffer)) {
    return "image/heic";
  }

  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }

  return "image/jpeg";
}

export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export async function prepareImageForVision(buffer: Buffer): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  try {
    const prepared = await sharp(buffer, SHARP_OPTIONS)
      .rotate()
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { buffer: prepared, mimeType: "image/jpeg" };
  } catch {
    if (isHeicBuffer(buffer)) {
      throw new Error(
        "Формат HEIC с iPhone не удалось обработать. В Камере включите «Наиболее совместимый» или выберите JPG/PNG.",
      );
    }
    if (!looksLikeImageBuffer(buffer)) {
      throw new Error("Файл не похож на изображение. Выберите другое фото.");
    }
    throw new Error("Не удалось обработать изображение. Попробуйте другое фото или JPG.");
  }
}

/**
 * Higher-resolution prep for nutrition-label reading.
 * Keep text sharper than the default vision pass — do not shrink aggressively.
 */
export async function prepareImageForLabelVision(buffer: Buffer): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  try {
    const prepared = await sharp(buffer, SHARP_OPTIONS)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();

    return { buffer: prepared, mimeType: "image/jpeg" };
  } catch {
    // Fall back to the standard prep path (same user-facing errors).
    return prepareImageForVision(buffer);
  }
}
