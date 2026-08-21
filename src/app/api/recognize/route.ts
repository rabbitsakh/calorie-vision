import { NextRequest, NextResponse } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { looksLikeImageBuffer } from "@/lib/ai/image-utils";
import { requireSession } from "@/lib/auth-session";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { compressFoodImage } from "@/lib/image-compress";
import { saveImageBuffer } from "@/lib/upload";

function isUploadBlob(value: FormDataEntryValue | null): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number"
  );
}

function uploadFilename(file: Blob): string {
  if (file instanceof File && file.name.trim()) {
    return file.name;
  }
  const type = file.type?.toLowerCase() ?? "";
  if (type.includes("png")) return "photo.png";
  if (type.includes("webp")) return "photo.webp";
  if (type.includes("heic") || type.includes("heif")) return "photo.heic";
  return "photo.jpg";
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!isUploadBlob(file) || file.size <= 0) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
    }

    const original = Buffer.from(await file.arrayBuffer());
    const mimeOk = Boolean(file.type?.toLowerCase().startsWith("image/"));
    const nameOk = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(uploadFilename(file));
    if (!mimeOk && !nameOk && !looksLikeImageBuffer(original)) {
      return NextResponse.json({ error: "Нужен файл изображения" }, { status: 400 });
    }

    const compressed = await compressFoodImage(original);
    const imagePath = await saveImageBuffer(compressed.buffer, compressed.mimeType);
    const recognition = await recognizeFoodWithAI(
      original,
      uploadFilename(file),
      session.user.id,
    );

    return NextResponse.json({
      imagePath,
      recognition,
    });
  } catch (error) {
    console.error(error);
    const status = isGigaChatApiError(error) ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось распознать фото",
      },
      { status: status === 429 ? 429 : status >= 400 && status < 600 ? status : 500 },
    );
  }
}
