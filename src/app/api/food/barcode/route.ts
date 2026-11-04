import { NextRequest, NextResponse } from "next/server";
import { lookupBarcodeCatalogLive } from "@/lib/barcode-catalog-live";
import { barcodeProductToRecognition } from "@/lib/barcode-catalog";
import { lookupFoodByBarcode } from "@/lib/food-recognition";
import { requireSession } from "@/lib/auth-session";
import { trackBarcodeScanned } from "@/lib/funnel-analytics";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { cacheRemoteImage } from "@/lib/upload";

const LOOKUP_RATE_LIMIT = 30;
const LOOKUP_RATE_WINDOW_MS = 60_000;

const BARCODE_OFFLINE_ERROR =
  "Нет связи с базой продуктов. Проверьте интернет и повторите.";

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const rate = await checkRateLimitAsync(
      `barcode-lookup:${session.user.id}`,
      LOOKUP_RATE_LIMIT,
      LOOKUP_RATE_WINDOW_MS,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Слишком много запросов. Подождите ${rate.retryAfterSec} сек.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = (await request.json().catch(() => null)) as { barcode?: unknown } | null;
    const raw = typeof body?.barcode === "string" ? body.barcode : "";
    const catalog = await lookupBarcodeCatalogLive(raw);

    if (catalog.status === "invalid") {
      return NextResponse.json(
        { status: "invalid", error: "Укажите корректный штрихкод (8, 12 или 13 цифр)" },
        { status: 400 },
      );
    }

    if (catalog.status === "offline") {
      return NextResponse.json(
        { status: "offline", error: BARCODE_OFFLINE_ERROR },
        { status: 503 },
      );
    }

    if (catalog.status === "not_found") {
      try {
        const recognition = await lookupFoodByBarcode(raw, session.user.id);
        trackBarcodeScanned(session.user.id, "found");
        return NextResponse.json({
          status: "found",
          recognition,
          imagePath: "",
          source: recognition.source ?? "gigachat-barcode",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Продукт не найден по штрихкоду";
        if (/нет связи/i.test(message)) {
          return NextResponse.json({ status: "offline", error: BARCODE_OFFLINE_ERROR }, { status: 503 });
        }
        trackBarcodeScanned(session.user.id, "not_found");
        return NextResponse.json(
          {
            status: "not_found",
            barcode: raw.replace(/\D/g, ""),
            error: message,
            source: "gigachat-barcode",
          },
          { status: 404 },
        );
      }
    }

    trackBarcodeScanned(session.user.id, "found");
    const recognition = barcodeProductToRecognition(catalog.product);
    let imagePath = "";
    try {
      imagePath =
        (await cacheRemoteImage(recognition.imageUrl, {
          ownerUserId: session.user.id,
          allowWebProduct: true,
        })) ?? "";
    } catch (error) {
      console.warn("barcode image cache failed", error);
    }

    return NextResponse.json({ status: "found", recognition, imagePath });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { status: "offline", error: BARCODE_OFFLINE_ERROR },
      { status: 503 },
    );
  }
}
