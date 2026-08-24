import { NextRequest, NextResponse } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { getImageDimensions } from "@/lib/ai/image-utils";
import { requireSession } from "@/lib/auth-session";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { loadLowConfidenceThresholdFromDb } from "@/lib/recognition-threshold-store";
import { prepareRecognizeUpload, parseRecognitionContext } from "@/lib/recognize-upload";
import { saveImageBuffer } from "@/lib/upload";

const RECOGNIZE_RATE_LIMIT = 12;
const RECOGNIZE_RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    await loadLowConfidenceThresholdFromDb();

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
    const prepared = await prepareRecognizeUpload(formData);
    if (!prepared.ok) {
      return NextResponse.json({ error: prepared.error }, { status: prepared.status });
    }

    const { compressed, visionFilename, barcodeHint, context } = prepared.data;
    const recognitionContext =
      context ?? parseRecognitionContext(request.nextUrl.searchParams.get("context"));
    const dimensions = await getImageDimensions(compressed.buffer);
    const visionHints = {
      barcodeHint: barcodeHint || undefined,
      aspectRatio:
        dimensions && dimensions.height > 0 ? dimensions.width / dimensions.height : undefined,
      context: recognitionContext,
    };

    const [imagePath, recognition] = await Promise.all([
      saveImageBuffer(compressed.buffer, compressed.mimeType, {
        ownerUserId: session.user.id,
      }),
      recognizeFoodWithAI(compressed.buffer, visionFilename, session.user.id, {
        barcode: barcodeHint || undefined,
        visionHints,
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
