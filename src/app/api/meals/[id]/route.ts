import { NextRequest, NextResponse } from "next/server";
import { notFoundMealResponse } from "@/lib/api-auth-guards";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
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
      brand?: string | null;
      lookupMode?: string | null;
      mealType?: string | null;
      eatenAt?: string | null;
      date?: string;
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

    let date: string | undefined;
    if (body.date !== undefined) {
      const parsed = requireDateKey(body.date);
      if (!parsed) {
        return NextResponse.json({ error: "Некорректная дата (YYYY-MM-DD)" }, { status: 400 });
      }
      date = parsed;
    }

    // Scope by session.user.id — foreign ids update 0 rows → same 404 as missing (no IDOR leak).
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
        ...(body.brand !== undefined
          ? { brand: body.brand?.trim().slice(0, 80) || null }
          : {}),
        ...(body.lookupMode !== undefined
          ? { lookupMode: body.lookupMode?.trim().slice(0, 16) || null }
          : {}),
        ...(mealType !== undefined ? { mealType } : {}),
        ...(eatenAt !== undefined ? { eatenAt } : {}),
        ...(date !== undefined ? { date } : {}),
      },
    });

    if (updated.count === 0) {
      const miss = notFoundMealResponse();
      return NextResponse.json({ error: miss.error }, { status: miss.status });
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
    // Same owner filter as PATCH — чужой id → 404, not 403.
    const deleted = await prisma.mealEntry.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (deleted.count === 0) {
      const miss = notFoundMealResponse();
      return NextResponse.json({ error: miss.error }, { status: miss.status });
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
