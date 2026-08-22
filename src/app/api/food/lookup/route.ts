import { NextRequest, NextResponse } from "next/server";
import { isGigaChatApiError } from "@/lib/ai/gigachat-errors";
import { requireSession } from "@/lib/auth-session";
import { lookupFoodByBarcode, lookupFoodByName } from "@/lib/food-recognition";
import { normalizeBarcode } from "@/lib/barcode";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { cacheRemoteImage } from "@/lib/upload";

const LOOKUP_RATE_LIMIT = 30;
const LOOKUP_RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const rate = await checkRateLimitAsync(
      `food-lookup:${session.user.id}`,
      LOOKUP_RATE_LIMIT,
      LOOKUP_RATE_WINDOW_MS,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Слишком много запросов. Подождите ${rate.retryAfterSec} сек.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = (await request.json()) as { dishName?: string; barcode?: string };
    const rawBarcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const barcode = rawBarcode ? normalizeBarcode(rawBarcode) : null;
    const dishName = body.dishName?.trim();

    if (rawBarcode) {
      if (!barcode) {
        return NextResponse.json(
          { error: "Укажите корректный штрихкод (8, 12 или 13 цифр)" },
          { status: 400 },
        );
      }
      const recognition = await lookupFoodByBarcode(barcode, session.user.id);
      const imagePath = await cacheRemoteImage(recognition.imageUrl);
      return NextResponse.json({ recognition, imagePath: imagePath ?? "" });
    }

    if (!dishName) {
      return NextResponse.json({ error: "Укажите название блюда или штрихкод" }, { status: 400 });
    }

    const recognition = await lookupFoodByName(dishName, session.user.id);
    const imagePath = await cacheRemoteImage(recognition.imageUrl);
    return NextResponse.json({ recognition, imagePath: imagePath ?? "" });
  } catch (error) {
    console.error(error);
    const status = isGigaChatApiError(error) ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось найти данные о блюде",
      },
      { status: status === 429 ? 429 : status >= 400 && status < 600 ? status : 500 },
    );
  }
}
