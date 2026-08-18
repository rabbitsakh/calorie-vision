import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { backfillMealImages } from "@/lib/backfill-meal-images";
import { requireDateKey } from "@/lib/dates";

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const body = (await request.json().catch(() => ({}))) as { date?: string };
    const date = body.date ? requireDateKey(body.date) : null;

    const result = await backfillMealImages({
      userId: session.user.id,
      ...(date ? { date } : {}),
      limit: 25,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось подобрать изображения" },
      { status: 500 },
    );
  }
}
