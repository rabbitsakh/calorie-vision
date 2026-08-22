import { NextRequest } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { getImageDimensions } from "@/lib/ai/image-utils";
import { recognizeWithGigaChat } from "@/lib/ai/gigachat";
import { requireSession } from "@/lib/auth-session";
import { enrichRecognitionAfterVision, lookupFoodByBarcode } from "@/lib/food-recognition";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { prepareRecognizeUpload } from "@/lib/recognize-upload";
import { saveImageBuffer } from "@/lib/upload";

const RECOGNIZE_RATE_LIMIT = 12;
const RECOGNIZE_RATE_WINDOW_MS = 60_000;

function sseEncode(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
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
    return new Response(
      JSON.stringify({
        error: `Слишком много распознаваний. Подождите ${rate.retryAfterSec} сек.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSec),
        },
      },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Некорректный запрос" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prepared = await prepareRecognizeUpload(formData);
  if (!prepared.ok) {
    return new Response(JSON.stringify({ error: prepared.error }), {
      status: prepared.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { compressed, visionFilename, barcodeHint } = prepared.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(sseEncode(event, data));
      };

      try {
        const imagePath = await saveImageBuffer(compressed.buffer, compressed.mimeType);
        send("image", { imagePath });

        if (barcodeHint) {
          try {
            const recognition = await lookupFoodByBarcode(barcodeHint, session.user.id);
            send("done", { imagePath, recognition });
            return;
          } catch {
            // OFF miss — fall through to vision with hint.
          }
        }

        const dimensions = await getImageDimensions(compressed.buffer);
        const visionHints = {
          barcodeHint: barcodeHint || undefined,
          aspectRatio:
            dimensions && dimensions.height > 0
              ? dimensions.width / dimensions.height
              : undefined,
        };

        const vision = await recognizeWithGigaChat(compressed.buffer, visionFilename, {
          hints: visionHints,
        });
        send("vision", { recognition: vision });

        const recognition = await enrichRecognitionAfterVision(vision, session.user.id);
        send("done", { imagePath, recognition });
      } catch (error) {
        console.error(error);
        const message =
          error instanceof Error ? error.message : "Не удалось распознать фото";
        const status = isGigaChatApiError(error) ? error.status : 500;
        send("error", {
          error: message,
          status: status === 429 ? 429 : status >= 400 && status < 600 ? status : 500,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
