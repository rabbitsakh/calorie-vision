import { looksLikeImageBuffer } from "@/lib/ai/image-utils";
import { compressFoodImage } from "@/lib/image-compress";
import { MAX_UPLOAD_INPUT_BYTES } from "@/lib/upload-limits";

/** FormDataEntryValue is File | string — predicate must narrow to File, not Blob. */
export function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number"
  );
}

export function uploadFilename(file: File): string {
  if (file.name.trim()) {
    return file.name;
  }
  const type = file.type?.toLowerCase() ?? "";
  if (type.includes("png")) return "photo.png";
  if (type.includes("webp")) return "photo.webp";
  if (type.includes("heic") || type.includes("heif")) return "photo.heic";
  return "photo.jpg";
}

export type PreparedRecognizeUpload = {
  compressed: Awaited<ReturnType<typeof compressFoodImage>>;
  visionFilename: string;
  barcodeHint: string;
};

export async function prepareRecognizeUpload(formData: FormData): Promise<
  | { ok: true; data: PreparedRecognizeUpload }
  | { ok: false; error: string; status: number }
> {
  const file = formData.get("photo");

  if (!isUploadFile(file) || file.size <= 0) {
    return { ok: false, error: "Фото не найдено", status: 400 };
  }

  if (file.size > MAX_UPLOAD_INPUT_BYTES) {
    return {
      ok: false,
      error: `Фото слишком большое (макс. ${Math.round(MAX_UPLOAD_INPUT_BYTES / (1024 * 1024))} МБ)`,
      status: 413,
    };
  }

  const original = Buffer.from(await file.arrayBuffer());
  const mimeOk = Boolean(file.type?.toLowerCase().startsWith("image/"));
  const nameOk = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(uploadFilename(file));
  if (!mimeOk && !nameOk && !looksLikeImageBuffer(original)) {
    return { ok: false, error: "Нужен файл изображения", status: 400 };
  }

  const compressed = await compressFoodImage(original);
  const visionFilename =
    compressed.mimeType.includes("webp")
      ? uploadFilename(file).replace(/\.[^.]+$/, ".webp")
      : uploadFilename(file);
  const barcodeField = formData.get("barcode");
  const barcodeHint = typeof barcodeField === "string" ? barcodeField.trim() : "";

  return {
    ok: true,
    data: { compressed, visionFilename, barcodeHint },
  };
}
