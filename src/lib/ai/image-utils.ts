import sharp from "sharp";

export function getImageMimeType(filename: string, buffer: Buffer): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";

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
    const prepared = await sharp(buffer)
      .rotate()
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { buffer: prepared, mimeType: "image/jpeg" };
  } catch {
    return { buffer, mimeType: getImageMimeType("photo.jpg", buffer) };
  }
}
