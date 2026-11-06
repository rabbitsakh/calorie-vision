import { NextRequest, NextResponse } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { getImageDimensions } from "@/lib/ai/image-utils";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { GUEST_RECOGNIZE_LIMIT } from "@/lib/guest-recognize";
import { gateGuestRecognize } from "@/lib/guest-recognize-gate";
import { loadLowConfidenceThresholdFromDb } from "@/lib/recognition-threshold-store";
import { parseRecognitionContext } from "@/lib/recognize-upload";
import { saveImageBuffer } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Soft trial: 2 photos / day / IP without an account. */
const GUEST_LIMIT = GUEST_RECOGNIZE_LIMIT;

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
  const gate = await gateGuestRecognize(request, clientIp(request));
  if (!gate.ok) {
    const headers: Record<string, string> = {};
    if (gate.status === 429 && gate.retryAfterSec) {
      headers["Retry-After"] = String(gate.retryAfterSec);
    }
    return NextResponse.json(
      {
        error: gate.error,
        ...(gate.retryAfterSec ? { retryAfterSec: gate.retryAfterSec } : {}),
        guestLimit: GUEST_LIMIT,
      },
      { status: gate.status, headers },
    );
  }

  try {
    await loadLowConfidenceThresholdFromDb();

    const { compressed, visionFilename, barcodeHint, context } = gate.prepared;
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
