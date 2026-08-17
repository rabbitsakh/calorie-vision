import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "public/uploads";

export async function saveUploadedImage(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(file.name) || ".jpg";
  const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext.toLowerCase())
    ? ext.toLowerCase()
    : ".jpg";

  const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
  await fs.mkdir(uploadPath, { recursive: true });

  const filename = `${randomUUID()}${safeExt}`;
  const fullPath = path.join(uploadPath, filename);
  await fs.writeFile(fullPath, buffer);

  return `/${UPLOAD_DIR.replace(/^public\//, "")}/${filename}`;
}

export async function readUploadedImage(relativePath: string): Promise<Buffer> {
  const normalized = relativePath.replace(/^\//, "");
  const fullPath = path.join(process.cwd(), "public", normalized.replace(/^uploads\//, "uploads/"));
  return fs.readFile(fullPath);
}
