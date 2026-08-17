import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { lookupFoodByName } from "@/lib/food-recognition";

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json()) as { dishName?: string };
    const dishName = body.dishName?.trim();

    if (!dishName) {
      return NextResponse.json({ error: "Укажите название блюда" }, { status: 400 });
    }

    const recognition = await lookupFoodByName(dishName);
    return NextResponse.json({ recognition });
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
