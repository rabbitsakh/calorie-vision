import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { decodeHtmlEntities } from "@/lib/html-text";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  name?: string;
  calories?: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

function optionalMacro(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Не указан id" }, { status: 400 });
    }

    const existing = await prisma.customFood.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Продукт не найден" }, { status: 404 });
    }

    const body = (await request.json()) as PatchBody;
    const data: {
      name?: string;
      calories?: number;
      protein?: number | null;
      fat?: number | null;
      carbs?: number | null;
      fiber?: number | null;
      sugar?: number | null;
      portionGrams?: number | null;
    } = {};

    if (body.name !== undefined) {
      const name = decodeHtmlEntities(String(body.name).trim());
      if (!name) {
        return NextResponse.json({ error: "Укажите название" }, { status: 400 });
      }
      data.name = name;
    }

    if (body.calories !== undefined) {
      const calories = Number(body.calories);
      if (!Number.isFinite(calories) || calories <= 0) {
        return NextResponse.json({ error: "Калории должны быть больше 0" }, { status: 400 });
      }
      data.calories = Math.round(calories);
    }

    if (body.protein !== undefined) data.protein = optionalMacro(body.protein) ?? null;
    if (body.fat !== undefined) data.fat = optionalMacro(body.fat) ?? null;
    if (body.carbs !== undefined) data.carbs = optionalMacro(body.carbs) ?? null;
    if (body.fiber !== undefined) data.fiber = optionalMacro(body.fiber) ?? null;
    if (body.sugar !== undefined) data.sugar = optionalMacro(body.sugar) ?? null;

    if (body.portionGrams !== undefined) {
      if (body.portionGrams === null || body.portionGrams === ("" as unknown)) {
        data.portionGrams = null;
      } else {
        const grams = Number(body.portionGrams);
        if (!Number.isFinite(grams) || grams <= 0) {
          return NextResponse.json({ error: "Порция должна быть больше 0 г" }, { status: 400 });
        }
        data.portionGrams = Math.round(grams);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
    }

    const food = await prisma.customFood.update({
      where: { id },
      data,
    });

    return NextResponse.json({ food: { ...food, name: decodeHtmlEntities(food.name) } });
  } catch (error) {
    console.error("PATCH /api/custom-foods/[id]", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
