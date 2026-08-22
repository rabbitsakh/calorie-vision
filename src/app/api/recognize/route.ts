import { NextRequest, NextResponse } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { looksLikeImageBuffer } from "@/lib/ai/image-utils";
import { requireSession } from "@/lib/auth-session";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { compressFoodImage } from "@/lib/image-compress";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { saveImageBuffer } from "@/lib/upload";

const RECOGNIZE_RATE_LIMIT = 12;
const RECOGNIZE_RATE_WINDOW_MS = 60_000;

/** FormDataEntryValue is File | string — predicate must narrow to File, not Blob. */
function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number"
  );
}

function uploadFilename(file: File): string {
  if (file.name.trim()) {
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

    const rate = await checkRateLimitAsync(
      `recognize:${session.user.id}`,
      RECOGNIZE_RATE_LIMIT,
      RECOGNIZE_RATE_WINDOW_MS,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Слишком много распознаваний. Подождите ${rate.retryAfterSec} сек.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!isUploadFile(file) || file.size <= 0) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
    }

    const original = Buffer.from(await file.arrayBuffer());
    const mimeOk = Boolean(file.type?.toLowerCase().startsWith("image/"));
    const nameOk = /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(uploadFilename(file));
    if (!mimeOk && !nameOk && !looksLikeImageBuffer(original)) {
      return NextResponse.json({ error: "Нужен файл изображения" }, { status: 400 });
    }

    const compressed = await compressFoodImage(original);
    const visionFilename =
      compressed.mimeType.includes("webp")
        ? uploadFilename(file).replace(/\.[^.]+$/, ".webp")
        : uploadFilename(file);
    const barcodeField = formData.get("barcode");
    const barcodeHint = typeof barcodeField === "string" ? barcodeField.trim() : "";

    const [imagePath, recognition] = await Promise.all([
      saveImageBuffer(compressed.buffer, compressed.mimeType),
      recognizeFoodWithAI(compressed.buffer, visionFilename, session.user.id, {
        barcode: barcodeHint || undefined,
      }),
    ]);

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
