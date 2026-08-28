import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { decodeHtmlEntities } from "@/lib/html-text";
import { parseEatenAt } from "@/lib/eaten-at";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const { id } = await params;
    const body = (await request.json()) as {
      dishName?: string;
      calories?: number;
      protein?: number | null;
      fat?: number | null;
      carbs?: number | null;
      fiber?: number | null;
      sugar?: number | null;
      portionGrams?: number | null;
      mealType?: string | null;
      eatenAt?: string | null;
    };

    if (body.dishName !== undefined && !body.dishName.trim()) {
      return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
    }
    if (body.calories !== undefined && (!Number.isFinite(body.calories) || body.calories <= 0)) {
      return NextResponse.json({ error: "Укажите корректную калорийность" }, { status: 400 });
    }

    const mealTypes = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"] as const;
    const mealType =
      body.mealType === null || body.mealType === ""
        ? null
        : mealTypes.includes(body.mealType as (typeof mealTypes)[number])
          ? (body.mealType as (typeof mealTypes)[number])
          : undefined;

    const eatenAt = body.eatenAt !== undefined ? parseEatenAt(body.eatenAt) : undefined;
    if (body.eatenAt !== undefined && eatenAt === undefined) {
      return NextResponse.json({ error: "Некорректное время приёма пищи" }, { status: 400 });
    }

    // If only HH:MM was intended via ISO without date, keep as-is (client sends full ISO).
    const updated = await prisma.mealEntry.updateMany({
      where: { id, userId: session.user.id },
      data: {
        ...(body.dishName ? { dishName: decodeHtmlEntities(body.dishName.trim()) } : {}),
        ...(body.calories !== undefined ? { calories: Math.round(body.calories) } : {}),
        ...(body.protein !== undefined ? { protein: body.protein } : {}),
        ...(body.fat !== undefined ? { fat: body.fat } : {}),
        ...(body.carbs !== undefined ? { carbs: body.carbs } : {}),
        ...(body.fiber !== undefined ? { fiber: body.fiber } : {}),
        ...(body.sugar !== undefined ? { sugar: body.sugar } : {}),
        ...(body.portionGrams !== undefined ? { portionGrams: body.portionGrams } : {}),
        ...(mealType !== undefined ? { mealType } : {}),
        ...(eatenAt !== undefined ? { eatenAt } : {}),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось обновить запись" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const { id } = await params;
    const deleted = await prisma.mealEntry.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Не удалось удалить запись" },
      { status: 500 },
    );
  }
}
