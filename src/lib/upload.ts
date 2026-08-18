import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { isAllowedImageUrl } from "./food-image";
import { compressFoodImage } from "./image-compress";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "public/uploads";

function getUploadDirectory(): string {
  return path.join(process.cwd(), UPLOAD_DIR);
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) {
    return ".png";
  }
  if (mimeType.includes("webp")) {
    return ".webp";
  }
  if (mimeType.includes("gif")) {
    return ".gif";
  }
  return ".jpg";
}

function mimeTypeForExtension(ext: string): string {
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  return "image/jpeg";
}

export async function saveImageBuffer(buffer: Buffer, mimeType = "image/jpeg"): Promise<string> {
  const uploadPath = getUploadDirectory();
  await fs.mkdir(uploadPath, { recursive: true });

  const id = randomUUID();
  const filename = `${id}${extensionForMime(mimeType)}`;
  await fs.writeFile(path.join(uploadPath, filename), buffer);

  return `/api/uploads/${id}`;
}

export async function saveUploadedImage(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const compressed = await compressFoodImage(Buffer.from(bytes));
  return saveImageBuffer(compressed.buffer, compressed.mimeType);
}

export async function readUploadedImageById(id: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const uploadPath = getUploadDirectory();
  const files = await fs.readdir(uploadPath);
  const matches = files.filter((file) => file.startsWith(`${id}.`));
  const match = matches.find((file) => file.toLowerCase().endsWith(".webp")) ?? matches[0];

  if (!match) {
    throw new Error("Image not found");
  }

  const ext = path.extname(match).toLowerCase();
  const buffer = await fs.readFile(path.join(uploadPath, match));
  return { buffer, mimeType: mimeTypeForExtension(ext) };
}

const MAX_REMOTE_IMAGE_BYTES = 2.5 * 1024 * 1024;

export async function saveRemoteImage(url: string): Promise<string | null> {
  if (!isAllowedImageUrl(url)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CalorieVision/1.0 (https://calorievision.ru; food image lookup)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok || !isAllowedImageUrl(response.url)) {
      return null;
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_REMOTE_IMAGE_BYTES) {
      return null;
    }

    const compressed = await compressFoodImage(buffer);
    return saveImageBuffer(compressed.buffer, compressed.mimeType);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function cacheRemoteImage(url: string | undefined): Promise<string | undefined> {
  if (!url) {
    return undefined;
  }

  const saved = await saveRemoteImage(url);
  if (saved) {
    return saved;
  }

  return isAllowedImageUrl(url) ? url : undefined;
}

export async function recompressStoredImages(): Promise<number> {
  const uploadPath = getUploadDirectory();

  let files: string[] = [];
  try {
    files = await fs.readdir(uploadPath);
  } catch {
    return 0;
  }

  let converted = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      continue;
    }

    const fullPath = path.join(uploadPath, file);
    let original: Buffer;
    try {
      original = await fs.readFile(fullPath);
    } catch {
      continue;
    }

    if (ext === ".webp" && original.length <= 18_000) {
      continue;
    }

    try {
      const compressed = await compressFoodImage(original);
      if (compressed.buffer.length >= original.length && ext === ".webp") {
        continue;
      }

      const id = path.basename(file, ext);
      const nextName = `${id}${extensionForMime(compressed.mimeType)}`;
      const nextPath = path.join(uploadPath, nextName);
      await fs.writeFile(nextPath, compressed.buffer);

      if (nextName !== file) {
        await fs.unlink(fullPath);
      }

      converted += 1;
    } catch (error) {
      console.error("Failed to recompress", file, error);
    }
  }

  return converted;
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
