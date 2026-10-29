import { NextRequest, NextResponse } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { getImageDimensions } from "@/lib/ai/image-utils";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { loadLowConfidenceThresholdFromDb } from "@/lib/recognition-threshold-store";
import { prepareRecognizeUpload, parseRecognitionContext } from "@/lib/recognize-upload";
import { saveImageBuffer } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Soft trial: 2 photos / day / IP without an account. */
const GUEST_LIMIT = 2;
const GUEST_WINDOW_MS = 24 * 60 * 60_000;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

/**
 * POST multipart photo → recognition JSON (no diary write).
 * For the public «попробуйте без входа» flow on /try.
 */
export async function POST(request: NextRequest) {
  try {
    await loadLowConfidenceThresholdFromDb();

    const ip = clientIp(request);
    const rate = await checkRateLimitAsync(
      `recognize-guest:${ip}`,
      GUEST_LIMIT,
      GUEST_WINDOW_MS,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Без входа доступно ${GUEST_LIMIT} фото в сутки. Войдите, чтобы продолжить.`,
          retryAfterSec: rate.retryAfterSec,
          guestLimit: GUEST_LIMIT,
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
      saveImageBuffer(compressed.buffer, compressed.mimeType),
      recognizeFoodWithAI(compressed.buffer, visionFilename, null, {
        barcode: barcodeHint || undefined,
        visionHints,
      }),
    ]);

    return NextResponse.json({
      imagePath,
      recognition,
      guestLimit: GUEST_LIMIT,
    });
  } catch (error) {
    console.error("POST /api/recognize/guest", error);
    const status = isGigaChatApiError(error) ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось распознать фото",
      },
      { status },
    );
  }
}
