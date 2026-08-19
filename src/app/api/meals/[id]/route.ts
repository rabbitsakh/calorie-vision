import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { decodeHtmlEntities } from "@/lib/html-text";
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
      portionGrams?: number | null;
    };

    if (body.dishName !== undefined && !body.dishName.trim()) {
      return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
    }
    if (body.calories !== undefined && (!Number.isFinite(body.calories) || body.calories <= 0)) {
      return NextResponse.json({ error: "Укажите корректную калорийность" }, { status: 400 });
    }

    const updated = await prisma.mealEntry.updateMany({
      where: { id, userId: session.user.id },
      data: {
        ...(body.dishName ? { dishName: decodeHtmlEntities(body.dishName.trim()) } : {}),
        ...(body.calories !== undefined ? { calories: Math.round(body.calories) } : {}),
        ...(body.protein !== undefined ? { protein: body.protein } : {}),
        ...(body.fat !== undefined ? { fat: body.fat } : {}),
        ...(body.carbs !== undefined ? { carbs: body.carbs } : {}),
        ...(body.portionGrams !== undefined ? { portionGrams: body.portionGrams } : {}),
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
