import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { lookupFoodByBarcode, lookupFoodByName } from "@/lib/food-recognition";
import { normalizeBarcode } from "@/lib/barcode";
import { cacheRemoteImage } from "@/lib/upload";

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as { dishName?: string; barcode?: string };
    const barcode = body.barcode ? normalizeBarcode(body.barcode) : null;
    const dishName = body.dishName?.trim();

    if (barcode) {
      const recognition = await lookupFoodByBarcode(barcode);
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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Не удалось найти данные о блюде",
      },
      { status: 500 },
    );
  }
}
