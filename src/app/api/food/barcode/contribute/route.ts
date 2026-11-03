import { NextRequest, NextResponse } from "next/server";
import { barcodeProductToRecognition } from "@/lib/barcode-catalog";
import { parseUserBarcodeProduct } from "@/lib/barcode-product";
import { readBarcodeProduct, writeBarcodeProduct } from "@/lib/barcode-product-store";
import { requireSession } from "@/lib/auth-session";
import { checkRateLimitAsync } from "@/lib/rate-limit";

const CONTRIBUTE_RATE_LIMIT = 20;
const CONTRIBUTE_RATE_WINDOW_MS = 60_000;

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const rate = await checkRateLimitAsync(
      `barcode-contribute:${session.user.id}`,
      CONTRIBUTE_RATE_LIMIT,
      CONTRIBUTE_RATE_WINDOW_MS,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Слишком много запросов. Подождите ${rate.retryAfterSec} сек.` },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = parseUserBarcodeProduct(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await readBarcodeProduct(parsed.product.barcode);
    const product = existing ?? parsed.product;
    if (!existing) {
      await writeBarcodeProduct(parsed.product, session.user.id);
    }

    return NextResponse.json({
      status: "found",
      existed: Boolean(existing),
      recognition: barcodeProductToRecognition(product),
      imagePath: "",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось сохранить продукт. Проверьте интернет и повторите." },
      { status: 503 },
    );
  }
}
