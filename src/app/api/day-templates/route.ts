import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import type { DayTemplateMeal } from "@/lib/day-templates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Payload = { meals: DayTemplateMeal[] };

function isMeal(value: unknown): value is DayTemplateMeal {
  if (!value || typeof value !== "object") return false;
  const meal = value as DayTemplateMeal;
  return typeof meal.dishName === "string" && typeof meal.calories === "number";
}

function normalizeMeals(raw: unknown): DayTemplateMeal[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isMeal).map((m) => ({
    dishName: m.dishName.trim(),
    calories: Math.round(m.calories),
    protein: m.protein ?? null,
    fat: m.fat ?? null,
    carbs: m.carbs ?? null,
    fiber: m.fiber ?? null,
    sugar: m.sugar ?? null,
    portionGrams: m.portionGrams ?? null,
    mealType: m.mealType ?? null,
  }));
}

function parsePayload(raw: unknown): Payload {
  if (!raw || typeof raw !== "object") return { meals: [] };
  const obj = raw as { meals?: unknown };
  return { meals: normalizeMeals(obj.meals) };
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const rows = await prisma.dayTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const templates = rows.map((row) => {
      const payload = parsePayload(row.payload);
      return {
        id: row.id,
        name: row.name,
        meals: payload.meals,
        createdAt: row.createdAt.toISOString(),
        synced: true as const,
      };
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить шаблоны" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { name?: string; meals?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const meals = normalizeMeals(body.meals);
    if (!name) {
      return NextResponse.json({ error: "Укажите название шаблона" }, { status: 400 });
    }
    if (meals.length === 0) {
      return NextResponse.json({ error: "В шаблоне нет блюд" }, { status: 400 });
    }

    const row = await prisma.dayTemplate.create({
      data: {
        userId: session.user.id,
        name: name.slice(0, 120),
        payload: { meals },
      },
    });

    return NextResponse.json({
      template: {
        id: row.id,
        name: row.name,
        meals,
        createdAt: row.createdAt.toISOString(),
        synced: true,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось сохранить шаблон" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { id?: string };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Не указан шаблон" }, { status: 400 });
    }

    await prisma.dayTemplate.deleteMany({
      where: { id, userId: session.user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось удалить шаблон" }, { status: 500 });
  }
}
