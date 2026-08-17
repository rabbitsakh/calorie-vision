import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "public/uploads";

function getUploadDirectory(): string {
  return path.join(process.cwd(), UPLOAD_DIR);
}

export async function saveUploadedImage(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(file.name) || ".jpg";
  const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase())
    ? ext.toLowerCase()
    : ".jpg";

  const uploadPath = getUploadDirectory();
  await fs.mkdir(uploadPath, { recursive: true });

  const id = randomUUID();
  const filename = `${id}${safeExt}`;
  await fs.writeFile(path.join(uploadPath, filename), buffer);

  return `/api/uploads/${id}`;
}

export async function readUploadedImageById(id: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const uploadPath = getUploadDirectory();
  const files = await fs.readdir(uploadPath);
  const match = files.find((file) => file.startsWith(`${id}.`));

  if (!match) {
    throw new Error("Image not found");
  }

  const ext = path.extname(match).toLowerCase();
  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
          ? "image/gif"
          : "image/jpeg";

  const buffer = await fs.readFile(path.join(uploadPath, match));
  return { buffer, mimeType };
}

export function resolveLegacyImageId(imagePath: string): string | null {
  const apiMatch = imagePath.match(/\/api\/uploads\/([^/?]+)/);
  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  const uploadsMatch = imagePath.match(/\/uploads\/([^/?]+)/);
  if (uploadsMatch?.[1]) {
    return uploadsMatch[1].replace(/\.[^.]+$/, "");
  }

  return null;
}
